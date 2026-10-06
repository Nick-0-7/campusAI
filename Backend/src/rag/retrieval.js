const DocumentChunk = require("../models/DocumentChunk");
const Document = require("../models/Document");
const { generateEmbedding, cosineSimilarity } = require("./embeddings");
const BM25Index = require("./bm25");

let cachedBM25 = null;
let lastIndexedTime = 0;
let lastIndexedDocCount = -1;

/**
 * Ensures BM25 index is up to date with active MongoDB document chunks.
 */
const getOrUpdateBM25Index = async (forceRefresh = false) => {
  const activeDocs = await Document.find({ status: "indexed" }).select("_id");
  const activeDocIds = activeDocs.map((d) => d._id);

  if (
    !cachedBM25 ||
    forceRefresh ||
    activeDocs.length !== lastIndexedDocCount ||
    Date.now() - lastIndexedTime > 30000
  ) {
    const chunks = await DocumentChunk.find({ documentId: { $in: activeDocIds } });
    const index = new BM25Index();
    index.buildIndex(chunks);
    cachedBM25 = index;
    lastIndexedTime = Date.now();
    lastIndexedDocCount = activeDocs.length;
  }
  return cachedBM25;
};

const invalidateBM25Cache = () => {
  cachedBM25 = null;
  lastIndexedDocCount = -1;
};

/**
 * Executes hybrid retrieval (Vector + BM25) and re-ranking.
 * @param {string} query - The natural language question.
 * @param {Object} options
 * @param {number} options.topK - Number of candidates to return (default 5).
 * @param {number} options.threshold - Minimum confidence threshold (default 0.35).
 * @param {string} options.department - Optional filter.
 * @param {string} options.category - Optional filter.
 * @returns {Promise<{
 *   chunks: Array<Object>,
 *   maxConfidence: number,
 *   isConfident: boolean,
 *   conflictDetected: boolean,
 *   conflictNote: string | null
 * }>}
 */
const hybridRetrieve = async (query, options = {}) => {
  const topK = options.topK || 5;
  const threshold = options.threshold !== undefined
    ? options.threshold
    : (parseFloat(process.env.CONFIDENCE_THRESHOLD) || 0.35);

  // 1. Fetch active chunks from MongoDB
  const activeDocs = await Document.find({ status: "indexed" }).select("_id currentVersion title");
  const activeDocIds = activeDocs.map((d) => d._id);

  if (activeDocIds.length === 0) {
    return {
      chunks: [],
      maxConfidence: 0,
      isConfident: false,
      conflictDetected: false,
      conflictNote: null,
    };
  }

  const filter = { documentId: { $in: activeDocIds } };
  if (options.department && options.department !== "All") filter.department = options.department;
  if (options.category && options.category !== "All") filter.category = options.category;

  const candidateChunks = await DocumentChunk.find(filter).lean();
  if (candidateChunks.length === 0) {
    return {
      chunks: [],
      maxConfidence: 0,
      isConfident: false,
      conflictDetected: false,
      conflictNote: null,
    };
  }

  // 2. Vector Semantic Retrieval
  const queryEmbedding = await generateEmbedding(query);
  const vectorScores = [];

  for (const chunk of candidateChunks) {
    if (chunk.embedding && chunk.embedding.length > 0) {
      const sim = cosineSimilarity(queryEmbedding, chunk.embedding);
      // Normalize cosine from [-1, 1] to [0, 1]
      const normSim = Math.max(0, (sim + 1) / 2);
      vectorScores.push({ chunk, score: normSim });
    } else {
      vectorScores.push({ chunk, score: 0 });
    }
  }
  vectorScores.sort((a, b) => b.score - a.score);

  // 3. BM25 Keyword Retrieval
  const bm25 = cachedBM25 || (await getOrUpdateBM25Index());
  const bm25Results = bm25.search(query, 50);

  // Normalize BM25 scores to [0, 1]
  const maxBM25 = bm25Results.length > 0 ? bm25Results[0].score : 1;
  const bm25ScoresMap = new Map();
  bm25Results.forEach((r, rank) => {
    const id = r.chunk._id ? r.chunk._id.toString() : r.chunk.id;
    bm25ScoresMap.set(id, {
      rank,
      normScore: maxBM25 > 0 ? r.score / maxBM25 : 0,
    });
  });

  // 4. Reciprocal Rank Fusion (RRF) & Re-ranking
  const kRRF = 60;
  const chunkMap = new Map();

  // Process Vector ranks
  vectorScores.forEach((item, rank) => {
    const id = item.chunk._id.toString();
    const rrfScore = 1.0 / (kRRF + rank + 1);
    chunkMap.set(id, {
      chunk: item.chunk,
      vectorRank: rank + 1,
      vectorScore: item.score,
      bm25Rank: 9999,
      bm25Score: 0,
      rrfScore,
    });
  });

  // Process BM25 ranks
  bm25Results.forEach((item, rank) => {
    const id = item.chunk._id ? item.chunk._id.toString() : item.chunk.id;
    const rrfScore = 1.0 / (kRRF + rank + 1);
    if (chunkMap.has(id)) {
      const existing = chunkMap.get(id);
      existing.bm25Rank = rank + 1;
      existing.bm25Score = maxBM25 > 0 ? item.score / maxBM25 : 0;
      existing.rrfScore += rrfScore;
    } else {
      chunkMap.set(id, {
        chunk: item.chunk,
        vectorRank: 9999,
        vectorScore: 0,
        bm25Rank: rank + 1,
        bm25Score: maxBM25 > 0 ? item.score / maxBM25 : 0,
        rrfScore,
      });
    }
  });

  // Salient query tokens for strict evidence coverage check
  const STOPWORDS = new Set([
    "what", "is", "the", "for", "rule", "policy", "does", "not", "exist", "tell",
    "me", "about", "a", "an", "of", "in", "to", "and", "or", "it", "this",
    "that", "how", "can", "i", "we", "they", "are", "be", "been", "was",
    "were", "with", "from", "at", "by", "on", "as", "do", "did", "have", "has",
    "any", "all", "which", "who", "whom", "where", "when", "why", "whose", "guidelines"
  ]);

  const salientQueryTokens = query
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

  function stemSimple(word) {
    if (word.endsWith("ies")) return word.slice(0, -3) + "y";
    if (word.endsWith("es") && word.length > 4) return word.slice(0, -2);
    if (word.endsWith("s") && word.length > 3) return word.slice(0, -1);
    return word;
  }

  // 5. Final Re-ranking score
  // Combined confidence = (0.55 * vectorScore) + (0.45 * bm25Score)
  const ranked = Array.from(chunkMap.values()).map((entry) => {
    let blendedScore = entry.vectorScore * 0.55 + entry.bm25Score * 0.45;

    // Check salient token coverage in chunk
    const chunkText = `${entry.chunk.documentTitle || ""} ${entry.chunk.section || ""} ${entry.chunk.content || ""}`.toLowerCase();
    let hits = 0;
    for (const token of salientQueryTokens) {
      const stemmed = stemSimple(token);
      if (chunkText.includes(token) || chunkText.includes(stemmed)) hits++;
    }
    const salientCoverage = salientQueryTokens.length > 0 ? hits / salientQueryTokens.length : 1.0;

    // Strict No Evidence Gate:
    // If specific salient terms are requested (e.g. "XYZ") and none exist in this chunk, score is 0
    if (salientQueryTokens.length > 0 && hits === 0) {
      blendedScore = 0;
    } else if (salientQueryTokens.length > 0 && salientCoverage < 0.3) {
      blendedScore = blendedScore * 0.25;
    } else {
      // Title / Section match boost
      const qLower = query.toLowerCase();
      if (entry.chunk.documentTitle && qLower.includes(entry.chunk.documentTitle.toLowerCase())) {
        blendedScore = Math.min(1.0, blendedScore + 0.15);
      }
      if (entry.chunk.section && qLower.includes(entry.chunk.section.toLowerCase())) {
        blendedScore = Math.min(1.0, blendedScore + 0.1);
      }
    }

    return {
      ...entry.chunk,
      confidence: Math.round(blendedScore * 100) / 100,
    };
  });

  ranked.sort((a, b) => b.confidence - a.confidence);
  const selectedChunks = ranked.filter((c) => c.confidence >= threshold).slice(0, topK);
  const maxConfidence = selectedChunks.length > 0 ? selectedChunks[0].confidence : 0;

  // 6. Evidence Gate Check
  const isConfident = maxConfidence >= threshold && selectedChunks.length > 0;

  // 7. Policy Conflict Check (e.g. conflicting versions or differing documents on same topic)
  let conflictDetected = false;
  let conflictNote = null;
  if (selectedChunks.length >= 2) {
    const topDocTitles = new Set(selectedChunks.map((c) => c.documentTitle));
    if (topDocTitles.size > 1 && selectedChunks[0].confidence > 0.6 && selectedChunks[1].confidence > 0.6) {
      // Check if versions differ significantly
      const v1 = selectedChunks[0].version || 1;
      const v2 = selectedChunks[1].version || 1;
      if (v1 !== v2) {
        conflictDetected = true;
        conflictNote = `Multiple document versions (v${v1} and v${v2}) retrieved with relevant policies. Preferring latest verified document.`;
      }
    }
  }

  return {
    chunks: selectedChunks,
    maxConfidence,
    isConfident,
    conflictDetected,
    conflictNote,
  };
};

module.exports = {
  hybridRetrieve,
  getOrUpdateBM25Index,
  invalidateBM25Cache,
};
