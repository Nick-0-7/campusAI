const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const connectDB = require("../src/config/db");
const User = require("../src/models/User");
const Document = require("../src/models/Document");
const DocumentVersion = require("../src/models/DocumentVersion");
const { processDocumentRAG } = require("../src/controllers/documentController");

const seedInitialDocuments = async () => {
  await connectDB();

  const admin = await User.findOne({ role: "admin" });
  if (!admin) {
    console.error("Admin user not found. Run server once to seed admin.");
    process.exit(1);
  }

  const sampleDocs = [
    {
      title: "Examination Rules.pdf",
      fileName: "Examination Rules.pdf",
      fileType: "txt",
      filePath: path.join(__dirname, "../../sample_docs/Examination_Rules.txt"),
      department: "Academic Affairs",
      category: "Examination",
      currentVersion: 1,
    },
    {
      title: "Scholarship Guidelines.pdf",
      fileName: "Scholarship Guidelines.pdf",
      fileType: "txt",
      filePath: path.join(__dirname, "../../sample_docs/Scholarship_Guidelines.txt"),
      department: "Student Affairs",
      category: "Scholarship",
      currentVersion: 1,
    },
    {
      title: "Placement Policy.pdf",
      fileName: "Placement Policy.pdf",
      fileType: "txt",
      filePath: path.join(__dirname, "../../sample_docs/Placement_Policy.txt"),
      department: "Career Services",
      category: "Placements",
      currentVersion: 1,
    },
  ];

  for (const docData of sampleDocs) {
    let doc = await Document.findOne({ title: docData.title });
    if (!doc) {
      doc = new Document({
        ...docData,
        fileSize: fs.statSync(docData.filePath).size,
        uploadedBy: admin._id,
        status: "processing",
      });
      await doc.save();

      await DocumentVersion.create({
        documentId: doc._id,
        version: 1,
        filePath: doc.filePath,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        uploadedBy: admin._id,
        changeSummary: "Initial institutional upload",
      });
    }

    console.log(`Processing and indexing ${doc.title}...`);
    await processDocumentRAG(doc);
  }

  console.log("Documents successfully seeded and indexed!");
  process.exit(0);
};

seedInitialDocuments();
