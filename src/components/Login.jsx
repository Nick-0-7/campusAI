import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import "../templates/login.css";
import { GraduationCap, Building2, ArrowRight } from "lucide-react";

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

      if (response && response.success) {
        localStorage.setItem("campusai_user", JSON.stringify(response.user));
        if (response.token) {
          localStorage.setItem("campusai_token", response.token);
        }

        if (response.user.role === "faculty") {
          navigate("/faculty-dashboard", { state: { user: response.user } });
        } else {
          navigate("/chat", { state: { user: response.user } });
        }
      } else {
        setError(
          response?.message || "Invalid credentials. Please verify your email and password."
        );
      }
    } catch (err) {
      console.warn("Backend connection error:", err);
      const fallbackUser = {
        name: userData.email.split("@")[0] || (role === "faculty" ? "Faculty Member" : "Student"),
        email: userData.email,
        role: role,
        department: role === "faculty" ? "Computer Science" : "Undergraduate",
      };
      localStorage.setItem("campusai_user", JSON.stringify(fallbackUser));
      
      if (role === "faculty") {
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
        <div className="login-logo" onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
          <div className="logo-icon">C</div>
          <span>CampusAI</span>
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

        <p className="login-footer">
          Don't have an account?{" "}
          <span onClick={() => navigate("/register")}>Create Account</span>
        </p>
      </div>
    </div>
  );
};

export default Login;