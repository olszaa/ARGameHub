import React, { useEffect, useRef, useState } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { Canvas } from '@react-three/fiber';
import { Box, Sphere, Cylinder, Text, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Link } from 'react-router-dom';

// 3D Volumetric Translucent Glass Hologram Wall
const HologramGridWall = ({ type, position, width = 2.4, height = 3.2, depth = 0.6 }) => {
  return (
    <group position={position}>
      {/* 3D Thick Translucent Cyan Glass Main Cuboid Body */}
      <Box args={[width, height, depth]}>
        <meshStandardMaterial
          color="#00f3ff"
          emissive="#00f3ff"
          emissiveIntensity={1.2}
          transparent
          opacity={0.45}
          roughness={0.1}
          metalness={0.8}
        />
      </Box>

      {/* 3D Glowing Cyan Outer Bezel Frame */}
      <Box args={[width + 0.08, height + 0.08, depth + 0.08]}>
        <meshStandardMaterial
          color="#00f3ff"
          emissive="#00f3ff"
          emissiveIntensity={3.0}
          wireframe
        />
      </Box>

      {/* 3D Wireframe Grid Matrix Lines inside */}
      <Box args={[width - 0.05, height - 0.05, depth - 0.05]}>
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#38bdf8"
          emissiveIntensity={2.0}
          wireframe
          transparent
          opacity={0.6}
        />
      </Box>

      {/* Diagonal 3D Hologram X-Grid Beams */}
      <Box args={[width * 1.05, 0.06, depth * 1.05]} rotation={[0, 0, Math.PI / 4]}>
        <meshStandardMaterial color="#00f3ff" emissive="#00f3ff" emissiveIntensity={3.0} />
      </Box>
      <Box args={[width * 1.05, 0.06, depth * 1.05]} rotation={[0, 0, -Math.PI / 4]}>
        <meshStandardMaterial color="#00f3ff" emissive="#00f3ff" emissiveIntensity={3.0} />
      </Box>
    </group>
  );
};

// 3D Volumetric High Barrier Duck Beam
const HighBarrierBeam = ({ position, width = 6.5, height = 1.2, depth = 0.6 }) => {
  return (
    <group position={position}>
      {/* 3D Thick Translucent Magenta Glass Beam Body */}
      <Box args={[width, height, depth]}>
        <meshStandardMaterial
          color="#ec4899"
          emissive="#ec4899"
          emissiveIntensity={1.5}
          transparent
          opacity={0.5}
          roughness={0.1}
        />
      </Box>

      {/* Glowing Outer Magenta Bezel Wireframe */}
      <Box args={[width + 0.08, height + 0.08, depth + 0.08]}>
        <meshStandardMaterial
          color="#ec4899"
          emissive="#ec4899"
          emissiveIntensity={3.5}
          wireframe
        />
      </Box>

      {/* Warning Text */}
      <Text position={[0, 0, depth / 2 + 0.05]} fontSize={0.5} color="#ffffff" anchorX="center" anchorY="middle">
        ⚠️ DUCK DOWN! 🏃‍♂️
      </Text>
    </group>
  );
};

// 5 Cyan Neon Lines & Cyber Highway Stage Floor
const CyberHighwayFloor = ({ mode }) => {
  const lineOffsets = [-3.0, -1.5, 0.0, 1.5, 3.0];

  return (
    <group position={[0, -2.4, -2]}>
      <Box args={[16, 0.1, 16]} position={[0, -0.05, 0]}>
        <meshStandardMaterial color="#050811" roughness={0.5} metalness={0.9} />
      </Box>

      {/* 5 Vertical Glowing Cyan Perspective Highway Lines */}
      {lineOffsets.map((x, idx) => (
        <Box key={`line_${idx}`} args={[0.08, 0.08, 15.8]} position={[x, 0.04, 0]}>
          <meshStandardMaterial color="#00f3ff" emissive="#00f3ff" emissiveIntensity={3.5} />
        </Box>
      ))}

      {/* Cyber Arena Stadium Seating Backdrop */}
      <group position={[0, 3.0, -9.0]}>
        <Box args={[22, 8, 0.5]}>
          <meshStandardMaterial color="#090d16" roughness={0.8} />
        </Box>
        {[-8, -4, 0, 4, 8].map((xPos, idx) => (
          <Sphere key={`seat_light_${idx}`} args={[0.3, 12, 12]} position={[xPos, 3.5, 0.3]}>
            <meshStandardMaterial color="#0284c7" emissive="#00f3ff" emissiveIntensity={2.0} />
          </Sphere>
        ))}
      </group>
    </group>
  );
};

// 3D Foot Energy Ring Component
const FootEnergyRing = ({ position, color = '#00f3ff' }) => {
  return (
    <group position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <Cylinder args={[0.45, 0.45, 0.05, 32]}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3.5} transparent opacity={0.9} />
      </Cylinder>
      <Cylinder args={[0.35, 0.35, 0.06, 32]}>
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2.0} />
      </Cylinder>
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

    if (type === 'dodge') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'hit') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) {}
};

const CyberDodgeGame = () => {
  const videoRef = useRef(null);
  const poseLandmarkerRef = useRef(null);
  const animationRef = useRef(null);

  // Game State
  const [mode, setMode] = useState('SINGLE');
  const [gameState, setGameState] = useState('MENU');
  const [scoreP1, setScoreP1] = useState(0);
  const [scoreP2, setScoreP2] = useState(0);
  const [livesP1, setLivesP1] = useState(3);
  const [livesP2, setLivesP2] = useState(3);
  const [timeLeft, setTimeLeft] = useState(60);
  const [status, setStatus] = useState('Initializing Model...');

  // Feet World Coordinates for Foot Energy Rings
  const [feetP1, setFeetP1] = useState([]);
  const [feetP2, setFeetP2] = useState([]);

  // Moving Hologram Obstacle Walls State
  const [obstacles, setObstacles] = useState([]);

  // Refs
  const modeRef = useRef('SINGLE');
  const gameStateRef = useRef('MENU');
  const obstaclesRef = useRef([]);
  const lastSpawnTimeRef = useRef(0);
  const scoreP1Ref = useRef(0);
  const scoreP2Ref = useRef(0);
  const livesP1Ref = useRef(3);
  const livesP2Ref = useRef(3);
  const playerPoseRef = useRef({ p1: { x: 0, y: 0 }, p2: { x: 0, y: 0 } });
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
    setLivesP1(3);
    setLivesP2(3);
    scoreP1Ref.current = 0;
    scoreP2Ref.current = 0;
    livesP1Ref.current = 3;
    livesP2Ref.current = 3;
    setTimeLeft(60);
    lastSpawnTimeRef.current = Date.now();
    obstaclesRef.current = [];
    setObstacles([]);
    setGameState('PLAYING');
  };

  // Main Motion Detection & Balanced Wall Sliding Loop
  const renderGame = () => {
    if (!videoRef.current) return;

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

        // Player 1 Position & Foot Rings
        if (sortedPoses[0]) {
          const lm1 = sortedPoses[0];
          const chestX = (0.5 - (lm1[11].x + lm1[12].x) / 2) * 5.5;
          const headY = (0.5 - lm1[0].y) * 5.5;
          playerPoseRef.current.p1 = { x: chestX, y: headY };

          const feet1 = [];
          [27, 28, 31, 32].forEach(idx => {
            if (lm1[idx] && lm1[idx].visibility > 0.3) {
              feet1.push([(0.5 - lm1[idx].x) * 5.5, -2.35, 1.2]);
            }
          });
          setFeetP1(feet1);
        }

        // Player 2 Position & Foot Rings
        if (sortedPoses[1] && modeRef.current === 'MULTI') {
          const lm2 = sortedPoses[1];
          const chestX = (0.5 - (lm2[11].x + lm2[12].x) / 2) * 5.5;
          const headY = (0.5 - lm2[0].y) * 5.5;
          playerPoseRef.current.p2 = { x: chestX, y: headY };

          const feet2 = [];
          [27, 28, 31, 32].forEach(idx => {
            if (lm2[idx] && lm2[idx].visibility > 0.3) {
              feet2.push([(0.5 - lm2[idx].x) * 5.5, -2.35, 1.2]);
            }
          });
          setFeetP2(feet2);
        }
      }
    }

    if (gameStateRef.current === 'PLAYING') {
      // 1. Spawn Walls with Comfortable Cooldown Gap (At least 2.2 seconds distance gap!)
      const now = Date.now();
      if (now - lastSpawnTimeRef.current > 2200 && obstaclesRef.current.length < 3) {
        lastSpawnTimeRef.current = now;

        const types = ['left_wall', 'right_wall', 'center_wall', 'high_barrier'];
        const selectedType = types[Math.floor(Math.random() * types.length)];

        let xOffset = 0;
        let yOffset = -0.8;

        if (selectedType === 'left_wall') xOffset = -1.8;
        else if (selectedType === 'right_wall') xOffset = 1.8;
        else if (selectedType === 'center_wall') xOffset = 0;
        else if (selectedType === 'high_barrier') {
          xOffset = 0;
          yOffset = 0.5;
        }

        obstaclesRef.current.push({
          id: Math.random(),
          type: selectedType,
          position: [xOffset, yOffset, -12.0], // Start further back for smoother transition
          speed: 0.08, // Comfortable playable sliding speed
          passed: false
        });
      }

      // 2. Smoothly Slide Hologram Walls Forward
      obstaclesRef.current.forEach((obs) => {
        obs.position[2] += obs.speed; // Slide forward to player at z = 1.2

        // Collision Check Window (z >= 0.7 && z <= 1.4)
        if (!obs.passed && obs.position[2] >= 0.7 && obs.position[2] <= 1.4) {
          let hitP1 = false;
          let hitP2 = false;

          const p1 = playerPoseRef.current.p1;
          const p2 = playerPoseRef.current.p2;

          if (obs.type === 'left_wall') {
            if (p1.x < -0.5) hitP1 = true;
            if (modeRef.current === 'MULTI' && p2.x < -0.5) hitP2 = true;
          } else if (obs.type === 'right_wall') {
            if (p1.x > 0.5) hitP1 = true;
            if (modeRef.current === 'MULTI' && p2.x > 0.5) hitP2 = true;
          } else if (obs.type === 'center_wall') {
            if (Math.abs(p1.x) < 1.0) hitP1 = true;
            if (modeRef.current === 'MULTI' && Math.abs(p2.x) < 1.0) hitP2 = true;
          } else if (obs.type === 'high_barrier') {
            if (p1.y > 0.2) hitP1 = true;
            if (modeRef.current === 'MULTI' && p2.y > 0.2) hitP2 = true;
          }

          if (hitP1) {
            playSound('hit');
            livesP1Ref.current = Math.max(0, livesP1Ref.current - 1);
            setLivesP1(livesP1Ref.current);
            if (livesP1Ref.current <= 0) {
              gameStateRef.current = 'GAMEOVER';
              setGameState('GAMEOVER');
            }
          } else {
            playSound('dodge');
            scoreP1Ref.current += 100;
            setScoreP1(scoreP1Ref.current);
          }

          if (modeRef.current === 'MULTI') {
            if (hitP2) {
              playSound('hit');
              livesP2Ref.current = Math.max(0, livesP2Ref.current - 1);
              setLivesP2(livesP2Ref.current);
            } else {
              scoreP2Ref.current += 100;
              setScoreP2(scoreP2Ref.current);
            }
          }

          obs.passed = true;
        }
      });

      obstaclesRef.current = obstaclesRef.current.filter(obs => obs.position[2] < 3.0);
      setObstacles(obstaclesRef.current.map(obs => ({
        ...obs,
        position: [obs.position[0], obs.position[1], obs.position[2]]
      })));
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

      {/* 3D Cyber Stage Canvas */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
        <Canvas camera={{ position: [0, 2.2, 7.5], fov: 55 }}>
          <ambientLight intensity={0.9} />
          <pointLight position={[0, 10, 5]} intensity={2.5} color="#00f3ff" />
          <pointLight position={[-8, 5, -2]} intensity={2.0} color="#ec4899" />
          <pointLight position={[8, 5, -2]} intensity={2.0} color="#eab308" />

          {/* 5 Cyan Neon Lines & Arena Seating Floor */}
          <CyberHighwayFloor mode={mode} />

          {/* Moving 3D Volumetric Translucent Glass Hologram Walls */}
          {obstacles.map((obs) => (
            obs.type === 'high_barrier' ? (
              <HighBarrierBeam key={obs.id} position={[obs.position[0], obs.position[1], obs.position[2]]} />
            ) : (
              <HologramGridWall key={obs.id} type={obs.type} position={[obs.position[0], obs.position[1], obs.position[2]]} />
            )
          ))}

          {/* Player 1 Foot Energy Rings (Cyan ⭕) */}
          {feetP1.map((pos, idx) => (
            <FootEnergyRing key={`foot_p1_${idx}`} position={pos} color="#00f3ff" />
          ))}

          {/* Player 2 Foot Energy Rings (Magenta ⭕) */}
          {mode === 'MULTI' && feetP2.map((pos, idx) => (
            <FootEnergyRing key={`foot_p2_${idx}`} position={pos} color="#ec4899" />
          ))}

          <OrbitControls enableZoom={false} enablePan={false} maxPolarAngle={Math.PI / 2} />
        </Canvas>
      </div>

      {/* Header Overlay */}
      <div style={{ position: 'absolute', top: '20px', left: '20px', right: '20px', display: 'flex', justifyContent: 'space-between', zIndex: 10, pointerEvents: 'none' }}>
        <div>
          <Link to="/" style={{ pointerEvents: 'auto', color: '#00d2ff', textDecoration: 'none', fontSize: '1.2rem', fontWeight: 'bold' }}>
            &larr; Back to Menu
          </Link>
          <h1 style={{ color: 'white', margin: '5px 0 0 0', fontSize: '2.2rem' }}>⚡ Cyber Stage Dodge & Step AR</h1>
          <p style={{ color: '#94a3b8', margin: 0 }}>Smooth & Comfortable Wall Sliding Speed! | 🙅 Cross Arms X 1.2s to Exit</p>
        </div>

        {gameState === 'PLAYING' && (
          <div style={{ display: 'flex', gap: '20px', pointerEvents: 'auto' }}>
            <div style={{ backgroundColor: 'rgba(15,23,42,0.85)', padding: '12px 20px', borderRadius: '16px', border: '2px solid #00f3ff', color: 'white', textAlign: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: '#00f3ff', fontWeight: 'bold' }}>PLAYER 1</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#10b981' }}>{scoreP1}</div>
              <div style={{ fontSize: '0.9rem', color: '#ef4444' }}>{'❤️'.repeat(livesP1)}</div>
            </div>

            {mode === 'MULTI' && (
              <div style={{ backgroundColor: 'rgba(15,23,42,0.85)', padding: '12px 20px', borderRadius: '16px', border: '2px solid #ec4899', color: 'white', textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: '#ec4899', fontWeight: 'bold' }}>PLAYER 2</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#10b981' }}>{scoreP2}</div>
                <div style={{ fontSize: '0.9rem', color: '#ef4444' }}>{'❤️'.repeat(livesP2)}</div>
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
            border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center', maxWidth: '560px', width: '90%',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
          }}>
            {gameState === 'MENU' ? (
              <>
                <h2 style={{ fontSize: '2.5rem', color: 'white', margin: '0 0 10px 0' }}>⚡ Cyber Stage Dodge & Step AR</h2>
                <p style={{ color: '#94a3b8', fontSize: '1rem', marginBottom: '1.5rem' }}>
                  Stand on the 5 cyan neon cyber lanes! Lean left/right and duck down under incoming 3D hologram walls!
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
                    👤 Single Player Highway
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
                    👥 2-Player Stage Battle
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: '2.5rem', color: '#ec4899', margin: '0 0 10px 0' }}>💥 Game Over!</h2>
                
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

export default CyberDodgeGame;
