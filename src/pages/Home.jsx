import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import '../styles/Home.css';

const MENU_ITEMS = [
  { path: '/dance', title: '3D Avatar Dance', desc: '3D Avatar dances inside the screen! (3D Stage)', class: 'dance-card', icon: '🕺' },
  { path: '/shooter', title: 'Bird Shooter', desc: 'Aim and shoot! (Hand Tracking)', class: 'shooter-card', icon: '🎯' },
  { path: '/avatar-test', title: 'Avatar Test', desc: 'Multiplayer 3D Mapping (Max 4 Players)', class: 'test-card', icon: '🤖' },
  { path: '/color-sort', title: 'Color Sort Game', desc: 'Grab & Sort Items by Color! (Hand Tracking)', class: 'sort-card', icon: '🧺' },
  { path: '/fruit-ninja', title: 'Fruit Ninja AR', desc: 'Slash fruits with laser hand blades! Avoid bombs!', class: 'ninja-card', icon: '⚔️' },
  { path: '/lightsaber', title: 'Beat Saber AR', desc: 'Dual Lightsabers & Directional Beat Blocks!', class: 'saber-card', icon: '🤺' },
  { path: '/runner', title: 'Subway Runner AR', desc: 'Lean, Jump 🦘 & Duck 🏃‍♂️ down 3 tracks!', class: 'runner-card', icon: '🏃' },
  { path: '/wall', title: 'Hole in the Wall', desc: 'Fit body posture into incoming wall cutouts!', class: 'wall-card', icon: '🧱' },
  { path: '/cyber-dodge', title: 'Cyber Stage Dodge', desc: 'Dodge 3D Hologram grid walls & duck high beams!', class: 'cyber-card', icon: '⚡' }
];

const Home = () => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const panelRef = useRef(null);
  const poseLandmarkerRef = useRef(null);
  const animationRef = useRef(null);

  const [cameraReady, setCameraReady] = useState(false);
  const hoverCardRef = useRef({ path: null, startTime: 0, progress: 0 });
  const xPoseRef = useRef({ startTime: 0, progress: 0 });
  const prevHandPosRef = useRef({ x: 0, y: 0, isClosed: false });

  useEffect(() => {
    let active = true;

    const initPose = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numPoses: 1
        });

        if (active) {
          poseLandmarkerRef.current = landmarker;
          startCamera();
        }
      } catch (err) {
        console.error("Camera init error:", err);
      }
    };

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 }
        });
        if (videoRef.current && active) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setCameraReady(true);
        }
      } catch (err) {}
    };

    initPose();

    return () => {
      active = false;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      }
      if (poseLandmarkerRef.current) poseLandmarkerRef.current.close();
    };
  }, []);

  const renderMenuTracking = () => {
    if (!canvasRef.current || !videoRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = window.innerWidth;
    const h = canvas.height = window.innerHeight;

    ctx.clearRect(0, 0, w, h);

    if (videoRef.current.readyState >= 2 && poseLandmarkerRef.current) {
      const res = poseLandmarkerRef.current.detectForVideo(videoRef.current, performance.now());
      if (res.landmarks && res.landmarks.length > 0) {
        const lm = res.landmarks[0];
        
        // 1. X-Pose Check (Cross arms X shape -> Reload Page)
        const lw = lm[15];
        const rw = lm[16];
        let isXPose = false;
        if (lw && rw && lw.visibility > 0.4 && rw.visibility > 0.4) {
          const distNorm = Math.hypot(lw.x - rw.x, lw.y - rw.y);
          if (distNorm < 0.15 && lw.y < 0.8 && rw.y < 0.8) {
            isXPose = true;
          }
        }

        if (isXPose) {
          if (xPoseRef.current.startTime === 0) xPoseRef.current.startTime = Date.now();
          const elapsed = Date.now() - xPoseRef.current.startTime;
          const progress = Math.min(1, elapsed / 1200);
          xPoseRef.current.progress = progress;

          if (progress >= 1) {
            xPoseRef.current = { startTime: 0, progress: 0 };
            window.location.reload();
            return;
          }
        } else {
          xPoseRef.current = { startTime: 0, progress: 0 };
        }

        // Draw X-Pose Progress Banner
        if (xPoseRef.current.progress > 0) {
          ctx.save();
          ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.roundRect(w / 2 - 180, 40, 360, 60, 16);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 20px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`🙅 Reloading Page... ${Math.round(xPoseRef.current.progress * 100)}%`, w / 2, 78);
          ctx.restore();
        }

        // 2. Hand Tracking
        const wristIndex = (lm[16] && lm[16].visibility > 0.4) ? 16 : ((lm[15] && lm[15].visibility > 0.4) ? 15 : null);
        const fingerIndex = wristIndex === 16 ? 20 : 19;

        if (wristIndex !== null && lm[wristIndex]) {
          const handX = (1 - lm[wristIndex].x) * w;
          const handY = lm[wristIndex].y * h;

          // Check if Fist (กำมือ)
          let isClosed = false;
          if (lm[fingerIndex]) {
            const distNorm = Math.hypot(lm[wristIndex].x - lm[fingerIndex].x, lm[wristIndex].y - lm[fingerIndex].y);
            if (distNorm < 0.16) isClosed = true;
          }

          // Drag & Zone Scroll Panel
          if (panelRef.current) {
            if (isClosed && prevHandPosRef.current.isClosed) {
              const deltaY = handY - prevHandPosRef.current.y;
              panelRef.current.scrollTop += deltaY * 4.5;
            }

            if (handY < h * 0.25) {
              panelRef.current.scrollTop -= 15;
            } else if (handY > h * 0.75) {
              panelRef.current.scrollTop += 15;
            }
          }

          prevHandPosRef.current = { x: handX, y: handY, isClosed };

          // Hold Fist to Select Menu Card
          const element = document.elementFromPoint(handX, handY);
          const cardElem = element?.closest('.menu-card');

          if (cardElem && isClosed) {
            const cardPath = cardElem.getAttribute('data-path');
            if (hoverCardRef.current.path === cardPath) {
              const elapsed = Date.now() - hoverCardRef.current.startTime;
              const progress = Math.min(1, elapsed / 1200);
              hoverCardRef.current.progress = progress;

              if (progress >= 1) {
                hoverCardRef.current = { path: null, startTime: 0, progress: 0 };
                navigate(cardPath);
                return;
              }
            } else {
              hoverCardRef.current = { path: cardPath, startTime: Date.now(), progress: 0 };
            }
          } else {
            hoverCardRef.current = { path: null, startTime: 0, progress: 0 };
          }

          // Draw Hand Cursor
          const isHoldingCard = !!hoverCardRef.current.path && isClosed;

          ctx.beginPath();
          ctx.arc(handX, handY, 35, 0, Math.PI * 2);
          ctx.fillStyle = isClosed ? 'rgba(236, 72, 153, 0.35)' : 'rgba(0, 243, 255, 0.35)';
          ctx.strokeStyle = isClosed ? '#ec4899' : '#00f3ff';
          ctx.lineWidth = 3;
          ctx.shadowColor = isClosed ? '#ec4899' : '#00f3ff';
          ctx.shadowBlur = 15;
          ctx.fill();
          ctx.stroke();
          ctx.shadowBlur = 0;

          if (isHoldingCard && hoverCardRef.current.progress > 0) {
            ctx.beginPath();
            ctx.arc(handX, handY, 42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hoverCardRef.current.progress);
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 7;
            ctx.shadowColor = '#10b981';
            ctx.shadowBlur = 15;
            ctx.stroke();
            ctx.shadowBlur = 0;
          }

          ctx.font = '36px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(isClosed ? '✊' : '🖐️', handX, handY + 12);
        }
      }
    }

    animationRef.current = requestAnimationFrame(renderMenuTracking);
  };

  useEffect(() => {
    if (cameraReady) {
      renderMenuTracking();
    }
  }, [cameraReady]);

  return (
    <div className="home-container">
      <video ref={videoRef} style={{ display: 'none' }} playsInline muted />

      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          pointerEvents: 'none', zIndex: 100
        }}
      />

      <div className="glass-panel" ref={panelRef}>
        <h1 className="title">AR Game Hub</h1>
        <p className="subtitle">
          {cameraReady ? '✊ Fist & Drag to Scroll | ✊ Hold Fist 1.2s on card to Select | 🙅 Cross Arms X 1.2s to Reload' : 'Select a mode to begin'}
        </p>
        
        <div className="menu-options">
          {MENU_ITEMS.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              data-path={item.path}
              className={`menu-card ${item.class}`}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{item.icon}</div>
              <h2>{item.title}</h2>
              <p>{item.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home;
