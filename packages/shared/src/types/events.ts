// ====================================
// AVENLO CORE - TYPE-SAFE EVENT SCHEMAS
// Distributed Event-Sourced System
// ====================================

/**
 * Event Types Registry - Single source of truth
 * Maps event names to stream keys for Redis Streams
 */
export const EventTypes = {
  // ====================================
  // GATEWAY EVENTS
  // ====================================
  GATEWAY_READY: 'gateway:ready',
  GATEWAY_SHUTDOWN: 'gateway:shutdown',
  GATEWAY_ERROR: 'gateway:error',

  // ====================================
  // ARCHITECT EVENTS (AI Scoping)
  // ====================================
  ARCHITECT_INTERVIEW_START: 'architect:interview:start',
  ARCHITECT_INTERVIEW_MESSAGE: 'architect:interview:message',
  ARCHITECT_INTERVIEW_COMPLETE: 'architect:interview:complete',
  ARCHITECT_BRIEF_GENERATED: 'architect:brief:generated',

  // Multi-Agent Orchestration Events
  ARCHITECT_THINKING_START: 'architect:thinking:start',
  ARCHITECT_THINKING_PROGRESS: 'architect:thinking:progress',
  ARCHITECT_AGENT_COMPLETE: 'architect:agent:complete',
  ARCHITECT_DEBATE_ROUND: 'architect:debate:round',
  ARCHITECT_DEBATE_COMPLETE: 'architect:debate:complete',
  ARCHITECT_PHASE_ADVANCED: 'architect:phase:advanced',

  // ====================================
  // PULSE EVENTS (DevOps)
  // ====================================
  PULSE_COMMIT_PUSHED: 'pulse:commit:pushed',
  PULSE_PR_OPENED: 'pulse:pr:opened',
  PULSE_PR_MERGED: 'pulse:pr:merged',
  PULSE_PR_CLOSED: 'pulse:pr:closed',
  PULSE_BUILD_START: 'pulse:build:start',
  PULSE_BUILD_SUCCESS: 'pulse:build:success',
  PULSE_BUILD_FAILURE: 'pulse:build:failure',
  PULSE_DEPLOY: 'pulse:deploy',
  PULSE_HEALTH_CHECK: 'pulse:health:check',
  PULSE_DASHBOARD_UPDATE: 'pulse:dashboard:update',

  // ====================================
  // LEDGER EVENTS (Economy)
  // ====================================
  LEDGER_CREDITS_EARNED: 'ledger:credits:earned',
  LEDGER_CREDITS_SPENT: 'ledger:credits:spent',
  LEDGER_CREDITS_TRANSFER: 'ledger:credits:transfer',
  LEDGER_ROLE_UPDATE: 'ledger:role:update',
  LEDGER_ROLE_PROMOTED: 'ledger:role:promoted',
  LEDGER_ROLE_DEMOTED: 'ledger:role:demoted',
  LEDGER_LEADERBOARD_UPDATE: 'ledger:leaderboard:update',
  LEDGER_TRANSACTION_CLEARED: 'ledger:transaction:cleared',

  // ====================================
  // TICKET EVENTS
  // ====================================
  TICKET_CREATED: 'ticket:created',
  TICKET_CLAIMED: 'ticket:claimed',
  TICKET_RESOLVED: 'ticket:resolved',
  TICKET_CLOSED: 'ticket:closed',
  TICKET_ESCALATED: 'ticket:escalated',
  TICKET_REOPENED: 'ticket:reopened',

  // ====================================
  // MODERATION EVENTS
  // ====================================
  MOD_USER_WARNED: 'mod:user:warned',
  MOD_USER_MUTED: 'mod:user:muted',
  MOD_USER_KICKED: 'mod:user:kicked',
  MOD_USER_BANNED: 'mod:user:banned',
  MOD_RAID_DETECTED: 'mod:raid:detected',

  // ====================================
  // KINETIC EVENTS (Guardian / Threat Engine)
  // ====================================
  KINETIC_THREAT_DETECTED: 'kinetic:threat:detected',

  // ====================================
  // SYSTEM EVENTS
  // ====================================
  SYSTEM_ERROR: 'system:error',
  SYSTEM_HEALTH: 'system:health',
  SYSTEM_METRICS: 'system:metrics',
} as const;

export type EventType = typeof EventTypes[keyof typeof EventTypes];

// ====================================
// BASE EVENT INTERFACE
// ====================================

/** Base event interface for legacy compatibility */
export interface BaseEvent {
  id: string;
  type: EventType;
  timestamp: Date;
  source: string;
  payload: unknown;
}

// ====================================
// EVENT PAYLOAD INTERFACES
// Strictly typed - No `any` allowed
// ====================================

/** Base metadata for all events */
export interface EventMetadata {
  /** Unique event ID (UUIDv4) */
  eventId: string;
  /** ISO timestamp of event creation */
  timestamp: string;
  /** Service that produced the event */
  source: 'gateway' | 'architect' | 'pulse' | 'ledger' | 'dashboard';
  /** Correlation ID for distributed tracing */
  correlationId?: string;
  /** Causation ID - the event that caused this event */
  causationId?: string;
  /** Schema version for forward compatibility */
  version: number;
}

/** Idempotency key for exactly-once processing */
export interface IdempotencyInfo {
  /** Unique key: hash(eventId + timestamp + payload_hash) */
  idempotencyKey: string;
  /** Number of delivery attempts */
  deliveryAttempt: number;
  /** First delivery timestamp */
  firstDeliveryAt: string;
}

// ====================================
// GATEWAY EVENT PAYLOADS
// ====================================

export interface GatewayReadyPayload {
  guildCount: number;
  shardId: number;
  totalShards: number;
  uptime: number;
}

export interface GatewayShutdownPayload {
  reason: 'manual' | 'error' | 'restart' | 'maintenance';
  graceful: boolean;
}

export interface GatewayErrorPayload {
  error: string;
  stack?: string;
  context: Record<string, unknown>;
}

// ====================================
// ARCHITECT EVENT PAYLOADS
// ====================================

export interface ArchitectInterviewStartPayload {
  userId: string;
  username: string;
  guildId: string;
  channelId: string;
  threadId: string;
  sessionId: string;
}

export interface ArchitectInterviewMessagePayload {
  sessionId: string;
  userId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  phase: 'discovery' | 'requirements' | 'timeline' | 'budget' | 'summary';
  tokenCount?: number;
}

export interface ArchitectInterviewCompletePayload {
  sessionId: string;
  userId: string;
  projectId: string;
  briefId: string;
  complexityScore: number;
  estimatedHours: number;
  techStack: string[];
}

export interface ArchitectBriefGeneratedPayload {
  briefId: string;
  projectId: string;
  userId: string;
  summary: string;
  requirements: string[];
  deliverables: string[];
  estimatedBudget?: number;
}

// Multi-Agent Orchestration Payloads

export interface ArchitectThinkingStartPayload {
  sessionId: string;
  userId: string;
  agentId: string;
  agentName: string;
  action: string;
  phase: 'discovery' | 'requirements' | 'technical' | 'timeline' | 'budget' | 'debate' | 'estimation';
}

export interface ArchitectThinkingProgressPayload {
  sessionId: string;
  agentId: string;
  agentName: string;
  action: string;
  status: 'started' | 'in_progress' | 'completed' | 'failed';
  progress?: number;  // 0-100
  details?: string;
  tokenCount?: number;
  duration?: number;  // ms
}

export interface ArchitectAgentCompletePayload {
  sessionId: string;
  agentId: string;
  agentName: string;
  action: string;
  result: 'success' | 'needs_revision' | 'halted' | 'error';
  outputSummary: string;
  tokenCount: number;
  duration: number;
}

export interface ArchitectDebateRoundPayload {
  sessionId: string;
  roundNumber: number;
  alphaAgentId: string;
  betaAgentId: string;
  criticalScore: number;  // 0-10
  warnings: string[];
  commendations: string[];
  approvalStatus: 'APPROVED' | 'NEEDS_REVISION' | 'CRITICAL_HALT';
  requiresRevision: boolean;
}

export interface ArchitectDebateCompletePayload {
  sessionId: string;
  userId: string;
  projectId: string;
  totalRounds: number;
  finalConfidence: number;  // 0-100
  criticalScoreProgression: number[];
  requirements: string[];
  estimatedCredits: number;
  estimatedHours: number;
  techStack: string[];
}

// ====================================
// PULSE EVENT PAYLOADS (DevOps)
// ====================================

export interface PulseCommitPayload {
  repository: string;
  repositoryUrl: string;
  branch: string;
  commits: Array<{
    sha: string;
    shortSha: string;
    message: string;
    author: string;
    authorUsername: string;
    timestamp: string;
    url: string;
    additions: number;
    deletions: number;
  }>;
  pusher: string;
  compareUrl: string;
}

export interface PulsePRPayload {
  repository: string;
  prNumber: number;
  title: string;
  body: string;
  author: string;
  authorUsername: string;
  action: 'opened' | 'merged' | 'closed';
  url: string;
  baseBranch: string;
  headBranch: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  mergedBy?: string;
}

export interface PulseBuildPayload {
  repository: string;
  buildId: string;
  workflowName: string;
  status: 'queued' | 'in_progress' | 'success' | 'failure' | 'cancelled';
  conclusion?: 'success' | 'failure' | 'cancelled' | 'skipped';
  duration?: number;
  url: string;
  triggeredBy: string;
  branch: string;
  sha: string;
}

export interface PulseDeployPayload {
  repository: string;
  environment: 'development' | 'staging' | 'production';
  status: 'pending' | 'success' | 'failure';
  version: string;
  deployedBy: string;
  url?: string;
  duration?: number;
}

export interface PulseHealthCheckPayload {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  checks: Record<string, boolean>;
  timestamp: string;
}

// ====================================
// LEDGER EVENT PAYLOADS (Economy)
// ====================================

export type CreditReason =
  | 'commit'
  | 'pr_opened'
  | 'pr_merged'
  | 'code_review'
  | 'issue_closed'
  | 'ticket_resolved'
  | 'ticket_claimed'
  | 'project_completed'
  | 'milestone_reached'
  | 'bug_report'
  | 'documentation'
  | 'admin_grant'
  | 'admin_revoke'
  | 'perk_exchange'
  | 'transfer_sent'
  | 'transfer_received';

export interface LedgerCreditsEarnedPayload {
  userId: string;
  discordId: string;
  username: string;
  amount: number;
  reason: CreditReason;
  balanceBefore: number;
  balanceAfter: number;
  /** Reference to the source (commit SHA, PR number, ticket ID, etc.) */
  referenceType?: 'commit' | 'pr' | 'issue' | 'ticket' | 'project';
  referenceId?: string;
  referenceUrl?: string;
}

export interface LedgerCreditsSpentPayload {
  userId: string;
  discordId: string;
  username: string;
  amount: number;
  reason: CreditReason;
  balanceBefore: number;
  balanceAfter: number;
  /** What was purchased/exchanged */
  itemType?: string;
  itemId?: string;
}

export interface LedgerCreditsTransferPayload {
  fromUserId: string;
  fromDiscordId: string;
  toUserId: string;
  toDiscordId: string;
  amount: number;
  message?: string;
  fromBalanceAfter: number;
  toBalanceAfter: number;
}

export interface LedgerRoleUpdatePayload {
  userId: string;
  discordId: string;
  username: string;
  action: 'promoted' | 'demoted';
  fromRole: string;
  toRole: string;
  newCredits: number;
  threshold: number;
}

export interface LedgerLeaderboardUpdatePayload {
  period: 'daily' | 'weekly' | 'monthly' | 'all_time';
  topUsers: Array<{
    rank: number;
    userId: string;
    discordId: string;
    username: string;
    credits: number;
    change: number;
  }>;
  updatedAt: string;
}

// ====================================
// TICKET EVENT PAYLOADS
// ====================================

export interface TicketCreatedPayload {
  ticketId: string;
  channelId: string;
  guildId: string;
  clientId: string;
  clientName: string;
  subject: string;
  category: 'project_inquiry' | 'technical_support' | 'billing' | 'feature_request' | 'bug_report' | 'general';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  slaResponseDeadline: string;
  slaResolutionDeadline: string;
}

export interface TicketClaimedPayload {
  ticketId: string;
  channelId: string;
  developerId: string;
  developerName: string;
  claimedAt: string;
  responseTime: number; // milliseconds from creation
}

export interface TicketResolvedPayload {
  ticketId: string;
  channelId: string;
  developerId: string;
  developerName: string;
  clientId: string;
  resolution: string;
  resolvedAt: string;
  totalTime: number; // milliseconds from creation
  sessionCredits: number; // credits to award
  slaMet: boolean;
}

export interface TicketClosedPayload {
  ticketId: string;
  channelId: string;
  closedBy: string;
  closedByName: string;
  reason?: string;
  wasResolved: boolean;
  transcriptUrl?: string;
}

export interface TicketEscalatedPayload {
  ticketId: string;
  channelId: string;
  escalatedBy: string;
  escalatedTo: string;
  reason: string;
  previousPriority: string;
  newPriority: string;
}

// ====================================
// MODERATION EVENT PAYLOADS
// ====================================

export interface ModUserActionPayload {
  guildId: string;
  userId: string;
  username: string;
  moderatorId: string;
  moderatorName: string;
  action: 'warn' | 'mute' | 'kick' | 'ban';
  reason: string;
  duration?: number; // for mutes, in minutes
  aiGenerated: boolean;
  aiScore?: number;
  aiCategories?: Record<string, number>;
}

export interface ModRaidDetectedPayload {
  guildId: string;
  joinCount: number;
  timeWindowMs: number;
  suspiciousUsers: Array<{
    userId: string;
    username: string;
    accountAge: number;
    joinedAt: string;
  }>;
  actionTaken: 'lockdown' | 'verification' | 'none';
  lockdownDuration?: number;
}

// ====================================
// SYSTEM EVENT PAYLOADS
// ====================================

export interface SystemErrorPayload {
  service: string;
  error: string;
  stack?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context: Record<string, unknown>;
  recoverable: boolean;
}

export interface SystemHealthPayload {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: number;
  connections: {
    redis: boolean;
    mongodb: boolean;
    discord: boolean;
  };
  latency: {
    redis: number;
    mongodb: number;
    discord: number;
  };
}

export interface SystemMetricsPayload {
  service: string;
  period: 'minute' | 'hour' | 'day';
  events: {
    processed: number;
    failed: number;
    retried: number;
    deadLettered: number;
  };
  performance: {
    avgProcessingTime: number;
    p95ProcessingTime: number;
    p99ProcessingTime: number;
  };
  throughput: number; // events per second
}

// ====================================
// V2.0 EVENT DICTIONARY PAYLOADS
// Exact cross-service contracts
// ====================================

/** Phases of an Architect AI client interview, in order */
export type InterviewPhase =
  | 'discovery'
  | 'requirements'
  | 'timeline'
  | 'budget'
  | 'review'
  | 'complete';

/**
 * Emitted by Architect when an interview session transitions to the next phase.
 */
export interface ArchitectPhaseAdvancedPayload {
  /** Interview session identifier */
  sessionId: string;
  /** Discord user being interviewed */
  userId: string;
  /** Phase the session moved out of */
  fromPhase: InterviewPhase;
  /** Phase the session moved into */
  toPhase: InterviewPhase;
  /** Zero-based index of the new phase */
  phaseIndex: number;
  /** Total number of phases in the flow */
  totalPhases: number;
  /** Overall completion percentage (0-100) */
  progress: number;
  /** ISO timestamp of the transition */
  advancedAt: string;
}

/**
 * Emitted by Pulse when a pull request is merged. Extends the generic PR
 * payload with merge-specific, always-present fields.
 */
export interface PulsePrMergedPayload extends PulsePRPayload {
  /** Discriminator narrowed to the merged action */
  action: 'merged';
  /** GitHub username of the actor that performed the merge */
  mergedBy: string;
  /** ISO timestamp the PR was merged */
  mergedAt: string;
  /** Number of commits included in the merged PR */
  commitCount: number;
}

/** Lifecycle classification for a cleared ledger transaction */
export type LedgerTransactionType = 'earn' | 'spend' | 'transfer' | 'adjustment';

/**
 * Emitted by Ledger once a credit transaction has been durably committed
 * (post double-entry settlement). Consumers can treat this as authoritative.
 */
export interface LedgerTransactionClearedPayload {
  /** Unique transaction identifier */
  transactionId: string;
  /** Internal user id */
  userId: string;
  /** Discord snowflake of the user */
  discordId: string;
  /** Display name at time of clearing */
  username: string;
  /** Direction/type of the transaction */
  type: LedgerTransactionType;
  /** Signed credit amount applied */
  amount: number;
  /** Balance prior to the transaction */
  balanceBefore: number;
  /** Balance after the transaction */
  balanceAfter: number;
  /** Business reason for the credit movement */
  reason: CreditReason;
  /** Idempotency key guaranteeing exactly-once settlement */
  idempotencyKey: string;
  /** ISO timestamp the transaction cleared */
  clearedAt: string;
}

/** Severity tiers for a detected kinetic threat */
export type ThreatSeverity = 'low' | 'medium' | 'high' | 'critical';

/** Categories of threat the Guardian/Kinetic engine can surface */
export type ThreatVector =
  | 'spam'
  | 'raid'
  | 'toxicity'
  | 'phishing'
  | 'scam'
  | 'nsfw'
  | 'self_harm'
  | 'impersonation';

/**
 * Emitted by the Gateway Guardian pipeline when the kinetic threat engine
 * flags a message or actor.
 */
export interface KineticThreatDetectedPayload {
  /** Guild where the threat was detected */
  guildId: string;
  /** Channel the offending content originated from */
  channelId: string;
  /** Offending user id */
  userId: string;
  /** Offending user's display name */
  username: string;
  /** Message id that triggered detection, when applicable */
  messageId?: string;
  /** Primary threat classification */
  vector: ThreatVector;
  /** Assessed severity */
  severity: ThreatSeverity;
  /** Model confidence in the detection (0-1) */
  confidence: number;
  /** Reputation delta applied to the user as a result */
  reputationDelta: number;
  /** Automated action recommended by the engine */
  recommendedAction:
    | 'observe'
    | 'warn'
    | 'mute'
    | 'kick'
    | 'ban'
    | 'quarantine';
  /** Raw signals/heuristics that contributed to the score */
  signals: string[];
  /** ISO timestamp of detection */
  detectedAt: string;
}

// ====================================
// EVENT REGISTRY - TYPE-SAFE MAPPING
// Uses TypeScript's `keyof` and `infer` for strict typing
// ====================================

/**
 * Maps EventType values to their corresponding payload types.
 * This is the single source of truth for event typing.
 */
export interface EventPayloadMap {
  // Gateway
  [EventTypes.GATEWAY_READY]: GatewayReadyPayload;
  [EventTypes.GATEWAY_SHUTDOWN]: GatewayShutdownPayload;
  [EventTypes.GATEWAY_ERROR]: GatewayErrorPayload;

  // Architect
  [EventTypes.ARCHITECT_INTERVIEW_START]: ArchitectInterviewStartPayload;
  [EventTypes.ARCHITECT_INTERVIEW_MESSAGE]: ArchitectInterviewMessagePayload;
  [EventTypes.ARCHITECT_INTERVIEW_COMPLETE]: ArchitectInterviewCompletePayload;
  [EventTypes.ARCHITECT_BRIEF_GENERATED]: ArchitectBriefGeneratedPayload;

  // Architect Multi-Agent Orchestration
  [EventTypes.ARCHITECT_THINKING_START]: ArchitectThinkingStartPayload;
  [EventTypes.ARCHITECT_THINKING_PROGRESS]: ArchitectThinkingProgressPayload;
  [EventTypes.ARCHITECT_AGENT_COMPLETE]: ArchitectAgentCompletePayload;
  [EventTypes.ARCHITECT_DEBATE_ROUND]: ArchitectDebateRoundPayload;
  [EventTypes.ARCHITECT_DEBATE_COMPLETE]: ArchitectDebateCompletePayload;
  [EventTypes.ARCHITECT_PHASE_ADVANCED]: ArchitectPhaseAdvancedPayload;

  // Pulse
  [EventTypes.PULSE_COMMIT_PUSHED]: PulseCommitPayload;
  [EventTypes.PULSE_PR_OPENED]: PulsePRPayload;
  [EventTypes.PULSE_PR_MERGED]: PulsePrMergedPayload;
  [EventTypes.PULSE_PR_CLOSED]: PulsePRPayload;
  [EventTypes.PULSE_BUILD_START]: PulseBuildPayload;
  [EventTypes.PULSE_BUILD_SUCCESS]: PulseBuildPayload;
  [EventTypes.PULSE_BUILD_FAILURE]: PulseBuildPayload;
  [EventTypes.PULSE_DEPLOY]: PulseDeployPayload;
  [EventTypes.PULSE_HEALTH_CHECK]: PulseHealthCheckPayload;

  // Ledger
  [EventTypes.LEDGER_CREDITS_EARNED]: LedgerCreditsEarnedPayload;
  [EventTypes.LEDGER_CREDITS_SPENT]: LedgerCreditsSpentPayload;
  [EventTypes.LEDGER_CREDITS_TRANSFER]: LedgerCreditsTransferPayload;
  [EventTypes.LEDGER_ROLE_PROMOTED]: LedgerRoleUpdatePayload;
  [EventTypes.LEDGER_ROLE_DEMOTED]: LedgerRoleUpdatePayload;
  [EventTypes.LEDGER_LEADERBOARD_UPDATE]: LedgerLeaderboardUpdatePayload;
  [EventTypes.LEDGER_TRANSACTION_CLEARED]: LedgerTransactionClearedPayload;

  // Tickets
  [EventTypes.TICKET_CREATED]: TicketCreatedPayload;
  [EventTypes.TICKET_CLAIMED]: TicketClaimedPayload;
  [EventTypes.TICKET_RESOLVED]: TicketResolvedPayload;
  [EventTypes.TICKET_CLOSED]: TicketClosedPayload;
  [EventTypes.TICKET_ESCALATED]: TicketEscalatedPayload;
  [EventTypes.TICKET_REOPENED]: TicketClosedPayload;

  // Moderation
  [EventTypes.MOD_USER_WARNED]: ModUserActionPayload;
  [EventTypes.MOD_USER_MUTED]: ModUserActionPayload;
  [EventTypes.MOD_USER_KICKED]: ModUserActionPayload;
  [EventTypes.MOD_USER_BANNED]: ModUserActionPayload;
  [EventTypes.MOD_RAID_DETECTED]: ModRaidDetectedPayload;

  // Kinetic
  [EventTypes.KINETIC_THREAT_DETECTED]: KineticThreatDetectedPayload;

  // System
  [EventTypes.SYSTEM_ERROR]: SystemErrorPayload;
  [EventTypes.SYSTEM_HEALTH]: SystemHealthPayload;
  [EventTypes.SYSTEM_METRICS]: SystemMetricsPayload;
}

// ====================================
// TYPE UTILITIES
// ====================================

/**
 * Extract payload type for a given event type
 * Usage: PayloadFor<'ledger:credits:earned'> => LedgerCreditsEarnedPayload
 */
export type PayloadFor<T extends EventType> = T extends keyof EventPayloadMap
  ? EventPayloadMap[T]
  : never;

/**
 * Full event envelope with metadata, idempotency, and typed payload
 */
export interface EventEnvelope<T extends EventType = EventType> {
  /** Event metadata */
  meta: EventMetadata;
  /** Idempotency information */
  idempotency: IdempotencyInfo;
  /** Event type discriminator */
  type: T;
  /** Strongly typed payload */
  payload: PayloadFor<T>;
}

/**
 * Serialized event for Redis Streams (all values are strings)
 */
export interface SerializedEvent {
  meta: string;
  idempotency: string;
  type: string;
  payload: string;
}

/**
 * Dead letter event with failure information
 */
export interface DeadLetterEvent<T extends EventType = EventType> {
  originalEvent: EventEnvelope<T>;
  streamId: string;
  consumerGroup: string;
  consumer: string;
  failureCount: number;
  lastError: string;
  lastErrorStack?: string;
  firstFailedAt: string;
  lastFailedAt: string;
  movedToDlqAt: string;
}

/**
 * Stream consumer group info
 */
export interface ConsumerGroupInfo {
  name: string;
  consumers: number;
  pending: number;
  lastDeliveredId: string;
}

/**
 * Pending message info from XPENDING
 */
export interface PendingMessage {
  messageId: string;
  consumer: string;
  idleTime: number;
  deliveryCount: number;
}

// ====================================
// STREAM CONFIGURATION
// ====================================

export const StreamConfig = {
  /** Maximum stream length (with approximate trimming) */
  MAX_STREAM_LENGTH: 10000,
  /** Dead letter queue stream name */
  DLQ_STREAM: 'stream:dead_letters',
  /** Idempotency key expiry in seconds (24 hours) */
  IDEMPOTENCY_TTL: 86400,
  /** Maximum retry attempts before DLQ */
  MAX_RETRIES: 3,
  /** Batch size for consumer reads */
  BATCH_SIZE: 50,
  /** Block timeout for XREADGROUP in milliseconds */
  BLOCK_TIMEOUT: 5000,
  /** Claim timeout for pending messages in milliseconds */
  CLAIM_TIMEOUT: 60000,
  /** Consumer heartbeat interval in milliseconds */
  HEARTBEAT_INTERVAL: 30000,
} as const;

/**
 * Get the Redis stream key for an event type
 */
export function getStreamKey(eventType: EventType): string {
  return `stream:${eventType.replace(/:/g, '.')}`;
}

/**
 * Get the idempotency set key for a consumer group
 */
export function getIdempotencySetKey(consumerGroup: string): string {
  return `idempotency:${consumerGroup}`;
}
