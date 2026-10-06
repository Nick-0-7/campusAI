const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");

const JWT_SECRET =
  process.env.JWT_SECRET || "campusai_secret_key_2026_education_tech";

// In-memory user store when MongoDB Atlas connection is pending
let memoryUsers = [
  {
    _id: "user-faculty-demo",
    name: "Dr. Rajesh Sharma",
    email: "faculty@campus.edu",
    passwordHash: bcrypt.hashSync("password123", 10),
    role: "faculty",
    department: "Computer Science & Engineering",
    rollNo: "",
  },
  {
    _id: "user-student-demo",
    name: "Alex Johnson",
    email: "student@campus.edu",
    passwordHash: bcrypt.hashSync("password123", 10),
    role: "student",
    department: "Computer Science & Engineering",
    rollNo: "CS2024-042",
  },
];

// Helper to check DB connection
const isDbConnected = () => mongoose.connection.readyState === 1;

// Register route
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, rollNo, department, adminToken } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required.",
      });
    }

    const providedToken = req.body.accessToken || req.body.facultyToken || req.body.adminToken;
    if (role === "faculty" || role === "admin") {
      const requiredToken =
        process.env.FACULTY_ACCESS_TOKEN ||
        process.env.ADMIN_ACCESS_TOKEN ||
        "CAMPUS_AI_ADMIN_SECURE_2026_KEY";
      if (!providedToken || providedToken.trim() !== requiredToken.trim()) {
        return res.status(403).json({
          success: false,
          message:
            "Invalid or missing Access Token. Only authorized faculty and staff with the valid token can create a Faculty account.",
        });
      }
    }

    const cleanEmail = email.toLowerCase().trim();

    if (isDbConnected()) {
      try {
        const existingUser = await User.findOne({ email: cleanEmail });
        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: "An account with this email already exists.",
          });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
          name,
          email: cleanEmail,
          password: hashedPassword,
          role: role || "student",
          rollNo: role === "student" ? rollNo || "" : "",
          department:
            role === "faculty" ? department || "" : department || "",
        });

        await newUser.save();

        const token = jwt.sign(
          { id: newUser._id, role: newUser.role, email: newUser.email },
          JWT_SECRET,
          { expiresIn: "7d" }
        );

        return res.status(201).json({
          success: true,
          message: "Account created successfully.",
          token,
          user: {
            id: newUser._id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            rollNo: newUser.rollNo,
            department: newUser.department,
          },
        });
      } catch (dbErr) {
        console.warn("DB register error, using memory fallback:", dbErr.message);
      }
    }

    // In-memory fallback
    const existingMemoryUser = memoryUsers.find((u) => u.email === cleanEmail);
    if (existingMemoryUser) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newMemoryUser = {
      _id: "user-" + Date.now(),
      name,
      email: cleanEmail,
      passwordHash: hashedPassword,
      role: role || "student",
      rollNo: role === "student" ? rollNo || "CS-2026" : "",
      department: department || "General",
    };

    memoryUsers.push(newMemoryUser);

    const token = jwt.sign(
      {
        id: newMemoryUser._id,
        role: newMemoryUser.role,
        email: newMemoryUser.email,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(201).json({
      success: true,
      message: "Account registered successfully.",
      token,
      user: {
        id: newMemoryUser._id,
        name: newMemoryUser.name,
        email: newMemoryUser.email,
        role: newMemoryUser.role,
        rollNo: newMemoryUser.rollNo,
        department: newMemoryUser.department,
      },
    });
  } catch (error) {
    console.error("Register Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during registration.",
      error: error.message,
    });
  }
});

// Login route
router.post("/login", async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    if (isDbConnected()) {
      try {
        const user = await User.findOne({ email: cleanEmail });
        if (user) {
          if (role && user.role !== role && !(role === "faculty" && user.role === "admin")) {
            return res.status(403).json({
              success: false,
              message: `This account is registered as ${user.role}. Please switch role to ${user.role}.`,
            });
          }

          const isMatch = await bcrypt.compare(password, user.password);
          if (!isMatch) {
            return res.status(401).json({
              success: false,
              message: "Invalid email or password.",
            });
          }

          const token = jwt.sign(
            { id: user._id, role: user.role, email: user.email },
            JWT_SECRET,
            { expiresIn: "7d" }
          );

          return res.status(200).json({
            success: true,
            message: "Logged in successfully.",
            token,
            user: {
              id: user._id,
              name: user.name,
              email: user.email,
              role: user.role,
              rollNo: user.rollNo,
              department: user.department,
            },
          });
        }
      } catch (dbErr) {
        console.warn("DB login lookup error, falling back to memory:", dbErr.message);
      }
    }

    // In-memory fallback
    let memUser = memoryUsers.find((u) => u.email === cleanEmail);

    if (memUser) {
      if (role && memUser.role !== role && !(role === "faculty" && memUser.role === "admin")) {
        return res.status(403).json({
          success: false,
          message: `This account is registered as ${memUser.role}. Please switch role to ${memUser.role}.`,
        });
      }

      const isMatch = await bcrypt.compare(password, memUser.passwordHash);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password.",
        });
      }
    } else {
      // Auto-provision demo session if user enters a new email to test without friction
      memUser = {
        _id: "user-" + Date.now(),
        name: cleanEmail.split("@")[0].replace(/[._-]/g, " "),
        email: cleanEmail,
        passwordHash: await bcrypt.hash(password, 10),
        role: role || "student",
        rollNo: role === "student" ? "CS-2026-TEMP" : "",
        department: role === "faculty" ? "Academic Department" : "Undergraduate",
      };
      memoryUsers.push(memUser);
    }

    const token = jwt.sign(
      { id: memUser._id, role: memUser.role, email: memUser.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      success: true,
      message: "Logged in successfully.",
      token,
      user: {
        id: memUser._id,
        name: memUser.name,
        email: memUser.email,
        role: memUser.role,
        rollNo: memUser.rollNo,
        department: memUser.department,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during login.",
      error: error.message,
    });
  }
});

// Profile / Current user route
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    if (isDbConnected()) {
      try {
        const user = await User.findById(decoded.id).select("-password");
        if (user) {
          return res.json({ success: true, user });
        }
      } catch (e) {}
    }

    const memUser = memoryUsers.find((u) => u._id === decoded.id);
    if (memUser) {
      const { passwordHash, ...safeUser } = memUser;
      return res.json({ success: true, user: safeUser });
    }

    return res.json({
      success: true,
      user: { id: decoded.id, email: decoded.email, role: decoded.role },
    });
  } catch (error) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid or expired token" });
  }
});

module.exports = router;
