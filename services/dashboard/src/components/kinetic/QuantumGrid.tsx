// ====================================
// QUANTUM GRID
// GPU-Instanced 10,000+ Point Visualization
// Zero-lag monitoring with WebGL acceleration
// ====================================

import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { KINETIC_COLORS, heatToRGB } from '../../types/kinetic';

// ====================================
// TYPES
// ====================================

interface DataPoint {
    id: string;
    position: [number, number, number];
    heat: number;        // 0-100
    velocity: number;    // Activity velocity
    threat: number;      // Threat level 0-100
}

interface QuantumGridProps {
    data: DataPoint[];
    width?: number;
    height?: number;
    className?: string;
    onPointClick?: (point: DataPoint) => void;
}

// ====================================
// INSTANCED SHADER MATERIAL
// ====================================

const instancedVertexShader = /* glsl */ `
  attribute float aHeat;
  attribute float aThreat;
  attribute float aVelocity;
  
  varying float vHeat;
  varying float vThreat;
  varying float vVelocity;
  varying vec3 vNormal;
  varying vec3 vPosition;
  
  uniform float uTime;
  
  void main() {
    vHeat = aHeat;
    vThreat = aThreat;
    vVelocity = aVelocity;
    vNormal = normalize(normalMatrix * normal);
    
    // Pulse effect based on threat level
    float pulse = sin(uTime * 3.0 + aThreat * 0.1) * 0.1 * (aThreat / 100.0);
    vec3 scaledPosition = position * (1.0 + pulse);
    
    // Calculate instance transform
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(scaledPosition, 1.0);
    vPosition = (instanceMatrix * vec4(position, 1.0)).xyz;
    
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const instancedFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColdColor;
  uniform vec3 uWarmColor;
  uniform vec3 uHotColor;
  uniform vec3 uCriticalColor;
  
  varying float vHeat;
  varying float vThreat;
  varying float vVelocity;
  varying vec3 vNormal;
  varying vec3 vPosition;
  
  void main() {
    // Fresnel rim lighting
    vec3 viewDirection = normalize(cameraPosition - vPosition);
    float fresnel = pow(1.0 - max(dot(viewDirection, vNormal), 0.0), 2.0);
    
    // Heat-based color interpolation
    vec3 color;
    if (vHeat < 25.0) {
      color = mix(uColdColor, uWarmColor, vHeat / 25.0);
    } else if (vHeat < 50.0) {
      color = mix(uWarmColor, uHotColor, (vHeat - 25.0) / 25.0);
    } else if (vHeat < 75.0) {
      color = mix(uHotColor, uCriticalColor, (vHeat - 50.0) / 25.0);
    } else {
      color = uCriticalColor;
    }
    
    // Threat-based intensity
    float intensity = 0.6 + (vThreat / 100.0) * 0.4;
    
    // Velocity-based shimmer
    float shimmer = sin(uTime * 5.0 + vPosition.x * 10.0) * 0.1 * vVelocity + 1.0;
    
    // Combine effects
    vec3 finalColor = color * intensity * shimmer;
    finalColor += fresnel * color * 0.3;
    
    // Glow for critical points
    if (vHeat > 80.0) {
      float glow = sin(uTime * 10.0) * 0.2 + 0.8;
      finalColor += vec3(1.0, 0.3, 0.1) * glow * 0.3;
    }
    
    float alpha = 0.7 + fresnel * 0.3;
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

// ====================================
// INSTANCED POINTS COMPONENT
// ====================================

interface InstancedPointsProps {
    data: DataPoint[];
}

function InstancedPoints({ data }: InstancedPointsProps) {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const materialRef = useRef<THREE.ShaderMaterial>(null);

    const count = data.length;

    // Create geometry and attributes
    const geometry = useMemo(() => {
        const geo = new THREE.IcosahedronGeometry(0.1, 1);

        const heats = new Float32Array(count);
        const threats = new Float32Array(count);
        const velocities = new Float32Array(count);

        data.forEach((point, i) => {
            heats[i] = point.heat;
            threats[i] = point.threat;
            velocities[i] = point.velocity;
        });

        geo.setAttribute('aHeat', new THREE.InstancedBufferAttribute(heats, 1));
        geo.setAttribute('aThreat', new THREE.InstancedBufferAttribute(threats, 1));
        geo.setAttribute('aVelocity', new THREE.InstancedBufferAttribute(velocities, 1));

        return geo;
    }, [data, count]);

    // Create shader material
    const material = useMemo(() => {
        return new THREE.ShaderMaterial({
            vertexShader: instancedVertexShader,
            fragmentShader: instancedFragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uColdColor: { value: new THREE.Color(KINETIC_COLORS.cold) },
                uWarmColor: { value: new THREE.Color(KINETIC_COLORS.warm) },
                uHotColor: { value: new THREE.Color(KINETIC_COLORS.hot) },
                uCriticalColor: { value: new THREE.Color(KINETIC_COLORS.critical) },
            },
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
    }, []);

    // Set instance matrices
    useEffect(() => {
        if (!meshRef.current) return;

        const dummy = new THREE.Object3D();

        data.forEach((point, i) => {
            dummy.position.set(...point.position);

            // Scale based on threat level
            const scale = 0.5 + (point.threat / 100) * 1.5;
            dummy.scale.setScalar(scale);

            dummy.updateMatrix();
            meshRef.current!.setMatrixAt(i, dummy.matrix);
        });

        meshRef.current.instanceMatrix.needsUpdate = true;
    }, [data]);

    // Animation loop
    useFrame((state) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
        }
    });

    return (
        <instancedMesh
            ref={meshRef}
            args={[geometry, material, count]}
            frustumCulled={false}
        >
            <primitive object={material} ref={materialRef} attach="material" />
        </instancedMesh>
    );
}

// ====================================
// GRID LINES (CYBERNETIC AESTHETIC)
// ====================================

function GridLines() {
    const gridRef = useRef<THREE.LineSegments>(null);

    const geometry = useMemo(() => {
        const geo = new THREE.BufferGeometry();
        const points: number[] = [];
        const gridSize = 20;
        const divisions = 40;
        const step = gridSize / divisions;

        // Create grid lines
        for (let i = 0; i <= divisions; i++) {
            const pos = -gridSize / 2 + i * step;
            // X lines
            points.push(-gridSize / 2, 0, pos, gridSize / 2, 0, pos);
            // Z lines
            points.push(pos, 0, -gridSize / 2, pos, 0, gridSize / 2);
        }

        geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
        return geo;
    }, []);

    return (
        <lineSegments ref={gridRef} geometry={geometry}>
            <lineBasicMaterial color={KINETIC_COLORS.glassBorder} transparent opacity={0.2} />
        </lineSegments>
    );
}

// ====================================
// CENTRAL THREAT CORE
// ====================================

function ThreatCore({ globalThreat }: { globalThreat: number }) {
    const coreRef = useRef<THREE.Mesh>(null);
    const glowRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (coreRef.current) {
            // Rotation based on threat
            coreRef.current.rotation.y += 0.005 * (1 + globalThreat / 50);
            coreRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
        }

        if (glowRef.current) {
            // Pulse glow
            const pulse = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.2 * (globalThreat / 100);
            glowRef.current.scale.setScalar(pulse);
        }
    });

    const coreColor = useMemo(() => {
        const rgb = heatToRGB(globalThreat);
        return new THREE.Color(rgb[0], rgb[1], rgb[2]);
    }, [globalThreat]);

    return (
        <group position={[0, 2, 0]}>
            {/* Core icosahedron */}
            <mesh ref={coreRef}>
                <icosahedronGeometry args={[0.5, 2]} />
                <meshStandardMaterial
                    color={coreColor}
                    emissive={coreColor}
                    emissiveIntensity={0.5}
                    transparent
                    opacity={0.9}
                    wireframe
                />
            </mesh>

            {/* Glow sphere */}
            <mesh ref={glowRef}>
                <sphereGeometry args={[0.8, 32, 32]} />
                <meshBasicMaterial
                    color={coreColor}
                    transparent
                    opacity={0.15}
                    side={THREE.BackSide}
                />
            </mesh>
        </group>
    );
}

// ====================================
// SCENE COMPONENT
// ====================================

interface QuantumSceneProps {
    data: DataPoint[];
    globalThreat: number;
}

function QuantumScene({ data, globalThreat }: QuantumSceneProps) {
    return (
        <>
            {/* Lighting */}
            <ambientLight intensity={0.3} />
            <pointLight position={[10, 10, 10]} intensity={0.5} color={KINETIC_COLORS.cold} />
            <pointLight position={[-10, 10, -10]} intensity={0.3} color={KINETIC_COLORS.critical} />

            {/* Grid */}
            <GridLines />

            {/* Data points */}
            <InstancedPoints data={data} />

            {/* Central core */}
            <ThreatCore globalThreat={globalThreat} />

            {/* Controls */}
            <OrbitControls
                enableDamping
                dampingFactor={0.05}
                minDistance={5}
                maxDistance={50}
                maxPolarAngle={Math.PI / 2}
            />
        </>
    );
}

// ====================================
// QUANTUM GRID (Main Export)
// ====================================

export default function QuantumGrid({
    data,
    width,
    height,
    className = '',
}: QuantumGridProps) {
    // Calculate global threat from data
    const globalThreat = useMemo(() => {
        if (data.length === 0) return 0;
        return data.reduce((sum, p) => sum + p.threat, 0) / data.length;
    }, [data]);

    return (
        <div
            className={`relative overflow-hidden rounded-xl border border-avenlo-border/30 ${className}`}
            style={{
                width: width || '100%',
                height: height || 500,
                background: KINETIC_COLORS.background,
            }}
        >
            {/* WebGL Canvas */}
            <Canvas
                gl={{
                    antialias: true,
                    alpha: true,
                    powerPreference: 'high-performance',
                }}
                dpr={[1, 2]}
            >
                <PerspectiveCamera makeDefault position={[15, 10, 15]} fov={50} />
                <color attach="background" args={[KINETIC_COLORS.background]} />
                <fog attach="fog" args={[KINETIC_COLORS.background, 20, 60]} />

                <QuantumScene data={data} globalThreat={globalThreat} />
            </Canvas>

            {/* Overlay Stats */}
            <div className="absolute top-4 left-4 flex flex-col gap-2">
                <div className="px-3 py-1.5 rounded-lg bg-avenlo-obsidian/80 backdrop-blur-sm border border-avenlo-border/30">
                    <div className="text-xs text-gray-400 uppercase tracking-wider">Data Points</div>
                    <div className="text-lg font-mono font-bold text-neon-cyan">
                        {data.length.toLocaleString()}
                    </div>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-avenlo-obsidian/80 backdrop-blur-sm border border-avenlo-border/30">
                    <div className="text-xs text-gray-400 uppercase tracking-wider">Global Threat</div>
                    <div className={`text-lg font-mono font-bold ${globalThreat > 75 ? 'text-neon-red' :
                        globalThreat > 50 ? 'text-warning' :
                            'text-neon-cyan'
                        }`}>
                        {globalThreat.toFixed(1)}%
                    </div>
                </div>
            </div>

            {/* GPU Indicator */}
            <div className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-avenlo-obsidian/80 backdrop-blur-sm border border-avenlo-border/30">
                <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
                <span className="text-xs text-gray-400 font-mono">GPU ACCELERATED</span>
            </div>
        </div>
    );
}
