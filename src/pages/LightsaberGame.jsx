import React, { useEffect, useRef, useState } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { Link } from 'react-router-dom';

const DIRECTIONS = [
  { id: 'UP', arrow: '⬆️', dx: 0, dy: -1 },
  { id: 'DOWN', arrow: '⬇️', dx: 0, dy: 1 },
  { id: 'LEFT', arrow: '⬅️', dx: -1, dy: 0 },
  { id: 'RIGHT', arrow: '➡️', dx: 1, dy: 0 }
];

// Web Audio API Sound Effects
const playSound = (type) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'saber_hit') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else if (type === 'wrong') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch (e) {}
};

const LightsaberGame = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const poseLandmarkerRef = useRef(null);
  const animationRef = useRef(null);

  // Game Mode & State
  const [mode, setMode] = useState('SINGLE'); // SINGLE or MULTI
  const [gameState, setGameState] = useState('MENU'); // MENU, PLAYING, GAMEOVER
  const [scoreP1, setScoreP1] = useState(0);
  const [scoreP2, setScoreP2] = useState(0);
  const [comboP1, setComboP1] = useState(0);
  const [comboP2, setComboP2] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [status, setStatus] = useState('Initializing Model...');

  // Game Refs
  const modeRef = useRef('SINGLE');
  const blocksRef = useRef([]);
  const slicedPiecesRef = useRef([]);
  const sparksRef = useRef([]);
  const saberTrailsRef = useRef({});
  const scoreP1Ref = useRef(0);
  const scoreP2Ref = useRef(0);
  const comboP1Ref = useRef(0);
  const comboP2Ref = useRef(0);
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

  // Timer Countdown
  useEffect(() => {
    let timer;
    if (gameState === 'PLAYING') {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setGameState('GAMEOVER');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [gameState]);

  const startGame = (selectedMode) => {
    setMode(selectedMode);
    modeRef.current = selectedMode;
    setScoreP1(0);
    setScoreP2(0);
    setComboP1(0);
    setComboP2(0);
    scoreP1Ref.current = 0;
    scoreP2Ref.current = 0;
    comboP1Ref.current = 0;
    comboP2Ref.current = 0;
    setTimeLeft(60);
    blocksRef.current = [];
    slicedPiecesRef.current = [];
    sparksRef.current = [];
    saberTrailsRef.current = {};
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

    // 1. Detect Hand Saber Trajectories
    let sabers = []; // { player: 1|2, side: 'left'|'right', color: string, tip: {x,y}, base: {x,y} }
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

        sortedPoses.forEach((lm, playerIdx) => {
          if (modeRef.current === 'SINGLE' && playerIdx > 0) return;

          const pNum = playerIdx + 1;
          
          ['left', 'right'].forEach((side) => {
            const wristIdx = side === 'left' ? 15 : 16;
            const elbowIdx = side === 'left' ? 13 : 14;

            if (lm[wristIdx] && lm[elbowIdx] && lm[wristIdx].visibility > 0.4) {
              const base = { x: (1 - lm[wristIdx].x) * w, y: lm[wristIdx].y * h };
              const elbow = { x: (1 - lm[elbowIdx].x) * w, y: lm[elbowIdx].y * h };

              // Calculate Saber Tip extending from forearm direction
              const dirX = base.x - elbow.x;
              const dirY = base.y - elbow.y;
              const len = Math.hypot(dirX, dirY) || 1;
              const saberLen = 220;

              const tip = {
                x: base.x + (dirX / len) * saberLen,
                y: base.y + (dirY / len) * saberLen
              };

              // Determine Saber Color
              let color = '#ef4444'; // Single Player: Left = Red
              if (modeRef.current === 'SINGLE') {
                color = side === 'left' ? '#ef4444' : '#3b82f6'; // Left Red, Right Blue
              } else {
                color = pNum === 1 ? '#00f3ff' : '#eab308'; // P1 Cyan, P2 Gold
              }

              sabers.push({ player: pNum, side, color, base, tip, dirX: dirX / len, dirY: dirY / len });

              // Trail
              const trailKey = `saber_p${pNum}_${side}`;
              if (!saberTrailsRef.current[trailKey]) saberTrailsRef.current[trailKey] = [];
              const trail = saberTrailsRef.current[trailKey];
              trail.push({ tipX: tip.x, tipY: tip.y, baseX: base.x, baseY: base.y });
              if (trail.length > 8) trail.shift();
            }
          });
        });
      }
    }

    if (gameState === 'PLAYING') {
      // 2. Spawn Beat Blocks
      if (Math.random() < (modeRef.current === 'MULTI' ? 0.07 : 0.05) && blocksRef.current.length < 7) {
        const direction = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];

        if (modeRef.current === 'SINGLE') {
          // Single Player Mode: Red & Blue Blocks
          const targetColor = Math.random() < 0.5 ? 'red' : 'blue';
          blocksRef.current.push({
            id: Math.random(),
            color: targetColor,
            targetPlayer: 1,
            direction,
            x: Math.random() * (w - 400) + 200,
            y: h / 2 + (Math.random() - 0.5) * 100,
            z: 0.1,
            speed: Math.random() * 0.015 + 0.018
          });
        } else {
          // 2-Player Versus Mode: Separate Left Lane (P1 Cyan) & Right Lane (P2 Gold)
          const isP1 = Math.random() < 0.5;
          const targetPlayer = isP1 ? 1 : 2;
          const color = isP1 ? 'cyan' : 'gold';
          // P1 Left Lane: 15% to 42% of width | P2 Right Lane: 58% to 85% of width
          const spawnX = isP1 ? (Math.random() * (w * 0.27) + w * 0.15) : (Math.random() * (w * 0.27) + w * 0.58);

          blocksRef.current.push({
            id: Math.random(),
            color,
            targetPlayer,
            direction,
            x: spawnX,
            y: h / 2 + (Math.random() - 0.5) * 100,
            z: 0.1,
            speed: Math.random() * 0.015 + 0.018
          });
        }
      }

        // 3. Update & Draw Beat Blocks
        blocksRef.current.forEach((block, bIdx) => {
          block.z += block.speed;

          const size = 120 * block.z;
          const bX = block.x;
          const bY = block.y;
          
          let hexColor = '#ef4444';
          if (modeRef.current === 'SINGLE') {
            hexColor = block.color === 'red' ? '#ef4444' : '#3b82f6';
          } else {
            hexColor = block.targetPlayer === 1 ? '#00f3ff' : '#eab308';
          }

          // Check Saber Slicing Collision when block reaches slicing plane (z >= 0.75)
          let slicedBySaber = null;
          if (block.z >= 0.75) {
            sabers.forEach(saber => {
              const saberMidX = (saber.base.x + saber.tip.x) / 2;
              const saberMidY = (saber.base.y + saber.tip.y) / 2;
              const dist = Math.hypot(saberMidX - bX, saberMidY - bY);

              if (dist < size * 0.9) {
                slicedBySaber = saber;
              }
            });
          }

          if (slicedBySaber) {
            // Validate Color & Player Match
            let isCorrectSlice = false;
            if (modeRef.current === 'SINGLE') {
              isCorrectSlice = (block.color === 'red' && slicedBySaber.side === 'left') || (block.color === 'blue' && slicedBySaber.side === 'right');
            } else {
              isCorrectSlice = (slicedBySaber.player === block.targetPlayer);
            }

            if (isCorrectSlice) {
              playSound('saber_hit');
              if (slicedBySaber.player === 1) {
                scoreP1Ref.current += 110;
                comboP1Ref.current += 1;
                setScoreP1(scoreP1Ref.current);
                setComboP1(comboP1Ref.current);
              } else {
                scoreP2Ref.current += 110;
                comboP2Ref.current += 1;
                setScoreP2(scoreP2Ref.current);
                setComboP2(comboP2Ref.current);
              }

              // Create Sliced Cube Halves
              slicedPiecesRef.current.push(
                { color: hexColor, x: bX - 30, y: bY, vx: -6, vy: -4, size, rot: 0, life: 1.0 },
                { color: hexColor, x: bX + 30, y: bY, vx: 6, vy: -4, size, rot: 0, life: 1.0 }
              );

              // Sparks Particles
              for (let s = 0; s < 25; s++) {
                sparksRef.current.push({
                  x: bX, y: bY,
                  vx: (Math.random() - 0.5) * 14, vy: (Math.random() - 0.5) * 14,
                  color: hexColor, size: Math.random() * 6 + 3, life: 1.0
                });
              }
            } else {
              playSound('wrong');
              if (slicedBySaber.player === 1) {
                scoreP1Ref.current = Math.max(0, scoreP1Ref.current - 20);
                comboP1Ref.current = 0;
                setScoreP1(scoreP1Ref.current);
                setComboP1(0);
              } else {
                scoreP2Ref.current = Math.max(0, scoreP2Ref.current - 20);
                comboP2Ref.current = 0;
                setScoreP2(scoreP2Ref.current);
                setComboP2(0);
              }
            }

            blocksRef.current.splice(bIdx, 1);
          } else if (block.z < 1.1) {
          // Draw Beat Cube Block
          ctx.save();
          ctx.translate(bX, bY);

          // Glow Box
          ctx.fillStyle = hexColor;
          ctx.shadowColor = hexColor;
          ctx.shadowBlur = 20 * block.z;
          ctx.beginPath();
          ctx.roundRect(-size / 2, -size / 2, size, size, 16 * block.z);
          ctx.fill();
          ctx.shadowBlur = 0;

          // Inner Border
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 4 * block.z;
          ctx.stroke();

          // Directional Arrow Symbol
          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${40 * block.z}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(block.direction.arrow, 0, 0);

          ctx.restore();
        }
      });

      // Filter out blocks passed player
      blocksRef.current = blocksRef.current.filter(b => b.z < 1.1);

      // 4. Update & Draw Sliced Cube Halves
      slicedPiecesRef.current.forEach((piece, pIdx) => {
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.vy += 0.5;
        piece.life -= 0.03;

        if (piece.life <= 0) {
          slicedPiecesRef.current.splice(pIdx, 1);
        } else {
          ctx.save();
          ctx.globalAlpha = piece.life;
          ctx.fillStyle = piece.color;
          ctx.beginPath();
          ctx.roundRect(piece.x - piece.size / 4, piece.y - piece.size / 2, piece.size / 2, piece.size, 8);
          ctx.fill();
          ctx.restore();
        }
      });

      // 5. Update & Draw Sparks
      sparksRef.current.forEach((sp, sIdx) => {
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.life -= 0.04;
        if (sp.life <= 0) {
          sparksRef.current.splice(sIdx, 1);
        } else {
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, sp.size * sp.life, 0, Math.PI * 2);
          ctx.fillStyle = sp.color;
          ctx.globalAlpha = sp.life;
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }
      });
    }

    // 6. Draw Glowing 3D Lightsabers
    sabers.forEach((saber) => {
      // Outer Laser Glow Aura
      ctx.beginPath();
      ctx.moveTo(saber.base.x, saber.base.y);
      ctx.lineTo(saber.tip.x, saber.tip.y);
      ctx.lineWidth = 18;
      ctx.strokeStyle = saber.color;
      ctx.shadowColor = saber.color;
      ctx.shadowBlur = 25;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Inner White Energy Core
      ctx.beginPath();
      ctx.moveTo(saber.base.x, saber.base.y);
      ctx.lineTo(saber.tip.x, saber.tip.y);
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#ffffff';
      ctx.shadowBlur = 0;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Metallic Hilt Handle
      ctx.beginPath();
      ctx.arc(saber.base.x, saber.base.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#64748b';
      ctx.fill();
    });

    // Draw X-Pose Exit Banner
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
      
      {/* Camera Video Background */}
      <video
        ref={videoRef}
        style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          objectFit: 'cover', transform: 'scaleX(-1)', opacity: 0.3
        }}
        playsInline
        muted
      />

      {/* Game Canvas Overlay */}
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
          <h1 style={{ color: 'white', margin: '5px 0 0 0', fontSize: '2.2rem' }}>⚔️ Beat Saber AR</h1>
          <p style={{ color: '#94a3b8', margin: 0 }}>Mode: {mode === 'SINGLE' ? '🔴 Left Red | 🔵 Right Blue' : '👥 2-Player Versus'} | 🙅 Cross Arms X 1.2s to Exit</p>
        </div>

        {gameState === 'PLAYING' && (
          <div style={{ display: 'flex', gap: '20px', pointerEvents: 'auto' }}>
            <div style={{ backgroundColor: 'rgba(15,23,42,0.85)', padding: '12px 20px', borderRadius: '16px', border: '2px solid #00f3ff', color: 'white', textAlign: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: '#00f3ff', fontWeight: 'bold' }}>PLAYER 1</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#10b981' }}>{scoreP1}</div>
              <div style={{ fontSize: '0.9rem', color: '#ec4899' }}>{comboP1} COMBO!</div>
            </div>

            {mode === 'MULTI' && (
              <div style={{ backgroundColor: 'rgba(15,23,42,0.85)', padding: '12px 20px', borderRadius: '16px', border: '2px solid #eab308', color: 'white', textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: '#eab308', fontWeight: 'bold' }}>PLAYER 2</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#10b981' }}>{scoreP2}</div>
                <div style={{ fontSize: '0.9rem', color: '#ec4899' }}>{comboP2} COMBO!</div>
              </div>
            )}

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
            backgroundColor: '#1e293b', padding: '3rem', borderRadius: '24px',
            border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center', maxWidth: '520px', width: '90%',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
          }}>
            {gameState === 'MENU' ? (
              <>
                <h2 style={{ fontSize: '2.5rem', color: 'white', margin: '0 0 10px 0' }}>⚔️ Beat Saber AR</h2>
                <p style={{ color: '#94a3b8', fontSize: '1.1rem', marginBottom: '2rem' }}>
                  Slice flying rhythm blocks in the arrow direction with your glowing Lightsabers!
                </p>

                <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                  <button
                    onClick={() => startGame('SINGLE')}
                    disabled={status !== 'Ready'}
                    style={{
                      padding: '16px 28px', fontSize: '1.2rem', fontWeight: 'bold',
                      backgroundColor: status === 'Ready' ? '#ef4444' : '#64748b',
                      color: 'white', border: 'none', borderRadius: '12px', cursor: status === 'Ready' ? 'pointer' : 'not-allowed',
                      boxShadow: '0 10px 25px rgba(239,68,68,0.4)'
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
                <h2 style={{ fontSize: '2.5rem', color: '#00f3ff', margin: '0 0 10px 0' }}>⚡ Song Complete!</h2>
                
                {mode === 'MULTI' ? (
                  <div style={{ backgroundColor: '#0f172a', padding: '1.5rem', borderRadius: '16px', marginBottom: '2rem' }}>
                    <h3 style={{ fontSize: '1.8rem', color: '#10b981', margin: '0 0 10px 0' }}>
                      {scoreP1 > scoreP2 ? '🏆 Player 1 Wins!' : scoreP2 > scoreP1 ? '🏆 Player 2 Wins!' : '👔 It\'s a Tie!'}
                    </h3>
                    <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '1.2rem', color: 'white' }}>
                      <div>P1: <b>{scoreP1}</b></div>
                      <div>P2: <b>{scoreP2}</b></div>
                    </div>
                  </div>
                ) : (
                  <div style={{ backgroundColor: '#0f172a', padding: '1.5rem', borderRadius: '16px', marginBottom: '2rem' }}>
                    <div style={{ color: '#94a3b8', fontSize: '1rem' }}>FINAL SCORE</div>
                    <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#10b981' }}>{scoreP1}</div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                  <button
                    onClick={() => startGame('SINGLE')}
                    style={{
                      padding: '14px 24px', fontSize: '1.1rem', fontWeight: 'bold',
                      backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer'
                    }}
                  >
                    👤 Single Player
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

export default LightsaberGame;
