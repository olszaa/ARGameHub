import React, { useEffect, useRef, useState } from 'react';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { useNavigate } from 'react-router-dom';

const ShooterGame = () => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const handLandmarkerRef = useRef(null);
  const animationRef = useRef(null);

  // Clean Exit Back to Main Menu
  const handleBackToMain = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
    }
    if (handLandmarkerRef.current) {
      try { handLandmarkerRef.current.close(); } catch (e) {}
    }
    navigate('/');
  };

  return (
    <div style={{ textAlign: 'center', padding: '2rem', color: 'white' }}>
      <h1>Bird Shooter Game</h1>
      <p>Hand tracking loading...</p>
      <button onClick={handleBackToMain} style={{ color: '#00d2ff', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
        Back to Home
      </button>
    </div>
  );
};

export default ShooterGame;
