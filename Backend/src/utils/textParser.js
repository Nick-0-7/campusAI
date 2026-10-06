const fs = require("fs");
const path = require("path");
const { PDFParse } = require("pdf-parse");
const mammoth = require("mammoth");
const csvParser = require("csv-parser");

/**
 * Extracts structured text pages/sections from supported document formats.
 * @param {string} filePath - Path on disk to the document.
 * @param {string} fileType - One of 'pdf', 'docx', 'txt', 'csv'
 * @returns {Promise<Array<{ pageNumber: number, section: string, text: string }>>}
 */
const extractDocumentText = async (filePath, fileType) => {
  const normType = fileType.toLowerCase().replace(".", "");

  if (normType === "pdf") {
    const dataBuffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: dataBuffer });
    try {
      const parsed = await parser.getText();
      await parser.destroy();

      if (parsed && Array.isArray(parsed.pages) && parsed.pages.length > 0) {
        const pages = parsed.pages.map((p) => ({
          pageNumber: p.num || 1,
          section: detectSectionTitle(p.text),
          text: cleanRawText(p.text),
        }));

        const totalExtractedChars = pages.reduce((sum, p) => sum + p.text.length, 0);
        if (totalExtractedChars > 20) {
          return pages;
        }

        // Zero or negligible text layer detected -> Scanned or Image-only PDF
        console.warn("[TextParser] PDF contains 0 digital text characters. Checking Gemini multimodal OCR...");
        if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 10) {
          return await extractPdfWithGeminiMultimodal(dataBuffer);
        } else {
          throw new Error(
            "Scanned / Image-Only PDF: No digital text layer found in this document. It contains scanned photos or flattened graphics. To index scanned PDFs, please set your GEMINI_API_KEY in Backend/.env for multimodal OCR, or upload a searchable text PDF/DOCX/TXT."
          );
        }
      }

      // Fallback if pages array is empty but raw text exists
      const fallbackText = cleanRawText(parsed.text || "");
      if (fallbackText.length > 20) {
        return splitIntoEstimatedPages(fallbackText);
      }

      if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 10) {
        return await extractPdfWithGeminiMultimodal(dataBuffer);
      }

      throw new Error(
        "Scanned / Image-Only PDF: No digital text layer found in this document. Please upload a searchable PDF or configure GEMINI_API_KEY in Backend/.env for automated vision OCR."
      );
    } catch (err) {
      console.error("[TextParser] PDF extraction error:", err);
      throw err;
    }
  }

  if (normType === "docx") {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      const fullText = cleanRawText(result.value || "");
      return splitIntoEstimatedPages(fullText);
    } catch (err) {
      console.error("[TextParser] DOCX extraction error:", err);
      throw new Error(`Failed to parse DOCX document: ${err.message}`);
    }
  }

  if (normType === "txt") {
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const fullText = cleanRawText(raw);
      return splitIntoEstimatedPages(fullText);
    } catch (err) {
      console.error("[TextParser] TXT extraction error:", err);
      throw new Error(`Failed to parse TXT document: ${err.message}`);
    }
  }

  if (normType === "csv") {
    return new Promise((resolve, reject) => {
      const results = [];
      let rowNum = 1;

      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on("data", (data) => {
          const rowText = Object.entries(data)
            .map(([col, val]) => `${col}: ${val}`)
            .join(" | ");
          results.push({
            pageNumber: Math.ceil(rowNum / 20), // 20 rows per virtual page
            section: `Records (Row ${rowNum})`,
            text: rowText,
          });
          rowNum++;
        })
        .on("end", () => {
          if (results.length === 0) {
            resolve([{ pageNumber: 1, section: "Table", text: "Empty CSV file" }]);
          } else {
            // Group by virtual page
            const grouped = {};
            for (const r of results) {
              if (!grouped[r.pageNumber]) {
                grouped[r.pageNumber] = [];
              }
              grouped[r.pageNumber].push(r.text);
            }
            const pages = Object.entries(grouped).map(([pg, lines]) => ({
              pageNumber: Number(pg),
              section: `CSV Page ${pg}`,
              text: lines.join("\n"),
            }));
            resolve(pages);
          }
        })
        .on("error", (err) => {
          reject(new Error(`Failed to parse CSV: ${err.message}`));
        });
    });
  }

  throw new Error(`Unsupported file type: ${fileType}`);
};

/**
 * Basic text cleaning: remove excessive whitespace, null bytes, normalize line endings.
 */
function cleanRawText(text) {
  if (!text) return "";
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

/**
 * Heuristic to detect section heading in a page text snippet.
 */
function detectSectionTitle(text) {
  if (!text) return "General";
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 5)) {
    if (
      /^(section|clause|chapter|article|policy|regulation|rule|guideline|title|topic)\b/i.test(line) ||
      /^(\d+(\.\d+)*|[A-Z][\.\)])\s+[A-Z]/i.test(line) ||
      (line.length < 80 && line === line.toUpperCase() && /[A-Z]/.test(line))
    ) {
      return line.slice(0, 80);
    }
  }
  return lines[0] && lines[0].length < 60 ? lines[0] : "General";
}

/**
 * Splits plain text into logical pages (~400 words per page) while preserving section headings.
 */
function splitIntoEstimatedPages(text) {
  if (!text) return [{ pageNumber: 1, section: "General", text: "" }];
  const paragraphs = text.split(/\n\s*\n/);
  const pages = [];
  let currentPage = 1;
  let currentBuffer = [];
  let currentWordCount = 0;
  let currentSection = "General";

  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (!trimmed) continue;

    const detected = detectSectionTitle(trimmed);
    if (detected !== "General") {
      currentSection = detected;
    }

    const words = trimmed.split(/\s+/).length;
    if (currentWordCount + words > 450 && currentBuffer.length > 0) {
      pages.push({
        pageNumber: currentPage++,
        section: currentSection,
        text: currentBuffer.join("\n\n"),
      });
      currentBuffer = [trimmed];
      currentWordCount = words;
    } else {
      currentBuffer.push(trimmed);
      currentWordCount += words;
    }
  }

  if (currentBuffer.length > 0) {
    pages.push({
      pageNumber: currentPage,
      section: currentSection,
      text: currentBuffer.join("\n\n"),
    });
  }

  return pages.length ? pages : [{ pageNumber: 1, section: "General", text }];
}

/**
 * Uses Gemini Multimodal vision capabilities to perform OCR on scanned PDFs
 */
async function extractPdfWithGeminiMultimodal(dataBuffer) {
  const { GoogleGenerativeAI } = require("@google/generative-ai");
  const candidateModels = [
    process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
    "gemini-3.5-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-3.5-flash",
  ];

  let lastError = null;

  for (const modelName of candidateModels) {
    try {
      console.log(`[TextParser] Attempting Multimodal OCR with model: ${modelName}...`);
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY.trim());
      const model = genAI.getGenerativeModel({ model: modelName });
      const prompt =
        "You are an institutional document OCR processor. Extract all text, tables, academic calendars, semester schedules, dates, and sections from this PDF page-by-page. For each page in the document, format the output starting with '--- PAGE <number> ---' followed by the text of that page.";

      const result = await model.generateContent([
        {
          inlineData: {
            data: dataBuffer.toString("base64"),
            mimeType: "application/pdf",
          },
        },
        prompt,
      ]);

      const response = await result.response;
      const fullText = response.text();

      const pageBlocks = fullText.split(/---\s*PAGE\s*(\d+)\s*---/i);
      const pages = [];

      if (pageBlocks.length > 1) {
        for (let i = 1; i < pageBlocks.length; i += 2) {
          const pageNum = parseInt(pageBlocks[i], 10) || Math.ceil(i / 2);
          const pageText = pageBlocks[i + 1] ? pageBlocks[i + 1].trim() : "";
          pages.push({
            pageNumber: pageNum,
            section: detectSectionTitle(pageText),
            text: cleanRawText(pageText),
          });
        }
      } else {
        return splitIntoEstimatedPages(fullText);
      }

      if (pages.length > 0) return pages;
    } catch (err) {
      console.warn(`[TextParser] OCR with ${modelName} encountered: ${err.message}. Trying next candidate...`);
      lastError = err;
    }
  }

  throw new Error(`Gemini Multimodal OCR failed across all candidates: ${lastError?.message}`);
}

module.exports = {
  extractDocumentText,
  cleanRawText,
  detectSectionTitle,
  extractPdfWithGeminiMultimodal,
};
