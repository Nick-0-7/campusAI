import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Hero from "./components/Hero";
import Login from "./components/Login";
import Register from "./components/Register";
import StudentChat from "./components/StudentChat";
import FacultyDashboard from "./components/FacultyDashboard";

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

        {/* Faculty Document Upload & Management Portal */}
        <Route path="/faculty-dashboard" element={<FacultyDashboard />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;