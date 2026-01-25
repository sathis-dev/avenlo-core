// ====================================
// KINETIC INTELLIGENCE TYPES
// Predictive Behavioral Modeling System
// ====================================

/**
 * Behavioral Velocity Vector (∇S)
 * Represents the rate of change in user behavioral metrics
 */
export interface BehavioralVelocityVector {
  /** Rate of sentiment change per minute */
  sentimentVelocity: number;
  /** Rate of reputation change per hour */
  reputationVelocity: number;
  /** Rate of message frequency change */
  activityVelocity: number;
  /** Directional angle in behavioral space (radians) */
  trajectoryAngle: number;
  /** Magnitude of velocity vector */
  magnitude: number;
}

/**
 * Predictive Threat Level String
 */
export type ThreatLevelString = 'MINIMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL' | 'IMMINENT';

/**
 * Predictive Threat Level Object
 * T(t) = α·H(t) + β·(dR/dt) + γ·∇S
 */
export interface PredictiveThreatLevel {
  /** Current threat score (0-100) */
  currentScore: number;
  /** Predicted score in 5 minutes */
  predicted5m: number;
  /** Predicted score in 15 minutes */
  predicted15m: number;
  /** Predicted score in 30 minutes */
  predicted30m: number;
  /** Confidence in prediction (0-1) */
  confidence: number;
  /** Weight coefficients used */
  weights: {
    alpha: number;  // Channel heat weight
    beta: number;   // Reputation velocity weight
    gamma: number;  // Behavioral vector weight
  };
}

/**
 * Channel Heat Node for 3D visualization
 */
export interface ChannelHeatNode {
  id: string;
  name: string;
  heat: number;              // 0-100
  messageVelocity: number;   // msgs/min
  activeUsers: number;
  sentimentScore: number;    // -1 to 1
  threatLevel: PredictiveThreatLevel;
  position: [number, number, number];  // 3D coordinates
  fractureLevel: number;     // 0-1, determines visual fragmentation
  particleEmission: number;  // Particle emit rate
}

/**
 * User Reputation Node for orbital visualization
 */
export interface ReputationNode {
  id: string;
  username: string;
  avatar?: string;
  reputation: number;        // 0-100 (simplified)
  trustLevel: 'TRUSTED' | 'NEUTRAL' | 'PROBATION' | 'HOSTILE';
  messageCount: number;
  recentActivity: number;    // 0-1
  connections: string[];     // IDs of connected users
}

/**
 * Timeline Event for Forensic Scrubber
 */
export interface TimelineEvent {
  timestamp: number;
  type: 'MESSAGE' | 'INFRACTION' | 'HEAT_SPIKE' | 'RAID_ALERT' | 'USER_JOIN' | 'USER_LEAVE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  userId?: string;
  username?: string;
  content?: string;
}

/**
 * Waveform Data Point for visualization
 */
export interface WaveformPoint {
  timestamp: number;
  heat: number;
  sentiment: number;
  events: TimelineEvent[];
}

/**
 * Kinetic State for the entire visualization
 */
export interface KineticState {
  channels: ChannelHeatNode[];
  users: ReputationNode[];
  timeline: WaveformPoint[];
  globalHeat: number;
  globalThreat: PredictiveThreatLevel;
  raidStatus: 'NORMAL' | 'ELEVATED' | 'CRITICAL';
  lastUpdate: number;
}

// ====================================
// SHADER UNIFORMS
// ====================================

/**
 * Uniforms for the Fracture Shader
 */
export interface FractureShaderUniforms {
  uTime: { value: number };
  uHeat: { value: number };
  uFracture: { value: number };
  uBaseColor: { value: [number, number, number] };
  uHotColor: { value: [number, number, number] };
  uCriticalColor: { value: [number, number, number] };
  uNoiseScale: { value: number };
  uDisplacement: { value: number };
}

/**
 * Uniforms for the Glow Shader
 */
export interface GlowShaderUniforms {
  uTime: { value: number };
  uIntensity: { value: number };
  uColor: { value: [number, number, number] };
  uPulseSpeed: { value: number };
}

// ====================================
// COLOR PALETTE
// ====================================

export const KINETIC_COLORS = {
  // Base obsidian
  background: '#050505',
  surface: '#0A0A0F',
  
  // Heat spectrum (cold to hot)
  cold: '#00D4FF',        // Teal
  warm: '#8B5CF6',        // Purple
  hot: '#F97316',         // Orange
  critical: '#EF4444',    // Red
  ultraviolet: '#A855F7', // Vibrating UV
  
  // Trust spectrum
  trusted: '#10B981',     // Green
  neutral: '#6B7280',     // Gray
  hostile: '#EF4444',     // Red
  
  // Accent
  neonCyan: '#00F5FF',
  neonPurple: '#BF40BF',
  neonPink: '#FF10F0',
  
  // Glass
  glass: 'rgba(10, 10, 15, 0.8)',
  glassWhite: 'rgba(255, 255, 255, 0.05)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
} as const;

/**
 * Convert heat (0-100) to color
 */
export function heatToColor(heat: number): string {
  if (heat < 25) return KINETIC_COLORS.cold;
  if (heat < 50) return KINETIC_COLORS.warm;
  if (heat < 75) return KINETIC_COLORS.hot;
  return KINETIC_COLORS.critical;
}

/**
 * Convert heat to RGB array for shaders
 */
export function heatToRGB(heat: number): [number, number, number] {
  if (heat < 25) return [0, 0.83, 1];        // Cyan
  if (heat < 50) return [0.55, 0.36, 0.96];  // Purple
  if (heat < 75) return [0.98, 0.45, 0.09];  // Orange
  return [0.94, 0.27, 0.27];                 // Red
}

/**
 * Convert reputation to orbital distance
 * High reputation = close to center (trusted)
 * Low reputation = far from center (hostile zone)
 */
export function reputationToOrbitDistance(reputation: number): number {
  // Map 0-100 reputation to 5-1 distance (inverse)
  return 5 - (reputation / 100) * 4;
}

/**
 * Calculate threat level using the predictive model
 * T(t) = α·H(t) + β·(dR/dt) + γ·∇S
 */
export function calculateThreatLevel(
  channelHeat: number,
  reputationVelocity: number,
  behavioralMagnitude: number,
  weights = { alpha: 0.4, beta: 0.35, gamma: 0.25 }
): number {
  const { alpha, beta, gamma } = weights;
  
  // Normalize inputs
  const normalizedHeat = channelHeat / 100;
  const normalizedRepVelocity = Math.min(1, Math.max(-1, reputationVelocity / 10));
  const normalizedBehavior = Math.min(1, behavioralMagnitude);
  
  // Calculate threat (higher velocity = more negative = higher threat)
  const threat = (
    alpha * normalizedHeat +
    beta * Math.max(0, -normalizedRepVelocity) +
    gamma * normalizedBehavior
  ) * 100;
  
  return Math.min(100, Math.max(0, threat));
}
