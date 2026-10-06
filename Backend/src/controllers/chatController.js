const mongoose = require("mongoose");
const ChatSession = require("../models/ChatSession");
const ChatMessage = require("../models/ChatMessage");
const { hybridRetrieve } = require("../rag/retrieval");
const { generateGroundedAnswer, ABSTENTION_MESSAGE } = require("../rag/gemini");

/**
 * Handle student/faculty natural language query with strict RAG and abstention gating
 */
const handleChatQuery = async (req, res) => {
  const startTime = Date.now();
  try {
    const { message, sessionId, department, category } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ message: "Question cannot be empty" });
    }

    const userId = req.user?._id;

    // 1. Locate or create chat session
    let session;
    if (sessionId && mongoose.isValidObjectId(sessionId)) {
      session = await ChatSession.findOne({ _id: sessionId, ...(userId ? { userId } : {}) });
    }
    if (!session && userId) {
      const titleSnippet = message.slice(0, 35) + (message.length > 35 ? "..." : "");
      session = await ChatSession.create({
        userId,
        title: titleSnippet,
      });
    }

    // 2. Perform Hybrid Retrieval (Vector + BM25 + RRF + Re-ranking)
    const retrieval = await hybridRetrieve(message, {
      topK: 4,
      department,
      category,
    });

    let answerPayload;

    // 3. Evidence / Confidence Gate ("No Evidence -> No Answer")
    if (!retrieval.isConfident || retrieval.chunks.length === 0) {
      answerPayload = {
        answer: ABSTENTION_MESSAGE,
        sources: [],
        confidence: retrieval.maxConfidence,
        grounded: false,
        abstention: true,
      };
    } else {
      // 4. Grounded Gemini Generation
      answerPayload = await generateGroundedAnswer(message, retrieval.chunks);
    }

    // Append conflict note if two disparate documents disagree
    let finalAnswer = answerPayload.answer;
    if (retrieval.conflictDetected && retrieval.conflictNote && !answerPayload.abstention) {
      finalAnswer += `\n\n⚠️ Note: ${retrieval.conflictNote}`;
    }

    const latencyMs = Date.now() - startTime;

    // 5. Store conversation history if session exists
    let userMsgDoc = null;
    let botMsgDoc = null;

    if (session && userId) {
      userMsgDoc = await ChatMessage.create({
        sessionId: session._id,
        userId,
        role: "user",
        content: message,
      });

      botMsgDoc = await ChatMessage.create({
        sessionId: session._id,
        userId,
        role: "assistant",
        content: finalAnswer,
        sources: answerPayload.sources,
        confidence: answerPayload.confidence,
        grounded: answerPayload.grounded,
        abstention: answerPayload.abstention,
        latencyMs,
      });
    }

    // 6. Return response matching hackathon requirements
    return res.status(200).json({
      answer: finalAnswer,
      sources: answerPayload.sources,
      confidence: answerPayload.confidence,
      grounded: answerPayload.grounded,
      abstention: answerPayload.abstention,
      conflictDetected: retrieval.conflictDetected,
      conflictNote: retrieval.conflictNote,
      sessionId: session ? session._id : null,
      messageId: botMsgDoc ? botMsgDoc._id : null,
      latencyMs,
    });
  } catch (err) {
    console.error("[Chat Controller Error]", err);
    return res.status(500).json({
      answer: "An error occurred while retrieving campus knowledge. Please try again.",
      sources: [],
      confidence: 0,
      grounded: false,
      abstention: true,
      error: err.message,
    });
  }
};

/**
 * Get user's chat sessions
 */
const getChatSessions = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.json({ sessions: [] });
    }
    const sessions = await ChatSession.find({ userId }).sort({ updatedAt: -1 });
    return res.json({ sessions });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/**
 * Get full history / inquiries for user
 */
const getHistory = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.json({ success: true, count: 0, history: [] });
    }

    const sessions = await ChatSession.find({ userId }).sort({ updatedAt: -1 }).limit(50);
    const sessionIds = sessions.map((s) => s._id);

    // Fetch messages for these sessions
    const messages = await ChatMessage.find({ sessionId: { $in: sessionIds } }).sort({ createdAt: 1 });

    const history = sessions.map((s) => {
      const sessionMsgs = messages.filter((m) => m.sessionId.toString() === s._id.toString());
      const firstUserMsg = sessionMsgs.find((m) => m.role === "user");
      const firstAssistantMsg = sessionMsgs.find((m) => m.role === "assistant");

      return {
        id: s._id,
        sessionId: s._id,
        title: s.title || "Campus Inquiry",
        query: firstUserMsg ? firstUserMsg.content : s.title,
        answer: firstAssistantMsg ? firstAssistantMsg.content : null,
        sources: firstAssistantMsg ? firstAssistantMsg.sources : [],
        confidence: firstAssistantMsg ? firstAssistantMsg.confidence : null,
        timestamp: s.createdAt,
        updatedAt: s.updatedAt,
      };
    });

    return res.json({ success: true, count: history.length, history });
  } catch (err) {
    console.error("[Get History Error]", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Clear all chat history or specific session
 */
const clearHistory = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { sessionId } = req.query;

    if (sessionId) {
      if (mongoose.isValidObjectId(sessionId)) {
        await ChatMessage.deleteMany({ sessionId, ...(userId ? { userId } : {}) });
        await ChatSession.deleteOne({ _id: sessionId, ...(userId ? { userId } : {}) });
      }
      return res.json({
        success: true,
        message: "Session history cleared successfully.",
      });
    }

    if (userId) {
      await ChatMessage.deleteMany({ userId });
      await ChatSession.deleteMany({ userId });
    }

    return res.json({
      success: true,
      message: "Chat history cleared successfully.",
    });
  } catch (err) {
    console.error("[Clear History Error]", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Delete a single chat session
 */
const deleteSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?._id;

    if (sessionId && mongoose.isValidObjectId(sessionId)) {
      await ChatMessage.deleteMany({ sessionId, ...(userId ? { userId } : {}) });
      await ChatSession.deleteOne({ _id: sessionId, ...(userId ? { userId } : {}) });
    }

    return res.json({ success: true, message: "Session deleted successfully." });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get messages inside a chat session
 */
const getSessionMessages = async (req, res) => {
  try {
    const messages = await ChatMessage.find({
      sessionId: req.params.sessionId,
      ...(req.user?._id ? { userId: req.user._id } : {}),
    }).sort({ createdAt: 1 });
    return res.json({ messages });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  handleChatQuery,
  getChatSessions,
  getSessionMessages,
  getHistory,
  clearHistory,
  deleteSession,
};
