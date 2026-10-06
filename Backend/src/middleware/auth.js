const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authorization token required" });
    }

    const token = authHeader.split(" ")[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || "campus_ai_super_secret_jwt_key_2026");
    } catch (verifyErr) {
      // Graceful fallback to previous dev secret during key rotation
      try {
        decoded = jwt.verify(token, "campus_ai_super_secret_jwt_key_2026");
      } catch (legacyErr) {
        return res.status(401).json({ message: "Invalid or expired token", error: verifyErr.message });
      }
    }

    let user = await User.findById(decoded.id).select("-password");
    if (!user && decoded.email) {
      user = await User.findOne({ email: decoded.email.toLowerCase() }).select("-password");
    }

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
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET || "campus_ai_super_secret_jwt_key_2026");
      } catch (verifyErr) {
        try {
          decoded = jwt.verify(token, "campus_ai_super_secret_jwt_key_2026");
        } catch (e) {
          decoded = null;
        }
      }

      if (decoded && decoded.id) {
        const user = await User.findById(decoded.id).select("-password");
        if (user) req.user = user;
      }
    }
  } catch (error) {
    // Continue as guest
  }
  next();
};

module.exports = { authenticate, optionalAuthenticate, requireRole };
