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
1. Answer factually using the facts explicitly stated in the RETRIEVED SOURCES below.
2. For dates, schedules, academic calendars, and holiday inquiries:
   - Identify the inquired date, month, and academic year.
   - Look at the monthly schedule and the declared "Probable Holidays" or events for that specific month in the source.
   - If specific holidays are declared (e.g., Oct 2 - Mahatma Gandhi Jayanti, Oct 20 - Dashahara) and the inquired date is NOT among them, explicitly inform the student:
     a) Whether that date is a holiday or a regular academic working day.
     b) Which specific holidays are officially declared for that month according to the source.
3. If the sources mention related policies or regulations but do NOT contain a specific detail requested by the student (e.g., specific fee amount, specific date), explicitly state what the document specifies and clarify that the specific detail is not mentioned in the retrieved documents.
4. If the retrieved sources do NOT contain enough relevant context to address the question at all, answer EXACTLY:
"${ABSTENTION_MESSAGE}"
5. Format your answer cleanly, aesthetically, and professionally using structured Markdown:
   - Use bold section titles (e.g., **Academic Schedule**, **Holiday Status**, **Evaluation Guidelines**).
   - Use structured bullet points (•) for distinct items and dates.
   - For timetables or tabular schedules, organize them into a clean Markdown table with headers (| Month / Week | Dates | Particulars / Events |).
   - Separate sections with blank lines for high readability.
6. At the end of your answer, cite the Source number(s) you used (e.g., **Sources:** [Source 1]).

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
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite",
        "gemini-flash-lite-latest",
        "gemini-3.8-flash",
      ].filter(Boolean);

      let text = null;
      for (const mName of candidateModels) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const model = genAI.getGenerativeModel({
              model: mName,
              generationConfig: {
                temperature: 0.1, // Low temperature for maximum factual precision
                maxOutputTokens: 2000,
              },
            });
            const prompt = buildGroundedPrompt(question, retrievedChunks);
            const result = await model.generateContent(prompt);
            const response = await result.response;
            text = response.text().trim();
            if (text) break;
          } catch (mErr) {
            console.warn(`[Gemini] Model ${mName} attempt ${attempt + 1} failed: ${mErr.message?.slice(0, 100)}`);
            // Fast skip on 404 (model not found) or 429 (quota exceeded)
            if (mErr.message && (mErr.message.includes("404") || mErr.message.includes("429"))) {
              break;
            }
            if (mErr.message && mErr.message.includes("503") && attempt === 0) {
              await new Promise((res) => setTimeout(res, 800));
            }
          }
        }
        if (text) break;
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

  // 2. Extractive Grounded Fallback across all retrieved chunks
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

  const allSentences = [];
  for (const chunk of retrievedChunks) {
    const rawSentences = (chunk.content || "")
      .split(/(?<!\bRs|\bDr|\bProf|\bMr|\bMs|\bGovt|\bSr|\bNo|\bvs|\bviz|\b[A-Z])[.?!]\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 15 && !s.startsWith("--- PAGE") && !s.startsWith("| ---"));

    for (const s of rawSentences) {
      const sLower = s.toLowerCase();
      const hits = salientWords.filter((w) => {
        const stemmed = stemSimple(w);
        return sLower.includes(w) || sLower.includes(stemmed);
      }).length;
      if (hits > 0) {
        allSentences.push({
          sentence: s,
          hits,
        });
      }
    }
  }

  allSentences.sort((a, b) => b.hits - a.hits);
  const topSentences = allSentences.slice(0, 4);

  if (topSentences.length === 0) {
    return {
      answer: ABSTENTION_MESSAGE,
      sources: [],
      confidence: maxConfidence,
      grounded: false,
      abstention: true,
    };
  }

  const synthesizedAnswer = topSentences
    .map((s) => s.sentence.trim())
    .join("\n\n");

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
