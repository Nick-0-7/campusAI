import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../templates/landing.css";
import saarthiOrb from "../assets/saarthi-orb.svg";
import { GraduationCap, Building2, LogOut } from "lucide-react";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const userJson = localStorage.getItem("campusai_user");
  const currentUser = userJson ? JSON.parse(userJson) : null;

  const handleLogout = () => {
    localStorage.removeItem("campusai_user");
    localStorage.removeItem("campusai_token");
    navigate("/");
  };

  return (
    <nav className="navbar">
      <div className="navbar-logo" onClick={() => navigate("/")} title="SaarthiAI Home">
        <img src={saarthiOrb} alt="SaarthiAI" className="saarthi-orb-logo" />
        <span style={{ color: "#ffffff", fontWeight: 700, fontSize: "19px", letterSpacing: "-0.4px" }}>
          SaarthiAI
        </span>
      </div>

      <div className="navbar-actions">
        {currentUser ? (
          <>
            <button
              className="login-btn"
              onClick={() =>
                navigate(
                  currentUser.role === "faculty"
                    ? "/faculty-dashboard"
                    : "/chat"
                )
              }
              title={`Logged in as ${currentUser.name}`}
              style={{ display: "inline-flex", alignItems: "center", gap: "7px" }}
            >
              {currentUser.role === "faculty" ? (
                <>
                  <Building2 size={14} />
                  <span>Faculty Portal</span>
                </>
              ) : (
                <>
                  <GraduationCap size={14} />
                  <span>Student Copilot</span>
                </>
              )}
            </button>

            <button
              className="create-btn"
              onClick={handleLogout}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <LogOut size={13} />
              <span>Logout</span>
            </button>
          </>
        ) : (
          <>
            {location.pathname !== "/login" && (
              <button
                className="login-btn"
                onClick={() => navigate("/login")}
              >
                Login
              </button>
            )}

            {location.pathname !== "/register" && (
              <button
                className="create-btn"
                onClick={() => navigate("/register")}
              >
                Create Account
              </button>
            )}
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;