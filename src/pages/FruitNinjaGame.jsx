import React, { useEffect, useRef, useState } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { Canvas } from '@react-three/fiber';
import { Sphere, Cylinder, Box, Text, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useNavigate } from 'react-router-dom';

// 3D Fruit Types & Visual Definitions
const FRUIT_TYPES = {
  watermelon: { name: 'Watermelon', color: '#ef4444', outerColor: '#15803d', score: 10, radius: 0.65 },
  orange: { name: 'Orange', color: '#f97316', outerColor: '#ea580c', score: 10, radius: 0.5 },
  apple: { name: 'Apple', color: '#dc2626', outerColor: '#991b1b', score: 10, radius: 0.48 },
  banana: { name: 'Banana', color: '#eab308', outerColor: '#ca8a04', score: 15, radius: 0.45 },
  bomb: { name: 'Bomb', color: '#1e293b', outerColor: '#0f172a', isBomb: true, radius: 0.55 }
};

// 3D Whole Floating Fruit Component
const Fruit3D = ({ typeKey, position, rotation }) => {
  const info = FRUIT_TYPES[typeKey] || FRUIT_TYPES.watermelon;

  if (info.isBomb) {
    return (
      <group position={position} rotation={rotation}>
        {/* Dark Metallic Bomb Sphere */}
        <Sphere args={[info.radius, 24, 24]}>
          <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
        </Sphere>
        {/* Fuse Tube */}
        <Cylinder args={[0.04, 0.04, 0.3, 12]} position={[0, info.radius + 0.1, 0]}>
          <meshStandardMaterial color="#d97706" />
        </Cylinder>
        {/* Burning Spark Light */}
        <Sphere args={[0.08, 12, 12]} position={[0, info.radius + 0.25, 0]}>
          <meshStandardMaterial color="#ef4444" emissive="#f59e0b" emissiveIntensity={5.0} />
        </Sphere>
      </group>
    );
  }

  return (
    <group position={position} rotation={rotation}>
      {/* Outer Skin Sphere */}
      <Sphere args={[info.radius, 24, 24]}>
        <meshStandardMaterial color={info.outerColor} roughness={0.3} metalness={0.1} />
      </Sphere>
      {/* Stem Accent for Apple/Orange */}
      <Cylinder args={[0.03, 0.03, 0.2, 8]} position={[0, info.radius + 0.05, 0]}>
        <meshStandardMaterial color="#78350f" />
      </Cylinder>
    </group>
  );
};

// 3D Sliced Fruit Half Component
const SlicedHalf3D = ({ typeKey, position, rotation, isLeft }) => {
  const info = FRUIT_TYPES[typeKey] || FRUIT_TYPES.watermelon;

  return (
    <group position={position} rotation={rotation}>
      {/* 3D Hemisphere Cut */}
      <Sphere args={[info.radius, 24, 24, 0, Math.PI]}>
        <meshStandardMaterial color={info.outerColor} roughness={0.3} />
      </Sphere>
      {/* Juicy Inner Face */}
      <Cylinder args={[info.radius, info.radius, 0.02, 24]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color={info.color} roughness={0.5} />
      </Cylinder>
    </group>
  );
};

// 3D Laser Katana Blade Trail Component
const BladeTrail3D = ({ points, color = '#00f3ff' }) => {
  if (!points || points.length < 2) return null;

  return (
    <group>
      {points.map((pt, idx) => (
        <Sphere key={`blade_pt_${idx}`} args={[0.08, 12, 12]} position={pt}>
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={4.0} transparent opacity={idx / points.length} />
        </Sphere>
      ))}
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
  const poseLandmarkerRef = useRef(null);
  const animationRef = useRef(null);

  // Game Mode & State
  const [mode, setMode] = useState('SINGLE');
  const [gameState, setGameState] = useState('MENU');
  const [scoreP1, setScoreP1] = useState(0);
  const [scoreP2, setScoreP2] = useState(0);
  const [livesP1, setLivesP1] = useState(3);
  const [livesP2, setLivesP2] = useState(3);
  const [status, setStatus] = useState('Initializing Model...');

  // 3D Game Engine State
  const [fruits3D, setFruits3D] = useState([]);
  const [halves3D, setHalves3D] = useState([]);
  const [bladeTrailsP1, setBladeTrailsP1] = useState([]);
  const [bladeTrailsP2, setBladeTrailsP2] = useState([]);

  // Refs
  const modeRef = useRef('SINGLE');
  const gameStateRef = useRef('MENU');
  const fruits3DRef = useRef([]);
  const halves3DRef = useRef([]);
  const bladeTrailsRef = useRef({ p1: [], p2: [] });
  const scoreP1Ref = useRef(0);
  const scoreP2Ref = useRef(0);
  const livesP1Ref = useRef(3);
  const livesP2Ref = useRef(3);
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

  const startGame = (selectedMode) => {
    setMode(selectedMode);
    modeRef.current = selectedMode;
    gameStateRef.current = 'PLAYING';
    setScoreP1(0);
    setScoreP2(0);
    scoreP1Ref.current = 0;
    scoreP2Ref.current = 0;
    setLivesP1(3);
    setLivesP2(3);
    livesP1Ref.current = 3;
    livesP2Ref.current = 3;
    fruits3DRef.current = [];
    halves3DRef.current = [];
    setFruits3D([]);
    setHalves3D([]);
    setGameState('PLAYING');
  };

  // Main 3D Motion Detection & Physics Engine Loop
  const renderGame = () => {
    if (!videoRef.current) return;

    // 1. MediaPipe Pose Hands Tracking
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

        // Player 1 Hands -> 3D Katana Laser Blades
        if (sortedPoses[0]) {
          const lm = sortedPoses[0];
          const newTrailP1 = [];
          [15, 16].forEach((handIdx) => {
            if (lm[handIdx] && lm[handIdx].visibility > 0.3) {
              const x3d = (0.5 - lm[handIdx].x) * 7.0;
              const y3d = (0.5 - lm[handIdx].y) * 5.0;
              newTrailP1.push([x3d, y3d, 1.0]);
            }
          });
          bladeTrailsRef.current.p1.push(...newTrailP1);
          if (bladeTrailsRef.current.p1.length > 12) bladeTrailsRef.current.p1.splice(0, newTrailP1.length);
          setBladeTrailsP1([...bladeTrailsRef.current.p1]);
        }

        // Player 2 Hands -> 3D Katana Laser Blades
        if (sortedPoses[1] && modeRef.current === 'MULTI') {
          const lm2 = sortedPoses[1];
          const newTrailP2 = [];
          [15, 16].forEach((handIdx) => {
            if (lm2[handIdx] && lm2[handIdx].visibility > 0.3) {
              const x3d = (0.5 - lm2[handIdx].x) * 7.0;
              const y3d = (0.5 - lm2[handIdx].y) * 5.0;
              newTrailP2.push([x3d, y3d, 1.0]);
            }
          });
          bladeTrailsRef.current.p2.push(...newTrailP2);
          if (bladeTrailsRef.current.p2.length > 12) bladeTrailsRef.current.p2.splice(0, newTrailP2.length);
          setBladeTrailsP2([...bladeTrailsRef.current.p2]);
        }
      }
    }

    // 2. 3D Fruit Launch & Physics Simulation
    if (gameStateRef.current === 'PLAYING') {
      if (Math.random() < 0.045 && fruits3DRef.current.length < 6) {
        const types = ['watermelon', 'orange', 'apple', 'banana', 'bomb'];
        const isBomb = Math.random() < 0.2;
        const selectedType = isBomb ? 'bomb' : types[Math.floor(Math.random() * 4)];

        fruits3DRef.current.push({
          id: Math.random(),
          typeKey: selectedType,
          x: (Math.random() - 0.5) * 5.5,
          y: -3.5,
          z: 0.0,
          vx: (Math.random() - 0.5) * 0.08,
          vy: Math.random() * 0.05 + 0.18,
          vz: 0,
          rotX: Math.random() * Math.PI,
          rotY: Math.random() * Math.PI,
          vRotX: (Math.random() - 0.5) * 0.1,
          vRotY: (Math.random() - 0.5) * 0.1,
          sliced: false
        });
      }

      const gravity = 0.005;

      // Update 3D Fruits Position & Handle Slicing Collisions
      fruits3DRef.current.forEach((fruit) => {
        fruit.x += fruit.vx;
        fruit.y += fruit.vy;
        fruit.vy -= gravity;
        fruit.rotX += fruit.vRotX;
        fruit.rotY += fruit.vRotY;

        // Check Blade Slicing Collision against 3D Fruit
        let slicedByPlayer = null;

        bladeTrailsRef.current.p1.forEach((bPt) => {
          const dist = Math.hypot(bPt[0] - fruit.x, bPt[1] - fruit.y);
          if (dist < FRUIT_TYPES[fruit.typeKey].radius + 0.25) {
            slicedByPlayer = 1;
          }
        });

        if (modeRef.current === 'MULTI') {
          bladeTrailsRef.current.p2.forEach((bPt) => {
            const dist = Math.hypot(bPt[0] - fruit.x, bPt[1] - fruit.y);
            if (dist < FRUIT_TYPES[fruit.typeKey].radius + 0.25) {
              slicedByPlayer = 2;
            }
          });
        }

        if (!fruit.sliced && slicedByPlayer) {
          fruit.sliced = true;

          if (FRUIT_TYPES[fruit.typeKey].isBomb) {
            playSound('bomb');
            if (slicedByPlayer === 1) {
              livesP1Ref.current = Math.max(0, livesP1Ref.current - 1);
              setLivesP1(livesP1Ref.current);
              if (livesP1Ref.current <= 0 && modeRef.current === 'SINGLE') {
                gameStateRef.current = 'GAMEOVER';
                setGameState('GAMEOVER');
              }
            } else {
              livesP2Ref.current = Math.max(0, livesP2Ref.current - 1);
              setLivesP2(livesP2Ref.current);
            }
          } else {
            playSound('slice');
            if (slicedByPlayer === 1) {
              scoreP1Ref.current += FRUIT_TYPES[fruit.typeKey].score;
              setScoreP1(scoreP1Ref.current);
            } else {
              scoreP2Ref.current += FRUIT_TYPES[fruit.typeKey].score;
              setScoreP2(scoreP2Ref.current);
            }

            // Spawn 2 Splitting 3D Halves
            halves3DRef.current.push({
              id: Math.random(),
              typeKey: fruit.typeKey,
              x: fruit.x - 0.2, y: fruit.y, z: fruit.z,
              vx: -0.06, vy: fruit.vy * 0.6,
              rotX: fruit.rotX, rotY: fruit.rotY,
              vRotX: -0.1, isLeft: true
            });
            halves3DRef.current.push({
              id: Math.random(),
              typeKey: fruit.typeKey,
              x: fruit.x + 0.2, y: fruit.y, z: fruit.z,
              vx: 0.06, vy: fruit.vy * 0.6,
              rotX: fruit.rotX, rotY: fruit.rotY,
              vRotX: 0.1, isLeft: false
            });
          }
        }
      });

      // Filter out off-screen fruits & sliced ones
      fruits3DRef.current = fruits3DRef.current.filter((f) => !f.sliced && f.y > -4.5);
      setFruits3D(fruits3DRef.current.map(f => ({ ...f })));

      // Update 3D Splitting Halves
      halves3DRef.current.forEach((h) => {
        h.x += h.vx;
        h.y += h.vy;
        h.vy -= gravity * 0.8;
        h.rotX += h.vRotX;
      });
      halves3DRef.current = halves3DRef.current.filter((h) => h.y > -4.5);
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

      {/* 3D Fruit Ninja Arena Canvas */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
        <Canvas camera={{ position: [0, 0, 7.5], fov: 55 }}>
          <ambientLight intensity={0.9} />
          <pointLight position={[0, 8, 5]} intensity={2.5} color="#ffffff" />
          <pointLight position={[-6, 4, 2]} intensity={2.0} color="#00f3ff" />
          <pointLight position={[6, 4, 2]} intensity={2.0} color="#ef4444" />

          {/* 3D Stage Dojo Backdrop */}
          <group position={[0, 0, -5]}>
            <Box args={[16, 12, 0.5]}>
              <meshStandardMaterial color="#0f172a" roughness={0.7} />
            </Box>
            <Box args={[16, 0.2, 8]} position={[0, -4.5, 3]}>
              <meshStandardMaterial color="#1e293b" metalness={0.5} />
            </Box>
          </group>

          {/* Render Whole 3D Floating Fruits */}
          {fruits3D.map((f) => (
            <Fruit3D
              key={f.id}
              typeKey={f.typeKey}
              position={[f.x, f.y, f.z]}
              rotation={[f.rotX, f.rotY, 0]}
            />
          ))}

          {/* Render 3D Sliced Fruit Halves */}
          {halves3D.map((h) => (
            <SlicedHalf3D
              key={h.id}
              typeKey={h.typeKey}
              position={[h.x, h.y, h.z]}
              rotation={[h.rotX, h.rotY, 0]}
              isLeft={h.isLeft}
            />
          ))}

          {/* Render 3D Laser Katana Blade Trails */}
          <BladeTrail3D points={bladeTrailsP1} color="#00f3ff" />
          {mode === 'MULTI' && <BladeTrail3D points={bladeTrailsP2} color="#ec4899" />}

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
          <h1 style={{ color: 'white', margin: '5px 0 0 0', fontSize: '2.2rem' }}>⚔️ 3D Fruit Ninja AR</h1>
          <p style={{ color: '#94a3b8', margin: 0 }}>Slash 3D Fruits with Laser Blade Hands! | 🙅 Cross Arms X 1.2s to Exit</p>
        </div>

        {gameState === 'PLAYING' && (
          <div style={{ display: 'flex', gap: '20px', pointerEvents: 'auto' }}>
            <div style={{ backgroundColor: 'rgba(15,23,42,0.85)', padding: '12px 20px', borderRadius: '16px', border: '2px solid #00f3ff', color: 'white', textAlign: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: '#00f3ff', fontWeight: 'bold' }}>PLAYER 1</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#10b981' }}>{scoreP1}</div>
              <div>{'❤️'.repeat(livesP1)}{'🖤'.repeat(3 - livesP1)}</div>
            </div>

            {mode === 'MULTI' && (
              <div style={{ backgroundColor: 'rgba(15,23,42,0.85)', padding: '12px 20px', borderRadius: '16px', border: '2px solid #ec4899', color: 'white', textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: '#ec4899', fontWeight: 'bold' }}>PLAYER 2</div>
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
                <h2 style={{ fontSize: '2.5rem', color: 'white', margin: '0 0 10px 0' }}>⚔️ 3D Fruit Ninja AR</h2>
                <p style={{ color: '#94a3b8', fontSize: '1rem', marginBottom: '1.5rem' }}>
                  Slash floating 3D fruits in mid-air with laser hand blades! Avoid slicing 💣 bombs!
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

export default FruitNinjaGame;
