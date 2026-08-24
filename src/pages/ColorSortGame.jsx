import React, { useEffect, useRef, useState } from 'react';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
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

  // Game States
  const [gameState, setGameState] = useState('MENU'); // MENU, PLAYING, GAMEOVER
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
      if (poseLandmarkerRef.current) poseLandmarkerRef.current.close();
    };
  }, []);

  // Timer Countdown
  useEffect(() => {
    let timer;
    if (gameState === 'PLAYING') {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setGameState('GAMEOVER');
            setHighScore(h => Math.max(h, scoreRef.current));
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [gameState]);

  const startGame = () => {
    setScore(0);
    scoreRef.current = 0;
    setTimeLeft(60);
    itemsRef.current = [];
    grabbedItemRef.current = null;
    particlesRef.current = [];
    setGameState('PLAYING');
  };

  const renderGame = () => {
    if (!canvasRef.current || !videoRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    let hands = [];
    if (videoRef.current.readyState >= 2 && poseLandmarkerRef.current) {
      const res = poseLandmarkerRef.current.detectForVideo(videoRef.current, performance.now());
      if (res.landmarks && res.landmarks.length > 0) {
        const lm = res.landmarks[0];
        
        // 1. X-Pose Check (Cross arms X shape to exit game)
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
            window.location.href = '/';
            return;
          }
        } else {
          xPoseRef.current = { startTime: 0, progress: 0 };
        }

        // 2. Hand Gesture Detection
        if (lm[15] && lm[15].visibility > 0.4) {
          const wristX = (1 - lm[15].x) * w;
          const wristY = lm[15].y * h;
          let isClosed = false;
          if (lm[19]) {
            const distNorm = Math.hypot(lm[15].x - lm[19].x, lm[15].y - lm[19].y);
            if (distNorm < 0.16) isClosed = true;
          }
          hands.push({ id: 'left', x: wristX, y: wristY, isClosed });
        }

        if (lm[16] && lm[16].visibility > 0.4) {
          const wristX = (1 - lm[16].x) * w;
          const wristY = lm[16].y * h;
          let isClosed = false;
          if (lm[20]) {
            const distNorm = Math.hypot(lm[16].x - lm[20].x, lm[16].y - lm[20].y);
            if (distNorm < 0.16) isClosed = true;
          }
          hands.push({ id: 'right', x: wristX, y: wristY, isClosed });
        }
      }
    }

    if (gameState === 'PLAYING') {
      if (Math.random() < 0.035 && itemsRef.current.length < 6) {
        const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
        itemsRef.current.push({
          id: Math.random(),
          color: randomColor,
          x: Math.random() * (w - 200) + 100,
          y: -40,
          radius: 35,
          speed: Math.random() * 2 + 1.5,
          isGrabbed: false
        });
      }

      const basketWidth = w / 4 - 20;
      const basketHeight = 90;
      const baskets = COLORS.map((c, i) => ({
        ...c,
        x: 10 + i * (basketWidth + 20),
        y: h - basketHeight - 10,
        w: basketWidth,
        h: basketHeight
      }));

      itemsRef.current.forEach((item, idx) => {
        if (item.isGrabbed && grabbedItemRef.current?.item.id === item.id) {
          const hand = hands.find(hItem => hItem.id === grabbedItemRef.current.handId);
          if (hand) {
            item.x = hand.x;
            item.y = hand.y;

            if (!hand.isClosed) {
              item.isGrabbed = false;
              grabbedItemRef.current = null;
            } else {
              baskets.forEach(b => {
                if (item.x > b.x && item.x < b.x + b.w && item.y > b.y && item.y < b.y + b.h) {
                  if (item.color.id === b.id) {
                    scoreRef.current += 10;
                    setScore(scoreRef.current);
                    playSound('score');
                    for (let p = 0; p < 15; p++) {
                      particlesRef.current.push({
                        x: item.x, y: item.y,
                        vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8,
                        color: b.hex, life: 1.0
                      });
                    }
                  } else {
                    scoreRef.current = Math.max(0, scoreRef.current - 5);
                    setScore(scoreRef.current);
                    playSound('wrong');
                  }
                  itemsRef.current.splice(idx, 1);
                  grabbedItemRef.current = null;
                }
              });
            }
          } else {
            item.isGrabbed = false;
            grabbedItemRef.current = null;
          }
        } else {
          item.y += item.speed;

          hands.forEach(hand => {
            if (!grabbedItemRef.current && hand.isClosed) {
              const dist = Math.hypot(hand.x - item.x, hand.y - item.y);
              if (dist < item.radius + 45) {
                item.isGrabbed = true;
                grabbedItemRef.current = { item, handId: hand.id };
                playSound('grab');
              }
            }
          });
        }

        ctx.beginPath();
        ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
        ctx.fillStyle = item.color.hex;
        ctx.shadowColor = item.color.hex;
        ctx.shadowBlur = 15;
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(item.color.label.split(' ')[0], item.x, item.y + 7);
      });

      itemsRef.current = itemsRef.current.filter(item => item.y < h + 50);

      baskets.forEach(b => {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = b.hex;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.w, b.h, 16);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = b.hex;
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 8);
      });

      particlesRef.current.forEach((p, pIdx) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.04;
        if (p.life <= 0) {
          particlesRef.current.splice(pIdx, 1);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 6 * p.life, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life;
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }
      });
    }

    hands.forEach(hItem => {
      ctx.beginPath();
      ctx.arc(hItem.x, hItem.y, 35, 0, Math.PI * 2);
      ctx.fillStyle = hItem.isClosed ? 'rgba(239, 68, 68, 0.35)' : 'rgba(16, 185, 129, 0.35)';
      ctx.strokeStyle = hItem.isClosed ? '#ef4444' : '#10b981';
      ctx.lineWidth = 3;
      ctx.shadowColor = hItem.isClosed ? '#ef4444' : '#10b981';
      ctx.shadowBlur = 15;
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.font = '36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(hItem.isClosed ? '✊' : '🖐️', hItem.x, hItem.y + 12);
    });

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
      ctx.fillText(`🙅 Exiting to Menu... ${Math.round(xPoseRef.current.progress * 100)}%`, w / 2, 78);
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
          objectFit: 'cover', transform: 'scaleX(-1)', opacity: 0.3
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
            <div style={{ backgroundColor: 'rgba(15,23,42,0.85)', padding: '12px 24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', color: 'white', textAlign: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>SCORE</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>{score}</div>
            </div>
            <div style={{ backgroundColor: 'rgba(15,23,42,0.85)', padding: '12px 24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', color: 'white', textAlign: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>TIME LEFT</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: timeLeft <= 10 ? '#ef4444' : '#3b82f6' }}>{timeLeft}s</div>
            </div>
          </div>
        )}
      </div>

      {gameState !== 'PLAYING' && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 30
        }}>
          <div style={{
            backgroundColor: '#1e293b', padding: '3rem', borderRadius: '24px',
            border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center', maxWidth: '480px', width: '90%',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
          }}>
            {gameState === 'MENU' ? (
              <>
                <h2 style={{ fontSize: '2.5rem', color: 'white', margin: '0 0 10px 0' }}>🧺 Color Sort</h2>
                <p style={{ color: '#94a3b8', fontSize: '1.1rem', marginBottom: '2rem' }}>
                  Make a Fist ✊ to grab falling fruits, and Open your Hand 🖐️ over matching color baskets!
                </p>
                <button
                  onClick={startGame}
                  disabled={status !== 'Ready'}
                  style={{
                    padding: '16px 36px', fontSize: '1.3rem', fontWeight: 'bold',
                    backgroundColor: status === 'Ready' ? '#10b981' : '#64748b',
                    color: 'white', border: 'none', borderRadius: '12px', cursor: status === 'Ready' ? 'pointer' : 'not-allowed',
                    boxShadow: '0 10px 25px rgba(16,185,129,0.4)', transition: 'transform 0.2s'
                  }}
                >
                  {status === 'Ready' ? '🎮 Start Game' : status}
                </button>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: '2.5rem', color: '#ef4444', margin: '0 0 10px 0' }}>⏰ Time's Up!</h2>
                <p style={{ color: '#94a3b8', fontSize: '1.1rem', marginBottom: '1.5rem' }}>Great job sorting!</p>
                <div style={{ backgroundColor: '#0f172a', padding: '1.5rem', borderRadius: '16px', marginBottom: '2rem' }}>
                  <div style={{ color: '#94a3b8', fontSize: '1rem' }}>FINAL SCORE</div>
                  <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#10b981' }}>{score}</div>
                  <div style={{ color: '#3b82f6', fontSize: '0.9rem', marginTop: '5px' }}>HIGH SCORE: {highScore}</div>
                </div>
                <button
                  onClick={startGame}
                  style={{
                    padding: '16px 36px', fontSize: '1.3rem', fontWeight: 'bold',
                    backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer',
                    boxShadow: '0 10px 25px rgba(59,130,246,0.4)'
                  }}
                >
                  🔄 Play Again
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
