const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const connectDB = require("../src/config/db");
const User = require("../src/models/User");
const Document = require("../src/models/Document");
const DocumentVersion = require("../src/models/DocumentVersion");
const { processDocumentRAG } = require("../src/controllers/documentController");

const indexSITCOE = async () => {
  await connectDB();

  const admin = await User.findOne({ role: "admin" });
  if (!admin) {
    console.error("Admin user not found.");
    process.exit(1);
  }

  const filePath = path.join(__dirname, "../../sample_docs/SITCOE_Academic_Rules_and_Regulations.txt");

  let doc = await Document.findOne({ title: "Academic Rules and Regulations (SITCOE).pdf" });
  if (!doc) {
    doc = new Document({
      title: "Academic Rules and Regulations (SITCOE).pdf",
      fileName: "Academic Rules and Regulations (SITCOE).pdf",
      fileType: "txt",
      filePath,
      fileSize: fs.statSync(filePath).size,
      department: "Academic Council",
      category: "Academic",
      currentVersion: 1,
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
      changeSummary: "Official Academic Rules and Regulations - SITCOE Autonomous",
    });
  }

  console.log(`Processing and indexing ${doc.title}...`);
  await processDocumentRAG(doc);

  console.log("SITCOE document successfully indexed into CampusAI!");
  process.exit(0);
};

indexSITCOE();
