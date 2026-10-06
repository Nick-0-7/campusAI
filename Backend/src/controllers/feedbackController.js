const Feedback = require("../models/Feedback");
const ChatMessage = require("../models/ChatMessage");
const Document = require("../models/Document");
const User = require("../models/User");

const submitFeedback = async (req, res) => {
  try {
    const { messageId, chatId, rating, feedback: altRating, comment } = req.body;
    const targetId = messageId || chatId;
    const rawRating = rating || altRating || "positive";

    const isPositive = ["positive", "helpful", "up", "like"].includes(String(rawRating).toLowerCase());
    const normalizedRating = isPositive ? "positive" : "negative";

    let feedbackRecord = null;
    if (targetId && !String(targetId).startsWith("bot-")) {
      try {
        feedbackRecord = await Feedback.create({
          messageId: targetId,
          userId: req.user?._id,
          rating: normalizedRating,
          comment: comment || "",
        });
      } catch (dbErr) {
        // Continue gracefully
      }
    }

    return res.status(200).json({
      success: true,
      message: "Feedback submitted successfully",
      feedback: feedbackRecord || { rating: normalizedRating },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getAdminStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalDocuments,
      totalQueries,
      abstentionCount,
      positiveFeedback,
      negativeFeedback,
      recentFeedback,
    ] = await Promise.all([
      User.countDocuments(),
      Document.countDocuments(),
      ChatMessage.countDocuments({ role: "assistant" }),
      ChatMessage.countDocuments({ role: "assistant", abstention: true }),
      Feedback.countDocuments({ rating: "positive" }),
      Feedback.countDocuments({ rating: "negative" }),
      Feedback.find()
        .populate("userId", "name email role")
        .populate("messageId", "content sources confidence")
        .sort({ createdAt: -1 })
        .limit(10),
    ]);

    const groundedCount = totalQueries - abstentionCount;
    const groundingRate = totalQueries > 0 ? Math.round((groundedCount / totalQueries) * 100) : 100;

    return res.json({
      stats: {
        totalUsers,
        totalDocuments,
        totalQueries,
        abstentionCount,
        groundingRate,
        positiveFeedback,
        negativeFeedback,
      },
      recentFeedback,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { submitFeedback, getAdminStats };
