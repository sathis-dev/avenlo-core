import sys
path = 'c:/Users/sathi/Desktop/Coding Projects/Avenlo Core/avenlo-core/packages/shared/src/types/events.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add verification events to EventTypes
old = "  KINETIC_THREAT_DETECTED: 'kinetic:threat:detected',"
new = """  KINETIC_THREAT_DETECTED: 'kinetic:threat:detected',

  // ====================================
  // VERIFICATION EVENTS
  // ====================================
  VERIFICATION_STARTED: 'verification:started',
  VERIFICATION_COMPLETED: 'verification:completed',
  VERIFICATION_FAILED: 'verification:failed',
  RAID_LOCKDOWN: 'raid:lockdown',"""
content = content.replace(old, new)

# Add payload interfaces before EventPayloadMap
old2 = """  detectedAt: string;
}

// ====================================
// EVENT REGISTRY - TYPE-SAFE MAPPING
// Uses TypeScript's `keyof` and `infer` for strict typing
// ====================================

/**
 * Maps EventType values to their corresponding payload types.
 * This is the single source of truth for event typing.
 */
export interface EventPayloadMap {"""
new2 = """  detectedAt: string;
}

// ====================================
// VERIFICATION EVENT PAYLOADS
// ====================================

export interface VerificationStartedPayload {
  guildId: string;
  userId: string;
  username: string;
  accountAgeDays: number;
  riskLevel: 'low' | 'medium' | 'high';
  startedAt: string;
}

export interface VerificationCompletedPayload {
  guildId: string;
  userId: string;
  username: string;
  timeTakenMs: number;
  riskLevel: 'low' | 'medium' | 'high';
  stagesPassed: number;
  completedAt: string;
}

export interface VerificationFailedPayload {
  guildId: string;
  userId: string;
  username: string;
  reason: 'timeout' | 'captcha_fail' | 'puzzle_fail' | 'high_risk_alt' | 'raid_lockdown';
  stageReached: number;
  failedAt: string;
}

export interface RaidLockdownPayload {
  guildId: string;
  guildName: string;
  joinCount: number;
  windowMs: number;
  triggeredBy: 'velocity' | 'manual' | 'system';
  lockdownDurationMs: number;
  triggeredAt: string;
}

// ====================================
// EVENT REGISTRY - TYPE-SAFE MAPPING
// Uses TypeScript's `keyof` and `infer` for strict typing
// ====================================

/**
 * Maps EventType values to their corresponding payload types.
 * This is the single source of truth for event typing.
 */
export interface EventPayloadMap {"""
content = content.replace(old2, new2)

# Add entries to EventPayloadMap
old3 = """  // System
  [EventTypes.SYSTEM_ERROR]: SystemErrorPayload;
  [EventTypes.SYSTEM_HEALTH]: SystemHealthPayload;
  [EventTypes.SYSTEM_METRICS]: SystemMetricsPayload;
}"""
new3 = """  // Verification
  [EventTypes.VERIFICATION_STARTED]: VerificationStartedPayload;
  [EventTypes.VERIFICATION_COMPLETED]: VerificationCompletedPayload;
  [EventTypes.VERIFICATION_FAILED]: VerificationFailedPayload;
  [EventTypes.RAID_LOCKDOWN]: RaidLockdownPayload;

  // System
  [EventTypes.SYSTEM_ERROR]: SystemErrorPayload;
  [EventTypes.SYSTEM_HEALTH]: SystemHealthPayload;
  [EventTypes.SYSTEM_METRICS]: SystemMetricsPayload;
}"""
content = content.replace(old3, new3)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated events.ts')
