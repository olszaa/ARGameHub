import React, { useEffect, useRef, useState } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { useNavigate } from 'react-router-dom';

const FRUITS = [
  { type: 'watermelon', emoji: '🍉', color: '#ef4444', name: 'Watermelon', score: 10 },
  { type: 'orange', emoji: '🍊', color: '#f97316', name: 'Orange', score: 10 },
  { type: 'apple', emoji: '🍎', color: '#dc2626', name: 'Apple', score: 10 },
  { type: 'banana', emoji: '🍌', color: '#eab308', name: 'Banana', score: 15 },
  { type: 'bomb', emoji: '💣', color: '#1e293b', name: 'Bomb', isBomb: true }
];

// Web Audio API Sound Generator
const playSound = (type) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'slice') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'bomb') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(40, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.6, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch (e) {}
};

const FruitNinjaGame = () => {
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

  // Game Mode & State
  const [mode, setMode] = useState('SINGLE');
  const [gameState, setGameState] = useState('MENU');
  const [scoreP1, setScoreP1] = useState(0);
  const [scoreP2, setScoreP2] = useState(0);
  const [livesP1, setLivesP1] = useState(3);
  const [livesP2, setLivesP2] = useState(3);
  const [status, setStatus] = useState('Initializing Model...');

  // Game Engine Refs
  const fruitsRef = useRef([]);
  const slicedPiecesRef = useRef([]);
  const particlesRef = useRef([]);
  const bladeTrailsRef = useRef({});
  const scoreP1Ref = useRef(0);
  const scoreP2Ref = useRef(0);
  const livesP1Ref = useRef(3);
  const livesP2Ref = useRef(3);
  const screenShakeRef = useRef(0);
  const modeRef = useRef('SINGLE');
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
          numPoses: 2
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

  const startGame = (selectedMode) => {
    setMode(selectedMode);
    modeRef.current = selectedMode;
    setScoreP1(0);
    setScoreP2(0);
    scoreP1Ref.current = 0;
    scoreP2Ref.current = 0;
    setLivesP1(3);
    setLivesP2(3);
    livesP1Ref.current = 3;
    livesP2Ref.current = 3;
    fruitsRef.current = [];
    slicedPiecesRef.current = [];
    particlesRef.current = [];
    bladeTrailsRef.current = {};
    screenShakeRef.current = 0;
    setGameState('PLAYING');
  };

  const lineIntersectsCircle = (p1, p2, circle) => {
    const dX = p2.x - p1.x;
    const dY = p2.y - p1.y;
    const len = Math.hypot(dX, dY);
    if (len === 0) return false;

    const u = ((circle.x - p1.x) * dX + (circle.y - p1.y) * dY) / (len * len);
    const clampedU = Math.max(0, Math.min(1, u));

    const nearestX = p1.x + clampedU * dX;
    const nearestY = p1.y + clampedU * dY;

    const dist = Math.hypot(circle.x - nearestX, circle.y - nearestY);
    return dist < circle.radius;
  };

  const renderGame = () => {
    if (!canvasRef.current || !videoRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.save();
    if (screenShakeRef.current > 0) {
      const shakeX = (Math.random() - 0.5) * screenShakeRef.current * 10;
      const shakeY = (Math.random() - 0.5) * screenShakeRef.current * 10;
      ctx.translate(shakeX, shakeY);
      screenShakeRef.current -= 0.1;
    }

    ctx.clearRect(0, 0, w, h);

    let activeBlades = [];
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

        const sortedPoses = [...res.landmarks].sort((a, b) => (1 - a[0].x) - (1 - b[0].x));

        sortedPoses.forEach((lm, playerIdx) => {
          if (modeRef.current === 'SINGLE' && playerIdx > 0) return;

          const pNum = playerIdx + 1;
          const pColor = pNum === 1 ? '#00f3ff' : '#eab308';

          ['left', 'right'].forEach((side) => {
            const idx = side === 'left' ? 15 : 16;
            if (lm[idx] && lm[idx].visibility > 0.4) {
              const hX = (1 - lm[idx].x) * w;
              const hY = lm[idx].y * h;

              const trailKey = `p${pNum}_${side}`;
              if (!bladeTrailsRef.current[trailKey]) bladeTrailsRef.current[trailKey] = [];
              const trail = bladeTrailsRef.current[trailKey];

              trail.push({ x: hX, y: hY, time: Date.now() });
              if (trail.length > 10) trail.shift();

              activeBlades.push({ key: trailKey, player: pNum, color: pColor, trail });
            }
          });
        });
      }
    }

    if (gameState === 'PLAYING') {
      if (Math.random() < (modeRef.current === 'MULTI' ? 0.06 : 0.04) && fruitsRef.current.length < 7) {
        const isBomb = Math.random() < 0.2;
        const fruitType = isBomb ? FRUITS[4] : FRUITS[Math.floor(Math.random() * 4)];

        fruitsRef.current.push({
          id: Math.random(),
          type: fruitType,
          x: Math.random() * (w - 300) + 150,
          y: h + 40,
          vx: (Math.random() - 0.5) * 6,
          vy: -(Math.random() * 6 + 18),
          radius: isBomb ? 45 : 40,
          rotation: 0,
          vRot: (Math.random() - 0.5) * 0.1
        });
      }

      const gravity = 0.45;
      fruitsRef.current.forEach((fruit, fIdx) => {
        fruit.x += fruit.vx;
        fruit.y += fruit.vy;
        fruit.vy += gravity;
        fruit.rotation += fruit.vRot;

        let slicedByPlayer = null;
        activeBlades.forEach((bItem) => {
          if (bItem.trail.length >= 2) {
            const p1 = bItem.trail[bItem.trail.length - 2];
            const p2 = bItem.trail[bItem.trail.length - 1];
            const speed = Math.hypot(p2.x - p1.x, p2.y - p1.y);

            if (speed > 12 && lineIntersectsCircle(p1, p2, fruit)) {
              slicedByPlayer = bItem.player;
            }
          }
        });

        if (slicedByPlayer) {
          if (fruit.type.isBomb) {
            playSound('bomb');
            screenShakeRef.current = 2.0;

            if (slicedByPlayer === 1) {
              livesP1Ref.current -= 1;
              setLivesP1(livesP1Ref.current);
            } else {
              livesP2Ref.current -= 1;
              setLivesP2(livesP2Ref.current);
            }

            for (let p = 0; p < 30; p++) {
              particlesRef.current.push({
                x: fruit.x, y: fruit.y,
                vx: (Math.random() - 0.5) * 16, vy: (Math.random() - 0.5) * 16,
                color: '#ef4444', size: Math.random() * 10 + 4, life: 1.0
              });
            }

            if (modeRef.current === 'SINGLE' && livesP1Ref.current <= 0) {
              setGameState('GAMEOVER');
            }
          } else {
            playSound('slice');
            if (slicedByPlayer === 1) {
              scoreP1Ref.current += fruit.type.score;
              setScoreP1(scoreP1Ref.current);
            } else {
              scoreP2Ref.current += fruit.type.score;
              setScoreP2(scoreP2Ref.current);
            }

            // Create Sliced Halves
            slicedPiecesRef.current.push({
              emoji: fruit.type.emoji,
              x: fruit.x - 15, y: fruit.y,
              vx: -4, vy: fruit.vy * 0.5,
              rotation: fruit.rotation, vRot: -0.1, life: 1.0
            });
            slicedPiecesRef.current.push({
              emoji: fruit.type.emoji,
              x: fruit.x + 15, y: fruit.y,
              vx: 4, vy: fruit.vy * 0.5,
              rotation: fruit.rotation, vRot: 0.1, life: 1.0
            });

            // Splatter Juice Particles
            for (let p = 0; p < 18; p++) {
              particlesRef.current.push({
                x: fruit.x, y: fruit.y,
                vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12,
                color: fruit.type.color, size: Math.random() * 8 + 3, life: 1.0
              });
            }
          }
          fruit.sliced = true;
        }
      });

      fruitsRef.current = fruitsRef.current.filter(f => !f.sliced && f.y < h + 100);

      // Update Sliced Pieces
      slicedPiecesRef.current.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += gravity * 0.8;
        p.rotation += p.vRot;
        p.life -= 0.02;
      });
      slicedPiecesRef.current = slicedPiecesRef.current.filter(p => p.life > 0);

      // Update Juice Particles
      particlesRef.current.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.03;
      });
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);
    }

    // Render Sliced Halves
    slicedPiecesRef.current.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.life;
      ctx.font = '40px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.emoji, 0, 0);
      ctx.restore();
    });

    // Render Active Fruits & Bombs
    fruitsRef.current.forEach(f => {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rotation);
      ctx.font = `${f.radius * 1.6}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(f.type.emoji, 0, 0);
      ctx.restore();
    });

    // Render Juice Particles
    particlesRef.current.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Render Blade Trails & Glowing Laser Slash Effects
    activeBlades.forEach(bItem => {
      if (bItem.trail.length < 2) return;

      ctx.save();
      ctx.strokeStyle = bItem.color;
      ctx.shadowColor = bItem.color;
      ctx.shadowBlur = 20;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let i = 1; i < bItem.trail.length; i++) {
        const pt1 = bItem.trail[i - 1];
        const pt2 = bItem.trail[i];
        const alpha = i / bItem.trail.length;

        ctx.beginPath();
        ctx.lineWidth = alpha * 14;
        ctx.globalAlpha = alpha;
        ctx.moveTo(pt1.x, pt1.y);
        ctx.lineTo(pt2.x, pt2.y);
        ctx.stroke();
      }
      ctx.restore();
    });

    ctx.restore();
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
          <h1 style={{ color: 'white', margin: '5px 0 0 0', fontSize: '2.2rem' }}>⚔️ Fruit Ninja AR</h1>
          <p style={{ color: '#94a3b8', margin: 0 }}>Mode: {mode === 'SINGLE' ? '👤 1-Player' : '👥 2-Player Versus'} | 🙅 Cross Arms X 1.2s to Exit</p>
        </div>

        {gameState === 'PLAYING' && (
          <div style={{ display: 'flex', gap: '20px', pointerEvents: 'auto' }}>
            <div style={{ backgroundColor: 'rgba(15,23,42,0.85)', padding: '12px 20px', borderRadius: '16px', border: '2px solid #00f3ff', color: 'white', textAlign: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: '#00f3ff', fontWeight: 'bold' }}>PLAYER 1</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#10b981' }}>{scoreP1}</div>
              <div>{'❤️'.repeat(livesP1)}{'🖤'.repeat(3 - livesP1)}</div>
            </div>

            {mode === 'MULTI' && (
              <div style={{ backgroundColor: 'rgba(15,23,42,0.85)', padding: '12px 20px', borderRadius: '16px', border: '2px solid #eab308', color: 'white', textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: '#eab308', fontWeight: 'bold' }}>PLAYER 2</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#10b981' }}>{scoreP2}</div>
                <div>{'❤️'.repeat(livesP2)}{'🖤'.repeat(3 - livesP2)}</div>
              </div>
            )}
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
                <h2 style={{ fontSize: '2.5rem', color: 'white', margin: '0 0 10px 0' }}>⚔️ Fruit Ninja AR</h2>
                <p style={{ color: '#94a3b8', fontSize: '1rem', marginBottom: '1.5rem' }}>
                  Slash fruits with laser hand blades! Avoid slicing 💣 bombs!
                </p>

                <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                  <button
                    onClick={() => startGame('SINGLE')}
                    disabled={status !== 'Ready'}
                    style={{
                      padding: '16px 28px', fontSize: '1.2rem', fontWeight: 'bold',
                      backgroundColor: status === 'Ready' ? '#00f3ff' : '#64748b',
                      color: '#0f172a', border: 'none', borderRadius: '12px', cursor: status === 'Ready' ? 'pointer' : 'not-allowed',
                      boxShadow: '0 10px 25px rgba(0,243,255,0.4)'
                    }}
                  >
                    👤 1-Player Ninja
                  </button>

                  <button
                    onClick={() => startGame('MULTI')}
                    disabled={status !== 'Ready'}
                    style={{
                      padding: '16px 28px', fontSize: '1.2rem', fontWeight: 'bold',
                      backgroundColor: status === 'Ready' ? '#eab308' : '#64748b',
                      color: '#0f172a', border: 'none', borderRadius: '12px', cursor: status === 'Ready' ? 'pointer' : 'not-allowed',
                      boxShadow: '0 10px 25px rgba(234,179,8,0.4)'
                    }}
                  >
                    👥 2-Player Versus
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: '2.5rem', color: '#ef4444', margin: '0 0 10px 0' }}>💣 Game Over!</h2>
                
                <div style={{ backgroundColor: '#0f172a', padding: '1.5rem', borderRadius: '16px', marginBottom: '2rem' }}>
                  <div style={{ color: '#94a3b8', fontSize: '1rem' }}>FINAL SCORE</div>
                  <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#10b981' }}>{scoreP1}</div>
                </div>

                <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                  <button
                    onClick={() => startGame('SINGLE')}
                    style={{
                      padding: '14px 24px', fontSize: '1.1rem', fontWeight: 'bold',
                      backgroundColor: '#00f3ff', color: '#0f172a', border: 'none', borderRadius: '12px', cursor: 'pointer'
                    }}
                  >
                    👤 Try Again
                  </button>
                  <button
                    onClick={() => startGame('MULTI')}
                    style={{
                      padding: '14px 24px', fontSize: '1.1rem', fontWeight: 'bold',
                      backgroundColor: '#eab308', color: '#0f172a', border: 'none', borderRadius: '12px', cursor: 'pointer'
                    }}
                  >
                    👥 2-Player Battle
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default FruitNinjaGame;
