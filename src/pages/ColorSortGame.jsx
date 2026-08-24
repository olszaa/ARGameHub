import React, { useEffect, useRef, useState } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { useNavigate } from 'react-router-dom';

const COLORS = [
  { id: 'red', name: 'Red', hex: '#ef4444', label: '🍎 Red' },
  { id: 'green', name: 'Green', hex: '#10b981', label: '🍏 Green' },
  { id: 'blue', name: 'Blue', hex: '#3b82f6', label: '🫐 Blue' },
  { id: 'yellow', name: 'Yellow', hex: '#eab308', label: '🍌 Yellow' }
];

// Web Audio API Sound Effects Generator
const playSound = (type) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'grab') {
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'score') {
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'wrong') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (e) {}
};

const ColorSortGame = () => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const poseLandmarkerRef = useRef(null);
  const animationRef = useRef(null);

  // Clean Exit Back to Main Menu
  const handleBackToMain = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
    }
    if (poseLandmarkerRef.current) {
      try { poseLandmarkerRef.current.close(); } catch (e) {}
    }
    navigate('/');
  };

  // Game States
  const [gameState, setGameState] = useState('MENU');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [highScore, setHighScore] = useState(0);
  const [status, setStatus] = useState('Initializing Model...');

  // Game Objects Ref
  const itemsRef = useRef([]);
  const grabbedItemRef = useRef(null);
  const particlesRef = useRef([]);
  const scoreRef = useRef(0);
  const xPoseRef = useRef({ startTime: 0, progress: 0 });

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
        if (active) setStatus('Failed to load tracking model.');
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
          setStatus('Ready');
        }
      } catch (err) {
        if (active) setStatus('Camera access denied.');
      }
    };

    initPose();

    return () => {
      active = false;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      }
      if (poseLandmarkerRef.current) {
        try { poseLandmarkerRef.current.close(); } catch (e) {}
      }
    };
  }, []);

  // Timer Countdown
  useEffect(() => {
    let timer;
    if (gameState === 'PLAYING') {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setGameState('GAMEOVER');
            if (scoreRef.current > highScore) {
              setHighScore(scoreRef.current);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [gameState, highScore]);

  const startGame = () => {
    setScore(0);
    scoreRef.current = 0;
    setTimeLeft(60);
    itemsRef.current = [];
    particlesRef.current = [];
    grabbedItemRef.current = null;
    spawnNewItems(4);
    setGameState('PLAYING');
  };

  const spawnNewItems = (count) => {
    const canvas = canvasRef.current;
    const w = canvas ? canvas.width : 1280;

    for (let i = 0; i < count; i++) {
      const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
      itemsRef.current.push({
        id: Math.random(),
        color: randomColor,
        x: Math.random() * (w - 300) + 150,
        y: Math.random() * 150 + 150,
        radius: 35,
        isGrabbed: false
      });
    }
  };

  const renderGame = () => {
    if (!canvasRef.current || !videoRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // 1. Draw Sorting Baskets (4 Baskets at bottom)
    const basketWidth = w / 4;
    const basketHeight = 120;
    const basketY = h - basketHeight;

    COLORS.forEach((colorObj, idx) => {
      const bX = idx * basketWidth;

      // Basket Fill & Glow
      ctx.save();
      ctx.fillStyle = colorObj.hex;
      ctx.globalAlpha = 0.25;
      ctx.fillRect(bX + 10, basketY, basketWidth - 20, basketHeight - 10);

      ctx.strokeStyle = colorObj.hex;
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.9;
      ctx.strokeRect(bX + 10, basketY, basketWidth - 20, basketHeight - 10);

      // Basket Label
      ctx.font = 'bold 24px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(colorObj.label, bX + basketWidth / 2, basketY + basketHeight / 2);
      ctx.restore();
    });

    // 2. Hand Position & Grab Logic
    let handPos = null;
    let isFist = false;

    if (videoRef.current.readyState >= 2 && poseLandmarkerRef.current) {
      const res = poseLandmarkerRef.current.detectForVideo(videoRef.current, performance.now());
      if (res.landmarks && res.landmarks.length > 0) {
        // Robust X-Pose Exit Check
        const p1Lm = res.landmarks[0];
        if (p1Lm[15] && p1Lm[16] && p1Lm[15].visibility > 0.3 && p1Lm[16].visibility > 0.3) {
          const distNorm = Math.hypot(p1Lm[15].x - p1Lm[16].x, p1Lm[15].y - p1Lm[16].y);
          if (distNorm < 0.25) {
            if (xPoseRef.current.startTime === 0) xPoseRef.current.startTime = Date.now();
            const elapsed = Date.now() - xPoseRef.current.startTime;
            const progress = Math.min(1, elapsed / 1200);
            xPoseRef.current.progress = progress;

            if (progress >= 1) {
              xPoseRef.current = { startTime: 0, progress: 0 };
              handleBackToMain();
              return;
            }
          } else {
            xPoseRef.current = { startTime: 0, progress: 0 };
          }
        }

        const lm = res.landmarks[0];
        if (lm[16] && lm[16].visibility > 0.4) {
          const hX = (1 - lm[16].x) * w;
          const hY = lm[16].y * h;
          handPos = { x: hX, y: hY };

          // Fist detection (wrist to index finger distance)
          if (lm[20]) {
            const handSpan = Math.hypot(lm[20].x - lm[16].x, lm[20].y - lm[16].y);
            isFist = handSpan < 0.15;
          }
        }
      }
    }

    if (gameState === 'PLAYING' && handPos) {
      if (isFist) {
        if (!grabbedItemRef.current) {
          // Try grabbing nearest item
          itemsRef.current.forEach((item) => {
            const dist = Math.hypot(handPos.x - item.x, handPos.y - item.y);
            if (dist < item.radius + 30) {
              grabbedItemRef.current = item;
              item.isGrabbed = true;
              playSound('grab');
            }
          });
        } else {
          // Drag item with hand
          grabbedItemRef.current.x = handPos.x;
          grabbedItemRef.current.y = handPos.y;
        }
      } else {
        // Drop item
        if (grabbedItemRef.current) {
          const item = grabbedItemRef.current;
          item.isGrabbed = false;

          // Check if dropped inside correct basket
          if (item.y > basketY) {
            const basketIdx = Math.floor(item.x / basketWidth);
            const targetColor = COLORS[basketIdx];

            if (targetColor && targetColor.id === item.color.id) {
              playSound('score');
              scoreRef.current += 10;
              setScore(scoreRef.current);

              // Score Particle Burst
              for (let p = 0; p < 20; p++) {
                particlesRef.current.push({
                  x: item.x, y: item.y,
                  vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10,
                  color: item.color.hex, size: Math.random() * 8 + 3, life: 1.0
                });
              }

              // Remove scored item & spawn new one
              itemsRef.current = itemsRef.current.filter((it) => it.id !== item.id);
              spawnNewItems(1);
            } else {
              playSound('wrong');
              // Reset item position
              item.y = 200;
            }
          }
          grabbedItemRef.current = null;
        }
      }
    }

    // 3. Render Items
    itemsRef.current.forEach((item) => {
      ctx.save();
      ctx.fillStyle = item.color.hex;
      ctx.shadowColor = item.color.hex;
      ctx.shadowBlur = item.isGrabbed ? 25 : 10;
      ctx.beginPath();
      ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    });

    // 4. Render Particles
    particlesRef.current.forEach((p) => {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    particlesRef.current.forEach((p) => { p.life -= 0.03; });
    particlesRef.current = particlesRef.current.filter((p) => p.life > 0);

    // 5. Render Hand Cursor
    if (handPos) {
      ctx.save();
      ctx.fillStyle = isFist ? '#ef4444' : '#00f3ff';
      ctx.shadowColor = isFist ? '#ef4444' : '#00f3ff';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(handPos.x, handPos.y, 16, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(isFist ? '✊' : '🖐️', handPos.x, handPos.y - 25);
      ctx.restore();
    }

    animationRef.current = requestAnimationFrame(renderGame);
  };

  useEffect(() => {
    if (status === 'Ready') {
      renderGame();
    }
  }, [status, gameState]);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', backgroundColor: '#0f172a', overflow: 'hidden' }}>
      
      <video
        ref={videoRef}
        style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          objectFit: 'cover', transform: 'scaleX(-1)', opacity: 0.35
        }}
        playsInline
        muted
      />

      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />

      {/* Header Overlay */}
      <div style={{ position: 'absolute', top: '20px', left: '20px', right: '20px', display: 'flex', justifyContent: 'space-between', zIndex: 10, pointerEvents: 'none' }}>
        <div>
          <button
            onClick={handleBackToMain}
            style={{
              pointerEvents: 'auto', background: 'none', border: 'none', color: '#00d2ff',
              fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', padding: 0
            }}
          >
            &larr; Back to Menu
          </button>
          <h1 style={{ color: 'white', margin: '5px 0 0 0', fontSize: '2.2rem' }}>🧺 Color Sort AR Game</h1>
          <p style={{ color: '#94a3b8', margin: 0 }}>Fist ✊ to Grab, Open Hand 🖐️ to Drop | 🙅 Cross Arms X 1.2s to Exit</p>
        </div>

        {gameState === 'PLAYING' && (
          <div style={{ display: 'flex', gap: '20px', pointerEvents: 'auto' }}>
            <div style={{ backgroundColor: 'rgba(15,23,42,0.85)', padding: '12px 20px', borderRadius: '16px', border: '2px solid #00f3ff', color: 'white', textAlign: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: '#00f3ff', fontWeight: 'bold' }}>SCORE</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#10b981' }}>{score}</div>
            </div>

            <div style={{ backgroundColor: 'rgba(15,23,42,0.85)', padding: '12px 20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', color: 'white', textAlign: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>TIME</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#3b82f6' }}>{timeLeft}s</div>
            </div>
          </div>
        )}
      </div>

      {/* Start / Game Over Modal */}
      {gameState !== 'PLAYING' && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 30
        }}>
          <div style={{
            backgroundColor: '#1e293b', padding: '2.5rem', borderRadius: '24px',
            border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center', maxWidth: '520px', width: '90%',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
          }}>
            {gameState === 'MENU' ? (
              <>
                <h2 style={{ fontSize: '2.5rem', color: 'white', margin: '0 0 10px 0' }}>🧺 Color Sort AR Game</h2>
                <p style={{ color: '#94a3b8', fontSize: '1rem', marginBottom: '1.5rem' }}>
                  Use fist ✊ to grab colored balls and drop 🖐️ them into the matching color baskets!
                </p>

                <button
                  onClick={startGame}
                  disabled={status !== 'Ready'}
                  style={{
                    padding: '16px 36px', fontSize: '1.3rem', fontWeight: 'bold',
                    backgroundColor: status === 'Ready' ? '#00f3ff' : '#64748b',
                    color: '#0f172a', border: 'none', borderRadius: '12px', cursor: status === 'Ready' ? 'pointer' : 'not-allowed',
                    boxShadow: '0 10px 25px rgba(0,243,255,0.4)'
                  }}
                >
                  🚀 Start Sorting Game
                </button>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: '2.5rem', color: '#10b981', margin: '0 0 10px 0' }}>🎉 Time Up!</h2>
                
                <div style={{ backgroundColor: '#0f172a', padding: '1.5rem', borderRadius: '16px', marginBottom: '2rem' }}>
                  <div style={{ color: '#94a3b8', fontSize: '1rem' }}>FINAL SCORE</div>
                  <div style={{ fontSize: '3.5rem', fontWeight: 'bold', color: '#10b981' }}>{score}</div>
                  {highScore > 0 && <div style={{ color: '#eab308', fontSize: '0.9rem' }}>🏆 High Score: {highScore}</div>}
                </div>

                <button
                  onClick={startGame}
                  style={{
                    padding: '14px 28px', fontSize: '1.2rem', fontWeight: 'bold',
                    backgroundColor: '#00f3ff', color: '#0f172a', border: 'none', borderRadius: '12px', cursor: 'pointer'
                  }}
                >
                  🚀 Play Again
                </button>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default ColorSortGame;
