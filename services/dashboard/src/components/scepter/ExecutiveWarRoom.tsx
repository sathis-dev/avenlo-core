// ====================================
// EXECUTIVE WAR ROOM
// Scepter-Class Sovereign Command Center
// 3D Sentiment Topology + Gold-Pulse Interface
// ====================================

import { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Sphere, Html, Float } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Crown,
    Shield,
    Zap,
    AlertTriangle,
    Check,
    X,
    ChevronUp,
    Globe,
    Activity,
    Users,
    TrendingUp,
    Clock,
} from 'lucide-react';

// ====================================
// SCEPTER COLOR PALETTE
// ====================================

const SCEPTER_COLORS = {
    obsidian: '#050505',
    champagneGold: '#D4AF37',
    goldLight: '#F5E6A3',
    goldDark: '#8B7355',
    danger: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    cold: '#00D4FF',
    glass: 'rgba(10, 10, 15, 0.85)',
    glassBorder: 'rgba(212, 175, 55, 0.3)',
};

// ====================================
// TYPES
// ====================================

interface ChannelSector {
    id: string;
    name: string;
    heat: number;
    userCount: number;
    messageVelocity: number;
    position: [number, number, number]; // Spherical position
    sentiment: number; // -1 to 1
}

interface GlobalMetrics {
    totalUsers: number;
    activeUsers24h: number;
    messageCount24h: number;
    averageHeat: number;
    threatLevel: 'MINIMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
    topContributors: { id: string; username: string; score: number }[];
    recentInfractions: number;
}

interface SovereignGavelAction {
    id: string;
    type: 'CONFIRM' | 'OVERRIDE' | 'ESCALATE';
    userId: string;
    username: string;
    infractionType: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    aiReasoning: string;
    confidence: number;
    timestamp: number;
}

interface ExecutiveWarRoomProps {
    channels: ChannelSector[];
    metrics: GlobalMetrics;
    pendingAction?: SovereignGavelAction;
    onGavelAction?: (actionId: string, decision: 'CONFIRM' | 'OVERRIDE' | 'ESCALATE') => void;
    onChannelFocus?: (channelId: string) => void;
}

// ====================================
// CHANNEL HEAT POINT (3D)
// ====================================

function ChannelHeatPoint({
    sector,
    onClick
}: {
    sector: ChannelSector;
    onClick: () => void;
}) {
    const meshRef = useRef<THREE.Mesh>(null);
    const glowRef = useRef<THREE.Mesh>(null);
    const [hovered, setHovered] = useState(false);

    // Convert spherical to cartesian
    const position = useMemo(() => {
        const radius = 2;
        const phi = sector.position[0];
        const theta = sector.position[1];
        return [
            radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.cos(phi),
            radius * Math.sin(phi) * Math.sin(theta),
        ] as [number, number, number];
    }, [sector.position]);

    // Heat-based color
    const color = useMemo(() => {
        if (sector.heat > 75) return new THREE.Color(SCEPTER_COLORS.danger);
        if (sector.heat > 50) return new THREE.Color(SCEPTER_COLORS.warning);
        if (sector.heat > 25) return new THREE.Color(SCEPTER_COLORS.champagneGold);
        return new THREE.Color(SCEPTER_COLORS.cold);
    }, [sector.heat]);

    useFrame((state) => {
        if (meshRef.current) {
            // Pulse based on heat
            const pulse = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.1 * (sector.heat / 100);
            meshRef.current.scale.setScalar(pulse);
        }

        if (glowRef.current) {
            glowRef.current.scale.setScalar(1 + sector.heat / 100);
        }
    });

    return (
        <group position={position}>
            {/* Glow */}
            <mesh ref={glowRef}>
                <sphereGeometry args={[0.15, 16, 16]} />
                <meshBasicMaterial color={color} transparent opacity={0.2} />
            </mesh>

            {/* Core */}
            <mesh
                ref={meshRef}
                onClick={onClick}
                onPointerEnter={() => setHovered(true)}
                onPointerLeave={() => setHovered(false)}
            >
                <sphereGeometry args={[0.08, 16, 16]} />
                <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={0.5}
                />
            </mesh>

            {/* Label on hover */}
            {hovered && (
                <Html distanceFactor={5}>
                    <div className="px-3 py-2 rounded-lg bg-avenlo-obsidian/90 border border-scepter-gold/30 backdrop-blur-sm whitespace-nowrap">
                        <div className="text-sm font-semibold text-scepter-gold">{sector.name}</div>
                        <div className="text-xs text-gray-400">
                            Heat: {sector.heat}% | Users: {sector.userCount}
                        </div>
                    </div>
                </Html>
            )}
        </group>
    );
}

// ====================================
// GLOBE CORE
// ====================================

function GlobeCore({ globalHeat }: { globalHeat: number }) {
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (meshRef.current) {
            meshRef.current.rotation.y += 0.002;
        }
    });

    const coreColor = useMemo(() => {
        if (globalHeat > 75) return new THREE.Color(SCEPTER_COLORS.danger);
        if (globalHeat > 50) return new THREE.Color(SCEPTER_COLORS.warning);
        return new THREE.Color(SCEPTER_COLORS.champagneGold);
    }, [globalHeat]);

    return (
        <group>
            {/* Wireframe globe */}
            <mesh ref={meshRef}>
                <sphereGeometry args={[1.8, 32, 32]} />
                <meshBasicMaterial
                    color={coreColor}
                    wireframe
                    transparent
                    opacity={0.1}
                />
            </mesh>

            {/* Inner glow */}
            <mesh>
                <sphereGeometry args={[1.75, 32, 32]} />
                <meshBasicMaterial
                    color={coreColor}
                    transparent
                    opacity={0.05}
                    side={THREE.BackSide}
                />
            </mesh>
        </group>
    );
}

// ====================================
// 3D SENTIMENT TOPOLOGY SCENE
// ====================================

function SentimentTopologyScene({
    channels,
    globalHeat,
    onChannelClick,
}: {
    channels: ChannelSector[];
    globalHeat: number;
    onChannelClick: (id: string) => void;
}) {
    return (
        <>
            {/* Lighting */}
            <ambientLight intensity={0.3} />
            <pointLight position={[10, 10, 10]} intensity={0.5} color={SCEPTER_COLORS.champagneGold} />
            <pointLight position={[-10, -10, -10]} intensity={0.3} color={SCEPTER_COLORS.cold} />

            {/* Globe */}
            <GlobeCore globalHeat={globalHeat} />

            {/* Channel points */}
            {channels.map((sector) => (
                <ChannelHeatPoint
                    key={sector.id}
                    sector={sector}
                    onClick={() => onChannelClick(sector.id)}
                />
            ))}

            {/* Controls */}
            <OrbitControls
                enablePan={false}
                minDistance={4}
                maxDistance={10}
                autoRotate
                autoRotateSpeed={0.3}
            />

            {/* Post-processing */}
            <EffectComposer>
                <Bloom
                    intensity={0.5}
                    luminanceThreshold={0.3}
                    luminanceSmoothing={0.9}
                />
                <ChromaticAberration
                    blendFunction={BlendFunction.NORMAL}
                    offset={new THREE.Vector2(0.001, 0.001)}
                />
            </EffectComposer>
        </>
    );
}

// ====================================
// SOVEREIGN GAVEL DECISION CARD
// ====================================

function SovereignGavel({
    action,
    onDecision,
}: {
    action: SovereignGavelAction;
    onDecision: (decision: 'CONFIRM' | 'OVERRIDE' | 'ESCALATE') => void;
}) {
    const severityColors = {
        LOW: SCEPTER_COLORS.cold,
        MEDIUM: SCEPTER_COLORS.warning,
        HIGH: SCEPTER_COLORS.danger,
        CRITICAL: '#FF0040',
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ backdropFilter: 'blur(50px)' }}
        >
            <motion.div
                className="w-[500px] rounded-2xl overflow-hidden border-2"
                style={{
                    background: SCEPTER_COLORS.glass,
                    borderColor: severityColors[action.severity],
                    boxShadow: `0 0 60px ${severityColors[action.severity]}40`,
                }}
                layoutId="gavel-card"
            >
                {/* Header */}
                <div
                    className="px-6 py-4 flex items-center gap-4"
                    style={{
                        background: `linear-gradient(135deg, ${severityColors[action.severity]}20, transparent)`,
                        borderBottom: `1px solid ${severityColors[action.severity]}30`,
                    }}
                >
                    <motion.div
                        animate={{
                            boxShadow: [
                                `0 0 10px ${SCEPTER_COLORS.champagneGold}`,
                                `0 0 30px ${SCEPTER_COLORS.champagneGold}`,
                                `0 0 10px ${SCEPTER_COLORS.champagneGold}`,
                            ],
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="p-3 rounded-xl"
                        style={{ background: `${SCEPTER_COLORS.champagneGold}20` }}
                    >
                        <Crown className="w-6 h-6" style={{ color: SCEPTER_COLORS.champagneGold }} />
                    </motion.div>
                    <div>
                        <h3 className="text-lg font-bold" style={{ color: SCEPTER_COLORS.champagneGold }}>
                            SOVEREIGN GAVEL
                        </h3>
                        <p className="text-sm text-gray-400">Executive Decision Required</p>
                    </div>
                    <div
                        className="ml-auto px-3 py-1 rounded-full text-xs font-bold uppercase"
                        style={{
                            background: `${severityColors[action.severity]}20`,
                            color: severityColors[action.severity],
                        }}
                    >
                        {action.severity}
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {/* User Info */}
                    <div className="flex items-center gap-3">
                        <div
                            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
                            style={{ background: severityColors[action.severity] }}
                        >
                            {action.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div className="font-semibold text-white">{action.username}</div>
                            <div className="text-xs text-gray-500">{action.infractionType}</div>
                        </div>
                        <div className="ml-auto text-right">
                            <div className="text-sm font-mono" style={{ color: SCEPTER_COLORS.champagneGold }}>
                                {action.confidence}% Confidence
                            </div>
                            <div className="text-xs text-gray-500">AI Analysis</div>
                        </div>
                    </div>

                    {/* AI Reasoning */}
                    <div
                        className="p-4 rounded-xl border"
                        style={{
                            background: 'rgba(0,0,0,0.3)',
                            borderColor: 'rgba(255,255,255,0.1)',
                        }}
                    >
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">AI Reasoning</div>
                        <p className="text-sm text-gray-300 font-mono">{action.aiReasoning}</p>
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-3 gap-3 pt-4">
                        {/* Confirm */}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => onDecision('CONFIRM')}
                            className="flex flex-col items-center gap-2 p-4 rounded-xl border transition-all"
                            style={{
                                background: `${SCEPTER_COLORS.success}10`,
                                borderColor: `${SCEPTER_COLORS.success}30`,
                            }}
                        >
                            <Check className="w-6 h-6" style={{ color: SCEPTER_COLORS.success }} />
                            <span className="text-sm font-semibold" style={{ color: SCEPTER_COLORS.success }}>
                                Confirm
                            </span>
                            <span className="text-xs text-gray-500">Execute AI Action</span>
                        </motion.button>

                        {/* Override */}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => onDecision('OVERRIDE')}
                            className="flex flex-col items-center gap-2 p-4 rounded-xl border transition-all"
                            style={{
                                background: `${SCEPTER_COLORS.warning}10`,
                                borderColor: `${SCEPTER_COLORS.warning}30`,
                            }}
                        >
                            <X className="w-6 h-6" style={{ color: SCEPTER_COLORS.warning }} />
                            <span className="text-sm font-semibold" style={{ color: SCEPTER_COLORS.warning }}>
                                Override
                            </span>
                            <span className="text-xs text-gray-500">Leniency</span>
                        </motion.button>

                        {/* Escalate */}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => onDecision('ESCALATE')}
                            className="flex flex-col items-center gap-2 p-4 rounded-xl border transition-all"
                            style={{
                                background: `${SCEPTER_COLORS.danger}10`,
                                borderColor: `${SCEPTER_COLORS.danger}30`,
                            }}
                        >
                            <ChevronUp className="w-6 h-6" style={{ color: SCEPTER_COLORS.danger }} />
                            <span className="text-sm font-semibold" style={{ color: SCEPTER_COLORS.danger }}>
                                Escalate
                            </span>
                            <span className="text-xs text-gray-500">Hard Ban + Pattern</span>
                        </motion.button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ====================================
// EXECUTIVE METRICS PANEL
// ====================================

function ExecutiveMetrics({ metrics }: { metrics: GlobalMetrics }) {
    const threatColors = {
        MINIMAL: SCEPTER_COLORS.success,
        ELEVATED: SCEPTER_COLORS.warning,
        HIGH: SCEPTER_COLORS.danger,
        CRITICAL: '#FF0040',
    };

    return (
        <div className="grid grid-cols-4 gap-4">
            {[
                { icon: Users, label: 'Total Users', value: metrics.totalUsers.toLocaleString() },
                { icon: Activity, label: 'Active 24h', value: metrics.activeUsers24h.toLocaleString() },
                { icon: TrendingUp, label: 'Messages 24h', value: metrics.messageCount24h.toLocaleString() },
                { icon: Zap, label: 'Avg Heat', value: `${metrics.averageHeat.toFixed(1)}%` },
            ].map((stat, i) => (
                <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="p-4 rounded-xl border"
                    style={{
                        background: SCEPTER_COLORS.glass,
                        borderColor: SCEPTER_COLORS.glassBorder,
                    }}
                >
                    <stat.icon className="w-5 h-5 mb-2" style={{ color: SCEPTER_COLORS.champagneGold }} />
                    <div className="text-2xl font-bold text-white font-mono">{stat.value}</div>
                    <div className="text-xs text-gray-500">{stat.label}</div>
                </motion.div>
            ))}
        </div>
    );
}

// ====================================
// EXECUTIVE WAR ROOM (Main Export)
// ====================================

export default function ExecutiveWarRoom({
    channels,
    metrics,
    pendingAction,
    onGavelAction,
    onChannelFocus,
}: ExecutiveWarRoomProps) {
    return (
        <div
            className="min-h-screen p-6"
            style={{ background: SCEPTER_COLORS.obsidian }}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <motion.div
                        animate={{
                            boxShadow: [
                                `0 0 10px ${SCEPTER_COLORS.champagneGold}`,
                                `0 0 25px ${SCEPTER_COLORS.champagneGold}`,
                                `0 0 10px ${SCEPTER_COLORS.champagneGold}`,
                            ],
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="p-3 rounded-xl"
                        style={{ background: `${SCEPTER_COLORS.champagneGold}15` }}
                    >
                        <Crown className="w-8 h-8" style={{ color: SCEPTER_COLORS.champagneGold }} />
                    </motion.div>
                    <div>
                        <h1
                            className="text-2xl font-bold"
                            style={{ color: SCEPTER_COLORS.champagneGold }}
                        >
                            EXECUTIVE WAR ROOM
                        </h1>
                        <p className="text-sm text-gray-500">Scepter-Class • Sovereign Command Center</p>
                    </div>
                </div>

                {/* Threat Level */}
                <div
                    className="px-4 py-2 rounded-xl border flex items-center gap-3"
                    style={{
                        background: `${metrics.threatLevel === 'CRITICAL' ? SCEPTER_COLORS.danger : SCEPTER_COLORS.champagneGold}10`,
                        borderColor: `${metrics.threatLevel === 'CRITICAL' ? SCEPTER_COLORS.danger : SCEPTER_COLORS.champagneGold}30`,
                    }}
                >
                    <Shield
                        className="w-5 h-5"
                        style={{ color: metrics.threatLevel === 'CRITICAL' ? SCEPTER_COLORS.danger : SCEPTER_COLORS.champagneGold }}
                    />
                    <div>
                        <div className="text-xs text-gray-500 uppercase">Threat Level</div>
                        <div
                            className="font-bold font-mono"
                            style={{ color: metrics.threatLevel === 'CRITICAL' ? SCEPTER_COLORS.danger : SCEPTER_COLORS.champagneGold }}
                        >
                            {metrics.threatLevel}
                        </div>
                    </div>
                </div>
            </div>

            {/* Metrics */}
            <ExecutiveMetrics metrics={metrics} />

            {/* Main Content */}
            <div className="grid grid-cols-3 gap-6 mt-6">
                {/* 3D Topology */}
                <div
                    className="col-span-2 rounded-2xl overflow-hidden border"
                    style={{
                        height: 500,
                        background: SCEPTER_COLORS.glass,
                        borderColor: SCEPTER_COLORS.glassBorder,
                    }}
                >
                    <div
                        className="px-4 py-3 flex items-center gap-2 border-b"
                        style={{ borderColor: SCEPTER_COLORS.glassBorder }}
                    >
                        <Globe className="w-4 h-4" style={{ color: SCEPTER_COLORS.champagneGold }} />
                        <span className="text-sm font-semibold" style={{ color: SCEPTER_COLORS.champagneGold }}>
                            Global Sentiment Topology
                        </span>
                    </div>
                    <div style={{ height: 'calc(100% - 48px)' }}>
                        <Canvas
                            gl={{ antialias: true, alpha: true }}
                            dpr={[1, 2]}
                        >
                            <PerspectiveCamera makeDefault position={[0, 0, 6]} fov={50} />
                            <color attach="background" args={[SCEPTER_COLORS.obsidian]} />

                            <SentimentTopologyScene
                                channels={channels}
                                globalHeat={metrics.averageHeat}
                                onChannelClick={(id) => onChannelFocus?.(id)}
                            />
                        </Canvas>
                    </div>
                </div>

                {/* Top Contributors */}
                <div
                    className="rounded-2xl overflow-hidden border"
                    style={{
                        background: SCEPTER_COLORS.glass,
                        borderColor: SCEPTER_COLORS.glassBorder,
                    }}
                >
                    <div
                        className="px-4 py-3 flex items-center gap-2 border-b"
                        style={{ borderColor: SCEPTER_COLORS.glassBorder }}
                    >
                        <TrendingUp className="w-4 h-4" style={{ color: SCEPTER_COLORS.champagneGold }} />
                        <span className="text-sm font-semibold" style={{ color: SCEPTER_COLORS.champagneGold }}>
                            Cultural Catalysts
                        </span>
                    </div>
                    <div className="p-4 space-y-3">
                        {metrics.topContributors.map((user, i) => (
                            <motion.div
                                key={user.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="flex items-center gap-3 p-3 rounded-xl"
                                style={{ background: 'rgba(0,0,0,0.3)' }}
                            >
                                <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                                    style={{
                                        background: i === 0 ? SCEPTER_COLORS.champagneGold : 'rgba(255,255,255,0.1)',
                                        color: i === 0 ? SCEPTER_COLORS.obsidian : 'white',
                                    }}
                                >
                                    {i + 1}
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm font-semibold text-white">{user.username}</div>
                                    <div className="text-xs text-gray-500">Score: {user.score}</div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sovereign Gavel Overlay */}
            <AnimatePresence>
                {pendingAction && (
                    <SovereignGavel
                        action={pendingAction}
                        onDecision={(decision) => onGavelAction?.(pendingAction.id, decision)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
