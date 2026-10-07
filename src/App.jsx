import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Hero from "./components/Hero";
import Login from "./components/Login";
import Register from "./components/Register";
import StudentChat from "./components/StudentChat";
import FacultyDashboard from "./components/FacultyDashboard";

// Route guard component enforcing authentication and institutional roles
const ProtectedRoute = ({ allowedRoles, children }) => {
  const token = localStorage.getItem("campusai_token");
  const storedUser = localStorage.getItem("campusai_user");

  if (!token || !storedUser) {
    return <Navigate to="/login" replace />;
  }

  try {
    const user = JSON.parse(storedUser);
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      return <Navigate to="/chat" replace />;
    }
  } catch (e) {
    localStorage.removeItem("campusai_token");
    localStorage.removeItem("campusai_user");
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing Page */}
        <Route path="/" element={<Hero />} />

        {/* Authentication */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/create-account" element={<Navigate to="/register" replace />} />

        {/* Student AI Chatbot Copilot */}
        <Route path="/chat" element={<StudentChat />} />

        {/* Faculty & Admin Document Management Portals (Protected) */}
        <Route
          path="/faculty-dashboard"
          element={
            <ProtectedRoute allowedRoles={["faculty", "admin"]}>
              <FacultyDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["admin", "faculty"]}>
              <FacultyDashboard />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;