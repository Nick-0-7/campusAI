const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Document title is required"],
      trim: true,
    },
    category: {
      type: String,
      enum: [
        "Academic Regulations",
        "Examination Guidelines",
        "Attendance Policies",
        "Scholarship Information",
        "Department Notices",
        "Placement Information",
        "Student Handbook",
        "General Circular",
      ],
      default: "Academic Regulations",
    },
    department: {
      type: String,
      default: "All Departments",
    },
    description: {
      type: String,
      default: "",
    },
    fileName: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    fileType: {
      type: String, // pdf, txt, docx, csv
      required: true,
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    uploaderName: {
      type: String,
      default: "Faculty Admin",
    },
    status: {
      type: String,
      enum: ["Indexed", "Processing", "Archived"],
      default: "Indexed",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Document", documentSchema);
