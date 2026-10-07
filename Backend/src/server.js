const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const documentRoutes = require("./routes/documentRoutes");
const chatRoutes = require("./routes/chatRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const User = require("./models/User");

const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 5000;

// Rate limiters to prevent DoS, brute-force, and API quota exhaustion
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 400,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests from this IP, please try again later." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login/registration attempts. Please try again after 15 minutes." },
});

const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Chat rate limit reached. Please wait a moment before asking another question." },
});

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// General API rate limiter
app.use("/api", apiLimiter);

// Root status route
app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "🚀 Saarthi AI Knowledge Copilot Backend is running successfully!",
    version: "1.0.0",
    endpoints: {
      health: "/api/health",
      auth: "/api/auth",
      chat: "/api/chat",
      documents: "/api/documents",
      feedback: "/api/feedback",
    },
    database: "MongoDB Atlas Connected",
  });
});

// API Routes with specialized rate limiting
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/chat", chatLimiter, chatRoutes);
app.use("/api/feedback", feedbackRoutes);

// Health check endpoint
app.get("/api/health", async (req, res) => {
  let geminiTest = "not_tested";
  if (req.query.testGemini === "true") {
    try {
      const { GoogleGenerativeAI } = require("@google/generative-ai");
      const key = process.env.GEMINI_API_KEY || "";
      const genAI = new GoogleGenerativeAI(key.trim());
      const modelName = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
      const model = genAI.getGenerativeModel({ model: modelName });
      const testRes = await model.generateContent("hello");
      geminiTest = "OK: " + testRes.response.text().trim();
    } catch (e) {
      geminiTest = "ERROR: " + e.message;
    }
  }

  res.json({
    status: "ok",
    service: "Saarthi AI Knowledge Copilot",
    geminiConfigured: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 10),
    geminiKeyPrefix: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.slice(0, 6) + "..." : "missing",
    geminiModelEnv: process.env.GEMINI_MODEL || "not_set",
    geminiTest,
    timestamp: new Date().toISOString(),
  });
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error("[Unhandled Server Error]", err);
  res.status(err.status || 500).json({
    message: err.message || "Internal server error occurred",
    grounded: false,
  });
});

// Seed default users if empty (for demo/development convenience only)
const seedDefaultAccounts = async () => {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_SEED !== "true") {
    return;
  }
  try {
    const adminExists = await User.findOne({ email: "admin@campus.edu" });
    if (!adminExists) {
      await User.create({
        name: "Campus Administrator",
        email: "admin@campus.edu",
        password: "AdminPassword123!",
        role: "admin",
        department: "Administration",
      });
      console.log("[Seed] Default admin account initialized: admin@campus.edu");
    }

    const studentExists = await User.findOne({ email: "student@campus.edu" });
    if (!studentExists) {
      await User.create({
        name: "Alex Johnson",
        email: "student@campus.edu",
        password: "StudentPassword123!",
        role: "student",
        rollNo: "CS2026-042",
        department: "Computer Science",
      });
      console.log("[Seed] Default student account initialized: student@campus.edu");
    }
  } catch (e) {
    console.warn("[Seed Error]", e.message);
  }
};

// Start Server
connectDB().then(async () => {
  await seedDefaultAccounts();
  app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🚀 Saarthi AI Backend running on port ${PORT}`);
    console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`===============================================`);
  });
});
