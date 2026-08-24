import React, { useEffect, useRef, useState } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { Link } from 'react-router-dom';

const POSES = [
  {
    id: 'STAR_POSE',
    name: '🌟 Star Pose!',
    emoji: '⭐',
    desc: 'Spread both arms & legs wide open!',
    checkFit: (lm) => {
      const lw = lm[15], rw = lm[16], la = lm[27], ra = lm[28], ls = lm[11], rs = lm[12];
      if (!lw || !rw || !la || !ra || !ls || !rs) return false;
      const armsWide = Math.abs((1 - lw.x) - (1 - rw.x)) > 0.55;
      const legsWide = Math.abs((1 - la.x) - (1 - ra.x)) > 0.35;
      return armsWide && legsWide;
    }
  },
  {
    id: 'T_POSE',
    name: '💃 T-Pose!',
    emoji: '🧍',
    desc: 'Stretch both arms out horizontally!',
    checkFit: (lm) => {
      const lw = lm[15], rw = lm[16], ls = lm[11], rs = lm[12];
      if (!lw || !rw || !ls || !rs) return false;
      const armsLevel = Math.abs(lw.y - ls.y) < 0.15 && Math.abs(rw.y - rs.y) < 0.15;
      const armsWide = Math.abs((1 - lw.x) - (1 - rw.x)) > 0.6;
      return armsLevel && armsWide;
    }
  },
  {
    id: 'CROWN_HEAD',
    name: '🙆 Crown Head!',
    emoji: '🙆',
    desc: 'Form a ring with both hands over head!',
    checkFit: (lm) => {
      const lw = lm[15], rw = lm[16], nose = lm[0];
      if (!lw || !rw || !nose) return false;
      const high = lw.y < nose.y - 0.08 && rw.y < nose.y - 0.08;
      const close = Math.hypot((1 - lw.x) - (1 - rw.x), lw.y - rw.y) < 0.22;
      return high && close;
    }
  },
  {
    id: 'MUSCLE_FLEX',
    name: '🤾 Muscle Flex!',
    emoji: '💪',
    desc: 'Flex both biceps with elbows bent!',
    checkFit: (lm) => {
      const lw = lm[15], rw = lm[16], le = lm[13], re = lm[14];
      if (!lw || !rw || !le || !re) return false;
      const flexL = lw.y < le.y - 0.08;
      const flexR = rw.y < re.y - 0.08;
      return flexL && flexR;
    }
  },
  {
    id: 'LOW_SQUAT',
    name: '🙇 Low Squat!',
    emoji: '🧘',
    desc: 'Squat down low to fit through lower hole!',
    checkFit: (lm) => {
      const nose = lm[0], hip = lm[23];
      if (!nose || !hip) return false;
      return nose.y > 0.45; // Low head position
    }
  }
];

// Web Audio API Sound Generator
const playSound = (type) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'pass') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
      osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } else if (type === 'crash') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(40, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch (e) {}
};

const WallGame = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const poseLandmarkerRef = useRef(null);
  const animationRef = useRef(null);

  // Game Mode & State
  const [mode, setMode] = useState('SINGLE'); // SINGLE or MULTI
  const [gameState, setGameState] = useState('MENU'); // MENU, PLAYING, GAMEOVER
  const [scoreP1, setScoreP1] = useState(0);
  const [scoreP2, setScoreP2] = useState(0);
  const [livesP1, setLivesP1] = useState(3);
  const [livesP2, setLivesP2] = useState(3);
  const [status, setStatus] = useState('Initializing Model...');

  // Current Wall Object: { pose, z: 0.1..1.0, player: 1|2 }
  const wallRef = useRef(null);
  const modeRef = useRef('SINGLE');
  const scoreP1Ref = useRef(0);
  const scoreP2Ref = useRef(0);
  const livesP1Ref = useRef(3);
  const livesP2Ref = useRef(3);
  const screenShakeRef = useRef(0);
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
      if (poseLandmarkerRef.current) poseLandmarkerRef.current.close();
    };
  }, []);

  const spawnNewWall = () => {
    const randomPose = POSES[Math.floor(Math.random() * POSES.length)];
    wallRef.current = {
      pose: randomPose,
      z: 0.08,
      speed: 0.008 + (scoreP1Ref.current * 0.0001)
    };
  };

  const startGame = (selectedMode) => {
    setMode(selectedMode);
    modeRef.current = selectedMode;
    setScoreP1(0);
    setScoreP2(0);
    setLivesP1(3);
    setLivesP2(3);
    scoreP1Ref.current = 0;
    scoreP2Ref.current = 0;
    livesP1Ref.current = 3;
    livesP2Ref.current = 3;
    screenShakeRef.current = 0;
    spawnNewWall();
    setGameState('PLAYING');
  };

  // Main Render Loop
  const renderGame = () => {
    if (!canvasRef.current || !videoRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.save();
    if (screenShakeRef.current > 0) {
      const shakeX = (Math.random() - 0.5) * screenShakeRef.current * 12;
      const shakeY = (Math.random() - 0.5) * screenShakeRef.current * 12;
      ctx.translate(shakeX, shakeY);
      screenShakeRef.current -= 0.1;
    }

    ctx.clearRect(0, 0, w, h);

    let playersLandmarks = [];
    if (videoRef.current.readyState >= 2 && poseLandmarkerRef.current) {
      const res = poseLandmarkerRef.current.detectForVideo(videoRef.current, performance.now());
      if (res.landmarks && res.landmarks.length > 0) {
        // X-Pose Exit Check
        const p1Lm = res.landmarks[0];
        if (p1Lm[15] && p1Lm[16] && p1Lm[15].visibility > 0.4 && p1Lm[16].visibility > 0.4) {
          const distNorm = Math.hypot(p1Lm[15].x - p1Lm[16].x, p1Lm[15].y - p1Lm[16].y);
          if (distNorm < 0.15 && p1Lm[15].y < 0.8 && p1Lm[16].y < 0.8) {
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
        }

        const sortedPoses = [...res.landmarks].sort((a, b) => (1 - a[0].x) - (1 - b[0].x));

        sortedPoses.forEach((lm, pIdx) => {
          if (modeRef.current === 'SINGLE' && pIdx > 0) return;
          playersLandmarks.push({ player: pIdx + 1, lm });

          // Draw Neon Player Skeleton
          const pColor = pIdx === 0 ? '#00f3ff' : '#eab308';
          const connections = [
            [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
            [11, 23], [12, 24], [23, 24],
            [23, 25], [25, 27], [24, 26], [26, 28]
          ];

          ctx.strokeStyle = pColor;
          ctx.lineWidth = 5;
          ctx.shadowColor = pColor;
          ctx.shadowBlur = 12;

          connections.forEach(([start, end]) => {
            if (lm[start] && lm[end] && lm[start].visibility > 0.4 && lm[end].visibility > 0.4) {
              ctx.beginPath();
              ctx.moveTo((1 - lm[start].x) * w, lm[start].y * h);
              ctx.lineTo((1 - lm[end].x) * w, lm[end].y * h);
              ctx.stroke();
            }
          });
          ctx.shadowBlur = 0;
        });
      }
    }

    if (gameState === 'PLAYING' && wallRef.current) {
      const wall = wallRef.current;
      wall.z += wall.speed;

      const scale = wall.z;
      const wallW = w * scale;
      const wallH = h * scale;
      const wallX = (w - wallW) / 2;
      const wallY = (h - wallH) / 2;

      // 1. Draw Red Solid Grid Wall Barrier
      ctx.save();
      ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 4 * scale;
      ctx.beginPath();
      ctx.roundRect(wallX, wallY, wallW, wallH, 20 * scale);
      ctx.fill();
      ctx.stroke();

      // 2. Draw Cutout Hole (Glowing Green Outline)
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 8 * scale;
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 20 * scale;

      // Draw Cutout Target Icon in Center of Wall
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${100 * scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(wall.pose.emoji, w / 2, h / 2);
      ctx.shadowBlur = 0;
      ctx.restore();

      // 3. Collision / Fit Inspection when Wall reaches Player (z >= 0.85)
      if (wall.z >= 0.85) {
        let isP1Fit = false;
        let isP2Fit = false;

        const p1Data = playersLandmarks.find(p => p.player === 1);
        if (p1Data) {
          isP1Fit = wall.pose.checkFit(p1Data.lm);
        }

        if (modeRef.current === 'MULTI') {
          const p2Data = playersLandmarks.find(p => p.player === 2);
          if (p2Data) isP2Fit = wall.pose.checkFit(p2Data.lm);
        }

        const isSuccess = modeRef.current === 'SINGLE' ? isP1Fit : (isP1Fit || isP2Fit);

        if (isSuccess) {
          playSound('pass');
          if (isP1Fit) {
            scoreP1Ref.current += 100;
            setScoreP1(scoreP1Ref.current);
          }
          if (isP2Fit) {
            scoreP2Ref.current += 100;
            setScoreP2(scoreP2Ref.current);
          }
        } else {
          playSound('crash');
          screenShakeRef.current = 2.0;
          livesP1Ref.current -= 1;
          setLivesP1(livesP1Ref.current);

          if (livesP1Ref.current <= 0) {
            setGameState('GAMEOVER');
          }
        }

        spawnNewWall();
      }
    }

    // X-Pose Exit Banner
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
      
      {/* Camera Video Background */}
      <video
        ref={videoRef}
        style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          objectFit: 'cover', transform: 'scaleX(-1)', opacity: 0.35
        }}
        playsInline
        muted
      />

      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />

      {/* Header Overlay */}
      <div style={{ position: 'absolute', top: '20px', left: '20px', right: '20px', display: 'flex', justifyContent: 'space-between', zIndex: 10, pointerEvents: 'none' }}>
        <div>
          <Link to="/" style={{ pointerEvents: 'auto', color: '#00d2ff', textDecoration: 'none', fontSize: '1.2rem', fontWeight: 'bold' }}>
            &larr; Back to Menu
          </Link>
          <h1 style={{ color: 'white', margin: '5px 0 0 0', fontSize: '2.2rem' }}>🧱 Hole in the Wall AR</h1>
          <p style={{ color: '#94a3b8', margin: 0 }}>Fit your body into incoming wall cutouts! | 🙅 Cross Arms X 1.2s to Exit</p>
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
              </div>
            )}
          </div>
        )}
      </div>

      {/* Target Pose Card Banner (Center Bottom) */}
      {gameState === 'PLAYING' && wallRef.current && (
        <div style={{
          position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(16px)',
          padding: '1.5rem 3rem', borderRadius: '24px', border: '2px solid #10b981',
          boxShadow: '0 0 30px rgba(16,185,129,0.5)', textAlign: 'center', color: 'white', zIndex: 20
        }}>
          <div style={{ fontSize: '3.5rem', margin: '0' }}>{wallRef.current.pose.emoji}</div>
          <h2 style={{ margin: '5px 0', fontSize: '1.8rem', color: '#a7f3d0' }}>{wallRef.current.pose.name}</h2>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '1.1rem' }}>{wallRef.current.pose.desc}</p>
        </div>
      )}

      {/* Start / Game Over Modal */}
      {gameState !== 'PLAYING' && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 30
        }}>
          <div style={{
            backgroundColor: '#1e293b', padding: '3rem', borderRadius: '24px',
            border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center', maxWidth: '520px', width: '90%',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
          }}>
            {gameState === 'MENU' ? (
              <>
                <h2 style={{ fontSize: '2.5rem', color: 'white', margin: '0 0 10px 0' }}>🧱 Hole in the Wall AR</h2>
                <p style={{ color: '#94a3b8', fontSize: '1.1rem', marginBottom: '2rem' }}>
                  Match incoming wall cutout shapes with your body posture before the wall crashes into you!
                </p>

                <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                  <button
                    onClick={() => startGame('SINGLE')}
                    disabled={status !== 'Ready'}
                    style={{
                      padding: '16px 28px', fontSize: '1.2rem', fontWeight: 'bold',
                      backgroundColor: status === 'Ready' ? '#10b981' : '#64748b',
                      color: '#0f172a', border: 'none', borderRadius: '12px', cursor: status === 'Ready' ? 'pointer' : 'not-allowed',
                      boxShadow: '0 10px 25px rgba(16,185,129,0.4)'
                    }}
                  >
                    👤 Single Player
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
                <h2 style={{ fontSize: '2.5rem', color: '#ef4444', margin: '0 0 10px 0' }}>💥 Crashed Into Wall!</h2>
                
                <div style={{ backgroundColor: '#0f172a', padding: '1.5rem', borderRadius: '16px', marginBottom: '2rem' }}>
                  <div style={{ color: '#94a3b8', fontSize: '1rem' }}>FINAL SCORE</div>
                  <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#10b981' }}>{scoreP1}</div>
                </div>

                <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                  <button
                    onClick={() => startGame('SINGLE')}
                    style={{
                      padding: '14px 24px', fontSize: '1.1rem', fontWeight: 'bold',
                      backgroundColor: '#10b981', color: '#0f172a', border: 'none', borderRadius: '12px', cursor: 'pointer'
                    }}
                  >
                    👤 Play Again
                  </button>
                  <button
                    onClick={() => startGame('MULTI')}
                    style={{
                      padding: '14px 24px', fontSize: '1.1rem', fontWeight: 'bold',
                      backgroundColor: '#eab308', color: '#0f172a', border: 'none', borderRadius: '12px', cursor: 'pointer'
                    }}
                  >
                    👥 2-Player Versus
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

export default WallGame;
