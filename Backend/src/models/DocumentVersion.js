const mongoose = require("mongoose");

const DocumentVersionSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true,
      index: true,
    },
    version: {
      type: Number,
      required: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    effectiveDate: {
      type: Date,
      default: Date.now,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    changeSummary: {
      type: String,
      default: "Initial release",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DocumentVersion", DocumentVersionSchema);
