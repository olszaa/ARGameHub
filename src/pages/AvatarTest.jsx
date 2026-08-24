import React, { useEffect, useRef, useState, Suspense } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { Canvas, useFrame } from '@react-three/fiber';
import { useNavigate } from 'react-router-dom';
import { Sphere, Box, Cylinder, OrbitControls, Line, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { Link } from 'react-router-dom';

// MediaPipe pose connections to draw the skeleton
const POSE_CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], // Arms
  [11, 23], [12, 24], [23, 24], // Torso
  [23, 25], [25, 27], [27, 29], [29, 31], [31, 27], // Left Leg
  [24, 26], [26, 28], [28, 30], [30, 32], [32, 28], // Right Leg
  // We'll handle the head separately
];

// Color palette for up to 4 players
const PLAYER_COLORS = ['#ff0055', '#00ffcc', '#ffff00', '#aa00ff'];

// Helper to draw a bone as a box seamlessly connecting p1 and p2
const BlockBone = ({ p1, p2, color, width = 0.6, depth = 0.6 }) => {
  if (!p1 || !p2) return null;
  const distance = p1.distanceTo(p2);
  if (distance < 0.01) return null;

  const position = p1.clone().lerp(p2, 0.5);
  const direction = new THREE.Vector3().subVectors(p2, p1).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction);

  return (
    <Box args={[width, distance, depth]} position={position} quaternion={quaternion}>
      <meshStandardMaterial color={color} roughness={0.4} metalness={0.5} />
    </Box>
  );
};

// Preset Head Accessories
const HeadPreset = ({ preset, skinColor, armorColor, hairColor, accentColor }) => {
  if (preset === 'knight') {
    return (
      <group>
        {/* Main Helmet */}
        <Box args={[1.8, 1.8, 1.8]}>
          <meshStandardMaterial color={armorColor} metalness={0.8} roughness={0.2} />
        </Box>
        {/* Visor */}
        <Box args={[1.5, 0.35, 0.2]} position={[0, 0.1, 0.95]}>
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={1.5} />
        </Box>
        {/* Plume */}
        <Cylinder args={[0.05, 0.4, 1.2, 8]} position={[0, 1.3, -0.3]} rotation={[-0.4, 0, 0]}>
          <meshStandardMaterial color={hairColor} />
        </Cylinder>
      </group>
    );
  } else if (preset === 'cyberpunk') {
    return (
      <group>
        {/* Cyber Head */}
        <Box args={[1.7, 1.7, 1.7]}>
          <meshStandardMaterial color={armorColor} metalness={0.3} roughness={0.5} />
        </Box>
        {/* Neon Visor */}
        <Box args={[1.8, 0.5, 0.3]} position={[0, 0.2, 0.8]}>
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={2.5} />
        </Box>
        {/* Cyber Hair / Spikes */}
        <Box args={[1.6, 0.6, 1.6]} position={[0, 1.0, -0.1]}>
          <meshStandardMaterial color={hairColor} />
        </Box>
      </group>
    );
  } else if (preset === 'robot') {
    return (
      <group>
        {/* Robot Head */}
        <Box args={[1.9, 1.7, 1.7]}>
          <meshStandardMaterial color={armorColor} metalness={0.9} roughness={0.1} />
        </Box>
        {/* Screen Eyes */}
        <Box args={[1.4, 0.4, 0.1]} position={[0, 0.2, 0.86]}>
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={2.0} />
        </Box>
        {/* Antenna */}
        <Cylinder args={[0.08, 0.08, 1.0, 8]} position={[0, 1.2, 0]}>
          <meshStandardMaterial color={skinColor} metalness={0.8} />
        </Cylinder>
        <Sphere args={[0.25, 12, 12]} position={[0, 1.7, 0]}>
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={2.0} />
        </Sphere>
      </group>
    );
  } else {
    // Chibi Preset
    return (
      <group>
        {/* Chibi Head */}
        <Sphere args={[1.2, 16, 16]}>
          <meshStandardMaterial color={skinColor} roughness={0.6} />
        </Sphere>
        {/* Hair Cap */}
        <Sphere args={[1.25, 16, 16]} position={[0, 0.3, -0.1]}>
          <meshStandardMaterial color={hairColor} roughness={0.8} />
        </Sphere>
        {/* Cute Eyes */}
        <Sphere args={[0.2, 12, 12]} position={[-0.4, 0.1, 1.05]}>
          <meshStandardMaterial color={accentColor} />
        </Sphere>
        <Sphere args={[0.2, 12, 12]} position={[0.4, 0.1, 1.05]}>
          <meshStandardMaterial color={accentColor} />
        </Sphere>
      </group>
    );
  }
};

// Rigged Avatar Component that maps blocks & accessories to landmarks seamlessly
const RiggedAvatar = ({ points, customAvatar }) => {
  const { preset, skinColor, armorColor, hairColor, accentColor } = customAvatar;

  // Key Joint Points
  const nose = points[0];
  const lShoulder = points[11];
  const rShoulder = points[12];
  const lElbow = points[13];
  const rElbow = points[14];
  const lWrist = points[15];
  const rWrist = points[16];
  const lHip = points[23];
  const rHip = points[24];
  const lKnee = points[25];
  const rKnee = points[26];
  const lAnkle = points[27];
  const rAnkle = points[28];

  const shoulderMid = lShoulder.clone().lerp(rShoulder, 0.5);
  const hipMid = lHip.clone().lerp(rHip, 0.5);
  // Base of head connects directly to neck
  const headPos = nose.clone().lerp(shoulderMid, 0.3);

  return (
    <group>
      {/* Head */}
      <group position={headPos}>
        <HeadPreset 
          preset={preset} 
          skinColor={skinColor} 
          armorColor={armorColor} 
          hairColor={hairColor} 
          accentColor={accentColor} 
        />
      </group>

      {/* Neck */}
      <BlockBone p1={shoulderMid} p2={headPos} color={skinColor} width={0.4} depth={0.4} />

      {/* Torso */}
      <BlockBone p1={shoulderMid} p2={hipMid} color={armorColor} width={1.5} depth={0.9} />

      {/* Joint Connectors (Spheres at all key joints so there are NO GAPS) */}
      <Sphere args={[0.5, 12, 12]} position={lShoulder}><meshStandardMaterial color={accentColor} metalness={0.7} /></Sphere>
      <Sphere args={[0.5, 12, 12]} position={rShoulder}><meshStandardMaterial color={accentColor} metalness={0.7} /></Sphere>
      <Sphere args={[0.35, 12, 12]} position={lElbow}><meshStandardMaterial color={armorColor} /></Sphere>
      <Sphere args={[0.35, 12, 12]} position={rElbow}><meshStandardMaterial color={armorColor} /></Sphere>
      <Sphere args={[0.3, 12, 12]} position={lWrist}><meshStandardMaterial color={skinColor} /></Sphere>
      <Sphere args={[0.3, 12, 12]} position={rWrist}><meshStandardMaterial color={skinColor} /></Sphere>
      <Sphere args={[0.45, 12, 12]} position={lHip}><meshStandardMaterial color={armorColor} /></Sphere>
      <Sphere args={[0.45, 12, 12]} position={rHip}><meshStandardMaterial color={armorColor} /></Sphere>
      <Sphere args={[0.4, 12, 12]} position={lKnee}><meshStandardMaterial color={armorColor} /></Sphere>
      <Sphere args={[0.4, 12, 12]} position={rKnee}><meshStandardMaterial color={armorColor} /></Sphere>

      {/* Left Arm */}
      <BlockBone p1={lShoulder} p2={lElbow} color={armorColor} width={0.55} depth={0.55} />
      <BlockBone p1={lElbow} p2={lWrist} color={skinColor} width={0.45} depth={0.45} />

      {/* Right Arm */}
      <BlockBone p1={rShoulder} p2={rElbow} color={armorColor} width={0.55} depth={0.55} />
      <BlockBone p1={rElbow} p2={rWrist} color={skinColor} width={0.45} depth={0.45} />

      {/* Left Leg */}
      <BlockBone p1={lHip} p2={lKnee} color={armorColor} width={0.65} depth={0.65} />
      <BlockBone p1={lKnee} p2={lAnkle} color={accentColor} width={0.55} depth={0.55} />

      {/* Right Leg */}
      <BlockBone p1={rHip} p2={rKnee} color={armorColor} width={0.65} depth={0.65} />
      <BlockBone p1={rKnee} p2={rAnkle} color={accentColor} width={0.55} depth={0.55} />
    </group>
  );
};

const SkeletonRenderer = ({ landmarksList, customAvatar }) => {
  if (!landmarksList || landmarksList.length === 0) return null;

  return (
    <group>
      {landmarksList.map((landmarks, playerIndex) => {
        const defaultColor = PLAYER_COLORS[playerIndex % PLAYER_COLORS.length];
        const isCustom = playerIndex === 0 && customAvatar.enabled;
        
        // Convert landmarks to 3D points
        const points = landmarks.map(lm => new THREE.Vector3(
          (lm.x - 0.5) * -10,
          (0.5 - lm.y) * 10,
          -lm.z * 10
        ));

        // If player 1 has custom avatar enabled, render the fully rigged avatar
        if (isCustom) {
          return (
            <RiggedAvatar 
              key={`rigged-avatar-${playerIndex}`}
              points={points}
              customAvatar={customAvatar}
            />
          );
        }
        
        return (
          <group key={`player-${playerIndex}`}>
            {/* Draw Joints */}
            {points.map((pt, i) => (
              <Sphere key={`joint-${i}`} args={[0.15, 8, 8]} position={pt}>
                <meshStandardMaterial color={defaultColor} />
              </Sphere>
            ))}

            {/* Draw Bones */}
            {POSE_CONNECTIONS.map(([start, end], i) => (
              <Line
                key={`bone-${i}`}
                points={[points[start], points[end]]}
                color={defaultColor}
                lineWidth={5}
              />
            ))}
          </group>
        );
      })}
    </group>
  );
};

const AvatarTest = () => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
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

  const [landmarksList, setLandmarksList] = useState([]);
  const [status, setStatus] = useState('Loading Model...');
  
  // Custom Avatar Builder State
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [customAvatar, setCustomAvatar] = useState({
    enabled: true,
    preset: 'robot', // knight, cyberpunk, robot, chibi
    skinColor: '#ffdbac',
    armorColor: '#0f172a',
    hairColor: '#3b82f6',
    accentColor: '#00f3ff'
  });

  const PRESETS = [
    { id: 'knight', name: '🛡️ Knight' },
    { id: 'cyberpunk', name: '⚡ Cyberpunk' },
    { id: 'robot', name: '🤖 Robot' },
    { id: 'chibi', name: '🐣 Chibi' }
  ];

  const lastVideoTime = useRef(-1);
  const previousLandmarksRef = useRef([]);
  const xPoseRef = useRef({ startTime: 0, progress: 0 });

  useEffect(() => {
    let active = true;

    const initializePoseLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm"
        );
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numPoses: 4 // Support up to 4 players
        });

        if (active) {
          poseLandmarkerRef.current = landmarker;
          setStatus('Starting Camera...');
          startCamera();
        }
      } catch (err) {
        console.error("Error initializing MediaPipe:", err);
        if (active) setStatus('Failed to load model.');
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
        console.error("Error accessing webcam:", err);
        if (active) setStatus('Camera access denied or unavailable.');
      }
    };

    initializePoseLandmarker();

    return () => {
      active = false;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
      if (poseLandmarkerRef.current) {
        poseLandmarkerRef.current.close();
      }
    };
  }, []);

  const canvasRef = useRef(null);

  const draw2DSkeleton = (landmarksList) => {
    if (!canvasRef.current || !videoRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    landmarksList.forEach((landmarks, playerIndex) => {
      const color = PLAYER_COLORS[playerIndex % PLAYER_COLORS.length];
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;

      // Draw bones
      POSE_CONNECTIONS.forEach(([start, end]) => {
        const pt1 = landmarks[start];
        const pt2 = landmarks[end];
        if (pt1.visibility > 0.5 && pt2.visibility > 0.5) {
          ctx.beginPath();
          ctx.moveTo(pt1.x * w, pt1.y * h);
          ctx.lineTo(pt2.x * w, pt2.y * h);
          ctx.stroke();
        }
      });

      // Draw joints
      landmarks.forEach((pt) => {
        if (pt.visibility > 0.5) {
          ctx.beginPath();
          ctx.arc(pt.x * w, pt.y * h, 4, 0, 2 * Math.PI);
          ctx.fill();
        }
      });
    });
  };

  const smoothLandmarks = (rawLandmarksList) => {
    const alpha = 0.35; // Smoothing factor (lower = smoother movement, reduces jitter)
    const prevList = previousLandmarksRef.current;

    const smoothedList = rawLandmarksList.map((playerLandmarks, pIdx) => {
      const prevPlayer = prevList[pIdx];
      if (!prevPlayer || prevPlayer.length !== playerLandmarks.length) {
        return playerLandmarks;
      }

      return playerLandmarks.map((lm, idx) => {
        const prevLm = prevPlayer[idx];
        return {
          x: prevLm.x + (lm.x - prevLm.x) * alpha,
          y: prevLm.y + (lm.y - prevLm.y) * alpha,
          z: prevLm.z + (lm.z - prevLm.z) * alpha,
          visibility: lm.visibility
        };
      });
    });

    previousLandmarksRef.current = smoothedList;
    return smoothedList;
  };

  const detectPose = () => {
    if (videoRef.current && videoRef.current.readyState >= 2 && poseLandmarkerRef.current) {
      let startTimeMs = performance.now();
      if (lastVideoTime.current !== videoRef.current.currentTime) {
        lastVideoTime.current = videoRef.current.currentTime;
        const result = poseLandmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);
        if (result.landmarks) {
          const smoothed = smoothLandmarks(result.landmarks);
          setLandmarksList(smoothed);
          draw2DSkeleton(smoothed);

          // X-Pose Check (Cross arms X shape to exit game)
          if (smoothed.length > 0) {
            const lm = smoothed[0];
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
                handleBackToMain();
                return;
              }
            } else {
              xPoseRef.current = { startTime: 0, progress: 0 };
            }
          }
        }
      }
    }
    animationRef.current = requestAnimationFrame(detectPose);
  };

  useEffect(() => {
    if (status === 'Ready') {
      detectPose();
    }
  }, [status]);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', backgroundColor: '#0f172a', overflow: 'hidden' }}>
      
      {/* Real Camera Mini Screen Container */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        width: '320px',
        height: '180px',
        borderRadius: '12px',
        border: '2px solid rgba(255,255,255,0.2)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        zIndex: 20,
        overflow: 'hidden',
        transform: 'scaleX(-1)' // Mirror effect for both video and canvas
      }}>
        <video
          ref={videoRef}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          width={1280} // Internal resolution matching camera
          height={720}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>

      {/* UI Overlay */}
      <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10, color: 'white', fontFamily: 'sans-serif', pointerEvents: 'none' }}>
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
        </div>
        <h1 style={{ margin: '0 0 10px 0', fontSize: '2rem' }}>Multiplayer Avatar Test</h1>
        <p style={{ margin: 0, color: '#94a3b8' }}>Status: {status}</p>
        <p style={{ margin: 0, color: '#94a3b8' }}>Players Detected: {landmarksList.length}/4</p>
        
        <div style={{ marginTop: '20px', pointerEvents: 'auto', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setShowCustomizer(true)}
            style={{
              padding: '10px 20px',
              fontSize: '1rem',
              backgroundColor: '#ec4899',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(236,72,153,0.4)'
            }}
          >
            ✨ 3D Avatar Builder Studio
          </button>
        </div>
      </div>

      {/* Customizer UI Panel */}
      {showCustomizer && (
        <div style={{
          position: 'absolute', top: '20px', right: '20px', width: '320px',
          backgroundColor: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(12px)',
          padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.15)',
          zIndex: 30, color: 'white', fontFamily: 'sans-serif', maxHeight: '90vh', overflowY: 'auto'
        }}>
          <h2 style={{ marginTop: 0, fontSize: '1.4rem' }}>🎨 3D Avatar Builder</h2>
          
          {/* Preset Selection */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', color: '#94a3b8' }}>Select Preset</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {PRESETS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setCustomAvatar(prev => ({ ...prev, preset: p.id, enabled: true }))}
                  style={{
                    padding: '8px', borderRadius: '8px', cursor: 'pointer',
                    backgroundColor: customAvatar.preset === p.id ? '#ec4899' : '#1e293b',
                    color: 'white', border: 'none', fontWeight: 'bold'
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Color Pickers */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem', color: '#94a3b8' }}>Armor / Outfit Color</label>
            <input 
              type="color" 
              value={customAvatar.armorColor}
              onChange={e => setCustomAvatar(prev => ({ ...prev, armorColor: e.target.value, enabled: true }))}
              style={{ width: '100%', height: '40px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'none' }}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem', color: '#94a3b8' }}>Accent / Glow Color</label>
            <input 
              type="color" 
              value={customAvatar.accentColor}
              onChange={e => setCustomAvatar(prev => ({ ...prev, accentColor: e.target.value, enabled: true }))}
              style={{ width: '100%', height: '40px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'none' }}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem', color: '#94a3b8' }}>Hair Color</label>
            <input 
              type="color" 
              value={customAvatar.hairColor}
              onChange={e => setCustomAvatar(prev => ({ ...prev, hairColor: e.target.value, enabled: true }))}
              style={{ width: '100%', height: '40px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'none' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem', color: '#94a3b8' }}>Skin Color</label>
            <input 
              type="color" 
              value={customAvatar.skinColor}
              onChange={e => setCustomAvatar(prev => ({ ...prev, skinColor: e.target.value, enabled: true }))}
              style={{ width: '100%', height: '40px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'none' }}
            />
          </div>

          <button 
            onClick={() => setShowCustomizer(false)}
            style={{ width: '100%', padding: '12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}
          >
            Save & Done
          </button>
        </div>
      )}

      {/* 3D Scene */}
      <Canvas camera={{ position: [0, 0, 10], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <OrbitControls />
        <React.Suspense fallback={null}>
          <SkeletonRenderer landmarksList={landmarksList} customAvatar={customAvatar} />
        </React.Suspense>
        
        {/* Floor grid for perspective */}
        <gridHelper args={[20, 20, 0x444444, 0x222222]} position={[0, -5, 0]} />
      </Canvas>

    </div>
  );
};

export default AvatarTest;
