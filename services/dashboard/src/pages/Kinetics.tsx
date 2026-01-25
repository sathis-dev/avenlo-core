// ====================================
// SOVEREIGN KINETICS PAGE
// Predictive Intelligence Command Center
// WebGL + D3 + Canvas Unified Interface
// ====================================

import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, 
  Activity, 
  Users, 
  Zap, 
  AlertTriangle,
  TrendingUp,
  Eye,
  Target,
  Radio,
  Gauge,
  Clock,
  ChevronRight,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { NeuralHeatPrism, ReputationOrbit, ForensicScrubber } from '../components/kinetic';
import { 
  ChannelHeatNode, 
  ReputationNode, 
  WaveformPoint, 
  TimelineEvent,
  ThreatLevelString,
  KINETIC_COLORS
} from '../types/kinetic';

// ====================================
// MOCK DATA GENERATORS
// ====================================

function generateMockChannels(): ChannelHeatNode[] {
  const channels = [
    'general', 'off-topic', 'memes', 'help', 'announcements',
    'voice-1', 'gaming', 'music', 'art', 'coding'
  ];
  
  return channels.map((name, i) => {
    const heat = Math.random() * 100;
    return {
      id: `ch-${i}`,
      name,
      heat,
      messageVelocity: Math.floor(Math.random() * 50),
      activeUsers: Math.floor(Math.random() * 30),
      sentimentScore: Math.random() * 2 - 1,
      position: [0, 0, 0] as [number, number, number],
      fractureLevel: heat / 100,
      particleEmission: heat / 20,
      threatLevel: {
        currentScore: heat,
        predicted5m: heat + (Math.random() - 0.5) * 20,
        predicted15m: heat + (Math.random() - 0.5) * 30,
        predicted30m: heat + (Math.random() - 0.5) * 40,
        confidence: 0.8 + Math.random() * 0.2,
        weights: { alpha: 0.4, beta: 0.35, gamma: 0.25 },
      },
    };
  });
}

function generateMockUsers(): ReputationNode[] {
  const names = [
    'CyberNova', 'ShadowPhoenix', 'QuantumDrift', 'NightHawk', 'StormRider',
    'PixelSage', 'TechWraith', 'DataMancer', 'CodeVortex', 'ByteGuardian',
    'NeonPulse', 'CryptoSeer', 'VoidWalker', 'IronClad', 'FluxMaster'
  ];
  
  return names.map((name, i) => ({
    id: `user-${i}`,
    username: name,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
    reputation: Math.random() * 100,
    trustLevel: ['TRUSTED', 'NEUTRAL', 'PROBATION', 'HOSTILE'][Math.floor(Math.random() * 4)] as any,
    messageCount: Math.floor(Math.random() * 1000),
    recentActivity: Math.random(),
    connections: [],
  }));
}

function generateMockWaveform(): WaveformPoint[] {
  const now = Date.now();
  const duration = 30 * 60 * 1000; // 30 minutes
  const points: WaveformPoint[] = [];
  
  for (let i = 0; i < 300; i++) {
    const timestamp = now - duration + (i / 300) * duration;
    const baseHeat = 30 + Math.sin(i / 20) * 20;
    const spike = Math.random() > 0.95 ? Math.random() * 50 : 0;
    
    const events: TimelineEvent[] = [];
    if (spike > 30) {
      events.push({
        type: 'HEAT_SPIKE',
        timestamp,
        severity: spike > 40 ? 'CRITICAL' : 'HIGH',
        content: 'Sudden activity spike detected',
      });
    }
    if (Math.random() > 0.98) {
      events.push({
        type: 'INFRACTION',
        timestamp,
        severity: 'MEDIUM',
        content: 'Potential rule violation',
      });
    }
    
    points.push({
      timestamp,
      heat: Math.min(100, baseHeat + spike),
      sentiment: Math.sin(i / 15) * 0.5 + (Math.random() - 0.5) * 0.3,
      events,
    });
  }
  
  return points;
}

// ====================================
// STAT CARD
// ====================================

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtext?: string;
  color: string;
  trend?: 'up' | 'down' | 'stable';
}

function StatCard({ icon: Icon, label, value, subtext, color, trend }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative p-4 rounded-xl overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${color}15, ${KINETIC_COLORS.background})`,
        border: `1px solid ${color}30`,
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {subtext && (
            <p className="text-xs text-gray-500 mt-1">{subtext}</p>
          )}
        </div>
        <div 
          className="p-2 rounded-lg"
          style={{ background: `${color}20` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
      
      {trend && (
        <div className="absolute bottom-2 right-2">
          <TrendingUp 
            className={`w-4 h-4 ${
              trend === 'up' ? 'text-green-400' : 
              trend === 'down' ? 'text-red-400 rotate-180' : 
              'text-gray-400'
            }`}
          />
        </div>
      )}
    </motion.div>
  );
}

// ====================================
// THREAT INDICATOR
// ====================================

interface ThreatIndicatorProps {
  level: ThreatLevelString;
}

function ThreatIndicator({ level }: ThreatIndicatorProps) {
  const config = {
    MINIMAL: { color: KINETIC_COLORS.cold, label: 'Minimal', icon: Eye },
    ELEVATED: { color: KINETIC_COLORS.warm, label: 'Elevated', icon: Activity },
    HIGH: { color: KINETIC_COLORS.hot, label: 'High', icon: AlertTriangle },
    CRITICAL: { color: KINETIC_COLORS.critical, label: 'Critical', icon: Zap },
    IMMINENT: { color: '#ff0000', label: 'IMMINENT', icon: Target },
  }[level];
  
  const Icon = config.icon;
  
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="relative flex items-center gap-3 px-4 py-3 rounded-xl overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${config.color}20, transparent)`,
        border: `1px solid ${config.color}50`,
      }}
    >
      {/* Pulse animation for critical levels */}
      {(level === 'CRITICAL' || level === 'IMMINENT') && (
        <motion.div
          className="absolute inset-0"
          animate={{ opacity: [0.1, 0.3, 0.1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          style={{ background: config.color }}
        />
      )}
      
      <div className="relative">
        <Icon className="w-6 h-6" style={{ color: config.color }} />
      </div>
      
      <div className="relative">
        <p className="text-xs text-gray-400">Threat Assessment</p>
        <p 
          className="text-lg font-bold tracking-wide"
          style={{ color: config.color }}
        >
          {config.label}
        </p>
      </div>
      
      <div className="ml-auto relative">
        <Gauge 
          className="w-8 h-8" 
          style={{ 
            color: config.color,
            transform: `rotate(${
              level === 'MINIMAL' ? -90 :
              level === 'ELEVATED' ? -45 :
              level === 'HIGH' ? 0 :
              level === 'CRITICAL' ? 45 : 90
            }deg)` 
          }} 
        />
      </div>
    </motion.div>
  );
}

// ====================================
// VISUALIZATION PANEL
// ====================================

interface VizPanelProps {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

function VizPanel({ title, icon: Icon, children, expanded, onToggleExpand }: VizPanelProps) {
  return (
    <motion.div
      layout
      className="rounded-2xl overflow-hidden"
      style={{
        background: KINETIC_COLORS.glass,
        backdropFilter: 'blur(20px)',
        border: `1px solid ${KINETIC_COLORS.glassBorder}`,
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-avenlo-cyan" />
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
        
        {onToggleExpand && (
          <button
            onClick={onToggleExpand}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            {expanded ? (
              <Minimize2 className="w-4 h-4 text-gray-400" />
            ) : (
              <Maximize2 className="w-4 h-4 text-gray-400" />
            )}
          </button>
        )}
      </div>
      
      <div className="relative">
        {children}
      </div>
    </motion.div>
  );
}

// ====================================
// KINETICS PAGE (Main Export)
// ====================================

export default function Kinetics() {
  const [expandedPanel, setExpandedPanel] = useState<string | null>(null);
  const [, setSelectedUser] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  
  // Mock data (would be real-time in production)
  const channels = useMemo(() => generateMockChannels(), []);
  const users = useMemo(() => generateMockUsers(), []);
  const waveformData = useMemo(() => generateMockWaveform(), []);
  
  // Calculate global metrics
  const globalHeat = useMemo(() => {
    return channels.reduce((sum, ch) => sum + ch.heat, 0) / channels.length;
  }, [channels]);
  
  const avgReputation = useMemo(() => {
    return users.reduce((sum, u) => sum + u.reputation, 0) / users.length;
  }, [users]);
  
  // Calculate threat level using predictive model
  const threatLevel = useMemo<ThreatLevelString>(() => {
    // Simple mock calculation - real would use behavioral velocity
    if (globalHeat > 80) return 'IMMINENT';
    if (globalHeat > 60) return 'CRITICAL';
    if (globalHeat > 40) return 'HIGH';
    if (globalHeat > 25) return 'ELEVATED';
    return 'MINIMAL';
  }, [globalHeat]);
  
  // Event counts
  const eventCounts = useMemo(() => {
    return waveformData.reduce((acc, point) => {
      point.events.forEach(e => {
        acc[e.type] = (acc[e.type] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);
  }, [waveformData]);
  
  const handleUserSelect = useCallback((userId: string) => {
    setSelectedUser(userId);
  }, []);
  
  const handleEventClick = useCallback((event: TimelineEvent) => {
    setSelectedEvent(event);
  }, []);
  
  const handleTimeChange = useCallback((timestamp: number) => {
    setCurrentTime(timestamp);
  }, []);
  
  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Would update data here in real implementation
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="min-h-screen p-6" style={{ background: KINETIC_COLORS.background }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6"
      >
        <div className="flex items-center gap-4">
          <div 
            className="p-3 rounded-xl"
            style={{ 
              background: `linear-gradient(135deg, ${KINETIC_COLORS.neonCyan}20, ${KINETIC_COLORS.neonPurple}20)`,
              border: `1px solid ${KINETIC_COLORS.glassBorder}`,
            }}
          >
            <Brain className="w-6 h-6 text-avenlo-cyan" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Kinetic Intelligence</h1>
            <p className="text-sm text-gray-400">Predictive Behavioral Modeling • Real-Time</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5">
            <Radio className="w-4 h-4 text-green-400 animate-pulse" />
            <span className="text-sm text-gray-300">Live</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300 font-mono">
              {new Date(currentTime).toLocaleTimeString()}
            </span>
          </div>
        </div>
      </motion.div>
      
      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <StatCard
          icon={Activity}
          label="Global Heat"
          value={`${globalHeat.toFixed(1)}°`}
          subtext="Community temperature"
          color={globalHeat > 50 ? KINETIC_COLORS.hot : KINETIC_COLORS.cold}
          trend={globalHeat > 40 ? 'up' : 'stable'}
        />
        <StatCard
          icon={Users}
          label="Active Users"
          value={users.length}
          subtext="Currently tracked"
          color={KINETIC_COLORS.neonCyan}
        />
        <StatCard
          icon={Target}
          label="Avg Reputation"
          value={avgReputation.toFixed(0)}
          subtext="Trust index"
          color={avgReputation > 50 ? KINETIC_COLORS.trusted : KINETIC_COLORS.hostile}
        />
        <StatCard
          icon={AlertTriangle}
          label="Infractions"
          value={eventCounts.INFRACTION || 0}
          subtext="Last 30 minutes"
          color={KINETIC_COLORS.warm}
        />
        <ThreatIndicator level={threatLevel} />
      </div>
      
      {/* Main Visualization Grid */}
      <AnimatePresence mode="wait">
        {expandedPanel ? (
          // Expanded single panel
          <motion.div
            key="expanded"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="h-[600px]"
          >
            <VizPanel
              title={
                expandedPanel === 'prism' ? 'Neural Heat Prism' :
                expandedPanel === 'orbit' ? 'Reputation Orbit' :
                'Forensic Scrubber'
              }
              icon={
                expandedPanel === 'prism' ? Brain :
                expandedPanel === 'orbit' ? Users :
                Activity
              }
              expanded
              onToggleExpand={() => setExpandedPanel(null)}
            >
              {expandedPanel === 'prism' && (
                <div className="h-[540px]">
                  <NeuralHeatPrism
                    channels={channels}
                    globalHeat={globalHeat}
                    threatLevel={threatLevel}
                    width={window.innerWidth - 80}
                    height={540}
                  />
                </div>
              )}
              {expandedPanel === 'orbit' && (
                <ReputationOrbit
                  users={users}
                  width={window.innerWidth - 80}
                  height={540}
                  onUserClick={handleUserSelect}
                />
              )}
              {expandedPanel === 'scrubber' && (
                <ForensicScrubber
                  data={waveformData}
                  startTime={Date.now() - 30 * 60 * 1000}
                  endTime={Date.now()}
                  width={window.innerWidth - 80}
                  height={200}
                  onEventClick={handleEventClick}
                  onTimeChange={handleTimeChange}
                />
              )}
            </VizPanel>
          </motion.div>
        ) : (
          // Grid layout
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-2 gap-4"
          >
            {/* Neural Heat Prism */}
            <VizPanel
              title="Neural Heat Prism"
              icon={Brain}
              onToggleExpand={() => setExpandedPanel('prism')}
            >
              <div className="h-[350px]">
                <NeuralHeatPrism
                  channels={channels}
                  globalHeat={globalHeat}
                  threatLevel={threatLevel}
                  height={350}
                />
              </div>
            </VizPanel>
            
            {/* Reputation Orbit */}
            <VizPanel
              title="Reputation Orbit"
              icon={Users}
              onToggleExpand={() => setExpandedPanel('orbit')}
            >
              <ReputationOrbit
                users={users}
                height={350}
                onUserClick={handleUserSelect}
              />
            </VizPanel>
            
            {/* Forensic Scrubber - Full Width */}
            <div className="col-span-2">
              <VizPanel
                title="Forensic Timeline"
                icon={Activity}
                onToggleExpand={() => setExpandedPanel('scrubber')}
              >
                <ForensicScrubber
                  data={waveformData}
                  startTime={Date.now() - 30 * 60 * 1000}
                  endTime={Date.now()}
                  height={140}
                  onEventClick={handleEventClick}
                  onTimeChange={handleTimeChange}
                />
              </VizPanel>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Event Details Drawer */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="fixed right-4 top-24 w-80 rounded-2xl overflow-hidden z-50"
            style={{
              background: KINETIC_COLORS.glass,
              backdropFilter: 'blur(20px)',
              border: `1px solid ${KINETIC_COLORS.glassBorder}`,
            }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h3 className="text-sm font-semibold text-white">Event Details</h3>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <p className="text-xs text-gray-400">Type</p>
                <p className="text-sm text-white font-medium">{selectedEvent.type}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Severity</p>
                <p 
                  className="text-sm font-medium"
                  style={{ 
                    color: selectedEvent.severity === 'CRITICAL' ? KINETIC_COLORS.critical :
                           selectedEvent.severity === 'HIGH' ? KINETIC_COLORS.hot :
                           selectedEvent.severity === 'MEDIUM' ? KINETIC_COLORS.warm :
                           KINETIC_COLORS.cold
                  }}
                >
                  {selectedEvent.severity}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Timestamp</p>
                <p className="text-sm text-white font-mono">
                  {new Date(selectedEvent.timestamp).toLocaleString()}
                </p>
              </div>
              {selectedEvent.content && (
                <div>
                  <p className="text-xs text-gray-400">Content</p>
                  <p className="text-sm text-gray-300">{selectedEvent.content}</p>
                </div>
              )}
              {selectedEvent.userId && (
                <button
                  className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-avenlo-cyan/20 text-avenlo-cyan text-sm font-medium hover:bg-avenlo-cyan/30 transition-colors"
                >
                  Open Forensic Report
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
