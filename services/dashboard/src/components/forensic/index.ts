// ====================================
// FORENSIC COMPONENTS BARREL EXPORT
// Crime Scene Investigator UI Suite
// ====================================

export { default as ForensicReportSheet } from './ForensicReportSheet';
export { default as InfractionPulse } from './InfractionPulse';
export { default as SieveLayer } from './SieveLayer';
export { default as AnalystLayer } from './AnalystLayer';
export { default as VisionaryLayer } from './VisionaryLayer';
export { default as ReputationDelta } from './ReputationDelta';

// Re-export types for convenience
export type {
  Infraction,
  AIReasoning,
  SocialContext,
  MessageContext,
  UserHistorySnapshot,
  ImageAnalysis,
  AppealInfo,
  DetectionLayer,
  IntentClassification,
  InfractionSeverity,
  InfractionType,
  ModActionTaken,
} from '../../types/guardian';

export {
  SEVERITY_COLORS,
  LAYER_COLORS,
  INTENT_COLORS,
  ACTION_SEVERITY,
} from '../../types/guardian';
