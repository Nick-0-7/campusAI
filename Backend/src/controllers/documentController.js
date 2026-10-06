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

    // B. Semantic Chunking
    const chunks = createSemanticChunks(pages, { targetChunkSize: 250, overlapSize: 35 });
    if (chunks.length === 0) {
      doc.status = "failed";
      doc.errorMessage = "No semantic chunks generated from text";
      await doc.save();
      return;
    }

    // C. Embed chunks and save
    const chunkDocs = [];
    for (const c of chunks) {
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

module.exports = {
  uploadDocument,
  listDocuments,
  getDocumentById,
  getDocumentStats,
  updateDocumentVersion,
  deleteDocument,
  reprocessDocument,
  processDocumentRAG,
};
