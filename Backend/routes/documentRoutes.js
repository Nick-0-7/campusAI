const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const Document = require("../models/Document");

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// In-memory fallback if Atlas is pending connection
let memoryDocs = [
  {
    _id: "doc-1",
    title: "Academic Regulations & Attendance Guidelines",
    category: "Attendance Policies",
    department: "All Departments",
    originalName: "Academic_Regulations_2026.pdf",
    fileName: "Academic_Regulations_2026.pdf",
    filePath: "/uploads/Academic_Regulations_2026.pdf",
    fileType: "PDF",
    fileSize: 2450000,
    uploaderName: "Dr. A. Sharma",
    status: "Indexed",
    createdAt: new Date().toISOString(),
  },
  {
    _id: "doc-2",
    title: "Examination Rules & Evaluation Standards",
    category: "Examination Guidelines",
    department: "All Departments",
    originalName: "Examination_Rules_v4.pdf",
    fileName: "Examination_Rules_v4.pdf",
    filePath: "/uploads/Examination_Rules_v4.pdf",
    fileType: "PDF",
    fileSize: 1850000,
    uploaderName: "Dean of Examinations",
    status: "Indexed",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    _id: "doc-3",
    title: "Merit-cum-Means Scholarship & Financial Aid Manual",
    category: "Scholarship Information",
    department: "Student Affairs",
    originalName: "Scholarship_Manual_2026.docx",
    fileName: "Scholarship_Manual_2026.docx",
    filePath: "/uploads/Scholarship_Manual_2026.docx",
    fileType: "DOCX",
    fileSize: 920000,
    uploaderName: "Scholarship Committee",
    status: "Indexed",
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    _id: "doc-4",
    title: "Training & Placement Drive Protocols",
    category: "Placement Information",
    department: "Training & Placement Cell",
    originalName: "Placement_Policy_Notice.pdf",
    fileName: "Placement_Policy_Notice.pdf",
    filePath: "/uploads/Placement_Policy_Notice.pdf",
    fileType: "PDF",
    fileSize: 1420000,
    uploaderName: "Prof. R. Verma",
    status: "Indexed",
    createdAt: new Date(Date.now() - 259200000).toISOString(),
  },
];

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const cleanBaseName = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, "_");
    cb(null, `${cleanBaseName}-${uniqueSuffix}${ext}`);
  },
});

// File filter (PDF, TXT, DOCX, CSV)
const fileFilter = (req, file, cb) => {
  const allowedExtensions = /pdf|txt|docx|doc|csv/;
  const ext = path.extname(file.originalname).toLowerCase().replace(".", "");
  if (allowedExtensions.test(ext)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only PDF, TXT, DOCX, and CSV files are accepted."
      )
    );
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 },
});

// @route   POST /api/documents/upload
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No document file was provided.",
      });
    }

    const {
      title,
      category,
      department,
      description,
      uploaderName,
      uploadedBy,
    } = req.body;

    if (!title) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: "Document title is required.",
      });
    }

    const fileType = path
      .extname(req.file.originalname)
      .toLowerCase()
      .replace(".", "");

    const isDbConnected = mongoose.connection.readyState === 1;

    let savedDoc = null;

    if (isDbConnected) {
      try {
        const newDoc = new Document({
          title,
          category: category || "Academic Regulations",
          department: department || "All Departments",
          description: description || "",
          fileName: req.file.filename,
          originalName: req.file.originalname,
          filePath: `/uploads/${req.file.filename}`,
          fileType: fileType.toUpperCase(),
          fileSize: req.file.size,
          uploaderName: uploaderName || "Faculty Member",
          uploadedBy: mongoose.isValidObjectId(uploadedBy) ? uploadedBy : null,
          status: "Indexed",
        });

        savedDoc = await newDoc.save();
      } catch (dbErr) {
        console.warn("DB save document error:", dbErr.message);
      }
    }

    if (!savedDoc) {
      savedDoc = {
        _id: "doc-" + Date.now(),
        title,
        category: category || "Academic Regulations",
        department: department || "All Departments",
        description: description || "",
        fileName: req.file.filename,
        originalName: req.file.originalname,
        filePath: `/uploads/${req.file.filename}`,
        fileType: fileType.toUpperCase(),
        fileSize: req.file.size,
        uploaderName: uploaderName || "Faculty Member",
        status: "Indexed",
        createdAt: new Date().toISOString(),
      };
      memoryDocs.unshift(savedDoc);
    }

    return res.status(201).json({
      success: true,
      message: "Document uploaded and indexed successfully into Knowledge Base.",
      document: savedDoc,
    });
  } catch (error) {
    console.error("Document Upload Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to upload document.",
      error: error.message,
    });
  }
});

// @route   GET /api/documents
router.get("/", async (req, res) => {
  try {
    const { category, department, search } = req.query;
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      let query = {};
      if (category && category !== "All") query.category = category;
      if (department && department !== "All") query.department = department;
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: "i" } },
          { originalName: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ];
      }
      const documents = await Document.find(query).sort({ createdAt: -1 });
      return res.json({ success: true, count: documents.length, documents });
    }

    let filtered = [...memoryDocs];
    if (category && category !== "All") {
      filtered = filtered.filter((d) => d.category === category);
    }
    if (department && department !== "All") {
      filtered = filtered.filter((d) => d.department === department);
    }
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.title.toLowerCase().includes(s) ||
          d.originalName.toLowerCase().includes(s)
      );
    }

    return res.json({ success: true, count: filtered.length, documents: filtered });
  } catch (error) {
    console.error("Fetch Documents Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch documents.",
      error: error.message,
    });
  }
});

// @route   GET /api/documents/stats
router.get("/stats", async (req, res) => {
  try {
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected) {
      const totalDocs = await Document.countDocuments();
      const categories = await Document.aggregate([
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ]);
      const fileTypes = await Document.aggregate([
        { $group: { _id: "$fileType", count: { $sum: 1 } } },
      ]);
      const recentDocs = await Document.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("title category originalName fileSize createdAt status");

      return res.json({
        success: true,
        stats: {
          totalDocuments: totalDocs,
          categories,
          fileTypes,
          recentDocs,
          indexingStatus: "Active & Synced",
        },
      });
    }

    return res.json({
      success: true,
      stats: {
        totalDocuments: memoryDocs.length,
        categories: [{ _id: "General", count: memoryDocs.length }],
        fileTypes: [{ _id: "PDF", count: 3 }, { _id: "DOCX", count: 1 }],
        recentDocs: memoryDocs.slice(0, 5),
        indexingStatus: "Active (Awaiting Atlas URI)",
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/documents/:id
router.delete("/:id", async (req, res) => {
  try {
    const isDbConnected = mongoose.connection.readyState === 1;

    if (isDbConnected && mongoose.isValidObjectId(req.params.id)) {
      const doc = await Document.findById(req.params.id);
      if (doc) {
        const physicalPath = path.join(uploadsDir, doc.fileName);
        if (fs.existsSync(physicalPath)) fs.unlinkSync(physicalPath);
        await Document.findByIdAndDelete(req.params.id);
      }
    }

    memoryDocs = memoryDocs.filter((d) => d._id !== req.params.id);

    return res.json({
      success: true,
      message: "Document deleted successfully.",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
