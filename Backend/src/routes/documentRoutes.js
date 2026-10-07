const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const { authenticate, optionalAuthenticate, requireRole } = require("../middleware/auth");
const {
  uploadDocument,
  listDocuments,
  getDocumentById,
  getDocumentStats,
  updateDocumentVersion,
  deleteDocument,
  reprocessDocument,
  downloadDocument,
} = require("../controllers/documentController");

// Public/Read: Knowledge statistics and document listing
router.get("/", optionalAuthenticate, listDocuments);
router.get("/stats", optionalAuthenticate, getDocumentStats);
router.get("/:id", optionalAuthenticate, getDocumentById);

// Authenticated file download
router.get("/:id/download", authenticate, downloadDocument);

// Role-protected Document management (Faculty / Admin only)
router.post(
  "/upload",
  authenticate,
  requireRole("admin", "faculty"),
  upload.single("file"),
  uploadDocument
);

router.post(
  "/:id/reprocess",
  authenticate,
  requireRole("admin", "faculty"),
  reprocessDocument
);

router.post(
  "/:id/versions",
  authenticate,
  requireRole("admin", "faculty"),
  upload.single("file"),
  updateDocumentVersion
);

router.delete(
  "/:id",
  authenticate,
  requireRole("admin", "faculty"),
  deleteDocument
);

module.exports = router;
