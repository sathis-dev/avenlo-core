// ====================================
// AVENLO CORE - EVENT TYPES
// ====================================

/**
 * Event types for the Redis Event Bus
 */
export const EventTypes = {
  // Gateway Events
  GATEWAY_READY: 'gateway:ready',
  GATEWAY_SHUTDOWN: 'gateway:shutdown',
  
  // Architect Events (AI Scoping)
  ARCHITECT_INTERVIEW_START: 'architect:interview:start',
  ARCHITECT_INTERVIEW_MESSAGE: 'architect:interview:message',
  ARCHITECT_INTERVIEW_COMPLETE: 'architect:interview:complete',
  ARCHITECT_BRIEF_GENERATED: 'architect:brief:generated',
  
  // Pulse Events (DevOps)
  PULSE_COMMIT: 'pulse:commit',
  PULSE_PR_OPENED: 'pulse:pr:opened',
  PULSE_PR_MERGED: 'pulse:pr:merged',
  PULSE_PR_CLOSED: 'pulse:pr:closed',
  PULSE_BUILD_START: 'pulse:build:start',
  PULSE_BUILD_SUCCESS: 'pulse:build:success',
  PULSE_BUILD_FAILURE: 'pulse:build:failure',
  PULSE_DEPLOY: 'pulse:deploy',
  PULSE_HEALTH_CHECK: 'pulse:health:check',
  PULSE_DASHBOARD_UPDATE: 'pulse:dashboard:update',
  
  // Ledger Events (Economy)
  LEDGER_CREDIT_EARNED: 'ledger:credit:earned',
  LEDGER_CREDIT_SPENT: 'ledger:credit:spent',
  LEDGER_ROLE_UPDATE: 'ledger:role:update',
  LEDGER_LEADERBOARD_UPDATE: 'ledger:leaderboard:update',
  
  // System Events
  SYSTEM_ERROR: 'system:error',
  SYSTEM_HEALTH: 'system:health',
  SYSTEM_METRICS: 'system:metrics',
} as const;

export type EventType = typeof EventTypes[keyof typeof EventTypes];

/**
 * Base event interface
 */
export interface BaseEvent {
  id: string;
  type: EventType;
  timestamp: Date;
  source: string;
  payload: unknown;
}

/**
 * Architect Interview Events
 */
export interface InterviewStartEvent extends BaseEvent {
  type: typeof EventTypes.ARCHITECT_INTERVIEW_START;
  payload: {
    userId: string;
    threadId: string;
    guildId: string;
  };
}

export interface InterviewMessageEvent extends BaseEvent {
  type: typeof EventTypes.ARCHITECT_INTERVIEW_MESSAGE;
  payload: {
    sessionId: string;
    userId: string;
    message: string;
    isAI: boolean;
  };
}

export interface InterviewCompleteEvent extends BaseEvent {
  type: typeof EventTypes.ARCHITECT_INTERVIEW_COMPLETE;
  payload: {
    sessionId: string;
    userId: string;
    briefId: string;
  };
}

/**
 * Pulse DevOps Events
 */
export interface CommitEvent extends BaseEvent {
  type: typeof EventTypes.PULSE_COMMIT;
  payload: {
    repository: string;
    branch: string;
    commits: Array<{
      sha: string;
      message: string;
      author: string;
      timestamp: string;
    }>;
  };
}

export interface PREvent extends BaseEvent {
  type: typeof EventTypes.PULSE_PR_OPENED | typeof EventTypes.PULSE_PR_MERGED | typeof EventTypes.PULSE_PR_CLOSED;
  payload: {
    repository: string;
    prNumber: number;
    title: string;
    author: string;
    action: 'opened' | 'merged' | 'closed';
  };
}

export interface BuildEvent extends BaseEvent {
  type: typeof EventTypes.PULSE_BUILD_START | typeof EventTypes.PULSE_BUILD_SUCCESS | typeof EventTypes.PULSE_BUILD_FAILURE;
  payload: {
    repository: string;
    buildId: string;
    status: 'running' | 'success' | 'failure';
    duration?: number;
    logs?: string;
  };
}

/**
 * Ledger Economy Events
 */
export interface CreditEvent extends BaseEvent {
  type: typeof EventTypes.LEDGER_CREDIT_EARNED | typeof EventTypes.LEDGER_CREDIT_SPENT;
  payload: {
    userId: string;
    discordId: string;
    amount: number;
    reason: string;
    newBalance: number;
  };
}

export interface RoleUpdateEvent extends BaseEvent {
  type: typeof EventTypes.LEDGER_ROLE_UPDATE;
  payload: {
    userId: string;
    discordId: string;
    action: 'add' | 'remove';
    roleId: string;
    roleName: string;
  };
}
