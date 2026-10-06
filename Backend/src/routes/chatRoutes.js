const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const {
  handleChatQuery,
  getChatSessions,
  getSessionMessages,
} = require("../controllers/chatController");

router.post("/", authenticate, handleChatQuery);
router.get("/sessions", authenticate, getChatSessions);
router.get("/sessions/:sessionId", authenticate, getSessionMessages);

module.exports = router;
