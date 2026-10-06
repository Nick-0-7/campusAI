const express = require("express");
const router = express.Router();
const { optionalAuthenticate } = require("../middleware/auth");
const {
  handleChatQuery,
  getChatSessions,
  getSessionMessages,
  getHistory,
  clearHistory,
  deleteSession,
} = require("../controllers/chatController");

router.post("/", optionalAuthenticate, handleChatQuery);
router.get("/sessions", optionalAuthenticate, getChatSessions);
router.get("/sessions/:sessionId", optionalAuthenticate, getSessionMessages);
router.get("/history", optionalAuthenticate, getHistory);
router.delete("/history", optionalAuthenticate, clearHistory);
router.delete("/sessions/:sessionId", optionalAuthenticate, deleteSession);

module.exports = router;
