// ====================================
// GUARDIAN FORENSIC TYPES
// Frontend Types for Crime Scene Investigation
// ====================================

/**
 * Detection layers in the Guardian pipeline
 */
export type DetectionLayer = 'SIEVE' | 'ANALYST' | 'VISIONARY' | 'RAID_DETECTOR';

/**
 * Intent classifications from GPT-4o Analyst
 */
export type IntentClassification =
  | 'EDUCATIONAL'
  | 'HOSTILE'
  | 'SARCASTIC'
  | 'DEFENSIVE'
  | 'NEUTRAL'
  | 'DECEPTIVE'
  | 'PROVOCATIVE';

/**
 * Severity levels for infractions
 */
export type InfractionSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Types of infractions Guardian can detect
 */
export type InfractionType =
  | 'SPAM'
  | 'SCAM'
  | 'TOXICITY'
  | 'HARASSMENT'
  | 'RAID'
  | 'NSFW'
  | 'EXTREMISM'
  | 'IMPERSONATION'
  | 'DOXXING'
  | 'PHISHING'
  | 'MALWARE'
  | 'CRYPTO_DRAINER'
  | 'OTHER';

/**
 * Moderation actions that can be taken
 */
export type ModActionTaken =
  | 'NONE'
  | 'WARNING'
  | 'MESSAGE_DELETE'
  | 'TIMEOUT_5M'
  | 'TIMEOUT_30M'
  | 'TIMEOUT_1H'
  | 'TIMEOUT_24H'
  | 'KICK'
  | 'BAN'
  | 'LOCKDOWN';

/**
 * Appeal decision states
 */
export type AppealDecision = 'PENDING' | 'UPHELD' | 'OVERTURNED' | 'REDUCED';

// ====================================
// EMBEDDED INTERFACES
// ====================================

/**
 * Social Context Snapshot
 * Environmental telemetry at time of infraction
 */
export interface SocialContext {
  channelHeat: number;
  messageVelocity: number;
  sentimentDelta: number;
  activeUsers: number;
  isHeatedDiscussion: boolean;
  conversationTopic?: string;
  technicalContext: boolean;
}

/**
 * Message in the sliding context window
 */
export interface MessageContext {
  messageId: string;
  authorId: string;
  authorUsername: string;
  content: string;
  timestamp: string;
  sentiment: number;
}

/**
 * AI Reasoning - The explainable moderation core
 */
export interface AIReasoning {
  detectionLayer: DetectionLayer;
  confidence: number;
  intentClassification: IntentClassification;
  patternSignatures: string[];
  reasoning: string;
  mitigatingFactors: string[];
  aggravatingFactors: string[];
  alternativeInterpretations: string[];
  modelUsed: string;
  processingTimeMs: number;
  tokenCount: number;
}

/**
 * User History Snapshot at time of infraction
 */
export interface UserHistorySnapshot {
  reputationScore: number;
  accountAgeDays: number;
  serverTenureDays: number;
  previousInfractions: number;
  wasElevatedObservation: boolean;
  positiveContributions: number;
  roles: string[];
}

/**
 * Image Analysis from Visionary layer
 */
export interface ImageAnalysis {
  imageUrl: string;
  steganographyDetected: boolean;
  extractedText?: string;
  iconographyFlags: string[];
  nsfwProbability: number;
  scamIndicators: string[];
  confidence: number;
}

/**
 * Appeal Information
 */
export interface AppealInfo {
  appealed: boolean;
  appealedAt?: string;
  appealReason?: string;
  appealDecision?: AppealDecision;
  reviewedBy?: string;
  reviewNotes?: string;
  reviewedAt?: string;
}

// ====================================
// MAIN INFRACTION INTERFACE
// ====================================

/**
 * Complete Infraction Record
 * The full "Crime Scene Report" for forensic analysis
 */
export interface Infraction {
  _id: string;
  infractionId: string;
  guildId: string;
  channelId: string;
  channelName?: string;
  userId: string;
  username: string;
  userAvatar?: string;
  messageId?: string;
  messageContent: string;
  attachmentUrls: string[];

  // Classification
  type: InfractionType;
  severity: InfractionSeverity;
  actionTaken: ModActionTaken;
  automated: boolean;

  // AI Analysis
  aiReasoning: AIReasoning;
  socialContext: SocialContext;
  messageContext: MessageContext[];
  userHistorySnapshot: UserHistorySnapshot;
  imageAnalysis?: ImageAnalysis;

  // Appeals
  appeal: AppealInfo;

  // Metadata
  confirmedFalsePositive: boolean;
  staffOverrideReason?: string;
  overriddenBy?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// ====================================
// UI STATE TYPES
// ====================================

/**
 * Infraction status for UI display
 */
export type InfractionStatus = 'ACTIVE' | 'APPEALED' | 'OVERTURNED' | 'EXPIRED';

/**
 * Color mapping for severity levels
 */
export const SEVERITY_COLORS: Record<InfractionSeverity, { bg: string; text: string; glow: string }> = {
  LOW: { bg: 'bg-info/20', text: 'text-info', glow: 'shadow-[0_0_20px_rgba(59,130,246,0.4)]' },
  MEDIUM: { bg: 'bg-warning/20', text: 'text-warning', glow: 'shadow-[0_0_20px_rgba(245,158,11,0.4)]' },
  HIGH: { bg: 'bg-orange-500/20', text: 'text-orange-400', glow: 'shadow-[0_0_20px_rgba(249,115,22,0.4)]' },
  CRITICAL: { bg: 'bg-danger/20', text: 'text-danger', glow: 'shadow-[0_0_25px_rgba(239,68,68,0.5)]' },
};

/**
 * Color mapping for detection layers
 */
export const LAYER_COLORS: Record<DetectionLayer, { bg: string; text: string; border: string }> = {
  SIEVE: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
  ANALYST: { bg: 'bg-avenlo-purple/10', text: 'text-avenlo-purple', border: 'border-avenlo-purple/30' },
  VISIONARY: { bg: 'bg-avenlo-cyan/10', text: 'text-avenlo-cyan', border: 'border-avenlo-cyan/30' },
  RAID_DETECTOR: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
};

/**
 * Color mapping for intent classifications
 */
export const INTENT_COLORS: Record<IntentClassification, { position: number; color: string }> = {
  EDUCATIONAL: { position: 0, color: '#10B981' },    // Green - left
  NEUTRAL: { position: 25, color: '#6B7280' },       // Gray
  SARCASTIC: { position: 40, color: '#F59E0B' },     // Amber
  DEFENSIVE: { position: 50, color: '#3B82F6' },     // Blue - center
  PROVOCATIVE: { position: 65, color: '#F97316' },   // Orange
  DECEPTIVE: { position: 80, color: '#EC4899' },     // Pink
  HOSTILE: { position: 100, color: '#EF4444' },      // Red - right
};

/**
 * Action severity mapping for display
 */
export const ACTION_SEVERITY: Record<ModActionTaken, number> = {
  NONE: 0,
  WARNING: 1,
  MESSAGE_DELETE: 2,
  TIMEOUT_5M: 3,
  TIMEOUT_30M: 4,
  TIMEOUT_1H: 5,
  TIMEOUT_24H: 6,
  KICK: 7,
  BAN: 8,
  LOCKDOWN: 9,
};
