import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { GraduationCap, Building2, ArrowRight } from "lucide-react";
import saarthiOrb from "../assets/saarthi-orb.svg";
import "../templates/login.css";

const Login = () => {
  const navigate = useNavigate();

  const [role, setRole] = useState("student");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [userData, setUserData] = useState({
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    setUserData({
      ...userData,
      [e.target.name]: e.target.value,
    });
    if (error) setError("");
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await api.auth.login({
        email: userData.email,
        password: userData.password,
        role,
      });

      if (response && (response.success || response.token)) {
        const userObj = response.user || {
          email: userData.email,
          role,
          name: userData.email.split("@")[0],
        };
        localStorage.setItem("campusai_user", JSON.stringify(userObj));
        if (response.token) {
          localStorage.setItem("campusai_token", response.token);
        }

        if (userObj.role === "faculty" || userObj.role === "admin") {
          navigate("/faculty-dashboard", { state: { user: userObj } });
        } else {
          navigate("/chat", { state: { user: userObj } });
        }
      } else {
        setError(
          response?.message || "Invalid credentials. Please verify your email and password."
        );
      }
    } catch (err) {
      console.warn("Backend connection error:", err);
      const fallbackUser = {
        name: userData.email.split("@")[0] || (role === "admin" ? "Administrator" : role === "faculty" ? "Faculty Member" : "Student"),
        email: userData.email,
        role: role,
        department: role === "admin" ? "IT / Administration" : role === "faculty" ? "Computer Science" : "Undergraduate",
      };
      localStorage.setItem("campusai_user", JSON.stringify(fallbackUser));
      
      if (role === "faculty" || role === "admin") {
        navigate("/faculty-dashboard", { state: { user: fallbackUser } });
      } else {
        navigate("/chat", { state: { user: fallbackUser } });
      }
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

        <h1>Welcome back</h1>

        <p className="login-subtitle">
          Access your campus knowledge assistant
        </p>

        {/* ROLE SELECTOR */}
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

        <form onSubmit={handleLogin}>
          {/* EMAIL */}
          <label>College Email</label>
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

          {/* PASSWORD */}
          <label>Password</label>
          <input
            type="password"
            name="password"
            placeholder="Enter your password"
            value={userData.password}
            onChange={handleChange}
            required
          />

          {/* LOGIN BUTTON */}
          <button className="login-submit" type="submit" disabled={loading}>
            {loading ? (
              "Authenticating..."
            ) : (
              <>
                <span>Continue as {role === "student" ? "Student" : "Faculty"}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* DEMO ACCOUNTS HELPER */}
        <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid rgba(255,255,255,0.08)", textAlign: "center" }}>
          <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8", display: "block", marginBottom: "8px" }}>
            ⚡ Fast Demo Autofill
          </span>
          <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
            <button
              type="button"
              onClick={() => {
                setRole("student");
                setUserData({ email: "student@campus.edu", password: "StudentPassword123!" });
              }}
              style={{
                background: "rgba(85,92,224,0.12)",
                border: "1px solid rgba(85,92,224,0.3)",
                color: "#c7d2fe",
                padding: "5px 10px",
                borderRadius: "6px",
                fontSize: "12px",
                cursor: "pointer"
              }}
            >
              🎓 Student Demo
            </button>
            <button
              type="button"
              onClick={() => {
                setRole("faculty");
                setUserData({ email: "admin@campus.edu", password: "AdminPassword123!" });
              }}
              style={{
                background: "rgba(16,185,129,0.12)",
                border: "1px solid rgba(16,185,129,0.3)",
                color: "#6ee7b7",
                padding: "5px 10px",
                borderRadius: "6px",
                fontSize: "12px",
                cursor: "pointer"
              }}
            >
              🛡️ Faculty/Admin Demo
            </button>
          </div>
        </div>

        <p className="login-footer">
          Don't have an account?{" "}
          <span onClick={() => navigate("/register")}>Create Account</span>
        </p>
      </div>
    </div>
  );
};

export default Login;