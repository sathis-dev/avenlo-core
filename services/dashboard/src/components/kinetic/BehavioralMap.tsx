// ====================================
// BEHAVIORAL MAP
// D3-Force User Interaction Graph
// Node Implosion on Violation
// ====================================

import { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as d3Force from 'd3-force';
import { AlertTriangle, User, Shield, Zap, Eye } from 'lucide-react';
import { KINETIC_COLORS } from '../../types/kinetic';

// ====================================
// TYPES
// ====================================

interface UserNode {
    id: string;
    username: string;
    avatar?: string;
    reputation: number;
    trustLevel: 'TRUSTED' | 'NEUTRAL' | 'PROBATION' | 'HOSTILE';
    messageCount: number;
    isViolating?: boolean;
    imploding?: boolean;
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
    fx?: number | null;
    fy?: number | null;
}

interface InteractionLink {
    source: string | UserNode;
    target: string | UserNode;
    strength: number;
    sentiment: number; // -1 to 1
}

interface BehavioralMapProps {
    users: UserNode[];
    interactions: InteractionLink[];
    width?: number;
    height?: number;
    className?: string;
    onNodeClick?: (user: UserNode) => void;
    onViolation?: (user: UserNode) => void;
}

// ====================================
// COLOR UTILITIES
// ====================================

const getTrustColor = (trustLevel: UserNode['trustLevel']): string => {
    switch (trustLevel) {
        case 'TRUSTED': return KINETIC_COLORS.trusted;
        case 'NEUTRAL': return KINETIC_COLORS.neutral;
        case 'PROBATION': return KINETIC_COLORS.hot;
        case 'HOSTILE': return KINETIC_COLORS.hostile;
    }
};

const getSentimentColor = (sentiment: number): string => {
    if (sentiment > 0.3) return KINETIC_COLORS.trusted;
    if (sentiment < -0.3) return KINETIC_COLORS.hostile;
    return KINETIC_COLORS.neutral;
};

// ====================================
// IMPLOSION PARTICLE
// ====================================

interface ImplosionParticle {
    id: number;
    x: number;
    y: number;
    angle: number;
    distance: number;
    size: number;
    delay: number;
}

function ImplosionEffect({
    x,
    y,
    onComplete
}: {
    x: number;
    y: number;
    onComplete: () => void;
}) {
    const particles: ImplosionParticle[] = useMemo(() => {
        return Array.from({ length: 12 }, (_, i) => ({
            id: i,
            x: x,
            y: y,
            angle: (i / 12) * Math.PI * 2,
            distance: 40 + Math.random() * 20,
            size: 4 + Math.random() * 4,
            delay: Math.random() * 0.1,
        }));
    }, [x, y]);

    useEffect(() => {
        const timer = setTimeout(onComplete, 800);
        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <g>
            {/* Shockwave ring */}
            <motion.circle
                cx={x}
                cy={y}
                r={10}
                fill="none"
                stroke={KINETIC_COLORS.critical}
                strokeWidth={2}
                initial={{ r: 10, opacity: 1, strokeWidth: 3 }}
                animate={{ r: 60, opacity: 0, strokeWidth: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
            />

            {/* Imploding particles */}
            {particles.map((particle) => (
                <motion.circle
                    key={particle.id}
                    cx={x + Math.cos(particle.angle) * particle.distance}
                    cy={y + Math.sin(particle.angle) * particle.distance}
                    r={particle.size}
                    fill={KINETIC_COLORS.critical}
                    initial={{
                        cx: x + Math.cos(particle.angle) * particle.distance,
                        cy: y + Math.sin(particle.angle) * particle.distance,
                        opacity: 1,
                        r: particle.size,
                    }}
                    animate={{
                        cx: x,
                        cy: y,
                        opacity: 0,
                        r: 0,
                    }}
                    transition={{
                        duration: 0.4,
                        delay: particle.delay,
                        ease: 'easeIn',
                    }}
                />
            ))}

            {/* Core flash */}
            <motion.circle
                cx={x}
                cy={y}
                r={5}
                fill={KINETIC_COLORS.critical}
                initial={{ r: 5, opacity: 1 }}
                animate={{ r: 0, opacity: 0 }}
                transition={{ duration: 0.3, delay: 0.3 }}
            />
        </g>
    );
}

// ====================================
// USER NODE COMPONENT
// ====================================

function UserNodeElement({
    node,
    scale,
    isHovered,
    onHover,
    onClick,
}: {
    node: UserNode;
    scale: number;
    isHovered: boolean;
    onHover: (node: UserNode | null) => void;
    onClick: (node: UserNode) => void;
}) {
    const color = getTrustColor(node.trustLevel);
    const nodeRadius = 12 + (node.messageCount / 10);
    const x = node.x ?? 0;
    const y = node.y ?? 0;

    if (node.imploding) return null;

    return (
        <g
            transform={`translate(${x}, ${y})`}
            onMouseEnter={() => onHover(node)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onClick(node)}
            style={{ cursor: 'pointer' }}
        >
            {/* Glow for hovered/violating */}
            {(isHovered || node.isViolating) && (
                <motion.circle
                    r={nodeRadius + 8}
                    fill={node.isViolating ? KINETIC_COLORS.critical : color}
                    opacity={0.2}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                />
            )}

            {/* Reputation ring */}
            <circle
                r={nodeRadius + 3}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeDasharray={`${(node.reputation / 100) * (2 * Math.PI * (nodeRadius + 3))} ${2 * Math.PI * (nodeRadius + 3)}`}
                transform="rotate(-90)"
                opacity={0.6}
            />

            {/* Main node */}
            <motion.circle
                r={nodeRadius}
                fill={KINETIC_COLORS.surface}
                stroke={color}
                strokeWidth={2}
                animate={node.isViolating ? {
                    stroke: [color, KINETIC_COLORS.critical, color],
                    scale: [1, 1.1, 1],
                } : {}}
                transition={node.isViolating ? { duration: 0.3, repeat: Infinity } : {}}
            />

            {/* Avatar or initial */}
            <text
                textAnchor="middle"
                dominantBaseline="central"
                fill={color}
                fontSize={nodeRadius * 0.8}
                fontWeight="bold"
            >
                {node.username.charAt(0).toUpperCase()}
            </text>

            {/* Username label */}
            {isHovered && (
                <motion.g
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <rect
                        x={-50}
                        y={nodeRadius + 8}
                        width={100}
                        height={22}
                        rx={4}
                        fill={KINETIC_COLORS.surface}
                        stroke={color}
                        strokeWidth={1}
                        opacity={0.9}
                    />
                    <text
                        textAnchor="middle"
                        y={nodeRadius + 22}
                        fill="white"
                        fontSize={10}
                    >
                        {node.username}
                    </text>
                </motion.g>
            )}

            {/* Violation indicator */}
            {node.isViolating && (
                <motion.g
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                >
                    <circle
                        cx={nodeRadius * 0.7}
                        cy={-nodeRadius * 0.7}
                        r={6}
                        fill={KINETIC_COLORS.critical}
                    />
                    <AlertTriangle
                        x={nodeRadius * 0.7 - 4}
                        y={-nodeRadius * 0.7 - 4}
                        width={8}
                        height={8}
                        color="white"
                    />
                </motion.g>
            )}
        </g>
    );
}

// ====================================
// BEHAVIORAL MAP COMPONENT
// ====================================

export default function BehavioralMap({
    users,
    interactions,
    width = 800,
    height = 600,
    className = '',
    onNodeClick,
    onViolation,
}: BehavioralMapProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const [nodes, setNodes] = useState<UserNode[]>([]);
    const [links, setLinks] = useState<InteractionLink[]>([]);
    const [hoveredNode, setHoveredNode] = useState<UserNode | null>(null);
    const [implosions, setImplosions] = useState<{ id: string; x: number; y: number }[]>([]);
    const simulationRef = useRef<d3Force.Simulation<UserNode, InteractionLink> | null>(null);

    // Initialize simulation
    useEffect(() => {
        const simulation = d3Force.forceSimulation<UserNode>(users)
            .force('link', d3Force.forceLink<UserNode, InteractionLink>(interactions)
                .id(d => d.id)
                .distance(100)
                .strength(d => d.strength * 0.5)
            )
            .force('charge', d3Force.forceManyBody().strength(-200))
            .force('center', d3Force.forceCenter(width / 2, height / 2))
            .force('collision', d3Force.forceCollide().radius(30))
            .on('tick', () => {
                setNodes([...simulation.nodes()]);
                setLinks([...(simulation.force<d3Force.ForceLink<UserNode, InteractionLink>>('link')?.links() ?? [])]);
            });

        simulationRef.current = simulation;

        return () => {
            simulation.stop();
        };
    }, [users, interactions, width, height]);

    // Handle node violation/implosion
    const triggerImplosion = useCallback((user: UserNode) => {
        const node = nodes.find(n => n.id === user.id);
        if (!node || node.x === undefined || node.y === undefined) return;

        // Add implosion effect
        setImplosions(prev => [...prev, { id: node.id, x: node.x!, y: node.y! }]);

        // Mark node as imploding
        setNodes(prev => prev.map(n =>
            n.id === user.id ? { ...n, imploding: true } : n
        ));

        // Trigger callback
        onViolation?.(user);
    }, [nodes, onViolation]);

    // Remove implosion after animation
    const removeImplosion = useCallback((id: string) => {
        setImplosions(prev => prev.filter(i => i.id !== id));
    }, []);

    // Expose trigger method
    useEffect(() => {
        // Check for violating users and trigger implosion
        const violatingUser = users.find(u => u.isViolating && !nodes.find(n => n.id === u.id && n.imploding));
        if (violatingUser) {
            triggerImplosion(violatingUser);
        }
    }, [users, nodes, triggerImplosion]);

    return (
        <div
            className={`relative overflow-hidden rounded-xl border border-avenlo-border/30 ${className}`}
            style={{
                width,
                height,
                background: KINETIC_COLORS.background,
            }}
        >
            <svg
                ref={svgRef}
                width={width}
                height={height}
                className="absolute inset-0"
            >
                <defs>
                    {/* Glow filter */}
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Interaction links */}
                <g className="links">
                    {links.map((link, i) => {
                        const source = link.source as UserNode;
                        const target = link.target as UserNode;
                        if (!source.x || !source.y || !target.x || !target.y) return null;

                        const color = getSentimentColor(link.sentiment);

                        return (
                            <motion.line
                                key={`${source.id}-${target.id}-${i}`}
                                x1={source.x}
                                y1={source.y}
                                x2={target.x}
                                y2={target.y}
                                stroke={color}
                                strokeWidth={1 + link.strength * 2}
                                strokeOpacity={0.3}
                                initial={{ pathLength: 0 }}
                                animate={{ pathLength: 1 }}
                                transition={{ duration: 0.5 }}
                            />
                        );
                    })}
                </g>

                {/* User nodes */}
                <g className="nodes">
                    {nodes.map((node) => (
                        <UserNodeElement
                            key={node.id}
                            node={node}
                            scale={1}
                            isHovered={hoveredNode?.id === node.id}
                            onHover={setHoveredNode}
                            onClick={(n) => onNodeClick?.(n)}
                        />
                    ))}
                </g>

                {/* Implosion effects */}
                <g className="implosions">
                    <AnimatePresence>
                        {implosions.map((imp) => (
                            <ImplosionEffect
                                key={imp.id}
                                x={imp.x}
                                y={imp.y}
                                onComplete={() => removeImplosion(imp.id)}
                            />
                        ))}
                    </AnimatePresence>
                </g>
            </svg>

            {/* Legend */}
            <div className="absolute top-4 left-4 flex flex-col gap-2 p-3 rounded-lg bg-avenlo-obsidian/80 backdrop-blur-sm border border-avenlo-border/30">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    Trust Levels
                </div>
                {(['TRUSTED', 'NEUTRAL', 'PROBATION', 'HOSTILE'] as const).map((level) => (
                    <div key={level} className="flex items-center gap-2">
                        <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: getTrustColor(level) }}
                        />
                        <span className="text-xs text-gray-400 capitalize">{level.toLowerCase()}</span>
                    </div>
                ))}
            </div>

            {/* Stats */}
            <div className="absolute top-4 right-4 flex flex-col gap-2 p-3 rounded-lg bg-avenlo-obsidian/80 backdrop-blur-sm border border-avenlo-border/30">
                <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-neon-cyan" />
                    <span className="text-sm font-mono text-white">{nodes.length}</span>
                    <span className="text-xs text-gray-500">users</span>
                </div>
                <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-warning" />
                    <span className="text-sm font-mono text-white">{links.length}</span>
                    <span className="text-xs text-gray-500">connections</span>
                </div>
            </div>

            {/* Hovered user tooltip */}
            <AnimatePresence>
                {hoveredNode && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-3 rounded-lg bg-avenlo-obsidian/90 backdrop-blur-sm border border-avenlo-border/30"
                    >
                        <div className="flex items-center gap-3">
                            <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
                                style={{ backgroundColor: getTrustColor(hoveredNode.trustLevel) }}
                            >
                                {hoveredNode.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div className="font-semibold text-white">{hoveredNode.username}</div>
                                <div className="text-xs text-gray-400">
                                    Rep: {hoveredNode.reputation} | Messages: {hoveredNode.messageCount}
                                </div>
                            </div>
                            <div
                                className="px-2 py-1 rounded text-xs font-mono"
                                style={{
                                    backgroundColor: `${getTrustColor(hoveredNode.trustLevel)}20`,
                                    color: getTrustColor(hoveredNode.trustLevel),
                                }}
                            >
                                {hoveredNode.trustLevel}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
