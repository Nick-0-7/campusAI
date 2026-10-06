const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const { optionalAuthenticate } = require("../middleware/auth");
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
router.get("/", optionalAuthenticate, listDocuments);
router.get("/stats", optionalAuthenticate, getDocumentStats);
router.get("/:id", optionalAuthenticate, getDocumentById);

// Document upload and management routes
router.post(
  "/upload",
  optionalAuthenticate,
  upload.single("file"),
  uploadDocument
);

router.post("/:id/reprocess", optionalAuthenticate, reprocessDocument);

router.post(
  "/:id/versions",
  optionalAuthenticate,
  upload.single("file"),
  updateDocumentVersion
);

router.delete("/:id", optionalAuthenticate, deleteDocument);

module.exports = router;
