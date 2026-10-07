const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authorization token required" });
    }

    const token = authHeader.split(" ")[1];
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("[Auth] Server misconfiguration: JWT_SECRET environment variable is not defined");
      return res.status(500).json({ message: "Internal server configuration error" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (verifyErr) {
      return res.status(401).json({ message: "Invalid or expired token", error: verifyErr.message });
    }

    if (!decoded || !decoded.id) {
      return res.status(401).json({ message: "Malformed token payload" });
    }

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "User not found or deactivated" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token", error: error.message });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Forbidden: Access requires one of roles: [${roles.join(", ")}]. Current: ${req.user.role}`,
      });
    }
    next();
  };
};

const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const secret = process.env.JWT_SECRET;
      if (secret) {
        const decoded = jwt.verify(token, secret);
        if (decoded && decoded.id) {
          const user = await User.findById(decoded.id).select("-password");
          if (user) req.user = user;
        }
      }
    }
  } catch (error) {
    // Continue as guest
  }
  next();
};

module.exports = { authenticate, optionalAuthenticate, requireRole };

