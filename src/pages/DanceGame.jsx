import React, { useEffect, useRef, useState, Suspense } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { Canvas } from '@react-three/fiber';
import { Box, Sphere, Cylinder, Text, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useNavigate } from 'react-router-dom';

// Free Streaming Royalty-Free Music Tracks
const FREE_STREAMING_TRACKS = [
  { id: 'track1', name: '🌸 Pastel Pop Magic', url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3', bpm: 128 },
  { id: 'track2', name: '⚡ Neon Cyber Beat', url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3', bpm: 135 },
  { id: 'track3', name: '🚀 Synthwave Rush', url: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3', bpm: 140 }
];

const ARROWS = [
  { id: 'left', name: 'Left', arrow: '⬅️', color: '#f472b6', xOffset: -1.8 },
  { id: 'up', name: 'Up', arrow: '⬆️', color: '#38bdf8', xOffset: -0.6 },
  { id: 'down', name: 'Down', arrow: '⬇️', color: '#facc15', xOffset: 0.6 },
  { id: 'right', name: 'Right', arrow: '➡️', color: '#c084fc', xOffset: 1.8 }
];

const AVATAR_PRESETS = [
  { id: 'knight', name: '⚔️ Cyber Knight', url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Fox/glTF-Binary/Fox.glb', scale: 0.015, yOffset: -2.4 },
  { id: 'robot', name: '🤖 Mech Chameleon', url: 'https://raw.githubusercontent.com/gltf-models/meccha_chameleon_white_character.glb', scale: 0.8, yOffset: -2.4 }
];

// 3D Flowing Piano Note Tile (Matching Pastel Pink Magic Tiles)
const PianoNoteTile3D = ({ noteData }) => {
  return (
    <group position={[noteData.xOffset, -2.35, noteData.zPos]}>
      {/* 3D Pastel Pink Piano Key Slab */}
      <Box args={[1.1, 0.15, 1.4]}>
        <meshStandardMaterial color="#f472b6" emissive="#ec4899" emissiveIntensity={2.5} roughness={0.2} />
      </Box>
      {/* Outer White Bezel */}
      <Box args={[1.15, 0.18, 1.45]}>
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={3.0} wireframe />
      </Box>
      {/* Target Key Symbol */}
      <Cylinder args={[0.35, 0.35, 0.2, 24]} position={[0, 0.05, 0]}>
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2.5} />
      </Cylinder>
      {/* Arrow Emoji */}
      <Text position={[0, 0.18, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.45} color="#0f172a">
        {noteData.arrow}
      </Text>
    </group>
  );
};

// 3D Avatar Loader Component
const Avatar3DModel = ({ url, scale = 1, yOffset = -2.4, landmarks }) => {
  const { scene } = useGLTF(url);
  const avatarRef = useRef();

  useEffect(() => {
    if (scene) {
      scene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
    }
  }, [scene]);

  return (
    <primitive
      ref={avatarRef}
      object={scene.clone()}
      scale={[scale, scale, scale]}
      position={[0, yOffset, -1.0]}
    />
  );
};

// Dreamy Pastel Sky Stage Floor (Matching Piano Highway Screenshot)
const PastelSkyHighwayStage = () => {
  const lineOffsets = [-2.4, -1.2, 0.0, 1.2, 2.4];

  return (
    <group position={[0, -2.4, -2]}>
      {/* Pastel Purple Main Runway Floor */}
      <Box args={[6.0, 0.1, 16]} position={[0, -0.05, 0]}>
        <meshStandardMaterial color="#a855f7" emissive="#9333ea" emissiveIntensity={0.8} roughness={0.3} />
      </Box>

      {/* 5 Glowing Golden Separator Lines */}
      {lineOffsets.map((xPos, idx) => (
        <Box key={`golden_line_${idx}`} args={[0.06, 0.06, 15.8]} position={[xPos, 0.02, 0]}>
          <meshStandardMaterial color="#fde047" emissive="#fef08a" emissiveIntensity={3.5} />
        </Box>
      ))}
    </group>
  );
};

// Web Audio API Hit Sound Generator
const playHitSound = (type) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'PERFECT') {
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    }
  } catch (e) {}
};

const DanceGame = () => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const poseLandmarkerRef = useRef(null);
  const animationRef = useRef(null);

  // Game Mode & State
  const [mode, setMode] = useState('SINGLE');
  const [gameState, setGameState] = useState('MENU');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_PRESETS[0]);
  const [currentTrack, setCurrentTrack] = useState(FREE_STREAMING_TRACKS[0]);
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const [scoreP1, setScoreP1] = useState(0);
  const [scoreP2, setScoreP2] = useState(0);
  const [comboP1, setComboP1] = useState(0);
  const [comboP2, setComboP2] = useState(0);
  const [activeStepP1, setActiveStepP1] = useState(null);
  const [activeStepP2, setActiveStepP2] = useState(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [status, setStatus] = useState('Initializing Model...');

  // 3D Avatar Pose Landmarks & Notes
  const [p1Landmarks, setP1Landmarks] = useState(null);
  const [p2Landmarks, setP2Landmarks] = useState(null);
  const [floor3DNotes, setFloor3DNotes] = useState([]);

  // Refs
  const modeRef = useRef('SINGLE');
  const floor3DNotesRef = useRef([]);
  const scoreP1Ref = useRef(0);
  const scoreP2Ref = useRef(0);
  const comboP1Ref = useRef(0);
  const comboP2Ref = useRef(0);
  const lastSpawnTimeRef = useRef(0);
  const xPoseRef = useRef({ startTime: 0, progress: 0 });

  // Clean Exit Back to Main Menu
  const handleBackToMain = () => {
    if (audioRef.current) audioRef.current.pause();
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
      if (audioRef.current) audioRef.current.pause();
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
            setGameState('GAMEOVER');
            if (audioRef.current) audioRef.current.pause();
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

    // Start Free Streaming Music Audio
    if (audioRef.current) {
      audioRef.current.src = currentTrack.url;
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
      setIsPlayingMusic(true);
    }
  };

  const toggleMusic = () => {
    if (audioRef.current) {
      if (isPlayingMusic) {
        audioRef.current.pause();
        setIsPlayingMusic(false);
      } else {
        audioRef.current.play().catch(() => {});
        setIsPlayingMusic(true);
      }
    }
  };

  const changeTrack = (track) => {
    setCurrentTrack(track);
    if (audioRef.current && gameState === 'PLAYING') {
      audioRef.current.src = track.url;
      audioRef.current.play().catch(() => {});
      setIsPlayingMusic(true);
    }
  };

  // Main Motion Detection Loop
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

        // Player 1 Feet Step Check
        if (sortedPoses[0]) {
          setP1Landmarks(sortedPoses[0]);
          const lm = sortedPoses[0];
          let detectedP1 = null;

          if (lm[27] && lm[28]) {
            const feetX = (0.5 - (lm[27].x + lm[28].x) / 2) * 4.5;
            if (feetX < -1.0) detectedP1 = 'left';
            else if (feetX > 1.0) detectedP1 = 'right';
            else if (lm[27].y < lm[28].y - 0.05) detectedP1 = 'up';
            else if (lm[27].y > lm[28].y + 0.05) detectedP1 = 'down';
          }
          setActiveStepP1(detectedP1);

          if (detectedP1 && gameState === 'PLAYING') {
            floor3DNotesRef.current.forEach(note => {
              if (!note.hitP1 && note.id === detectedP1 && note.zPos >= -1.0 && note.zPos <= 0.8) {
                note.hitP1 = true;
                playHitSound('PERFECT');
                scoreP1Ref.current += 100;
                comboP1Ref.current += 1;
                setScoreP1(scoreP1Ref.current);
                setComboP1(comboP1Ref.current);
              }
            });
          }
        }

        // Player 2 Feet Step Check
        if (sortedPoses[1] && modeRef.current === 'MULTI') {
          setP2Landmarks(sortedPoses[1]);
          const lm2 = sortedPoses[1];
          let detectedP2 = null;

          if (lm2[27] && lm2[28]) {
            const feetX = (0.5 - (lm2[27].x + lm2[28].x) / 2) * 4.5;
            if (feetX < -1.0) detectedP2 = 'left';
            else if (feetX > 1.0) detectedP2 = 'right';
            else if (lm2[27].y < lm2[28].y - 0.05) detectedP2 = 'up';
            else if (lm2[27].y > lm2[28].y + 0.05) detectedP2 = 'down';
          }
          setActiveStepP2(detectedP2);

          if (detectedP2 && gameState === 'PLAYING') {
            floor3DNotesRef.current.forEach(note => {
              if (!note.hitP2 && note.id === detectedP2 && note.zPos >= -1.0 && note.zPos <= 0.8) {
                note.hitP2 = true;
                playHitSound('PERFECT');
                scoreP2Ref.current += 100;
                comboP2Ref.current += 1;
                setScoreP2(scoreP2Ref.current);
                setComboP2(comboP2Ref.current);
              }
            });
          }
        }
      }
    }

    if (gameState === 'PLAYING') {
      // 1. Spawn 3D Flowing Piano Note Tiles (In sync with Music BPM)
      const now = Date.now();
      const spawnInterval = (60 / currentTrack.bpm) * 1000 * 1.5;
      if (now - lastSpawnTimeRef.current > spawnInterval && floor3DNotesRef.current.length < 5) {
        lastSpawnTimeRef.current = now;
        const randomArrow = ARROWS[Math.floor(Math.random() * ARROWS.length)];

        floor3DNotesRef.current.push({
          uid: Math.random(),
          id: randomArrow.id,
          arrow: randomArrow.arrow,
          color: randomArrow.color,
          xOffset: randomArrow.xOffset,
          zPos: -10.0,
          speed: 0.14,
          hitP1: false,
          hitP2: false
        });
      }

      // 2. Slide 3D Piano Tiles Forward
      floor3DNotesRef.current.forEach(note => {
        note.zPos += note.speed;
      });

      floor3DNotesRef.current = floor3DNotesRef.current.filter(n => n.zPos < 2.0);
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
    <div style={{
      position: 'relative', width: '100vw', height: '100vh',
      background: 'linear-gradient(135deg, #38bdf8 0%, #bae6fd 50%, #fef08a 100%)',
      overflow: 'hidden'
    }}>
      
      <video ref={videoRef} style={{ display: 'none' }} playsInline muted />
      <audio ref={audioRef} loop />

      {/* 3D Stage Canvas */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
        <Canvas camera={{ position: [0, 2.0, 7.0], fov: 55 }}>
          <ambientLight intensity={1.5} />
          <directionalLight position={[0, 10, 5]} intensity={2.5} color="#ffffff" />
          <pointLight position={[-5, 5, 2]} intensity={2.0} color="#f472b6" />
          <pointLight position={[5, 5, 2]} intensity={2.0} color="#38bdf8" />

          {/* Dreamy Pastel Sky Stage Runway Floor */}
          <PastelSkyHighwayStage />

          {/* 3D Flowing Piano Note Tiles */}
          {floor3DNotes.map((note) => (
            <PianoNoteTile3D key={note.uid} noteData={note} />
          ))}

          {/* 3D Avatar Character */}
          <Suspense fallback={null}>
            <Avatar3DModel
              url={selectedAvatar.url}
              scale={selectedAvatar.scale}
              yOffset={selectedAvatar.yOffset}
              landmarks={p1Landmarks}
            />
          </Suspense>

          <OrbitControls enableZoom={false} enablePan={false} maxPolarAngle={Math.PI / 2} />
        </Canvas>
      </div>

      {/* Header Overlay & Free Streaming Music Control Bar */}
      <div style={{ position: 'absolute', top: '20px', left: '20px', right: '20px', display: 'flex', justifyContent: 'space-between', zIndex: 10, pointerEvents: 'none' }}>
        <div>
          <button
            onClick={handleBackToMain}
            style={{
              pointerEvents: 'auto', background: 'none', border: 'none', color: '#0284c7',
              fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', padding: 0
            }}
          >
            &larr; Back to Menu
          </button>
          <h1 style={{ color: '#0f172a', margin: '5px 0 0 0', fontSize: '2.2rem', textShadow: '0 2px 10px rgba(255,255,255,0.8)' }}>
            🎶 Dreamy Magic Tiles AR
          </h1>
          <p style={{ color: '#334155', margin: 0, fontWeight: 'bold' }}>
            📻 Free Music Streaming Connected | Step on Floor Note Tiles! | 🙅 Cross Arms X 1.2s to Exit
          </p>
        </div>

        {/* Free Music Player Bar Component */}
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', pointerEvents: 'auto' }}>
          <div style={{ backgroundColor: 'rgba(255,255,255,0.9)', padding: '10px 16px', borderRadius: '16px', border: '2px solid #38bdf8', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.2rem' }}>📻</span>
            <select
              value={currentTrack.id}
              onChange={(e) => changeTrack(FREE_STREAMING_TRACKS.find(t => t.id === e.target.value))}
              style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}
            >
              {FREE_STREAMING_TRACKS.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button
              onClick={toggleMusic}
              style={{
                padding: '6px 12px', borderRadius: '8px', border: 'none',
                backgroundColor: isPlayingMusic ? '#ef4444' : '#10b981', color: 'white', fontWeight: 'bold', cursor: 'pointer'
              }}
            >
              {isPlayingMusic ? '⏸️ Pause' : '▶️ Play'}
            </button>
          </div>

          {gameState === 'PLAYING' && (
            <div style={{ backgroundColor: 'rgba(255,255,255,0.9)', padding: '12px 20px', borderRadius: '16px', border: '2px solid #f472b6', color: '#0f172a', textAlign: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: '#db2777', fontWeight: 'bold' }}>SCORE</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#059669' }}>{scoreP1}</div>
              <div style={{ fontSize: '0.9rem', color: '#d97706' }}>🔥 Combo: {comboP1}</div>
            </div>
          )}
        </div>
      </div>

      {/* Start / Game Over Modal */}
      {gameState !== 'PLAYING' && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(8px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 30
        }}>
          <div style={{
            backgroundColor: 'rgba(255,255,255,0.95)', padding: '2.5rem', borderRadius: '24px',
            border: '2px solid #f472b6', textAlign: 'center', maxWidth: '560px', width: '90%',
            boxShadow: '0 25px 50px -12px rgba(244,114,182,0.4)'
          }}>
            {gameState === 'MENU' ? (
              <>
                <h2 style={{ fontSize: '2.5rem', color: '#0f172a', margin: '0 0 10px 0' }}>🎶 Dreamy Magic Tiles AR</h2>
                <p style={{ color: '#475569', fontSize: '1rem', marginBottom: '1.5rem', fontWeight: 'bold' }}>
                  Dance with 3D Avatar on the Pastel Sky Piano Highway connected with Free Streaming Music!
                </p>

                <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                  <button
                    onClick={() => startGame('SINGLE')}
                    disabled={status !== 'Ready'}
                    style={{
                      padding: '16px 28px', fontSize: '1.2rem', fontWeight: 'bold',
                      backgroundColor: status === 'Ready' ? '#38bdf8' : '#cbd5e1',
                      color: '#0f172a', border: 'none', borderRadius: '12px', cursor: status === 'Ready' ? 'pointer' : 'not-allowed',
                      boxShadow: '0 10px 25px rgba(56,189,248,0.4)'
                    }}
                  >
                    👤 1-Player Dance
                  </button>

                  <button
                    onClick={() => startGame('MULTI')}
                    disabled={status !== 'Ready'}
                    style={{
                      padding: '16px 28px', fontSize: '1.2rem', fontWeight: 'bold',
                      backgroundColor: status === 'Ready' ? '#f472b6' : '#cbd5e1',
                      color: '#ffffff', border: 'none', borderRadius: '12px', cursor: status === 'Ready' ? 'pointer' : 'not-allowed',
                      boxShadow: '0 10px 25px rgba(244,114,182,0.4)'
                    }}
                  >
                    👥 2-Player Battle
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: '2.5rem', color: '#059669', margin: '0 0 10px 0' }}>🎉 Dance Finish!</h2>
                
                <div style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '16px', marginBottom: '2rem', border: '1px solid #e2e8f0' }}>
                  <div style={{ color: '#64748b', fontSize: '1rem', fontWeight: 'bold' }}>FINAL SCORE</div>
                  <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#059669' }}>{scoreP1}</div>
                </div>

                <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                  <button
                    onClick={() => startGame('SINGLE')}
                    style={{
                      padding: '14px 24px', fontSize: '1.1rem', fontWeight: 'bold',
                      backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '12px', cursor: 'pointer'
                    }}
                  >
                    👤 Try Again
                  </button>
                  <button
                    onClick={() => startGame('MULTI')}
                    style={{
                      padding: '14px 24px', fontSize: '1.1rem', fontWeight: 'bold',
                      backgroundColor: '#f472b6', color: '#ffffff', border: 'none', borderRadius: '12px', cursor: 'pointer'
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
