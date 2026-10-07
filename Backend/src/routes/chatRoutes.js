const express = require("express");
const router = express.Router();
const { authenticate, optionalAuthenticate } = require("../middleware/auth");
const {
  handleChatQuery,
  getChatSessions,
  getSessionMessages,
  getHistory,
  clearHistory,
  deleteSession,
} = require("../controllers/chatController");

// Public query endpoint (optional login for history saving)
router.post("/", optionalAuthenticate, handleChatQuery);

// Protected user-specific conversation history and session management
router.get("/sessions", authenticate, getChatSessions);
router.get("/sessions/:sessionId", authenticate, getSessionMessages);
router.get("/history", authenticate, getHistory);
router.delete("/history", authenticate, clearHistory);
router.delete("/sessions/:sessionId", authenticate, deleteSession);

module.exports = router;
