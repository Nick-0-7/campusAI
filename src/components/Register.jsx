import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../templates/login.css"

const Register = () => {
  const navigate = useNavigate();

  const [role, setRole] = useState("student");

  const [userData, setUserData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    rollNo: "",
    department: "",
  });

  const handleChange = (e) => {
    setUserData({
      ...userData,
      [e.target.name]: e.target.value,
    });
  };

  const handleRegister = (e) => {
    e.preventDefault();

    if (userData.password !== userData.confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    const data = {
      name: userData.name,
      email: userData.email,
      password: userData.password,
      role,
      ...(role === "student"
        ? { rollNo: userData.rollNo }
        : { department: userData.department }),
    };

    // Backend will use this later
    console.log("Registration data:", data);

    navigate("/login");
  };

  return (
    <div className="login-page">

      <div className="login-card">

        <div className="login-logo">
          <div className="logo-icon">C</div>
          <span>CampusAI</span>
        </div>

        <h1>Create Account</h1>

        <p className="login-subtitle">
          Join your campus knowledge assistant
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

        <form onSubmit={handleRegister}>

          <label>
            {role === "student" ? "Student Name" : "Faculty Name"}
          </label>

          <input
            type="text"
            name="name"
            placeholder="Enter your full name"
            value={userData.name}
            onChange={handleChange}
            required
          />

          <label>College Email</label>

          <input
            type="email"
            name="email"
            placeholder="Enter your college email"
            value={userData.email}
            onChange={handleChange}
            required
          />

          {role === "student" && (
            <>
              <label>Roll Number</label>

              <input
                type="text"
                name="rollNo"
                placeholder="Enter your roll number"
                value={userData.rollNo}
                onChange={handleChange}
                required
              />
            </>
          )}

          {role === "faculty" && (
            <>
              <label>Department</label>

              <input
                type="text"
                name="department"
                placeholder="Enter your department"
                value={userData.department}
                onChange={handleChange}
                required
              />
            </>
          )}

          <label>Password</label>

          <input
            type="password"
            name="password"
            placeholder="Create a password"
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

          <button className="login-submit" type="submit">
            Create {role === "student" ? "Student" : "Faculty"} Account
            <span>→</span>
          </button>

        </form>

        <p className="login-footer">
          Already have an account?{" "}
          <span onClick={() => navigate("/login")}>
            Login
          </span>
        </p>

      </div>

    </div>
  );
};

export default Register;