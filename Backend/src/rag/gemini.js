const { GoogleGenerativeAI } = require("@google/generative-ai");

const ABSTENTION_MESSAGE = "Information not found in the institutional knowledge base.";

/**
 * Builds the strict grounded context prompt for Gemini.
 */
function buildGroundedPrompt(question, retrievedChunks) {
  const contextBlocks = retrievedChunks
    .map((chunk, idx) => {
      return `[SOURCE ${idx + 1}]
Document: ${chunk.documentTitle || chunk.fileName}
Page: ${chunk.pageNumber || "N/A"}
Section: ${chunk.section || "General"}
Version: v${chunk.version || 1}
Content:
${chunk.content}
---`;
    })
    .join("\n\n");

  return `You are CampusAI, an institutional knowledge assistant for our college campus.
Your core principle is: "No Evidence → No Answer".

CRITICAL INSTRUCTIONS:
1. Answer ONLY using the facts explicitly stated in the RETRIEVED SOURCES below.
2. If the sources do NOT contain enough clear evidence to answer the student's question, you MUST answer EXACTLY:
"${ABSTENTION_MESSAGE}"
3. Do NOT invent, assume, extrapolate, or use general external knowledge for campus policies, eligibility criteria, percentages, dates, deadlines, or rules.
4. Keep the answer direct, professional, and concise (2-4 sentences).
5. At the end of your answer, you MUST specify which Source number(s) you used.

RETRIEVED SOURCES:
${contextBlocks}

STUDENT QUESTION:
${question}

GROUNDED INSTITUTIONAL ANSWER:`;
}

/**
 * Generates grounded answer using Google Gemini API or local extractive fallback.
 * @param {string} question
 * @param {Array<Object>} retrievedChunks
 * @param {Object} options
 * @returns {Promise<{
 *   answer: string,
 *   sources: Array<Object>,
 *   confidence: number,
 *   grounded: boolean,
 *   abstention: boolean
 * }>}
 */
const generateGroundedAnswer = async (question, retrievedChunks, options = {}) => {
  // 1. Evidence gate check
  if (!retrievedChunks || retrievedChunks.length === 0) {
    return {
      answer: ABSTENTION_MESSAGE,
      sources: [],
      confidence: 0,
      grounded: false,
      abstention: true,
    };
  }

  // Filter sources to attach to the final citation
  const formattedSources = retrievedChunks.map((c) => ({
    document: c.documentTitle || c.fileName,
    page: c.pageNumber || 1,
    section: c.section || "General",
    snippet: (c.content || "").slice(0, 160) + "...",
    confidence: c.confidence || 0.8,
    version: c.version || 1,
  }));

  const maxConfidence = retrievedChunks[0].confidence || 0.85;

  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey.trim().length > 10) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey.trim());
      const candidateModels = [
        process.env.GEMINI_MODEL,
        "gemini-3.8-flash",
        "gemini-flash-latest",
        "gemini-2.5-flash-lite",
      ].filter(Boolean);

      let text = null;
      for (const mName of candidateModels) {
        try {
          const model = genAI.getGenerativeModel({
            model: mName,
            generationConfig: {
              temperature: 0.1, // Low temperature for maximum factual precision
              maxOutputTokens: 500,
            },
          });
          const prompt = buildGroundedPrompt(question, retrievedChunks);
          const result = await model.generateContent(prompt);
          const response = await result.response;
          text = response.text().trim();
          if (text) break;
        } catch (mErr) {
          // try next model
        }
      }

      if (!text) {
        throw new Error("All candidate Gemini models failed to generate output");
      }

      // Check if LLM itself determined lack of evidence
      const isAbstention =
        text.toLowerCase().includes("information not found") ||
        text.toLowerCase().includes("no evidence") ||
        text === ABSTENTION_MESSAGE;

      if (isAbstention) {
        return {
          answer: ABSTENTION_MESSAGE,
          sources: [],
          confidence: maxConfidence,
          grounded: false,
          abstention: true,
        };
      }

      return {
        answer: text,
        sources: formattedSources,
        confidence: maxConfidence,
        grounded: true,
        abstention: false,
      };
    } catch (err) {
      console.warn(`[Gemini] LLM generation error (${err.message}). Using grounded extractive fallback.`);
    }
  }

  // 2. Extractive Grounded Fallback (Guarantees zero hallucinations & preserves offline functionality)
  const topChunk = retrievedChunks[0];
  const STOPWORDS = new Set([
    "what", "is", "the", "for", "rule", "policy", "does", "not", "exist", "tell",
    "me", "about", "a", "an", "of", "in", "to", "and", "or", "it", "this",
    "that", "how", "can", "i", "we", "they", "are", "be", "been", "was",
    "were", "with", "from", "at", "by", "on", "as", "do", "did", "have", "has",
    "any", "all", "which", "who", "whom", "where", "when", "why", "whose", "guidelines"
  ]);

  const salientWords = question
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

  const sentences = topChunk.content
    .split(/(?<!\bRs|\bDr|\bProf|\bMr|\bMs|\bGovt|\bSr|\bNo|\bvs|\bviz|\b[A-Z])[.?!]\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10 && !s.startsWith("--- PAGE"));

  const scoredSentences = sentences.map((s) => {
    const sLower = s.toLowerCase();
    const hits = salientWords.filter((w) => {
      const stemmed = stemSimple(w);
      return sLower.includes(w) || sLower.includes(stemmed);
    }).length;
    return { sentence: s, hits };
  });

  scoredSentences.sort((a, b) => b.hits - a.hits);
  const topSentences = scoredSentences.filter((s) => s.hits > 0).slice(0, 3);

  if (topSentences.length === 0 || (salientWords.length > 0 && scoredSentences[0].hits === 0)) {
    return {
      answer: ABSTENTION_MESSAGE,
      sources: [],
      confidence: maxConfidence,
      grounded: false,
      abstention: true,
    };
  }

  const synthesizedAnswer = topSentences.map((s) => s.sentence.trim()).join(" ");

  return {
    answer: synthesizedAnswer,
    sources: formattedSources.slice(0, 2),
    confidence: maxConfidence,
    grounded: true,
    abstention: false,
  };
};

module.exports = {
  generateGroundedAnswer,
  ABSTENTION_MESSAGE,
};
