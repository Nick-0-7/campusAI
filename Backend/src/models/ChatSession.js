const mongoose = require("mongoose");

const ChatSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "New Conversation",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ChatSession", ChatSessionSchema);
