import React, { useEffect, useRef, useState } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { Canvas } from '@react-three/fiber';
import { Box, Sphere, Cylinder, Text, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useNavigate } from 'react-router-dom';

// Slash Direction Definitions
const DIRECTIONS = [
  { id: 'UP', arrow: '⬆️', rot: 0 },
  { id: 'DOWN', arrow: '⬇️', rot: Math.PI },
  { id: 'LEFT', arrow: '⬅️', rot: Math.PI / 2 },
  { id: 'RIGHT', arrow: '➡️', rot: -Math.PI / 2 }
];

// 3D Directional Beat Block Component
const BeatBlock3D = ({ color, dirArrow, position, rotation }) => {
  const isRed = color === 'red';
  const blockColor = isRed ? '#ef4444' : '#3b82f6';
  const emissiveColor = isRed ? '#f87171' : '#60a5fa';

  return (
    <group position={position} rotation={rotation}>
      {/* 3D Main Beat Block Body */}
      <Box args={[0.9, 0.9, 0.9]}>
        <meshStandardMaterial
          color={blockColor}
          emissive={emissiveColor}
          emissiveIntensity={1.5}
          roughness={0.2}
          metalness={0.4}
        />
      </Box>

      {/* Outer Glowing Wireframe Bezel */}
      <Box args={[0.95, 0.95, 0.95]}>
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2.0} wireframe />
      </Box>

      {/* Front Face Arrow Symbol */}
      <Text position={[0, 0, 0.48]} fontSize={0.5} color="#ffffff" anchorX="center" anchorY="middle">
        {dirArrow}
      </Text>
    </group>
  );
};

// 3D Sliced Beat Block Half Component
const SlicedBlockHalf3D = ({ color, position, rotation, isLeft }) => {
  const isRed = color === 'red';
  const blockColor = isRed ? '#ef4444' : '#3b82f6';

  return (
    <group position={position} rotation={rotation}>
      <Box args={[0.42, 0.9, 0.9]}>
        <meshStandardMaterial color={blockColor} roughness={0.3} />
      </Box>
    </group>
  );
};

// 3D Dual Lightsaber Component (Held by player hands)
const Lightsaber3D = ({ position, color = '#ef4444' }) => {
  return (
    <group position={position}>
      {/* Metallic Hilt Handle */}
      <Cylinder args={[0.06, 0.06, 0.4, 16]} position={[0, -0.2, 0]}>
        <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.1} />
      </Cylinder>
      {/* Glowing Energy Plasma Blade */}
      <Cylinder args={[0.05, 0.05, 1.8, 16]} position={[0, 0.9, 0]}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={4.0} transparent opacity={0.9} />
      </Cylinder>
      {/* Core Plasma White Core */}
      <Cylinder args={[0.02, 0.02, 1.75, 16]} position={[0, 0.9, 0]}>
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={3.0} />
      </Cylinder>
      {/* Tip Glow Light */}
      <pointLight position={[0, 1.8, 0]} intensity={3.0} color={color} />
    </group>
  );
};

// 3D Cyber Stage Floor
const LightsaberStageFloor = () => {
  return (
    <group position={[0, -2.2, -2]}>
      <Box args={[14, 0.1, 16]} position={[0, -0.05, 0]}>
        <meshStandardMaterial color="#0b0f19" roughness={0.4} metalness={0.8} />
      </Box>

      {/* Glowing Highway Side Rails */}
      {[-3.5, 3.5].map((xPos, idx) => (
        <Box key={`rail_${idx}`} args={[0.12, 0.12, 15.8]} position={[xPos, 0.05, 0]}>
          <meshStandardMaterial color="#00f3ff" emissive="#00f3ff" emissiveIntensity={3.5} />
        </Box>
      ))}

      {/* Red & Blue Center Lane Dividers */}
      <Box args={[0.08, 0.08, 15.8]} position={[-1.2, 0.04, 0]}>
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={3.0} />
      </Box>
      <Box args={[0.08, 0.08, 15.8]} position={[1.2, 0.04, 0]}>
        <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={3.0} />
      </Box>
    </group>
  );
};

// Web Audio API Sound Generator
const playSound = (type) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'slash') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else if (type === 'miss') {
      osc.type = 'sine';
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
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const poseLandmarkerRef = useRef(null);
  const animationRef = useRef(null);

  // Game Mode & State
  const [mode, setMode] = useState('SINGLE');
  const [gameState, setGameState] = useState('MENU');
  const [scoreP1, setScoreP1] = useState(0);
  const [scoreP2, setScoreP2] = useState(0);
  const [comboP1, setComboP1] = useState(0);
  const [comboP2, setComboP2] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [status, setStatus] = useState('Initializing Model...');

  // 3D Game Engine State
  const [blocks3D, setBlocks3D] = useState([]);
  const [halves3D, setHalves3D] = useState([]);
  const [saberP1Left, setSaberP1Left] = useState([-1.2, -0.5, 1.2]);
  const [saberP1Right, setSaberP1Right] = useState([1.2, -0.5, 1.2]);
  const [saberP2Left, setSaberP2Left] = useState([-2.2, -0.5, 1.2]);
  const [saberP2Right, setSaberP2Right] = useState([2.2, -0.5, 1.2]);

  // Refs
  const modeRef = useRef('SINGLE');
  const gameStateRef = useRef('MENU');
  const blocks3DRef = useRef([]);
  const halves3DRef = useRef([]);
  const lastSpawnTimeRef = useRef(0);
  const scoreP1Ref = useRef(0);
  const scoreP2Ref = useRef(0);
  const comboP1Ref = useRef(0);
  const comboP2Ref = useRef(0);
  const saberP1LeftRef = useRef([-1.2, -0.5, 1.2]);
  const saberP1RightRef = useRef([1.2, -0.5, 1.2]);
  const saberP2LeftRef = useRef([-2.2, -0.5, 1.2]);
  const saberP2RightRef = useRef([2.2, -0.5, 1.2]);
  const xPoseRef = useRef({ startTime: 0, progress: 0 });

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

  // Timer Countdown
  useEffect(() => {
    let timer;
    if (gameState === 'PLAYING') {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            gameStateRef.current = 'GAMEOVER';
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
    gameStateRef.current = 'PLAYING';
    setScoreP1(0);
    setScoreP2(0);
    setComboP1(0);
    setComboP2(0);
    scoreP1Ref.current = 0;
    scoreP2Ref.current = 0;
    comboP1Ref.current = 0;
    comboP2Ref.current = 0;
    setTimeLeft(60);
    lastSpawnTimeRef.current = Date.now();
    blocks3DRef.current = [];
    halves3DRef.current = [];
    setBlocks3D([]);
    setHalves3D([]);
    setGameState('PLAYING');
  };

  // Main Motion Detection & 3D Beat Saber Engine Loop
  const renderGame = () => {
    if (!videoRef.current) return;

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

        // Player 1 Left (Red) & Right (Blue) Lightsaber Hand Tracking
        if (sortedPoses[0]) {
          const lm1 = sortedPoses[0];
          if (lm1[15] && lm1[15].visibility > 0.3) {
            const x3d = (0.5 - lm1[15].x) * 6.5;
            const y3d = (0.5 - lm1[15].y) * 4.5;
            saberP1LeftRef.current = [x3d, y3d, 1.2];
            setSaberP1Left([x3d, y3d, 1.2]);
          }
          if (lm1[16] && lm1[16].visibility > 0.3) {
            const x3d = (0.5 - lm1[16].x) * 6.5;
            const y3d = (0.5 - lm1[16].y) * 4.5;
            saberP1RightRef.current = [x3d, y3d, 1.2];
            setSaberP1Right([x3d, y3d, 1.2]);
          }
        }

        // Player 2 Cyan & Magenta Lightsaber Hand Tracking
        if (sortedPoses[1] && modeRef.current === 'MULTI') {
          const lm2 = sortedPoses[1];
          if (lm2[15] && lm2[15].visibility > 0.3) {
            const x3d = (0.5 - lm2[15].x) * 6.5;
            const y3d = (0.5 - lm2[15].y) * 4.5;
            saberP2LeftRef.current = [x3d, y3d, 1.2];
            setSaberP2Left([x3d, y3d, 1.2]);
          }
          if (lm2[16] && lm2[16].visibility > 0.3) {
            const x3d = (0.5 - lm2[16].x) * 6.5;
            const y3d = (0.5 - lm2[16].y) * 4.5;
            saberP2RightRef.current = [x3d, y3d, 1.2];
            setSaberP2Right([x3d, y3d, 1.2]);
          }
        }
      }
    }

    if (gameStateRef.current === 'PLAYING') {
      // 1. Spawn 3D Beat Blocks
      const now = Date.now();
      if (now - lastSpawnTimeRef.current > 1800 && blocks3DRef.current.length < 5) {
        lastSpawnTimeRef.current = now;

        const isRed = Math.random() < 0.5;
        const selectedDir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
        const xOffset = isRed ? -1.2 : 1.2;

        blocks3DRef.current.push({
          id: Math.random(),
          color: isRed ? 'red' : 'blue',
          dir: selectedDir,
          position: [xOffset, -0.4, -12.0],
          speed: 0.12,
          hit: false
        });
      }

      // 2. Slide 3D Beat Blocks Forward & Check Lightsaber Slash Collision
      blocks3DRef.current.forEach((block) => {
        block.position[2] += block.speed; // Slide forward to player at z = 1.2

        // Lightsaber Slash Collision Check Window (z >= 0.8 && z <= 1.5)
        if (!block.hit && block.position[2] >= 0.8 && block.position[2] <= 1.5) {
          const targetSaber = block.color === 'red' ? saberP1LeftRef.current : saberP1RightRef.current;
          const distP1 = Math.hypot(targetSaber[0] - block.position[0], targetSaber[1] - block.position[1]);

          let slashed = false;
          if (distP1 < 0.95) {
            slashed = true;
            scoreP1Ref.current += 100;
            comboP1Ref.current += 1;
            setScoreP1(scoreP1Ref.current);
            setComboP1(comboP1Ref.current);
            playSound('slash');
          }

          if (modeRef.current === 'MULTI' && !slashed) {
            const targetSaberP2 = block.color === 'red' ? saberP2LeftRef.current : saberP2RightRef.current;
            const distP2 = Math.hypot(targetSaberP2[0] - block.position[0], targetSaberP2[1] - block.position[1]);
            if (distP2 < 0.95) {
              slashed = true;
              scoreP2Ref.current += 100;
              comboP2Ref.current += 1;
              setScoreP2(scoreP2Ref.current);
              setComboP2(comboP2Ref.current);
              playSound('slash');
            }
          }

          if (slashed) {
            block.hit = true;

            // Spawn 2 Splitting 3D Block Halves
            halves3DRef.current.push({
              id: Math.random(),
              color: block.color,
              x: block.position[0] - 0.3, y: block.position[1], z: block.position[2],
              vx: -0.06, vy: 0.04,
              rotX: 0.1, isLeft: true
            });
            halves3DRef.current.push({
              id: Math.random(),
              color: block.color,
              x: block.position[0] + 0.3, y: block.position[1], z: block.position[2],
              vx: 0.06, vy: 0.04,
              rotX: -0.1, isLeft: false
            });
          }
        }
      });

      // Filter out passed blocks
      blocks3DRef.current = blocks3DRef.current.filter(b => !b.hit && b.position[2] < 3.0);
      setBlocks3D(blocks3DRef.current.map(b => ({
        ...b,
        position: [b.position[0], b.position[1], b.position[2]]
      })));

      // Update 3D Splitting Halves
      halves3DRef.current.forEach((h) => {
        h.x += h.vx;
        h.y += h.vy;
        h.vy -= 0.004;
      });
      halves3DRef.current = halves3DRef.current.filter((h) => h.y > -4.0);
      setHalves3D(halves3DRef.current.map(h => ({ ...h })));
    }

    animationRef.current = requestAnimationFrame(renderGame);
  };

  useEffect(() => {
    if (status === 'Ready') {
      renderGame();
    }
  }, [status]);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', backgroundColor: '#090d16', overflow: 'hidden' }}>
      
      <video ref={videoRef} style={{ display: 'none' }} playsInline muted />

      {/* 3D Beat Saber Canvas */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
        <Canvas camera={{ position: [0, 2.0, 7.0], fov: 55 }}>
          <ambientLight intensity={0.9} />
          <pointLight position={[0, 10, 5]} intensity={2.5} color="#00f3ff" />
          <pointLight position={[-6, 5, -2]} intensity={2.5} color="#ef4444" />
          <pointLight position={[6, 5, -2]} intensity={2.5} color="#3b82f6" />

          {/* 3D Cyber Highway Floor */}
          <LightsaberStageFloor />

          {/* 3D Flying Directional Beat Blocks */}
          {blocks3D.map((block) => (
            <BeatBlock3D
              key={block.id}
              color={block.color}
              dirArrow={block.dir.arrow}
              position={[block.position[0], block.position[1], block.position[2]]}
              rotation={[0, 0, block.dir.rot]}
            />
          ))}

          {/* 3D Sliced Block Halves */}
          {halves3D.map((h) => (
            <SlicedBlockHalf3D
              key={h.id}
              color={h.color}
              position={[h.x, h.y, h.z]}
              rotation={[h.rotX, 0, 0]}
              isLeft={h.isLeft}
            />
          ))}

          {/* Player 1 3D Dual Lightsabers (🔴 Red Left / 🔵 Blue Right) */}
          <Lightsaber3D position={saberP1Left} color="#ef4444" />
          <Lightsaber3D position={saberP1Right} color="#3b82f6" />

          {/* Player 2 3D Dual Lightsabers (Cyan Left / Magenta Right) */}
          {mode === 'MULTI' && (
            <>
              <Lightsaber3D position={saberP2Left} color="#00f3ff" />
              <Lightsaber3D position={saberP2Right} color="#ec4899" />
            </>
          )}

          <OrbitControls enableZoom={false} enablePan={false} maxPolarAngle={Math.PI / 2} />
        </Canvas>
      </div>

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
          <h1 style={{ color: 'white', margin: '5px 0 0 0', fontSize: '2.2rem' }}>⚔️ 3D Beat Saber AR</h1>
          <p style={{ color: '#94a3b8', margin: 0 }}>🔴 Left Red Saber | 🔵 Right Blue Saber! | 🙅 Cross Arms X 1.2s to Exit</p>
        </div>

        {gameState === 'PLAYING' && (
          <div style={{ display: 'flex', gap: '20px', pointerEvents: 'auto' }}>
            <div style={{ backgroundColor: 'rgba(15,23,42,0.85)', padding: '12px 20px', borderRadius: '16px', border: '2px solid #ef4444', color: 'white', textAlign: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: '#ef4444', fontWeight: 'bold' }}>PLAYER 1</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#10b981' }}>{scoreP1}</div>
              <div style={{ fontSize: '0.9rem', color: '#f59e0b' }}>🔥 Combo: {comboP1}</div>
            </div>

            {mode === 'MULTI' && (
              <div style={{ backgroundColor: 'rgba(15,23,42,0.85)', padding: '12px 20px', borderRadius: '16px', border: '2px solid #00f3ff', color: 'white', textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: '#00f3ff', fontWeight: 'bold' }}>PLAYER 2</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#10b981' }}>{scoreP2}</div>
                <div style={{ fontSize: '0.9rem', color: '#f59e0b' }}>🔥 Combo: {comboP2}</div>
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
            backgroundColor: '#1e293b', padding: '2.5rem', borderRadius: '24px',
            border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center', maxWidth: '520px', width: '90%',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
          }}>
            {gameState === 'MENU' ? (
              <>
                <h2 style={{ fontSize: '2.5rem', color: 'white', margin: '0 0 10px 0' }}>⚔️ 3D Beat Saber AR</h2>
                <p style={{ color: '#94a3b8', fontSize: '1rem', marginBottom: '1.5rem' }}>
                  Slash incoming 3D directional beat blocks with 🔴 Left Red Saber & 🔵 Right Blue Saber!
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
                    👤 Single Saber Battle
                  </button>

                  <button
                    onClick={() => startGame('MULTI')}
                    disabled={status !== 'Ready'}
                    style={{
                      padding: '16px 28px', fontSize: '1.2rem', fontWeight: 'bold',
                      backgroundColor: status === 'Ready' ? '#ec4899' : '#64748b',
                      color: '#ffffff', border: 'none', borderRadius: '12px', cursor: status === 'Ready' ? 'pointer' : 'not-allowed',
                      boxShadow: '0 10px 25px rgba(236,72,153,0.4)'
                    }}
                  >
                    👥 2-Player Versus
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: '2.5rem', color: '#10b981', margin: '0 0 10px 0' }}>🎉 Song Finish!</h2>
                
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
                      backgroundColor: '#ec4899', color: '#ffffff', border: 'none', borderRadius: '12px', cursor: 'pointer'
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

export default LightsaberGame;
