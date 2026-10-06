import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../templates/login.css";

const Login = () => {
  const navigate = useNavigate();

  const [role, setRole] = useState("student");

  const [userData, setUserData] = useState({
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    setUserData({
      ...userData,
      [e.target.name]: e.target.value,
    });
  };

  const handleLogin = (e) => {
    e.preventDefault();

    const data = {
      email: userData.email,
      password: userData.password,
      role,
    };

    // Later this will be sent to backend
    console.log("Login data:", data);

    navigate("/chat", {
      state: {
        user: data,
      },
    });
  };

  return (
    <div className="login-page">

      <div className="login-card">

        <div className="login-logo">
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
          >
            🎓 Student
          </button>

          <button
            type="button"
            className={role === "faculty" ? "selected" : ""}
            onClick={() => setRole("faculty")}
          >
            👨‍🏫 Faculty
          </button>

        </div>

        <form onSubmit={handleLogin}>

          {/* EMAIL */}

          <label>College Email</label>

          <input
            type="email"
            name="email"
            placeholder="Enter your college email"
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

          <button className="login-submit" type="submit">
            Continue as {role === "student" ? "Student" : "Faculty"}
            <span>→</span>
          </button>

        </form>

        <p className="login-footer">
          Don't have an account?{" "}
          <span onClick={() => navigate("/register")}>
            Create Account
          </span>
        </p>

      </div>

    </div>
  );
};

export default Login;