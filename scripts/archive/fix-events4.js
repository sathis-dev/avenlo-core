const fs = require('fs');
const path = 'c:/Users/sathi/Desktop/Coding Projects/Avenlo Core/avenlo-core/packages/shared/src/types/events.ts';
let content = fs.readFileSync(path, 'utf-8');

// Add payload interfaces before EventPayloadMap
const beforeMap = `// ====================================
// EVENT REGISTRY - TYPE-SAFE MAPPING`;

const payloadInterfaces = `// ====================================
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
// EVENT REGISTRY - TYPE-SAFE MAPPING`;

if (!content.includes('VerificationStartedPayload')) {
  content = content.replace(beforeMap, payloadInterfaces);
  console.log('Added payload interfaces');
} else {
  console.log('Payload interfaces already present');
}

// Update EventPayloadMap
const beforeSystem = `  // System
  [EventTypes.SYSTEM_ERROR]: SystemErrorPayload;
  [EventTypes.SYSTEM_HEALTH]: SystemHealthPayload;
  [EventTypes.SYSTEM_METRICS]: SystemMetricsPayload;
}`;

const withVerification = `  // Verification
  [EventTypes.VERIFICATION_STARTED]: VerificationStartedPayload;
  [EventTypes.VERIFICATION_COMPLETED]: VerificationCompletedPayload;
  [EventTypes.VERIFICATION_FAILED]: VerificationFailedPayload;
  [EventTypes.RAID_LOCKDOWN]: RaidLockdownPayload;

  // System
  [EventTypes.SYSTEM_ERROR]: SystemErrorPayload;
  [EventTypes.SYSTEM_HEALTH]: SystemHealthPayload;
  [EventTypes.SYSTEM_METRICS]: SystemMetricsPayload;
}`;

if (!content.includes('VERIFICATION_STARTED]: VerificationStartedPayload')) {
  content = content.replace(beforeSystem, withVerification);
  console.log('Updated EventPayloadMap');
} else {
  console.log('EventPayloadMap already updated');
}

fs.writeFileSync(path, content, 'utf-8');
console.log('Done');
