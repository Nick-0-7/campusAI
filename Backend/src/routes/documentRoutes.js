const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const { authenticate, requireRole } = require("../middleware/auth");
const {
  uploadDocument,
  listDocuments,
  getDocumentById,
  getDocumentStats,
  updateDocumentVersion,
  deleteDocument,
  reprocessDocument,
} = require("../controllers/documentController");

// Knowledge statistics and document listing
router.get("/", authenticate, listDocuments);
router.get("/stats", authenticate, getDocumentStats);
router.get("/:id", authenticate, getDocumentById);

// Admin-only management routes
router.post(
  "/upload",
  authenticate,
  requireRole("admin", "faculty"),
  upload.single("file"),
  uploadDocument
);

router.post("/:id/reprocess", authenticate, requireRole("admin"), reprocessDocument);

router.post(
  "/:id/versions",
  authenticate,
  requireRole("admin"),
  upload.single("file"),
  updateDocumentVersion
);

router.delete("/:id", authenticate, requireRole("admin"), deleteDocument);

module.exports = router;
