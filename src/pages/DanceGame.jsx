import React, { useEffect, useRef, useState } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { Link } from 'react-router-dom';

const ARROWS = [
  { id: 'left', name: 'Left', arrow: '⬅️', color: '#ec4899', key: 'LEFT' },
  { id: 'up', name: 'Up', arrow: '⬆️', color: '#00f3ff', key: 'UP' },
  { id: 'down', name: 'Down', arrow: '⬇️', color: '#eab308', key: 'DOWN' },
  { id: 'right', name: 'Right', arrow: '➡️', color: '#10b981', key: 'RIGHT' }
];

// Web Audio API Sound Generator
const playSound = (type) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'step') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else if (type === 'beat') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    }
  } catch (e) {}
};

const DanceGame = () => {
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
  const [ratingP1, setRatingP1] = useState('');
  const [ratingP2, setRatingP2] = useState('');
  const [timeLeft, setTimeLeft] = useState(60);
  const [status, setStatus] = useState('Initializing Model...');

  // Game Engine Refs
  const modeRef = useRef('SINGLE');
  const arrowNotesRef = useRef([]);
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
    arrowNotesRef.current = [];
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

    // Track Feet Positions (Ankle #27/#28, Foot #31/#32)
    let playerFeet = []; // { player: 1|2, feet: [{x, y, isStepping}] }
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
          const feetList = [];

          // Left Foot (Ankle 27 / Foot 31) & Right Foot (Ankle 28 / Foot 32)
          [27, 28, 31, 32].forEach(idx => {
            if (lm[idx] && lm[idx].visibility > 0.3) {
              feetList.push({
                x: (1 - lm[idx].x) * w,
                y: lm[idx].y * h
              });
            }
          });

          playerFeet.push({ player: pNum, feet: feetList });
        });
      }
    }

    if (gameState === 'PLAYING') {
      // 1. Define Floor Step Pad Bounds
      const padY = h - 110;
      const padSize = 85;

      const p1Pads = ARROWS.map((arr, i) => ({
        ...arr,
        player: 1,
        x: modeRef.current === 'SINGLE' ? (w / 2 - 180 + i * 95) : (w * 0.25 - 180 + i * 95),
        y: padY,
        w: padSize,
        h: padSize
      }));

      const p2Pads = modeRef.current === 'MULTI' ? ARROWS.map((arr, i) => ({
        ...arr,
        player: 2,
        x: w * 0.75 - 180 + i * 95,
        y: padY,
        w: padSize,
        h: padSize
      })) : [];

      const allPads = [...p1Pads, ...p2Pads];

      // 2. Spawn Falling Rhythm Arrow Notes
      if (Math.random() < 0.05 && arrowNotesRef.current.length < 8) {
        const arrow = ARROWS[Math.floor(Math.random() * ARROWS.length)];
        const targetPlayer = modeRef.current === 'MULTI' ? (Math.random() < 0.5 ? 1 : 2) : 1;

        const targetPad = allPads.find(p => p.player === targetPlayer && p.id === arrow.id);
        if (targetPad) {
          arrowNotesRef.current.push({
            id: Math.random(),
            arrow,
            player: targetPlayer,
            x: targetPad.x + targetPad.w / 2,
            y: -50,
            targetY: padY + padSize / 2,
            speed: Math.random() * 2.5 + 4.5
          });
        }
      }

      // 3. Update & Draw Falling Notes
      arrowNotesRef.current.forEach((note, nIdx) => {
        note.y += note.speed;

        // Check Foot Stepping Collision when note reaches target floor pad line
        let isHit = false;
        if (Math.abs(note.y - note.targetY) < 55) {
          const pFeet = playerFeet.find(pf => pf.player === note.player);
          if (pFeet) {
            pFeet.feet.forEach(foot => {
              if (Math.abs(foot.x - note.x) < 55 && Math.abs(foot.y - note.targetY) < 65) {
                isHit = true;
              }
            });
          }
        }

        if (isHit) {
          playSound('step');
          if (note.player === 1) {
            scoreP1Ref.current += 100;
            comboP1Ref.current += 1;
            setScoreP1(scoreP1Ref.current);
            setComboP1(comboP1Ref.current);
            setRatingP1('PERFECT! ⭐⭐⭐');
          } else {
            scoreP2Ref.current += 100;
            comboP2Ref.current += 1;
            setScoreP2(scoreP2Ref.current);
            setComboP2(comboP2Ref.current);
            setRatingP2('PERFECT! ⭐⭐⭐');
          }

          arrowNotesRef.current.splice(nIdx, 1);
        } else {
          // Draw Falling Arrow Note
          ctx.save();
          ctx.translate(note.x, note.y);
          ctx.fillStyle = note.arrow.color;
          ctx.shadowColor = note.arrow.color;
          ctx.shadowBlur = 15;
          ctx.beginPath();
          ctx.roundRect(-30, -30, 60, 60, 14);
          ctx.fill();
          ctx.shadowBlur = 0;

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 32px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(note.arrow.arrow, 0, 0);
          ctx.restore();
        }
      });

      // Filter missed notes
      arrowNotesRef.current = arrowNotesRef.current.filter(n => n.y < h + 60);

      // 4. Draw AR Floor Step Pads (Glowing Neon Target Line)
      allPads.forEach(pad => {
        let isSteppedOn = false;
        const pFeet = playerFeet.find(pf => pf.player === pad.player);
        if (pFeet) {
          pFeet.feet.forEach(foot => {
            if (foot.x > pad.x && foot.x < pad.x + pad.w && foot.y > pad.y - 30 && foot.y < pad.y + pad.h + 30) {
              isSteppedOn = true;
            }
          });
        }

        ctx.save();
        ctx.fillStyle = isSteppedOn ? pad.color : 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = pad.color;
        ctx.lineWidth = isSteppedOn ? 6 : 3;
        ctx.shadowColor = pad.color;
        ctx.shadowBlur = isSteppedOn ? 30 : 10;
        ctx.beginPath();
        ctx.roundRect(pad.x, pad.y, pad.w, pad.h, 16);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.fillStyle = isSteppedOn ? '#0f172a' : '#ffffff';
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pad.arrow, pad.x + pad.w / 2, pad.y + pad.h / 2);
        ctx.restore();
      });

      // 5. Draw Player Feet Indicators
      playerFeet.forEach(pf => {
        const footColor = pf.player === 1 ? '#00f3ff' : '#eab308';
        pf.feet.forEach(foot => {
          ctx.beginPath();
          ctx.arc(foot.x, foot.y, 18, 0, Math.PI * 2);
          ctx.fillStyle = footColor;
          ctx.shadowColor = footColor;
          ctx.shadowBlur = 15;
          ctx.fill();
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();
          ctx.shadowBlur = 0;

          ctx.font = '16px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('🦶', foot.x, foot.y + 5);
        });
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
      
      {/* Background Camera Video */}
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
          <h1 style={{ color: 'white', margin: '5px 0 0 0', fontSize: '2.2rem' }}>💃 DDR Step Dance AR</h1>
          <p style={{ color: '#94a3b8', margin: 0 }}>Step feet 🦶 on floor arrows! | Mode: {mode === 'SINGLE' ? '👤 1-Player' : '👥 2-Player Battle'} | 🙅 Cross Arms X 1.2s to Exit</p>
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
                <h2 style={{ fontSize: '2.5rem', color: 'white', margin: '0 0 10px 0' }}>💃 DDR Step Dance AR</h2>
                <p style={{ color: '#94a3b8', fontSize: '1.1rem', marginBottom: '2rem' }}>
                  Physically step your feet 🦶 onto the floor arrow pads in sync with the falling rhythm notes!
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
                    👥 2-Player Step Battle
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: '2.5rem', color: '#ec4899', margin: '0 0 10px 0' }}>🎉 Song Complete!</h2>
                
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
                      backgroundColor: '#00f3ff', color: '#0f172a', border: 'none', borderRadius: '12px', cursor: 'pointer'
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

export default DanceGame;
