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
  viewDocumentFile,
  compareDocumentVersions,
} = require("../controllers/documentController");

// Public/Read: Knowledge statistics and document listing
router.get("/", optionalAuthenticate, listDocuments);
router.get("/stats", optionalAuthenticate, getDocumentStats);

// Policy diff & version comparison (Features 4)
router.get("/compare", optionalAuthenticate, compareDocumentVersions);
router.post("/compare", optionalAuthenticate, compareDocumentVersions);

// File viewing & citations download (Features 2)
router.get("/:id/file", optionalAuthenticate, viewDocumentFile);
router.get("/:id/download", optionalAuthenticate, downloadDocument);
router.get("/:id/diff", optionalAuthenticate, compareDocumentVersions);
router.get("/:id", optionalAuthenticate, getDocumentById);

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
