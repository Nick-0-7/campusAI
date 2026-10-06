const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

// Route imports
const authRoutes = require("./routes/authRoutes");
const documentRoutes = require("./routes/documentRoutes");
const chatRoutes = require("./routes/chatRoutes");

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/campusai";

// Ensure uploads folder exists
const uploadsPath = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}

// Disable Mongoose operation buffering so requests don't hang if Atlas connection is pending
mongoose.set("bufferCommands", false);

// Middleware
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use("/uploads", express.static(uploadsPath));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/chat", chatRoutes);

// Health Check
app.get("/api/health", (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  res.json({
    status: "ok",
    service: "CampusAI Express Backend",
    database: isConnected ? "Connected" : "Awaiting Atlas URI",
    dbReadyState: mongoose.connection.readyState,
    timestamp: new Date().toISOString(),
  });
});

// Root welcome route
app.get("/", (req, res) => {
  res.send("CampusAI Backend is running. Ready for MongoDB Atlas connection.");
});

// MongoDB Connection
console.log("Connecting to MongoDB...");
mongoose
  .connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
  })
  .then(() => {
    console.log("-----------------------------------------");
    console.log("MongoDB connected successfully!");
    console.log(`Database: ${mongoose.connection.name}`);
    console.log("-----------------------------------------");
  })
  .catch((err) => {
    console.log("-----------------------------------------");
    console.warn("MongoDB connection note:", err.message);
    console.log(">>> Paste your MongoDB Atlas URI into Backend/.env as MONGO_URI");
    console.log("-----------------------------------------");
  });

// Start Server
app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(` CampusAI Backend Server running on port ${PORT}`);
  console.log(` Health check: http://localhost:${PORT}/api/health`);
  console.log(` API Endpoints:`);
  console.log(`   - Auth:      http://localhost:${PORT}/api/auth`);
  console.log(`   - Documents: http://localhost:${PORT}/api/documents`);
  console.log(`   - Chat:      http://localhost:${PORT}/api/chat`);
  console.log(`=========================================`);
});
