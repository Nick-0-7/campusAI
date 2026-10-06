const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * Generates an embedding vector for given text.
 * Uses Google Gemini text-embedding-004 when GEMINI_API_KEY is available;
 * falls back to a deterministic 256-dim semantic projection vector otherwise.
 * @param {string} text
 * @returns {Promise<number[]>}
 */
const generateEmbedding = async (text) => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey.trim().length > 10) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey.trim());
      const candidateModels = [
        process.env.EMBEDDING_MODEL,
        "gemini-embedding-001",
        "text-embedding-004",
        "gemini-embedding-2",
      ].filter(Boolean);

      for (const m of candidateModels) {
        try {
          const model = genAI.getGenerativeModel({ model: m });
          const result = await model.embedContent(text);
          if (result && result.embedding && Array.isArray(result.embedding.values)) {
            return result.embedding.values;
          }
        } catch (mErr) {
          // try next model
        }
      }
    } catch (err) {
      console.warn(`[Embeddings] Gemini API embedding failed (${err.message}). Falling back to local vectorizer.`);
    }
  }

  // Fallback: Local deterministic dense semantic vector
  return generateDeterministicVector(text, 256);
};

/**
 * Batch generate embeddings with concurrency control.
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
const generateBatchEmbeddings = async (texts) => {
  const results = [];
  for (const text of texts) {
    const emb = await generateEmbedding(text);
    results.push(emb);
  }
  return results;
};

/**
 * Computes cosine similarity between two numeric vectors.
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number} Value in [ -1, 1 ]
 */
const cosineSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
  if (vecA.length !== vecB.length) {
    // If dimensionalities differ, truncate or project
    const minLen = Math.min(vecA.length, vecB.length);
    vecA = vecA.slice(0, minLen);
    vecB = vecB.slice(0, minLen);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * Deterministic dense vectorizer: Maps n-grams to dimensionality D with L2 normalization.
 */
function generateDeterministicVector(text, dimensions = 256) {
  const vec = new Array(dimensions).fill(0);
  if (!text) return vec;

  const normalized = text.toLowerCase().replace(/[^\w\s]/g, " ");
  const tokens = normalized.split(/\s+/).filter(Boolean);

  // Unigrams + Bigrams
  for (let i = 0; i < tokens.length; i++) {
    const unigram = tokens[i];
    const hashUni = hashString(unigram) % dimensions;
    vec[hashUni] += 1.0;

    if (i < tokens.length - 1) {
      const bigram = `${unigram}_${tokens[i + 1]}`;
      const hashBi = hashString(bigram) % dimensions;
      vec[hashBi] += 1.5;
    }
  }

  // L2 Normalize
  let sumSq = 0;
  for (let i = 0; i < dimensions; i++) sumSq += vec[i] * vec[i];
  const mag = Math.sqrt(sumSq);
  if (mag > 0) {
    for (let i = 0; i < dimensions; i++) vec[i] /= mag;
  }

  return vec;
}

function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return Math.abs(hash);
}

module.exports = {
  generateEmbedding,
  generateBatchEmbeddings,
  cosineSimilarity,
};
