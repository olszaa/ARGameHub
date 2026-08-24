import React, { useEffect, useRef, useState } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { Canvas } from '@react-three/fiber';
import { Box, Sphere, Cylinder, Text, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Link } from 'react-router-dom';

const ARROWS = [
  { id: 'left', name: 'Left', arrow: '⬅️', color: '#ec4899', xOffset: -1.8 },
  { id: 'up', name: 'Up', arrow: '⬆️', color: '#00f3ff', xOffset: -0.6 },
  { id: 'down', name: 'Down', arrow: '⬇️', color: '#eab308', xOffset: 0.6 },
  { id: 'right', name: 'Right', arrow: '➡️', color: '#10b981', xOffset: 1.8 }
];

const AVATAR_PRESETS = [
  { id: 'knight', name: '🛡️ Knight', armorColor: '#475569', hairColor: '#ef4444', accentColor: '#00f3ff', skinColor: '#fca5a5' },
  { id: 'cyberpunk', name: '⚡ Cyberpunk', armorColor: '#1e1b4b', hairColor: '#ec4899', accentColor: '#00f3ff', skinColor: '#fed7aa' },
  { id: 'robot', name: '🤖 Robot', armorColor: '#334155', hairColor: '#eab308', accentColor: '#10b981', skinColor: '#94a3b8' },
  { id: 'chibi', name: '🐣 Chibi', armorColor: '#f43f5e', hairColor: '#fbbf24', accentColor: '#38bdf8', skinColor: '#ffedd5' }
];

// 3D Bone Helper
const BlockBone = ({ p1, p2, color, width = 0.4, depth = 0.4 }) => {
  if (!p1 || !p2) return null;
  const distance = p1.distanceTo(p2);
  if (distance < 0.01) return null;

  const position = p1.clone().lerp(p2, 0.5);
  const direction = new THREE.Vector3().subVectors(p2, p1).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction);

  return (
    <Box args={[width, distance, depth]} position={position} quaternion={quaternion}>
      <meshStandardMaterial color={color} roughness={0.3} metalness={0.6} />
    </Box>
  );
};

// 3D Avatar Head Accessories
const HeadPreset = ({ preset, skinColor, armorColor, hairColor, accentColor }) => {
  if (preset === 'knight') {
    return (
      <group scale={[0.35, 0.35, 0.35]}>
        <Box args={[1.8, 1.8, 1.8]}>
          <meshStandardMaterial color={armorColor} metalness={0.8} roughness={0.2} />
        </Box>
        <Box args={[1.5, 0.35, 0.2]} position={[0, 0.1, 0.95]}>
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={2.5} />
        </Box>
      </group>
    );
  } else if (preset === 'cyberpunk') {
    return (
      <group scale={[0.35, 0.35, 0.35]}>
        <Box args={[1.7, 1.7, 1.7]}>
          <meshStandardMaterial color={armorColor} metalness={0.3} roughness={0.5} />
        </Box>
        <Box args={[1.8, 0.5, 0.3]} position={[0, 0.2, 0.8]}>
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={2.8} />
        </Box>
      </group>
    );
  } else if (preset === 'robot') {
    return (
      <group scale={[0.35, 0.35, 0.35]}>
        <Box args={[1.9, 1.7, 1.7]}>
          <meshStandardMaterial color={armorColor} metalness={0.9} roughness={0.1} />
        </Box>
        <Sphere args={[0.25, 12, 12]} position={[0, 1.4, 0]}>
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={2.5} />
        </Sphere>
      </group>
    );
  } else {
    return (
      <group scale={[0.35, 0.35, 0.35]}>
        <Sphere args={[1.2, 16, 16]}>
          <meshStandardMaterial color={skinColor} roughness={0.6} />
        </Sphere>
      </group>
    );
  }
};

// Rigged 3D Avatar Component
const Rigged3DAvatar = ({ points, avatarPreset, positionOffset = [0, 0, 0] }) => {
  if (!points || points.length < 29) return null;

  const toV3 = (lm) => new THREE.Vector3(
    (0.5 - lm.x) * 5.5 + positionOffset[0],
    (0.5 - lm.y) * 5.5 + positionOffset[1],
    -lm.z * 3 + positionOffset[2]
  );

  const nose = toV3(points[0]);
  const lShoulder = toV3(points[11]);
  const rShoulder = toV3(points[12]);
  const lElbow = toV3(points[13]);
  const rElbow = toV3(points[14]);
  const lWrist = toV3(points[15]);
  const rWrist = toV3(points[16]);
  const lHip = toV3(points[23]);
  const rHip = toV3(points[24]);
  const lKnee = toV3(points[25]);
  const rKnee = toV3(points[26]);
  const lAnkle = toV3(points[27]);
  const rAnkle = toV3(points[28]);

  const shoulderMid = lShoulder.clone().lerp(rShoulder, 0.5);
  const hipMid = lHip.clone().lerp(rHip, 0.5);
  const headPos = nose.clone().lerp(shoulderMid, 0.3);

  return (
    <group>
      <group position={headPos}>
        <HeadPreset preset={avatarPreset.id} {...avatarPreset} />
      </group>
      <BlockBone p1={shoulderMid} p2={headPos} color={avatarPreset.skinColor} width={0.18} depth={0.18} />
      <BlockBone p1={shoulderMid} p2={hipMid} color={avatarPreset.armorColor} width={0.7} depth={0.4} />
      
      {/* Arms */}
      <BlockBone p1={lShoulder} p2={lElbow} color={avatarPreset.armorColor} width={0.25} depth={0.25} />
      <BlockBone p1={lElbow} p2={lWrist} color={avatarPreset.skinColor} width={0.2} depth={0.2} />
      <BlockBone p1={rShoulder} p2={rElbow} color={avatarPreset.armorColor} width={0.25} depth={0.25} />
      <BlockBone p1={rElbow} p2={rWrist} color={avatarPreset.skinColor} width={0.2} depth={0.2} />

      {/* Legs */}
      <BlockBone p1={lHip} p2={lKnee} color={avatarPreset.armorColor} width={0.3} depth={0.3} />
      <BlockBone p1={lKnee} p2={lAnkle} color={avatarPreset.skinColor} width={0.25} depth={0.25} />
      <BlockBone p1={rHip} p2={rKnee} color={avatarPreset.armorColor} width={0.3} depth={0.3} />
      <BlockBone p1={rKnee} p2={rAnkle} color={avatarPreset.skinColor} width={0.25} depth={0.25} />
    </group>
  );
};

// 3D Flowing Floor Arrow Component (With vibrant colors & neon borders)
const FloorFlowing3DArrow = ({ arrowData, xOffset, zPos, pColor }) => {
  return (
    <group position={[xOffset, -2.34, zPos]} rotation={[-Math.PI / 2, 0, 0]}>
      {/* Dark Base Tile */}
      <Box args={[0.8, 0.8, 0.06]}>
        <meshStandardMaterial color="#0f172a" roughness={0.2} />
      </Box>
      {/* Vibrant Neon Emissive Border */}
      <Box args={[0.85, 0.85, 0.04]}>
        <meshStandardMaterial color={arrowData.color} emissive={arrowData.color} emissiveIntensity={2.5} />
      </Box>
      {/* Arrow Symbol Text */}
      <Text position={[0, 0, 0.05]} fontSize={0.45} color="#ffffff" anchorX="center" anchorY="middle">
        {arrowData.arrow}
      </Text>
    </group>
  );
};

// Cyber Stage Floor Lines & Neon Tracks
const CyberStageFloor = ({ mode }) => {
  return (
    <group position={[0, -2.4, -2]}>
      {/* Main Dark Metallic Stage Floor */}
      <Box args={[14, 0.1, 14]}>
        <meshStandardMaterial color="#0b0f19" roughness={0.1} metalness={0.9} />
      </Box>

      {/* Stage Glowing Neon Border Beams */}
      <Box args={[14.2, 0.15, 0.2]} position={[0, 0.05, 7]}>
        <meshStandardMaterial color="#00f3ff" emissive="#00f3ff" emissiveIntensity={2.5} />
      </Box>
      <Box args={[14.2, 0.15, 0.2]} position={[0, 0.05, -7]}>
        <meshStandardMaterial color="#ec4899" emissive="#ec4899" emissiveIntensity={2.5} />
      </Box>
      <Box args={[0.2, 0.15, 14]} position={[-7.1, 0.05, 0]}>
        <meshStandardMaterial color="#00f3ff" emissive="#00f3ff" emissiveIntensity={2.5} />
      </Box>
      <Box args={[0.2, 0.15, 14]} position={[7.1, 0.05, 0]}>
        <meshStandardMaterial color="#eab308" emissive="#eab308" emissiveIntensity={2.5} />
      </Box>

      {/* Center Divider Line (Multiplayer Split) */}
      {mode === 'MULTI' && (
        <Box args={[0.15, 0.12, 14]} position={[0, 0.06, 0]}>
          <meshStandardMaterial color="#a855f7" emissive="#a855f7" emissiveIntensity={3.0} />
        </Box>
      )}

      {/* Glowing Neon Lane Lines (4 Lanes per player) */}
      {mode === 'SINGLE' ? (
        ARROWS.map((arr) => (
          <Box key={`lane_single_${arr.id}`} args={[0.06, 0.08, 13.8]} position={[arr.xOffset, 0.06, 0]}>
            <meshStandardMaterial color={arr.color} emissive={arr.color} emissiveIntensity={1.8} />
          </Box>
        ))
      ) : (
        <>
          {/* Player 1 Left Stage Lanes (Cyan) */}
          {ARROWS.map((arr) => (
            <Box key={`lane_p1_${arr.id}`} args={[0.06, 0.08, 13.8]} position={[-2.5 + arr.xOffset * 0.7, 0.06, 0]}>
              <meshStandardMaterial color="#00f3ff" emissive="#00f3ff" emissiveIntensity={1.8} />
            </Box>
          ))}
          {/* Player 2 Right Stage Lanes (Gold) */}
          {ARROWS.map((arr) => (
            <Box key={`lane_p2_${arr.id}`} args={[0.06, 0.08, 13.8]} position={[2.5 + arr.xOffset * 0.7, 0.06, 0]}>
              <meshStandardMaterial color="#eab308" emissive="#eab308" emissiveIntensity={1.8} />
            </Box>
          ))}
        </>
      )}
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

    if (type === 'step') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    }
  } catch (e) {}
};

const DanceGame = () => {
  const videoRef = useRef(null);
  const poseLandmarkerRef = useRef(null);
  const animationRef = useRef(null);

  // Game Mode & State
  const [mode, setMode] = useState('SINGLE'); // SINGLE or MULTI
  const [gameState, setGameState] = useState('MENU'); // MENU, PLAYING, GAMEOVER
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_PRESETS[0]);
  const [scoreP1, setScoreP1] = useState(0);
  const [scoreP2, setScoreP2] = useState(0);
  const [comboP1, setComboP1] = useState(0);
  const [comboP2, setComboP2] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [status, setStatus] = useState('Initializing Model...');

  // 3D Avatar Pose Landmarks
  const [p1Landmarks, setP1Landmarks] = useState(null);
  const [p2Landmarks, setP2Landmarks] = useState(null);

  // 3D Flowing Floor Arrows State
  const [floor3DNotes, setFloor3DNotes] = useState([]);

  // Refs
  const modeRef = useRef('SINGLE');
  const floor3DNotesRef = useRef([]);
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
    floor3DNotesRef.current = [];
    setFloor3DNotes([]);
    setGameState('PLAYING');
  };

  // Main Motion Loop
  const renderGame = () => {
    if (!videoRef.current) return;

    let playerFeet = [];
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

        if (sortedPoses[0]) setP1Landmarks(sortedPoses[0]);
        if (sortedPoses[1] && modeRef.current === 'MULTI') setP2Landmarks(sortedPoses[1]);

        sortedPoses.forEach((lm, playerIdx) => {
          if (modeRef.current === 'SINGLE' && playerIdx > 0) return;

          const pNum = playerIdx + 1;
          const feetList = [];

          [27, 28, 31, 32].forEach(idx => {
            if (lm[idx] && lm[idx].visibility > 0.3) {
              feetList.push({ x: (0.5 - lm[idx].x) * 5.5, z: -lm[idx].z * 3 + 1.0 });
            }
          });

          playerFeet.push({ player: pNum, feet: feetList });
        });
      }
    }

    if (gameState === 'PLAYING') {
      if (Math.random() < (modeRef.current === 'MULTI' ? 0.07 : 0.05) && floor3DNotesRef.current.length < 8) {
        const arrow = ARROWS[Math.floor(Math.random() * ARROWS.length)];
        const targetPlayer = modeRef.current === 'MULTI' ? (Math.random() < 0.5 ? 1 : 2) : 1;
        const xBase = modeRef.current === 'MULTI' ? (targetPlayer === 1 ? -2.5 : 2.5) : 0;
        const xSpread = modeRef.current === 'MULTI' ? arrow.xOffset * 0.7 : arrow.xOffset;

        floor3DNotesRef.current.push({
          id: Math.random(),
          arrow,
          player: targetPlayer,
          xOffset: xBase + xSpread,
          z: -8.0,
          speed: Math.random() * 0.06 + 0.12
        });
      }

      floor3DNotesRef.current.forEach((note, nIdx) => {
        note.z += note.speed;

        let isHit = false;
        if (note.z >= 0.7 && note.z <= 1.4) {
          const pFeet = playerFeet.find(pf => pf.player === note.player);
          if (pFeet) {
            pFeet.feet.forEach(foot => {
              if (Math.abs(foot.x - note.xOffset) < 0.8) {
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
          } else {
            scoreP2Ref.current += 100;
            comboP2Ref.current += 1;
            setScoreP2(scoreP2Ref.current);
            setComboP2(comboP2Ref.current);
          }

          floor3DNotesRef.current.splice(nIdx, 1);
        }
      });

      floor3DNotesRef.current = floor3DNotesRef.current.filter(n => n.z < 2.0);
      setFloor3DNotes([...floor3DNotesRef.current]);
    }

    animationRef.current = requestAnimationFrame(renderGame);
  };

  useEffect(() => {
    if (status === 'Ready') {
      renderGame();
    }
  }, [status, gameState]);

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

          {/* Cyber Stage Floor & Neon Lanes */}
          <CyberStageFloor mode={mode} />

          {/* Player 1 3D Target Step Pads (Glowing Cyan Emissive) */}
          {ARROWS.map((arr) => {
            const xPos = mode === 'MULTI' ? -2.5 + arr.xOffset * 0.7 : arr.xOffset;
            return (
              <group key={`pad_p1_${arr.id}`} position={[xPos, -2.33, 1.0]} rotation={[-Math.PI / 2, 0, 0]}>
                {/* Dark Pad Base */}
                <Box args={[0.8, 0.8, 0.05]}>
                  <meshStandardMaterial color="#0f172a" roughness={0.2} />
                </Box>
                {/* Vibrant Glowing Emissive Border Ring */}
                <Box args={[0.88, 0.88, 0.03]}>
                  <meshStandardMaterial color={arr.color} emissive={arr.color} emissiveIntensity={3.0} />
                </Box>
                <Text position={[0, 0, 0.05]} fontSize={0.45} color="#ffffff">
                  {arr.arrow}
                </Text>
              </group>
            );
          })}

          {/* Player 2 3D Target Step Pads (Glowing Gold Emissive) */}
          {mode === 'MULTI' && ARROWS.map((arr) => {
            const xPos = 2.5 + arr.xOffset * 0.7;
            return (
              <group key={`pad_p2_${arr.id}`} position={[xPos, -2.33, 1.0]} rotation={[-Math.PI / 2, 0, 0]}>
                <Box args={[0.8, 0.8, 0.05]}>
                  <meshStandardMaterial color="#0f172a" roughness={0.2} />
                </Box>
                <Box args={[0.88, 0.88, 0.03]}>
                  <meshStandardMaterial color={arr.color} emissive={arr.color} emissiveIntensity={3.0} />
                </Box>
                <Text position={[0, 0, 0.05]} fontSize={0.45} color="#ffffff">
                  {arr.arrow}
                </Text>
              </group>
            );
          })}

          {/* 3D Flowing Floor Arrows */}
          {floor3DNotes.map((note) => (
            <FloorFlowing3DArrow
              key={note.id}
              arrowData={note.arrow}
              xOffset={note.xOffset}
              zPos={note.z}
              pColor={note.player === 1 ? '#00f3ff' : '#eab308'}
            />
          ))}

          {/* Player 1 3D Avatar */}
          {p1Landmarks && (
            <Rigged3DAvatar
              points={p1Landmarks}
              avatarPreset={selectedAvatar}
              positionOffset={mode === 'MULTI' ? [-2.5, 0, 1.0] : [0, 0, 1.0]}
            />
          )}

          {/* Player 2 3D Avatar */}
          {p2Landmarks && mode === 'MULTI' && (
            <Rigged3DAvatar
              points={p2Landmarks}
              avatarPreset={AVATAR_PRESETS[1]}
              positionOffset={[2.5, 0, 1.0]}
            />
          )}

          <OrbitControls enableZoom={false} enablePan={false} maxPolarAngle={Math.PI / 2} />
        </Canvas>
      </div>

      {/* Header Overlay */}
      <div style={{ position: 'absolute', top: '20px', left: '20px', right: '20px', display: 'flex', justifyContent: 'space-between', zIndex: 10, pointerEvents: 'none' }}>
        <div>
          <Link to="/" style={{ pointerEvents: 'auto', color: '#00d2ff', textDecoration: 'none', fontSize: '1.2rem', fontWeight: 'bold' }}>
            &larr; Back to Menu
          </Link>
          <h1 style={{ color: 'white', margin: '5px 0 0 0', fontSize: '2.2rem' }}>💃 3D Cyber Stage Dance AR</h1>
          <p style={{ color: '#94a3b8', margin: 0 }}>Vibrant Neon Stage & Flowing Floor Arrows! | 🙅 Cross Arms X 1.2s to Exit</p>
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
            backgroundColor: '#1e293b', padding: '2.5rem', borderRadius: '24px',
            border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center', maxWidth: '560px', width: '90%',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
          }}>
            {gameState === 'MENU' ? (
              <>
                <h2 style={{ fontSize: '2.5rem', color: 'white', margin: '0 0 10px 0' }}>💃 3D Cyber Stage Dance AR</h2>
                <p style={{ color: '#94a3b8', fontSize: '1rem', marginBottom: '1.5rem' }}>
                  Cyberpunk concert stage with vibrant glowing neon floor lanes!
                </p>

                {/* Avatar Selection Picker */}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '2rem' }}>
                  {AVATAR_PRESETS.map((avatar) => (
                    <button
                      key={avatar.id}
                      onClick={() => setSelectedAvatar(avatar)}
                      style={{
                        padding: '10px 14px', borderRadius: '12px', border: '2px solid',
                        borderColor: selectedAvatar.id === avatar.id ? '#00f3ff' : 'rgba(255,255,255,0.1)',
                        backgroundColor: selectedAvatar.id === avatar.id ? 'rgba(0,243,255,0.2)' : '#0f172a',
                        color: 'white', cursor: 'pointer', fontWeight: 'bold'
                      }}
                    >
                      {avatar.name}
                    </button>
                  ))}
                </div>

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
                    👤 Single Player Stage
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
                    👥 2-Player 3D Battle
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: '2.5rem', color: '#ec4899', margin: '0 0 10px 0' }}>🎉 Dance Complete!</h2>
                
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
                    👤 Dance Again
                  </button>
                  <button
                    onClick={() => startGame('MULTI')}
                    style={{
                      padding: '14px 24px', fontSize: '1.1rem', fontWeight: 'bold',
                      backgroundColor: '#eab308', color: '#0f172a', border: 'none', borderRadius: '12px', cursor: 'pointer'
                    }}
                  >
                    👥 2-Player 3D Battle
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
