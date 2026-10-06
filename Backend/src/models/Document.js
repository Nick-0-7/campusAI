const mongoose = require("mongoose");

const DocumentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    fileType: {
      type: String,
      enum: ["pdf", "docx", "txt", "csv"],
      required: true,
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    filePath: {
      type: String,
      required: true,
    },
    department: {
      type: String,
      default: "General",
      trim: true,
    },
    category: {
      type: String,
      enum: [
        "Academic",
        "Examination",
        "Attendance",
        "Scholarship",
        "Placements",
        "Hostel",
        "Discipline",
        "General",
      ],
      default: "General",
    },
    currentVersion: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ["processing", "indexed", "failed", "archived"],
      default: "processing",
    },
    errorMessage: {
      type: String,
      default: null,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    effectiveDate: {
      type: Date,
      default: Date.now,
    },
    chunkCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Document", DocumentSchema);
