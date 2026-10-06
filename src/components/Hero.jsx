import React from "react";
import { useNavigate } from "react-router-dom";
import hackVideo from "../assets/hack.mp4";

const Hero = () => {
  const navigate = useNavigate();

  return (
    <section className="hero">

          <div className="hero-video-wrapper">

          <div className="hero-video-frame">

            <video
              src={hackVideo}
              autoPlay
              muted
              loop
              playsInline
            />

          </div>

        </div>

      {/* Very subtle ambient glow */}
      <div className="hero-bg-glow"></div>

      <div className="hero-content">

        {/* Small top label */}
        <div className="hero-label">
          <span></span>
          AI-Powered Campus Knowledge
        </div>

        {/* Main heading */}
        <h1 className="hero-title">
          Your Campus,
          <br />
          <span>One Intelligent Assistant.</span>
        </h1>

        <p className="hero-description">
          Find academic information, campus policies, notices,
          scholarships and more — instantly from your institution's
          trusted knowledge.
        </p>

        {/* Buttons */}
        <div className="hero-actions">

          <button
            className="hero-primary-btn"
            onClick={() => navigate("/login")}
          >
            Get Started
            <span>→</span>
          </button>

          <button
            className="hero-secondary-btn"
            onClick={() => navigate("/register")}
          >
            Create Account
          </button>

        </div>

        {/* VIDEO */}
      

      </div>

    </section>
  );
};

export default Hero;