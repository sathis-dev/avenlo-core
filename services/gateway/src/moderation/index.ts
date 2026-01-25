// ====================================
// AVENLO CORE - GUARDIAN MODERATION MODULE
// Sovereign Security Layer Exports
// ====================================

// Core Pipeline
export {
  GuardianPipeline,
  getGuardianPipeline,
  PipelineResult,
  AnalystResult,
  VisionaryResult,
} from './GuardianPipeline';

// Context Buffer
export {
  MessageContextBuffer,
  ContextBufferResult,
  analyzeSentiment,
  detectTechnicalContext,
} from './MessageContextBuffer';

// Sentiment Engine
export {
  SentimentEngine,
  getSentimentEngine,
  shutdownSentimentEngines,
  ChannelHeatStatus,
  SentimentEntry,
} from './SentimentEngine';

// User Reputation
export {
  UserReputationManager,
  getUserReputationManager,
  UserReputationState,
  ObservationLevel,
  ReputationChange,
} from './UserReputation';

// Raid Detection
export {
  RaidDetector,
  getRaidDetector,
  shutdownRaidDetectors,
  RaidStatus,
  LockdownLevel,
  LockdownAction,
  JoinEvent,
  SuspiciousPattern,
} from './RaidDetector';
