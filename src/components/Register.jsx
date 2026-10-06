import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import "../templates/login.css";
import saarthiOrb from "../assets/saarthi-orb.svg";
import { GraduationCap, Building2, ShieldCheck, Key, ArrowRight } from "lucide-react";

const Register = () => {
  const navigate = useNavigate();

  const [role, setRole] = useState("student");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [userData, setUserData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    rollNo: "",
    department: "",
    accessToken: "",
  });

  const handleChange = (e) => {
    setUserData({
      ...userData,
      [e.target.name]: e.target.value,
    });
    if (error) setError("");
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (userData.password !== userData.confirmPassword) {
      setError("Passwords do not match. Please verify.");
      return;
    }

    if (userData.password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (role === "faculty" && !userData.accessToken.trim()) {
      setError("Faculty Access Token is required to create a Faculty account.");
      return;
    }

    setLoading(true);

    const payload = {
      name: userData.name,
      email: userData.email,
      password: userData.password,
      role,
      rollNo: role === "student" ? userData.rollNo : "",
      department: userData.department || (role === "student" ? "General" : "Academic Department"),
      accessToken: role === "faculty" ? userData.accessToken.trim() : undefined,
    };

    try {
      const response = await api.auth.register(payload);

      if (response && (response.success || response.token)) {
        setSuccessMsg("Account registered successfully! Redirecting to login...");
        setTimeout(() => {
          navigate("/login");
        }, 1200);
      } else {
        setError(response?.message || "Failed to register. Please try again.");
      }
    } catch (err) {
      console.warn("Backend registration error:", err);
      setError(err?.message || "Failed to register account. Please check credentials or token.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo" onClick={() => navigate("/")} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "10px" }}>
          <img src={saarthiOrb} alt="SaarthiAI" style={{ width: "28px", height: "28px", filter: "drop-shadow(0 0 8px rgba(79, 117, 255, 0.45))" }} />
          <span style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.4px", color: "#ffffff" }}>SaarthiAI</span>
        </div>

        <h1>Create Account</h1>

        <p className="login-subtitle">
          Join your campus knowledge assistant
        </p>

        {/* ROLE SELECTOR: Student or Faculty only */}
        <div className="role-selector">
          <button
            type="button"
            className={role === "student" ? "selected" : ""}
            onClick={() => setRole("student")}
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "7px" }}
          >
            <GraduationCap size={16} />
            <span>Student</span>
          </button>

          <button
            type="button"
            className={role === "faculty" ? "selected" : ""}
            onClick={() => setRole("faculty")}
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "7px" }}
          >
            <Building2 size={16} />
            <span>Faculty</span>
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: "12px 14px",
              marginBottom: "18px",
              borderRadius: "8px",
              backgroundColor: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#fca5a5",
              fontSize: "13px",
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}

        {successMsg && (
          <div
            style={{
              padding: "12px 14px",
              marginBottom: "18px",
              borderRadius: "8px",
              backgroundColor: "rgba(34, 197, 94, 0.12)",
              border: "1px solid rgba(34, 197, 94, 0.3)",
              color: "#86efac",
              fontSize: "13px",
              lineHeight: 1.5,
            }}
          >
            {successMsg}
          </div>
        )}

        <form onSubmit={handleRegister}>
          {role === "faculty" && (
            <div style={{ marginBottom: "16px" }}>
              <label style={{ color: "#a5b4fc", display: "flex", alignItems: "center", gap: "6px" }}>
                <Key size={14} />
                <span>Faculty Access Token *</span>
              </label>
              <input
                type="password"
                name="accessToken"
                placeholder="Enter institutional faculty access token..."
                value={userData.accessToken}
                onChange={handleChange}
                required
                style={{
                  borderColor: "#6366f1",
                  backgroundColor: "rgba(99, 102, 241, 0.08)",
                  marginBottom: "8px",
                }}
              />
              <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#818cf8", lineHeight: 1.4 }}>
                🔒 Restricted: A valid institutional access token is required to create a Faculty account.
              </p>
            </div>
          )}

          <label>
            {role === "student" ? "Student Full Name" : "Faculty Name & Title"}
          </label>
          <input
            type="text"
            name="name"
            placeholder={
              role === "student" ? "e.g. Alex Johnson" : "e.g. Dr. Rajesh Sharma"
            }
            value={userData.name}
            onChange={handleChange}
            required
          />

          <label>Institutional Email</label>
          <input
            type="email"
            name="email"
            placeholder={
              role === "student"
                ? "student@campus.edu"
                : "faculty@campus.edu"
            }
            value={userData.email}
            onChange={handleChange}
            required
          />

          {role === "student" && (
            <>
              <label>Roll Number / Student ID</label>
              <input
                type="text"
                name="rollNo"
                placeholder="e.g. CS2024-089"
                value={userData.rollNo}
                onChange={handleChange}
                required
              />
            </>
          )}

          <label>Department</label>
          <input
            type="text"
            name="department"
            placeholder="e.g. Computer Science & Engineering"
            value={userData.department}
            onChange={handleChange}
            required
          />

          <label>Password</label>
          <input
            type="password"
            name="password"
            placeholder="Create a strong password (min 6 chars)"
            value={userData.password}
            onChange={handleChange}
            required
          />

          <label>Confirm Password</label>
          <input
            type="password"
            name="confirmPassword"
            placeholder="Confirm your password"
            value={userData.confirmPassword}
            onChange={handleChange}
            required
          />

          <button className="login-submit" type="submit" disabled={loading}>
            {loading ? (
              "Creating Account..."
            ) : (
              <>
                <span>
                  Create {role === "student" ? "Student" : "Faculty"} Account
                </span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <p className="login-footer">
          Already have an account?{" "}
          <span onClick={() => navigate("/login")}>Login</span>
        </p>
      </div>
    </div>
  );
};

export default Register;