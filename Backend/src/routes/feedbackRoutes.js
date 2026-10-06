const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require("../middleware/auth");
const { submitFeedback, getAdminStats } = require("../controllers/feedbackController");

router.post("/", authenticate, submitFeedback);
router.get("/stats", authenticate, requireRole("admin"), getAdminStats);

module.exports = router;
