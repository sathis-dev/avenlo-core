// ====================================
// NEURAL HEAT PRISM
// WebGL-Accelerated 3D Channel Heat Visualization
// ====================================

import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing';
import * as THREE from 'three';
import { BlendFunction } from 'postprocessing';
import { ChannelHeatNode, heatToRGB, KINETIC_COLORS } from '../../types/kinetic';
import { fractureVertexShader, fractureFragmentShader, particleVertexShader, particleFragmentShader } from './shaders';

// ====================================
// PRISM FACET COMPONENT
// Individual channel facet with fracture effect
// ====================================

interface PrismFacetProps {
  node: ChannelHeatNode;
  index: number;
  totalFacets: number;
}

function PrismFacet({ node, index, totalFacets }: PrismFacetProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  
  // Calculate position on prism surface
  const angle = (index / totalFacets) * Math.PI * 2;
  const radius = 2;
  const position: [number, number, number] = [
    Math.cos(angle) * radius,
    (node.heat / 100) * 2 - 1, // Height based on heat
    Math.sin(angle) * radius,
  ];
  
  // Shader uniforms
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uHeat: { value: node.heat },
    uFracture: { value: node.fractureLevel },
    uBaseColor: { value: new THREE.Vector3(0, 0.83, 1) }, // Cyan
    uHotColor: { value: new THREE.Vector3(0.98, 0.45, 0.09) }, // Orange
    uCriticalColor: { value: new THREE.Vector3(0.94, 0.27, 0.27) }, // Red
    uNoiseScale: { value: 3.0 },
    uDisplacement: { value: 1.0 },
  }), []);
  
  // Animate
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      materialRef.current.uniforms.uHeat.value = THREE.MathUtils.lerp(
        materialRef.current.uniforms.uHeat.value,
        node.heat,
        0.05
      );
    }
    
    if (meshRef.current) {
      // Subtle rotation
      meshRef.current.rotation.y += 0.001;
      
      // Vibration at high heat
      if (node.heat > 70) {
        meshRef.current.position.x = position[0] + Math.sin(state.clock.elapsedTime * 20) * 0.02;
        meshRef.current.position.z = position[2] + Math.cos(state.clock.elapsedTime * 20) * 0.02;
      }
    }
  });
  
  return (
    <mesh ref={meshRef} position={position}>
      <icosahedronGeometry args={[0.3 + (node.heat / 200), 2]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={fractureVertexShader}
        fragmentShader={fractureFragmentShader}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ====================================
// HEAT PARTICLES
// Emitted from hot channels
// ====================================

interface HeatParticlesProps {
  nodes: ChannelHeatNode[];
}

function HeatParticles({ nodes }: HeatParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const particleCount = 500;
  
  // Generate particle attributes
  const { positions, scales, lives, velocities } = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const scales = new Float32Array(particleCount);
    const lives = new Float32Array(particleCount);
    const velocities = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      // Random position in space (not tied to specific node for now)
      const angle = Math.random() * Math.PI * 2;
      const radius = 2 + Math.random() * 0.5;
      
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.random() * 2 - 1;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
      
      scales[i] = Math.random() * 0.5 + 0.5;
      lives[i] = Math.random();
      
      velocities[i * 3] = (Math.random() - 0.5) * 0.5;
      velocities[i * 3 + 1] = Math.random() * 0.5 + 0.5;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    }
    
    return { positions, scales, lives, velocities };
  }, [nodes.length]);
  
  // Average heat for particle intensity
  const avgHeat = useMemo(() => 
    nodes.reduce((acc, n) => acc + n.heat, 0) / nodes.length,
    [nodes]
  );
  
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uHeat: { value: avgHeat },
    uColor: { value: new THREE.Vector3(...heatToRGB(avgHeat)) },
  }), []);
  
  useFrame((state) => {
    if (pointsRef.current) {
      const material = pointsRef.current.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value = state.clock.elapsedTime;
      material.uniforms.uHeat.value = avgHeat;
    }
  });
  
  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aScale"
          count={particleCount}
          array={scales}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aLife"
          count={particleCount}
          array={lives}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aVelocity"
          count={particleCount}
          array={velocities}
          itemSize={3}
        />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={particleVertexShader}
        fragmentShader={particleFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ====================================
// CENTRAL CORE
// Gravity well representing global threat
// ====================================

interface CentralCoreProps {
  globalHeat: number;
  threatLevel: number;
}

function CentralCore({ globalHeat, threatLevel }: CentralCoreProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.2;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.3;
      
      // Pulse based on threat
      const scale = 0.3 + (threatLevel / 100) * 0.2 + Math.sin(state.clock.elapsedTime * 2) * 0.05;
      meshRef.current.scale.setScalar(scale);
    }
    
    if (glowRef.current) {
      const glowScale = 0.5 + (threatLevel / 100) * 0.3;
      glowRef.current.scale.setScalar(glowScale);
    }
  });
  
  const coreColor = useMemo(() => {
    const rgb = heatToRGB(globalHeat);
    return new THREE.Color(rgb[0], rgb[1], rgb[2]);
  }, [globalHeat]);
  
  return (
    <group>
      {/* Inner core */}
      <mesh ref={meshRef}>
        <octahedronGeometry args={[0.3, 2]} />
        <meshStandardMaterial
          color={coreColor}
          emissive={coreColor}
          emissiveIntensity={0.5}
          metalness={0.9}
          roughness={0.1}
        />
      </mesh>
      
      {/* Outer glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshBasicMaterial
          color={coreColor}
          transparent
          opacity={0.15}
        />
      </mesh>
    </group>
  );
}

// ====================================
// PRISM SCENE
// Main 3D scene composition
// ====================================

interface PrismSceneProps {
  channels: ChannelHeatNode[];
  globalHeat: number;
  threatLevel: number;
}

function PrismScene({ channels, globalHeat, threatLevel }: PrismSceneProps) {
  const { camera } = useThree();
  
  useEffect(() => {
    camera.position.set(0, 2, 5);
    camera.lookAt(0, 0, 0);
  }, [camera]);
  
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.2} />
      <pointLight position={[10, 10, 10]} intensity={0.5} />
      <pointLight position={[-10, -10, -10]} intensity={0.3} color="#8B5CF6" />
      
      {/* Central core */}
      <CentralCore globalHeat={globalHeat} threatLevel={threatLevel} />
      
      {/* Channel facets */}
      {channels.map((channel, i) => (
        <PrismFacet
          key={channel.id}
          node={channel}
          index={i}
          totalFacets={channels.length}
        />
      ))}
      
      {/* Particles */}
      <HeatParticles nodes={channels} />
      
      {/* Controls */}
      <OrbitControls
        enablePan={false}
        minDistance={3}
        maxDistance={10}
        autoRotate
        autoRotateSpeed={0.5}
      />
      
      {/* Post-processing */}
      <EffectComposer>
        <Bloom
          intensity={0.5}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
        />
        <ChromaticAberration
          blendFunction={BlendFunction.NORMAL}
          offset={new THREE.Vector2(0.002, 0.002)}
          radialModulation={false}
          modulationOffset={0}
        />
      </EffectComposer>
    </>
  );
}

// ====================================
// NEURAL HEAT PRISM (Main Export)
// ====================================

interface NeuralHeatPrismProps {
  channels: ChannelHeatNode[];
  globalHeat?: number;
  threatLevel?: number | string;
  width?: number;
  height?: number;
  className?: string;
}

export default function NeuralHeatPrism({
  channels,
  globalHeat = 50,
  threatLevel = 30,
  width,
  height,
  className = '',
}: NeuralHeatPrismProps) {
  // Convert string threat level to number
  const threatNum = typeof threatLevel === 'string' 
    ? { MINIMAL: 10, ELEVATED: 30, HIGH: 50, CRITICAL: 75, IMMINENT: 95 }[threatLevel] ?? 30
    : threatLevel;
  return (
    <div className={`relative ${className}`} style={{ background: KINETIC_COLORS.background }}>
      {/* WebGL Canvas */}
      <Canvas
        gl={{ 
          antialias: true, 
          alpha: true,
          powerPreference: 'high-performance',
        }}
        dpr={[1, 2]}
        style={{ width: width || '100%', height: height || '100%' }}
      >
        <PerspectiveCamera makeDefault fov={50} near={0.1} far={100} />
        <PrismScene
          channels={channels}
          globalHeat={globalHeat}
          threatLevel={threatNum}
        />
      </Canvas>
      
      {/* Overlay UI */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-black/50 backdrop-blur-sm border border-white/10">
            <span className="text-xs text-gray-400">Global Heat</span>
            <div className="text-lg font-mono font-bold" style={{ color: heatToRGB(globalHeat).map(c => `${Math.round(c * 255)}`).join(',') ? `rgb(${heatToRGB(globalHeat).map(c => Math.round(c * 255)).join(',')})` : '#fff' }}>
              {globalHeat.toFixed(1)}%
            </div>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-black/50 backdrop-blur-sm border border-white/10">
            <span className="text-xs text-gray-400">Threat Level</span>
            <div className={`text-lg font-mono font-bold ${threatNum > 70 ? 'text-red-400' : threatNum > 40 ? 'text-orange-400' : 'text-green-400'}`}>
              {threatNum.toFixed(1)}
            </div>
          </div>
        </div>
        <div className="px-3 py-1.5 rounded-lg bg-black/50 backdrop-blur-sm border border-white/10">
          <span className="text-xs text-gray-400">Channels</span>
          <div className="text-lg font-mono font-bold text-avenlo-cyan">
            {channels.length}
          </div>
        </div>
      </div>
    </div>
  );
}
