const Feedback = require("../models/Feedback");
const ChatMessage = require("../models/ChatMessage");
const Document = require("../models/Document");
const User = require("../models/User");

const submitFeedback = async (req, res) => {
  try {
    const { messageId, rating, comment } = req.body;

    if (!messageId || !["positive", "negative"].includes(rating)) {
      return res.status(400).json({ message: "messageId and valid rating ('positive'/'negative') required" });
    }

    const feedback = await Feedback.create({
      messageId,
      userId: req.user._id,
      rating,
      comment: comment || "",
    });

    return res.status(201).json({ message: "Feedback submitted successfully", feedback });
  } catch (err) {
    return res.status(500).json({ message: err.message });
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
