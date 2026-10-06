/**
 * Semantic & Page-Aware Chunker for Campus Institutional Documents
 */

/**
 * Splits extracted pages into semantic chunks while strictly retaining pageNumber and section.
 * @param {Array<{ pageNumber: number, section: string, text: string }>} pages
 * @param {Object} options
 * @param {number} options.targetChunkSize - Target words per chunk (default ~280 words)
 * @param {number} options.overlapSize - Word overlap between chunks (default ~40 words)
 * @returns {Array<{ chunkIndex: number, pageNumber: number, section: string, content: string, cleanedContent: string, tokenCount: number }>}
 */
const createSemanticChunks = (pages, options = {}) => {
  const targetChunkSize = options.targetChunkSize || 280;
  const overlapSize = options.overlapSize || 40;

  const chunks = [];
  let globalChunkIndex = 0;

  for (const page of pages) {
    const { pageNumber, section, text } = page;
    if (!text || text.trim().length === 0) continue;

    // Split page into paragraphs
    const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

    let currentChunkWords = [];
    let currentSection = section || "General";

    for (const para of paragraphs) {
      // Check if paragraph defines a new section
      const lines = para.split("\n");
      const firstLine = lines[0].trim();
      if (
        lines.length > 1 &&
        firstLine.length < 70 &&
        (/^(section|clause|chapter|rule|policy|guideline|article)\b/i.test(firstLine) ||
          /^(\d+(\.\d+)*|[A-Z][\.\)])\s+[A-Z]/i.test(firstLine))
      ) {
        currentSection = firstLine;
      }

      const words = para.split(/\s+/).filter(Boolean);

      // If adding this paragraph exceeds targetChunkSize, emit current chunk
      if (currentChunkWords.length + words.length > targetChunkSize && currentChunkWords.length > 0) {
        const chunkText = currentChunkWords.join(" ");
        chunks.push({
          chunkIndex: globalChunkIndex++,
          pageNumber,
          section: currentSection,
          content: chunkText,
          cleanedContent: normalizeChunkText(chunkText),
          tokenCount: Math.ceil(currentChunkWords.length * 1.3),
        });

        // Retain overlap from end of current chunk
        const overlap = currentChunkWords.slice(-overlapSize);
        currentChunkWords = [...overlap, ...words];
      } else {
        currentChunkWords.push(...words);
      }
    }

    // Flush remaining words on this page
    if (currentChunkWords.length > 0) {
      const chunkText = currentChunkWords.join(" ");
      chunks.push({
        chunkIndex: globalChunkIndex++,
        pageNumber,
        section: currentSection,
        content: chunkText,
        cleanedContent: normalizeChunkText(chunkText),
        tokenCount: Math.ceil(currentChunkWords.length * 1.3),
      });
    }
  }

  return chunks;
};

function normalizeChunkText(text) {
  return text.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

module.exports = {
  createSemanticChunks,
  normalizeChunkText,
};
