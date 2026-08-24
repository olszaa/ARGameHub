import React, { useEffect, useRef, useState } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { useNavigate } from 'react-router-dom';

// Web Audio API Sound Generator
const playSound = (type) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'coin') {
      osc.frequency.setValueAtTime(987.77, ctx.currentTime); // B5
      osc.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.08); // E6
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'jump') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(250, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'hit') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(40, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) {}
};

const RunnerGame = () => {
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
  const [mode, setMode] = useState('SINGLE'); // SINGLE or MULTI
  const [gameState, setGameState] = useState('MENU'); // MENU, PLAYING, GAMEOVER
  const [coinsP1, setCoinsP1] = useState(0);
  const [coinsP2, setCoinsP2] = useState(0);
  const [distance, setDistance] = useState(0);
  const [status, setStatus] = useState('Initializing Model...');

  // Player Motion States: { lane: -1|0|1, isJumping: bool, isCrouching: bool }
  const [p1State, setP1State] = useState({ lane: 0, isJumping: false, isCrouching: false });
  const [p2State, setP2State] = useState({ lane: 0, isJumping: false, isCrouching: false });

  // Refs
  const modeRef = useRef('SINGLE');
  const itemsRef = useRef([]);
  const coinsP1Ref = useRef(0);
  const coinsP2Ref = useRef(0);
  const distanceRef = useRef(0);
  const p1BaselineY = useRef(null);
  const p2BaselineY = useRef(null);
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

  const startGame = (selectedMode) => {
    setMode(selectedMode);
    modeRef.current = selectedMode;
    setCoinsP1(0);
    setCoinsP2(0);
    setDistance(0);
    coinsP1Ref.current = 0;
    coinsP2Ref.current = 0;
    distanceRef.current = 0;
    itemsRef.current = [];
    p1BaselineY.current = null;
    p2BaselineY.current = null;
    setGameState('PLAYING');
  };

  // Main Render Loop
  const renderGame = () => {
    if (!canvasRef.current || !videoRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Track Player Motion (Lean Left/Right, Jump, Crouch)
    if (videoRef.current.readyState >= 2 && poseLandmarkerRef.current) {
      const res = poseLandmarkerRef.current.detectForVideo(videoRef.current, performance.now());
      if (res.landmarks && res.landmarks.length > 0) {
        // Robust X-Pose Exit Check (Relaxed threshold: distNorm < 0.25)
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
          const nose = lm[0];
          const hip = lm[23];

          if (nose && hip && nose.visibility > 0.4) {
            const bodyX = 1 - nose.x; // Mirrored
            const bodyY = nose.y;

            // Set Y baseline for Jump/Crouch
            if (pNum === 1) {
              if (p1BaselineY.current === null) p1BaselineY.current = bodyY;
            } else {
              if (p2BaselineY.current === null) p2BaselineY.current = bodyY;
            }

            const baseY = pNum === 1 ? p1BaselineY.current : p2BaselineY.current;

            // Lane Shift Logic (-1 Left, 0 Center, 1 Right)
            let lane = 0;
            if (modeRef.current === 'SINGLE') {
              if (bodyX < 0.40) lane = -1;
              else if (bodyX > 0.60) lane = 1;
            } else {
              if (pNum === 1) {
                if (bodyX < 0.20) lane = -1;
                else if (bodyX > 0.35) lane = 1;
              } else {
                if (bodyX < 0.65) lane = -1;
                else if (bodyX > 0.80) lane = 1;
              }
            }

            // Jump & Crouch Logic
            const isJumping = bodyY < baseY - 0.08;
            const isCrouching = bodyY > baseY + 0.08;

            if (pNum === 1) setP1State({ lane, isJumping, isCrouching });
            else setP2State({ lane, isJumping, isCrouching });
          }
        });
      }
    }

    if (gameState === 'PLAYING') {
      distanceRef.current += 1;
      setDistance(Math.floor(distanceRef.current / 5));

      // 1. Spawn Tracks & Perspective Lines
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, w, h);

      // Draw Rails Perspective
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 4;
      
      const horizonY = h * 0.35;
      const centerLine = w / 2;

      // Track Lanes
      [-1.5, -0.5, 0.5, 1.5].forEach(laneOffset => {
        ctx.beginPath();
        ctx.moveTo(centerLine + laneOffset * 40, horizonY);
        ctx.lineTo(centerLine + laneOffset * 220, h);
        ctx.stroke();
      });

      // 2. Spawn Coins & Obstacles
      if (Math.random() < 0.04 && itemsRef.current.length < 8) {
        const type = Math.random() < 0.6 ? 'COIN' : (Math.random() < 0.5 ? 'CRATE' : 'BARRIER');
        const lane = [-1, 0, 1][Math.floor(Math.random() * 3)];
        const playerTarget = modeRef.current === 'MULTI' ? (Math.random() < 0.5 ? 1 : 2) : 1;

        itemsRef.current.push({
          id: Math.random(),
          type,
          player: playerTarget,
          lane,
          z: 0.05, // Perspective scale (0.05 far -> 1.0 near)
          speed: 0.02 + (distanceRef.current * 0.00002)
        });
      }

      // 3. Update & Draw Items
      itemsRef.current.forEach((item, iIdx) => {
        item.z += item.speed;

        const size = 90 * item.z;
        const laneWidth = 140 * item.z;
        
        let trackCenterX = w / 2;
        if (modeRef.current === 'MULTI') {
          trackCenterX = item.player === 1 ? w * 0.3 : w * 0.7;
        }

        const posX = trackCenterX + item.lane * laneWidth;
        const posY = horizonY + (h - horizonY) * (item.z * item.z);

        // Check Player Collision when item reaches near plane (z >= 0.85)
        if (item.z >= 0.85 && item.z <= 1.05) {
          const pState = item.player === 1 ? p1State : p2State;

          if (pState.lane === item.lane) {
            if (item.type === 'COIN') {
              playSound('coin');
              if (item.player === 1) {
                coinsP1Ref.current += 1;
                setCoinsP1(coinsP1Ref.current);
              } else {
                coinsP2Ref.current += 1;
                setCoinsP2(coinsP2Ref.current);
              }
              itemsRef.current.splice(iIdx, 1);
              return;
            } else if (item.type === 'CRATE') {
              // Crate requires JUMPing over
              if (!pState.isJumping) {
                playSound('hit');
                setGameState('GAMEOVER');
              }
            } else if (item.type === 'BARRIER') {
              // Barrier requires CROUCHing under
              if (!pState.isCrouching) {
                playSound('hit');
                setGameState('GAMEOVER');
              }
            }
          }
        }

        // Render Item
        ctx.save();
        ctx.translate(posX, posY);

        if (item.type === 'COIN') {
          ctx.fillStyle = '#eab308';
          ctx.shadowColor = '#eab308';
          ctx.shadowBlur = 15 * item.z;
          ctx.beginPath();
          ctx.arc(0, -size / 2, size / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${30 * item.z}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🪙', 0, -size / 2);
        } else if (item.type === 'CRATE') {
          // Low Wooden Crate
          ctx.fillStyle = '#b45309';
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 4 * item.z;
          ctx.beginPath();
          ctx.roundRect(-size / 2, -size, size, size, 10 * item.z);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${30 * item.z}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText('📦 JUMP!', 0, -size / 2);
        } else if (item.type === 'BARRIER') {
          // High Overhead Barrier
          ctx.fillStyle = '#ef4444';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 4 * item.z;
          ctx.beginPath();
          ctx.roundRect(-size / 2, -size * 1.8, size, size * 0.9, 10 * item.z);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${24 * item.z}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText('🚧 DUCK!', 0, -size * 1.35);
        }

        ctx.restore();
      });

      // Filter passed items
      itemsRef.current = itemsRef.current.filter(it => it.z < 1.15);

      // 4. Draw Player Runner Avatars
      [1, modeRef.current === 'MULTI' ? 2 : null].filter(Boolean).forEach(pNum => {
        const pState = pNum === 1 ? p1State : p2State;
        const pColor = pNum === 1 ? '#00f3ff' : '#eab308';
        const trackCenterX = modeRef.current === 'MULTI' ? (pNum === 1 ? w * 0.3 : w * 0.7) : w / 2;

        const pX = trackCenterX + pState.lane * 140;
        let pY = h - 120;
        if (pState.isJumping) pY -= 80;
        if (pState.isCrouching) pY += 30;

        ctx.save();
        ctx.translate(pX, pY);

        ctx.fillStyle = pColor;
        ctx.shadowColor = pColor;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(0, pState.isCrouching ? -20 : -50, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.font = '40px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pState.isJumping ? '🦘' : (pState.isCrouching ? '🏃‍♂️' : '🏃'), 0, pState.isCrouching ? -20 : -50);

        ctx.restore();
      });
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
          objectFit: 'cover', transform: 'scaleX(-1)', opacity: 0.25
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
          <h1 style={{ color: 'white', margin: '5px 0 0 0', fontSize: '2.2rem' }}>🏃 Subway Runner AR</h1>
          <p style={{ color: '#94a3b8', margin: 0 }}>Lean Left/Right | Jump 🦘 | Duck 🏃‍♂️ | 🙅 Cross Arms X 1.2s to Exit</p>
        </div>

        {gameState === 'PLAYING' && (
          <div style={{ display: 'flex', gap: '20px', pointerEvents: 'auto' }}>
            <div style={{ backgroundColor: 'rgba(15,23,42,0.85)', padding: '12px 20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', color: 'white', textAlign: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>DISTANCE</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#3b82f6' }}>{Math.floor(distanceRef.current / 5)} m</div>
            </div>

            <div style={{ backgroundColor: 'rgba(15,23,42,0.85)', padding: '12px 20px', borderRadius: '16px', border: '2px solid #00f3ff', color: 'white', textAlign: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: '#00f3ff', fontWeight: 'bold' }}>P1 COINS</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#eab308' }}>🪙 {coinsP1}</div>
            </div>

            {mode === 'MULTI' && (
              <div style={{ backgroundColor: 'rgba(15,23,42,0.85)', padding: '12px 20px', borderRadius: '16px', border: '2px solid #eab308', color: 'white', textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: '#eab308', fontWeight: 'bold' }}>P2 COINS</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#eab308' }}>🪙 {coinsP2}</div>
              </div>
            )}
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
            border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center', maxWidth: '520px', width: '90%',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
          }}>
            {gameState === 'MENU' ? (
              <>
                <h2 style={{ fontSize: '2.5rem', color: 'white', margin: '0 0 10px 0' }}>🏃 Subway Runner AR</h2>
                <p style={{ color: '#94a3b8', fontSize: '1.1rem', marginBottom: '2rem' }}>
                  Physically Lean Left/Right to change lanes, Jump 🦘 over low hurdles, and Squat 🏃‍♂️ under barriers!
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
                    👤 Single Player Run
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
                    👥 2-Player Race
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: '2.5rem', color: '#ef4444', margin: '0 0 10px 0' }}>💥 Crashed!</h2>
                
                <div style={{ backgroundColor: '#0f172a', padding: '1.5rem', borderRadius: '16px', marginBottom: '2rem' }}>
                  <div style={{ color: '#94a3b8', fontSize: '1rem' }}>DISTANCE RUN</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#3b82f6', marginBottom: '10px' }}>
                    {Math.floor(distanceRef.current / 5)} meters
                  </div>
                  <div style={{ color: '#eab308', fontSize: '1.4rem', fontWeight: 'bold' }}>
                    🪙 Coins Collected: {coinsP1}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                  <button
                    onClick={() => startGame('SINGLE')}
                    style={{
                      padding: '14px 24px', fontSize: '1.1rem', fontWeight: 'bold',
                      backgroundColor: '#00f3ff', color: '#0f172a', border: 'none', borderRadius: '12px', cursor: 'pointer'
                    }}
                  >
                    👤 Run Again
                  </button>
                  <button
                    onClick={() => startGame('MULTI')}
                    style={{
                      padding: '14px 24px', fontSize: '1.1rem', fontWeight: 'bold',
                      backgroundColor: '#eab308', color: '#0f172a', border: 'none', borderRadius: '12px', cursor: 'pointer'
                    }}
                  >
                    👥 2-Player Race
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

export default RunnerGame;
