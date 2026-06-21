// ====================================
// AVENLO CORE - QUANTUM GRID
// 3D Neural Mapping of Server Users
// ====================================

import { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Html } from '@react-three/drei';
import * as THREE from 'three';

interface UserStarProps {
  position: [number, number, number];
  color: string;
  size: number;
  userData: {
    username: string;
    trustLevel: string;
    heat: number;
  };
}

function UserStar({ position, color, size, userData }: UserStarProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (meshRef.current) {
      // Gentle floating animation
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime + position[0]) * 0.5;
    }
  });

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onClick={() => {
            // Trigger 3D Ban / Moderate Action
            console.log("Clicked star:", userData);
        }}
      >
        <sphereGeometry args={[size, 16, 16]} />
        <meshStandardMaterial 
            color={color} 
            emissive={color} 
            emissiveIntensity={hovered ? 2 : 0.5} 
            wireframe={hovered}
        />
      </mesh>
      
      {hovered && (
        <Html distanceFactor={15}>
          <div className="bg-black/80 text-white p-3 rounded-lg border border-white/20 backdrop-blur-md whitespace-nowrap pointer-events-none transform -translate-x-1/2 -translate-y-full mb-2">
            <div className="font-bold text-lg text-cyan-400">{userData.username}</div>
            <div className="text-xs text-white/70">Trust: {userData.trustLevel}</div>
            <div className="text-xs text-orange-400">Heat: {userData.heat.toFixed(1)}%</div>
          </div>
        </Html>
      )}
    </group>
  );
}

export function QuantumGrid() {
  // Generate random data for the demo
  const dummyUsers = useMemo(() => {
    const users = [];
    for (let i = 0; i < 200; i++) {
      const radius = 10 + Math.random() * 40;
      const theta = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 20;
      
      const x = radius * Math.cos(theta);
      const z = radius * Math.sin(theta);
      
      // Determine trust and color
      const rand = Math.random();
      let color = '#10B981'; // Green (Trusted)
      let trust = 'TRUSTED';
      let heat = Math.random() * 20;
      
      if (rand > 0.8) {
          color = '#F59E0B'; // Orange (Suspicious)
          trust = 'SUSPICIOUS';
          heat = 50 + Math.random() * 30;
      }
      if (rand > 0.95) {
          color = '#EF4444'; // Red (Hostile)
          trust = 'HOSTILE';
          heat = 85 + Math.random() * 15;
      }

      users.push({
        position: [x, y, z] as [number, number, number],
        color,
        size: 0.5 + Math.random() * 0.8,
        data: {
          username: `User_${Math.floor(Math.random() * 9999)}`,
          trustLevel: trust,
          heat
        }
      });
    }
    return users;
  }, []);

  return (
    <div className="w-full h-full relative bg-black rounded-2xl overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
      
      <div className="absolute top-4 left-4 z-10 bg-black/60 p-4 rounded-xl border border-white/10 backdrop-blur-md">
        <h2 className="text-xl font-bold text-white mb-1">Quantum Grid</h2>
        <p className="text-sm text-white/50">3D Real-time User Vectors</p>
        
        <div className="mt-4 flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_#10B981]"></div>
                <span className="text-xs text-white/70">Trusted</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_10px_#F59E0B]"></div>
                <span className="text-xs text-white/70">Suspicious</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_10px_#EF4444]"></div>
                <span className="text-xs text-white/70">Hostile / Heated</span>
            </div>
        </div>
      </div>

      <Canvas camera={{ position: [0, 30, 60], fov: 60 }}>
        <color attach="background" args={['#050505']} />
        
        <ambientLight intensity={0.2} />
        <pointLight position={[10, 10, 10]} intensity={1.5} color="#00ffff" />
        <pointLight position={[-10, -10, -10]} intensity={1} color="#ff00ff" />
        
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        
        {/* Core Sun / Guild Server Node */}
        <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[4, 32, 32]} />
            <meshStandardMaterial color="#A855F7" emissive="#A855F7" emissiveIntensity={2} />
        </mesh>
        
        {/* User Nodes */}
        {dummyUsers.map((u, i) => (
          <UserStar 
            key={i} 
            position={u.position} 
            color={u.color} 
            size={u.size} 
            userData={u.data} 
          />
        ))}

        {/* Orbit Rings */}
        <mesh rotation={[-Math.PI/2, 0, 0]}>
            <ringGeometry args={[15, 15.2, 64]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.05} side={THREE.DoubleSide} />
        </mesh>
        <mesh rotation={[-Math.PI/2, 0, 0]}>
            <ringGeometry args={[30, 30.2, 64]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.05} side={THREE.DoubleSide} />
        </mesh>

        <OrbitControls 
            enablePan={false}
            maxDistance={100}
            minDistance={10}
            autoRotate
            autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
}
