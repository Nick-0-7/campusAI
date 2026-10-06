import React from "react";
import { useNavigate } from "react-router-dom";
import "../templates/landing.css"

const Navbar = () => {
  const navigate = useNavigate();

  return (
    <nav className="navbar">
      <div className="navbar-logo" onClick={() => navigate("/")}>
        <div className="logo-icon">C</div>
        <span>CampusAI</span>
      </div>

      <div className="navbar-actions">
        <button
          className="login-btn"
          onClick={() => navigate("/login")}
        >
          Login
        </button>

        <button
          className="create-btn"
          onClick={() => navigate("/create-account")}
        >
          Create Account
        </button>
      </div>
    </nav>
  );
};

export default Navbar;