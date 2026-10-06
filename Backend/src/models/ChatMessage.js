const mongoose = require("mongoose");

const SourceSchema = new mongoose.Schema(
  {
    document: { type: String, required: true },
    page: { type: Number, default: 1 },
    section: { type: String, default: "General" },
    snippet: { type: String },
    confidence: { type: Number, default: 0 },
    version: { type: Number, default: 1 },
  },
  { _id: false }
);

const ChatMessageSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatSession",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    sources: [SourceSchema],
    confidence: {
      type: Number,
      default: 0,
    },
    grounded: {
      type: Boolean,
      default: false,
    },
    abstention: {
      type: Boolean,
      default: false,
    },
    latencyMs: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ChatMessage", ChatMessageSchema);
