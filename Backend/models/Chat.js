const mongoose = require("mongoose");

const citationSchema = new mongoose.Schema(
  {
    source: {
      type: String, // e.g. "Examination Rules.pdf"
      required: true,
    },
    page: {
      type: String, // e.g. "Page 12"
      default: "Page 1",
    },
    section: {
      type: String, // e.g. "Section 4.1 - Eligibility"
      default: "General",
    },
    relevanceScore: {
      type: Number, // e.g. 95 (percentage)
      default: 90,
    },
    excerpt: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

const chatSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    studentName: {
      type: String,
      default: "Student",
    },
    sessionId: {
      type: String,
      default: "default_session",
    },
    question: {
      type: String,
      required: [true, "Question is required"],
    },
    answer: {
      type: String,
      required: [true, "Answer is required"],
    },
    isFoundInKnowledgeBase: {
      type: Boolean,
      default: true,
    },
    citations: [citationSchema],
    feedback: {
      type: String,
      enum: ["up", "down", "none"],
      default: "none",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Chat", chatSchema);
