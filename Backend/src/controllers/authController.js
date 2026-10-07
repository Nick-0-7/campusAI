const jwt = require("jsonwebtoken");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");

const createToken = (user) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured on the server");
  }
  return jwt.sign(
    { id: user._id, role: user.role, email: user.email },
    secret,
    { expiresIn: "7d" }
  );
};

const register = async (req, res) => {
  try {
    const { name, email, password, role, rollNo, department, accessToken, facultyToken, adminToken } = req.body;
    const providedToken = (accessToken || facultyToken || adminToken || "").trim();

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email, and password are required" });
    }

    const requestedRole = (role || "student").toLowerCase().trim();
    let assignedRole = "student";

    if (requestedRole === "admin") {
      const requiredAdminToken = (process.env.ADMIN_ACCESS_TOKEN || "").trim();
      if (!requiredAdminToken || !providedToken || providedToken !== requiredAdminToken) {
        return res.status(403).json({
          success: false,
          message: "Invalid or missing Administrator Access Token. Administrator account creation denied.",
        });
      }
      assignedRole = "admin";
    } else if (requestedRole === "faculty") {
      const requiredFacultyToken = (process.env.FACULTY_ACCESS_TOKEN || "").trim();
      if (!requiredFacultyToken || !providedToken || providedToken !== requiredFacultyToken) {
        return res.status(403).json({
          success: false,
          message: "Invalid or missing Faculty Access Token. Faculty account creation denied.",
        });
      }
      assignedRole = "faculty";
    } else {
      assignedRole = "student";
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: "An account with this email already exists" });
    }

    const user = new User({
      name,
      email: email.toLowerCase(),
      password,
      role: assignedRole,
      rollNo: assignedRole === "student" ? rollNo : undefined,
      department: department ? department.trim() : "General",
      year: req.body.year ? req.body.year.trim() : "1st Year",
    });

    await user.save();

    await AuditLog.create({
      action: "USER_REGISTERED",
      userId: user._id,
      details: { role: assignedRole, email: user.email },
      ip: req.ip,
    });

    const token = createToken(user);

    return res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        rollNo: user.rollNo,
        department: user.department,
        year: user.year,
      },
    });
  } catch (err) {
    console.error("[Auth Register Error]", err);
    return res.status(500).json({ success: false, message: "Registration failed", error: err.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Role check warning or adaptation
    if (role && user.role !== role && user.role !== "admin") {
      return res.status(403).json({
        message: `Account is registered as ${user.role}, but attempting to sign in as ${role}`,
      });
    }

    await AuditLog.create({
      action: "USER_LOGIN",
      userId: user._id,
      details: { role: user.role },
      ip: req.ip,
    });

    const token = createToken(user);

    return res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        rollNo: user.rollNo,
        department: user.department || "General",
        year: user.year || "1st Year",
      },
    });
  } catch (err) {
    console.error("[Auth Login Error]", err);
    return res.status(500).json({ message: "Login failed", error: err.message });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    return res.json({ user });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, department, year, rollNo } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (name) user.name = name.trim();
    if (department) user.department = department.trim();
    if (year) user.year = year.trim();
    if (rollNo !== undefined) user.rollNo = rollNo ? rollNo.trim() : "";
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        rollNo: user.rollNo,
        department: user.department,
        year: user.year,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { register, login, getMe, updateProfile };
