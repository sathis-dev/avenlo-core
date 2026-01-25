// ====================================
// REPUTATION ORBIT
// D3-Force Based Orbital User Visualization
// Users orbit around Trust/Hostile poles based on Shadow Score
// ====================================

import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as d3Force from 'd3-force';
import { ReputationNode, KINETIC_COLORS, reputationToOrbitDistance } from '../../types/kinetic';

// ====================================
// TYPES
// ====================================

interface OrbitNode extends d3Force.SimulationNodeDatum {
  id: string;
  username: string;
  avatar?: string;
  reputation: number;
  pole: 'TRUSTED' | 'NEUTRAL' | 'HOSTILE';
  orbitDistance: number;
  angle: number;
  glowIntensity: number;
  vx?: number;
  vy?: number;
  x?: number;
  y?: number;
}

interface OrbitLink {
  source: OrbitNode | string;
  target: OrbitNode | string;
  index?: number;
  strength: number;
}

// ====================================
// CONSTANTS
// ====================================

const ORBIT_RINGS = [
  { distance: 1, label: 'Core Trust', color: KINETIC_COLORS.trusted },
  { distance: 2, label: 'Trusted', color: KINETIC_COLORS.trusted },
  { distance: 3, label: 'Neutral', color: KINETIC_COLORS.neutral },
  { distance: 4, label: 'Probation', color: KINETIC_COLORS.hot },
  { distance: 5, label: 'Hostile Zone', color: KINETIC_COLORS.hostile },
];

// ====================================
// USER NODE COMPONENT
// ====================================

interface UserNodeProps {
  node: OrbitNode;
  scale: number;
  onHover: (node: OrbitNode | null) => void;
  onClick: (node: OrbitNode) => void;
  isHovered: boolean;
}

function UserNode({ node, scale, onHover, onClick, isHovered }: UserNodeProps) {
  const x = (node.x || 0) * scale;
  const y = (node.y || 0) * scale;
  
  const color = useMemo(() => {
    if (node.reputation >= 70) return KINETIC_COLORS.trusted;
    if (node.reputation >= 40) return KINETIC_COLORS.neutral;
    return KINETIC_COLORS.hostile;
  }, [node.reputation]);
  
  const glowSize = 10 + node.glowIntensity * 20;
  
  return (
    <motion.g
      initial={{ scale: 0, opacity: 0 }}
      animate={{ 
        scale: isHovered ? 1.3 : 1, 
        opacity: 1,
        x,
        y,
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      onMouseEnter={() => onHover(node)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(node)}
      style={{ cursor: 'pointer' }}
    >
      {/* Glow effect */}
      <circle
        r={glowSize}
        fill={color}
        opacity={0.2 + node.glowIntensity * 0.3}
        filter="blur(8px)"
      />
      
      {/* Outer ring */}
      <circle
        r={18}
        fill="none"
        stroke={color}
        strokeWidth={2}
        opacity={0.6}
      />
      
      {/* Avatar or placeholder */}
      {node.avatar ? (
        <clipPath id={`avatar-clip-${node.id}`}>
          <circle r={15} />
        </clipPath>
      ) : null}
      
      <circle
        r={15}
        fill={node.avatar ? 'transparent' : `${color}44`}
      />
      
      {node.avatar && (
        <image
          href={node.avatar}
          x={-15}
          y={-15}
          width={30}
          height={30}
          clipPath={`url(#avatar-clip-${node.id})`}
          style={{ borderRadius: '50%' }}
        />
      )}
      
      {/* Reputation score badge */}
      <g transform="translate(12, 12)">
        <circle r={8} fill={KINETIC_COLORS.background} stroke={color} strokeWidth={1} />
        <text
          textAnchor="middle"
          dominantBaseline="middle"
          fill={color}
          fontSize={8}
          fontWeight="bold"
          fontFamily="monospace"
        >
          {Math.round(node.reputation)}
        </text>
      </g>
    </motion.g>
  );
}

// ====================================
// ORBIT RING COMPONENT
// ====================================

interface OrbitRingProps {
  radius: number;
  label: string;
  color: string;
  centerX: number;
  centerY: number;
}

function OrbitRing({ radius, label, color, centerX, centerY }: OrbitRingProps) {
  return (
    <g>
      {/* Dashed orbit ring */}
      <circle
        cx={centerX}
        cy={centerY}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={1}
        strokeDasharray="4 8"
        opacity={0.3}
      />
      
      {/* Label */}
      <text
        x={centerX + radius + 10}
        y={centerY}
        fill={color}
        fontSize={10}
        opacity={0.5}
        fontFamily="monospace"
      >
        {label}
      </text>
    </g>
  );
}

// ====================================
// CONNECTION LINK COMPONENT
// ====================================

interface ConnectionLinkProps {
  source: OrbitNode;
  target: OrbitNode;
  scale: number;
}

function ConnectionLink({ source, target, scale }: ConnectionLinkProps) {
  const x1 = (source.x || 0) * scale;
  const y1 = (source.y || 0) * scale;
  const x2 = (target.x || 0) * scale;
  const y2 = (target.y || 0) * scale;
  
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={KINETIC_COLORS.glassBorder}
      strokeWidth={1}
      opacity={0.3}
    />
  );
}

// ====================================
// TOOLTIP COMPONENT
// ====================================

interface TooltipProps {
  node: OrbitNode;
  x: number;
  y: number;
}

function Tooltip({ node, x, y }: TooltipProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="absolute pointer-events-none z-50"
      style={{
        left: x + 20,
        top: y - 40,
      }}
    >
      <div className="px-3 py-2 rounded-xl bg-black/90 backdrop-blur-sm border border-white/10 shadow-xl">
        <div className="font-semibold text-white text-sm">{node.username}</div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-gray-400">Reputation:</span>
          <span className={`text-xs font-mono font-bold ${
            node.reputation >= 70 ? 'text-green-400' :
            node.reputation >= 40 ? 'text-gray-400' :
            'text-red-400'
          }`}>
            {node.reputation.toFixed(1)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">Zone:</span>
          <span className={`text-xs font-bold ${
            node.pole === 'TRUSTED' ? 'text-green-400' :
            node.pole === 'NEUTRAL' ? 'text-gray-400' :
            'text-red-400'
          }`}>
            {node.pole}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ====================================
// REPUTATION ORBIT (Main Export)
// ====================================

interface ReputationOrbitProps {
  users: ReputationNode[];
  width?: number;
  height?: number;
  className?: string;
  onUserClick?: (userId: string) => void;
}

export default function ReputationOrbit({
  users,
  width = 600,
  height = 600,
  className = '',
  onUserClick,
}: ReputationOrbitProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<OrbitNode[]>([]);
  const [links, setLinks] = useState<OrbitLink[]>([]);
  const [hoveredNode, setHoveredNode] = useState<OrbitNode | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  const centerX = width / 2;
  const centerY = height / 2;
  const scale = Math.min(width, height) / 12;
  
  // Convert users to simulation nodes
  useEffect(() => {
    const orbitNodes: OrbitNode[] = users.map((user) => {
      const distance = reputationToOrbitDistance(user.reputation);
      const angle = Math.random() * Math.PI * 2;
      
      // Determine pole from trustLevel
      const pole: 'TRUSTED' | 'NEUTRAL' | 'HOSTILE' = 
        user.trustLevel === 'TRUSTED' ? 'TRUSTED' :
        user.trustLevel === 'HOSTILE' ? 'HOSTILE' : 'NEUTRAL';
      
      return {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        reputation: user.reputation,
        pole,
        orbitDistance: distance,
        angle,
        glowIntensity: user.recentActivity,
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
      };
    });
    
    // Create links between connected users
    const orbitLinks: OrbitLink[] = [];
    users.forEach((user) => {
      user.connections.forEach((connId) => {
        const sourceNode = orbitNodes.find(n => n.id === user.id);
        const targetNode = orbitNodes.find(n => n.id === connId);
        if (sourceNode && targetNode) {
          orbitLinks.push({
            source: sourceNode,
            target: targetNode,
            strength: 0.1,
          });
        }
      });
    });
    
    setNodes(orbitNodes);
    setLinks(orbitLinks);
  }, [users]);
  
  // D3 Force simulation
  useEffect(() => {
    if (nodes.length === 0) return;
    
    const simulation = d3Force.forceSimulation(nodes)
      .force('charge', d3Force.forceManyBody().strength(-30))
      .force('radial', d3Force.forceRadial<OrbitNode>(
        (d) => d.orbitDistance,
        0,
        0
      ).strength(0.8))
      .force('collision', d3Force.forceCollide().radius(25))
      .force('link', d3Force.forceLink<OrbitNode, OrbitLink>(links)
        .id(d => d.id)
        .strength(d => d.strength)
      )
      .alphaDecay(0.02)
      .on('tick', () => {
        setNodes([...nodes]);
      });
    
    return () => {
      simulation.stop();
    };
  }, [nodes.length, links.length]);
  
  // Mouse tracking
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) {
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  }, []);
  
  const handleNodeClick = useCallback((node: OrbitNode) => {
    onUserClick?.(node.id);
  }, [onUserClick]);
  
  return (
    <div 
      className={`relative ${className}`}
      style={{ background: KINETIC_COLORS.background }}
      onMouseMove={handleMouseMove}
    >
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        {/* Background gradient */}
        <defs>
          <radialGradient id="orbit-bg-gradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={KINETIC_COLORS.surface} />
            <stop offset="100%" stopColor={KINETIC_COLORS.background} />
          </radialGradient>
        </defs>
        <rect width={width} height={height} fill="url(#orbit-bg-gradient)" />
        
        {/* Orbit rings */}
        {ORBIT_RINGS.map((ring, i) => (
          <OrbitRing
            key={i}
            radius={ring.distance * scale}
            label={ring.label}
            color={ring.color}
            centerX={centerX}
            centerY={centerY}
          />
        ))}
        
        {/* Center core */}
        <circle
          cx={centerX}
          cy={centerY}
          r={15}
          fill={KINETIC_COLORS.trusted}
          opacity={0.8}
        />
        <circle
          cx={centerX}
          cy={centerY}
          r={25}
          fill="none"
          stroke={KINETIC_COLORS.trusted}
          strokeWidth={2}
          opacity={0.3}
        />
        
        {/* Connection links */}
        <g transform={`translate(${centerX}, ${centerY})`}>
          {links.map((link, i) => (
            <ConnectionLink
              key={i}
              source={link.source as OrbitNode}
              target={link.target as OrbitNode}
              scale={scale}
            />
          ))}
        </g>
        
        {/* User nodes */}
        <g transform={`translate(${centerX}, ${centerY})`}>
          {nodes.map((node) => (
            <UserNode
              key={node.id}
              node={node}
              scale={scale}
              onHover={setHoveredNode}
              onClick={handleNodeClick}
              isHovered={hoveredNode?.id === node.id}
            />
          ))}
        </g>
      </svg>
      
      {/* Tooltip */}
      <AnimatePresence>
        {hoveredNode && (
          <Tooltip
            node={hoveredNode}
            x={mousePos.x}
            y={mousePos.y}
          />
        )}
      </AnimatePresence>
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: KINETIC_COLORS.trusted }} />
          <span className="text-xs text-gray-400">Trusted</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: KINETIC_COLORS.neutral }} />
          <span className="text-xs text-gray-400">Neutral</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: KINETIC_COLORS.hostile }} />
          <span className="text-xs text-gray-400">Hostile</span>
        </div>
      </div>
      
      {/* Stats */}
      <div className="absolute top-4 right-4 flex items-center gap-3">
        <div className="px-3 py-1.5 rounded-lg bg-black/50 backdrop-blur-sm border border-white/10">
          <span className="text-xs text-gray-400">Users</span>
          <div className="text-lg font-mono font-bold text-avenlo-cyan">{nodes.length}</div>
        </div>
      </div>
    </div>
  );
}
