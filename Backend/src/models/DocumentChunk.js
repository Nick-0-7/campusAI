const mongoose = require("mongoose");

const DocumentChunkSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true,
      index: true,
    },
    documentTitle: {
      type: String,
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    department: {
      type: String,
      default: "General",
    },
    category: {
      type: String,
      default: "General",
    },
    version: {
      type: Number,
      default: 1,
    },
    chunkIndex: {
      type: Number,
      required: true,
    },
    pageNumber: {
      type: Number,
      default: 1,
    },
    section: {
      type: String,
      default: "General",
    },
    content: {
      type: String,
      required: true,
    },
    cleanedContent: {
      type: String,
    },
    tokenCount: {
      type: Number,
      default: 0,
    },
    embedding: {
      type: [Number],
      default: [],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

DocumentChunkSchema.index({ documentId: 1, chunkIndex: 1 });
DocumentChunkSchema.index({ category: 1, department: 1 });

module.exports = mongoose.model("DocumentChunk", DocumentChunkSchema);
