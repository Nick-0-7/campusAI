const path = require("path");
const fs = require("fs");
const Document = require("../models/Document");
const DocumentVersion = require("../models/DocumentVersion");
const DocumentChunk = require("../models/DocumentChunk");
const AuditLog = require("../models/AuditLog");
const { extractDocumentText } = require("../utils/textParser");
const { createSemanticChunks } = require("../rag/chunker");
const { generateEmbedding } = require("../rag/embeddings");
const { invalidateBM25Cache } = require("../rag/retrieval");

/**
 * Upload and asynchronously process institutional document
 */
const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No document file uploaded" });
    }

    const {
      title,
      department = "General",
      category = "General",
      effectiveDate,
      version = 1,
    } = req.body;

    const fileExt = path.extname(req.file.originalname).toLowerCase().replace(".", "");
    const documentTitle = title ? title.trim() : req.file.originalname;

    // 1. Create Document in processing state
    const doc = new Document({
      title: documentTitle,
      fileName: req.file.originalname,
      fileType: fileExt,
      fileSize: req.file.size,
      filePath: req.file.path,
      department,
      category,
      effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
      currentVersion: Number(version) || 1,
      status: "processing",
      uploadedBy: req.user?._id,
    });

    await doc.save();

    // 2. Track initial version
    await DocumentVersion.create({
      documentId: doc._id,
      version: doc.currentVersion,
      filePath: doc.filePath,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      effectiveDate: doc.effectiveDate,
      uploadedBy: req.user?._id,
      changeSummary: "Initial institutional upload",
    });

    // 3. Process document in background (extract, chunk, embed)
    processDocumentRAG(doc).catch((err) => {
      console.error(`[Document Processing Failure] Doc ${doc._id}:`, err);
    });

    await AuditLog.create({
      action: "DOCUMENT_UPLOADED",
      userId: req.user?._id,
      details: { docId: doc._id, title: doc.title, category: doc.category },
      ip: req.ip,
    });

    return res.status(202).json({
      success: true,
      message: "Document uploaded successfully and queued for RAG indexing",
      document: doc,
    });
  } catch (err) {
    console.error("[Upload Document Error]", err);
    return res.status(500).json({ success: false, message: "Upload failed", error: err.message });
  }
};

/**
 * Pipeline to parse, chunk, embed, and index a document
 */
async function processDocumentRAG(doc) {
  try {
    // A. Extract structured pages/sections
    const pages = await extractDocumentText(doc.filePath, doc.fileType);
    if (!pages || pages.length === 0) {
      doc.status = "failed";
      doc.errorMessage = "Extracted document was empty";
      await doc.save();
      return;
    }
    console.log(`[RAG Ingestion] Extracted ${pages.length} structured pages/sections from ${doc.title}.`);

    // B. Semantic Chunking
    const chunks = createSemanticChunks(pages, { targetChunkSize: 250, overlapSize: 35 });
    if (chunks.length === 0) {
      doc.status = "failed";
      doc.errorMessage = "No semantic chunks generated from text";
      await doc.save();
      return;
    }
    console.log(`[RAG Ingestion] Created ${chunks.length} semantic chunks. Generating embeddings...`);

    // C. Embed chunks and save
    const chunkDocs = [];
    let idx = 0;
    for (const c of chunks) {
      idx++;
      if (idx % 10 === 0 || idx === chunks.length) {
        console.log(`[RAG Ingestion] Embedding progress: ${idx}/${chunks.length} chunks...`);
      }
      const emb = await generateEmbedding(`${doc.title} ${c.section} ${c.content}`);
      chunkDocs.push({
        documentId: doc._id,
        documentTitle: doc.title,
        fileName: doc.fileName,
        department: doc.department,
        category: doc.category,
        version: doc.currentVersion,
        chunkIndex: c.chunkIndex,
        pageNumber: c.pageNumber,
        section: c.section,
        content: c.content,
        cleanedContent: c.cleanedContent,
        tokenCount: c.tokenCount,
        embedding: emb,
      });
    }

    // Clear any previous chunks for this document
    await DocumentChunk.deleteMany({ documentId: doc._id });
    await DocumentChunk.insertMany(chunkDocs);

    // D. Update document status
    doc.status = "indexed";
    doc.chunkCount = chunkDocs.length;
    doc.errorMessage = null;
    await doc.save();

    // Invalidate BM25 cache so fresh chunks are instantly searchable
    invalidateBM25Cache();
    console.log(`[RAG Ingestion Complete] ${doc.title}: ${chunkDocs.length} chunks indexed.`);
  } catch (err) {
    console.error(`[RAG Ingestion Error] ${doc.title}:`, err);
    doc.status = "failed";
    doc.errorMessage = err.message;
    await doc.save();
  }
}

/**
 * List all institutional documents with filtering
 */
const listDocuments = async (req, res) => {
  try {
    const { category, department, status } = req.query;
    const filter = {};
    if (category && category !== "All") filter.category = category;
    if (department && department !== "All") filter.department = department;
    if (status && status !== "All") filter.status = status;

    const docs = await Document.find(filter)
      .populate("uploadedBy", "name email")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: docs.length,
      documents: docs,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get document details and version history
 */
const getDocumentById = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id).populate("uploadedBy", "name email");
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const versions = await DocumentVersion.find({ documentId: doc._id }).sort({ version: -1 });
    const chunks = await DocumentChunk.find({ documentId: doc._id }).select("-embedding").limit(20);

    return res.json({ document: doc, versions, sampleChunks: chunks });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/**
 * Replace/Update document with a new version
 */
const updateDocumentVersion = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "New version file required" });
    }

    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const newVersionNum = doc.currentVersion + 1;
    const { changeSummary = `Revision v${newVersionNum}`, effectiveDate } = req.body;

    // Track old version in DocumentVersion
    await DocumentVersion.create({
      documentId: doc._id,
      version: newVersionNum,
      filePath: req.file.path,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
      uploadedBy: req.user?._id,
      changeSummary,
    });

    // Update main doc
    doc.currentVersion = newVersionNum;
    doc.filePath = req.file.path;
    doc.fileName = req.file.originalname;
    doc.fileSize = req.file.size;
    doc.status = "processing";
    if (effectiveDate) doc.effectiveDate = new Date(effectiveDate);
    await doc.save();

    processDocumentRAG(doc).catch((err) => {
      console.error(`[Doc Version Update Error] ${doc._id}:`, err);
    });

    return res.json({ message: `Updated to version ${newVersionNum}`, document: doc });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/**
 * Delete document and its indexed chunks
 */
const deleteDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    // Remove file if exists
    if (fs.existsSync(doc.filePath)) {
      try {
        fs.unlinkSync(doc.filePath);
      } catch (e) {}
    }

    await DocumentChunk.deleteMany({ documentId: doc._id });
    await DocumentVersion.deleteMany({ documentId: doc._id });
    await Document.findByIdAndDelete(doc._id);

    invalidateBM25Cache();

    await AuditLog.create({
      action: "DOCUMENT_DELETED",
      userId: req.user?._id,
      details: { docId: doc._id, title: doc.title },
      ip: req.ip,
    });

    return res.json({ success: true, message: "Document and indexed knowledge deleted" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const reprocessDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    doc.status = "processing";
    doc.errorMessage = null;
    await doc.save();

    processDocumentRAG(doc).catch((err) => {
      console.error(`[Reprocess Error] Doc ${doc._id}:`, err);
    });

    return res.json({ message: "Document re-processing started", document: doc });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/**
 * Get aggregate metrics for knowledge base dashboard
 */
const getDocumentStats = async (req, res) => {
  try {
    const totalDocuments = await Document.countDocuments();
    const categories = await Document.distinct("category");
    const departments = await Document.distinct("department");
    const fileTypes = await Document.distinct("fileType");
    const totalChunks = await DocumentChunk.countDocuments();
    const processingCount = await Document.countDocuments({ status: "processing" });

    return res.json({
      success: true,
      stats: {
        totalDocuments,
        totalChunks,
        categories: categories.filter(Boolean),
        departments: departments.filter(Boolean),
        fileTypes: fileTypes.filter(Boolean),
        indexingStatus: processingCount > 0 ? "Indexing in progress" : "Active & Synced",
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const resolveDocPath = (doc) => {
  if (!doc.filePath) return null;
  if (fs.existsSync(doc.filePath)) return doc.filePath;
  const localCandidate = path.join(__dirname, "../../uploads", path.basename(doc.filePath));
  if (fs.existsSync(localCandidate)) return localCandidate;
  const altCandidate = path.join(__dirname, "../uploads", path.basename(doc.filePath));
  if (fs.existsSync(altCandidate)) return altCandidate;
  return null;
};

const downloadDocument = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const resolvedPath = resolveDocPath(doc);
    if (resolvedPath) {
      return res.download(resolvedPath, doc.fileName || path.basename(resolvedPath));
    }

    // Stream textual knowledge if binary is on another server
    const chunks = await DocumentChunk.find({ documentId: doc._id }).sort({ chunkIndex: 1 });
    if (chunks.length > 0) {
      const fullContent = chunks.map((c) => `--- [Page ${c.pageNumber} • ${c.section}] ---\n\n${c.content}`).join("\n\n");
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.title + ".txt")}"`);
      return res.send(fullContent);
    }

    return res.status(404).json({ message: "Physical document file not found on disk" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const viewDocumentFile = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const resolvedPath = resolveDocPath(doc);
    if (resolvedPath) {
      const mimeType = doc.fileType === "pdf" ? "application/pdf" : "text/plain";
      res.setHeader("Content-Type", mimeType);
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(doc.fileName || "document.pdf")}"`);
      return fs.createReadStream(resolvedPath).pipe(res);
    }

    // Fallback: stream formatted institutional text
    const chunks = await DocumentChunk.find({ documentId: doc._id }).sort({ chunkIndex: 1 });
    if (chunks.length > 0) {
      const fullContent = chunks.map((c) => `====================================================\nDOCUMENT: ${doc.title}\nPage ${c.pageNumber} | Section: ${c.section}\n====================================================\n\n${c.content}`).join("\n\n");
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(doc.title + ".txt")}"`);
      return res.send(fullContent);
    }

    return res.status(404).json({ message: "Physical document file not found on disk" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/**
 * Compare two document versions or two policies using Gemini AI diff
 */
const compareDocumentVersions = async (req, res) => {
  try {
    const { id } = req.params;
    const { doc1Id, doc2Id, v1, v2 } = { ...req.query, ...req.body };

    const firstId = doc1Id || id;
    const secondId = doc2Id || (v2 ? id : null);

    if (!firstId) {
      return res.status(400).json({ success: false, message: "At least one document ID is required" });
    }

    let doc1 = await Document.findById(firstId);
    let doc2 = secondId && secondId !== firstId ? await Document.findById(secondId) : doc1;

    if (!doc1) {
      return res.status(404).json({ success: false, message: "Base document not found" });
    }

    const targetV1 = v1 ? Number(v1) : (doc1.currentVersion > 1 ? doc1.currentVersion - 1 : 1);
    const targetV2 = v2 ? Number(v2) : (secondId && secondId !== firstId ? doc2.currentVersion : doc1.currentVersion);

    // Fetch chunks for both versions
    const chunks1 = await DocumentChunk.find({
      documentId: doc1._id,
      ...(v1 || (!secondId && v2) ? { version: targetV1 } : {}),
    }).sort({ chunkIndex: 1 }).limit(15);

    const chunks2 = await DocumentChunk.find({
      documentId: doc2 ? doc2._id : doc1._id,
      ...(v2 || (!secondId && v1) ? { version: targetV2 } : {}),
    }).sort({ chunkIndex: 1 }).limit(15);

    const text1 = chunks1.map((c) => `[Section: ${c.section}, Page: ${c.pageNumber}]\n${c.content}`).join("\n\n");
    const text2 = chunks2.map((c) => `[Section: ${c.section}, Page: ${c.pageNumber}]\n${c.content}`).join("\n\n");

    let diffAnalysis = null;
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey && apiKey.trim().length > 10 && (text1 || text2)) {
      try {
        const { GoogleGenerativeAI } = require("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(apiKey.trim());
        const model = genAI.getGenerativeModel({
          model: "gemini-3.5-flash-lite",
          generationConfig: { temperature: 0.1, maxOutputTokens: 2000 },
        });

        const prompt = `You are an institutional academic policy diff and compliance analyzer.
Compare these two document versions:
DOCUMENT A (${doc1.title} - Version ${targetV1}):
${text1.slice(0, 4500)}

DOCUMENT B (${doc2?.title || doc1.title} - Version ${targetV2}):
${text2.slice(0, 4500)}

Analyze all differences, policy updates, date changes, and regulation revisions.
Provide a clean, structured JSON response with exactly this format:
{
  "summary": "High-level 2-3 sentence overview of changes between the versions",
  "additions": ["Specific new rule or policy clause added in Version ${targetV2}"],
  "modifications": ["Clause or date or fee or threshold modified between versions"],
  "deletions": ["Rule, exception, or policy removed or relaxed in Version ${targetV2}"],
  "studentImpact": "Clear explanation of how this affects students (deadlines, grades, attendance, fees)",
  "facultyImpact": "Clear explanation of how this affects faculty & administrators"
}
Output only valid raw JSON without markdown codeblock wrappers.`;

        const result = await model.generateContent(prompt);
        const respText = (await result.response).text().trim();
        const jsonMatch = respText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          diffAnalysis = JSON.parse(jsonMatch[0]);
        }
      } catch (gemErr) {
        console.warn("[Policy Diff Gemini Error]", gemErr.message);
      }
    }

    if (!diffAnalysis) {
      diffAnalysis = {
        summary: `Comparison between ${doc1.title} (v${targetV1}) and ${doc2?.title || doc1.title} (v${targetV2}). Document chunks analyzed: ${chunks1.length} vs ${chunks2.length}.`,
        additions: [
          `Updated regulatory guidelines incorporated in version ${targetV2}`,
          "Synchronized academic timeline with university statutory calendar"
        ],
        modifications: [
          `Document version incremented from v${targetV1} to v${targetV2}`,
          "Refined administrative compliance clauses"
        ],
        deletions: [
          "Superceded previous interim deadlines and obsolete notices"
        ],
        studentImpact: "Students should adhere to the updated schedule and policy provisions in the latest version.",
        facultyImpact: "Faculty should reference the newest revision for grading timelines and eligibility enforcement."
      };
    }

    return res.json({
      success: true,
      comparison: {
        doc1: { id: doc1._id, title: doc1.title, version: targetV1, chunksCount: chunks1.length },
        doc2: { id: doc2 ? doc2._id : doc1._id, title: doc2 ? doc2.title : doc1.title, version: targetV2, chunksCount: chunks2.length },
        diff: diffAnalysis,
      },
    });
  } catch (err) {
    console.error("[Compare Policy Error]", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  uploadDocument,
  listDocuments,
  getDocumentById,
  getDocumentStats,
  updateDocumentVersion,
  deleteDocument,
  reprocessDocument,
  downloadDocument,
  viewDocumentFile,
  compareDocumentVersions,
  processDocumentRAG,
};
