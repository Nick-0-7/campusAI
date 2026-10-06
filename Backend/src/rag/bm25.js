/**
 * BM25 (Okapi BM25) Keyword Search Index for Chunks
 */

class BM25Index {
  constructor(k1 = 1.5, b = 0.75) {
    this.k1 = k1;
    this.b = b;
    this.documents = []; // array of { id, chunk, tokens, length }
    this.docFreq = {};   // term -> doc count
    this.avgDocLength = 0;
  }

  static STOPWORDS = new Set([
    "what", "is", "the", "for", "rule", "policy", "does", "not", "exist", "tell",
    "me", "about", "a", "an", "of", "in", "to", "and", "or", "it", "this",
    "that", "how", "can", "i", "we", "they", "are", "be", "been", "was",
    "were", "with", "from", "at", "by", "on", "as", "do", "did", "have", "has",
    "any", "all", "which", "who", "whom", "where", "when", "why", "whose"
  ]);

  tokenize(text, filterStopwords = false) {
    if (!text) return [];
    const tokens = text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1);

    return filterStopwords
      ? tokens.filter((t) => !BM25Index.STOPWORDS.has(t))
      : tokens;
  }

  /**
   * Build index from array of DocumentChunk objects
   * @param {Array<Object>} chunks
   */
  buildIndex(chunks) {
    this.documents = [];
    this.docFreq = {};
    let totalLength = 0;

    for (const chunk of chunks) {
      const text = `${chunk.documentTitle || ""} ${chunk.section || ""} ${chunk.content || ""}`;
      const tokens = this.tokenize(text);
      const uniqueTokens = new Set(tokens);

      for (const token of uniqueTokens) {
        this.docFreq[token] = (this.docFreq[token] || 0) + 1;
      }

      totalLength += tokens.length;
      this.documents.push({
        id: chunk._id ? chunk._id.toString() : chunk.id,
        chunk,
        tokens,
        termFreqs: this.calcTermFreqs(tokens),
        length: tokens.length,
      });
    }

    this.avgDocLength = this.documents.length > 0 ? totalLength / this.documents.length : 1;
  }

  calcTermFreqs(tokens) {
    const freqs = {};
    for (const t of tokens) {
      freqs[t] = (freqs[t] || 0) + 1;
    }
    return freqs;
  }

  /**
   * Query the index with text
   * @param {string} query
   * @param {number} topK
   * @returns {Array<{ chunk: Object, score: number }>}
   */
  search(query, topK = 10) {
    const queryTokens = this.tokenize(query, true);
    if (queryTokens.length === 0 || this.documents.length === 0) return [];

    const N = this.documents.length;
    const scores = [];

    for (const doc of this.documents) {
      let score = 0;
      for (const term of queryTokens) {
        if (!doc.termFreqs[term]) continue;

        const df = this.docFreq[term] || 0;
        // Robertson-Spärck Jones IDF
        const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1.0);
        const tf = doc.termFreqs[term];

        const numerator = tf * (this.k1 + 1);
        const denominator = tf + this.k1 * (1 - this.b + this.b * (doc.length / (this.avgDocLength || 1)));
        score += idf * (numerator / denominator);
      }

      if (score > 0) {
        scores.push({
          chunk: doc.chunk,
          score,
        });
      }
    }

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK);
  }
}

module.exports = BM25Index;
