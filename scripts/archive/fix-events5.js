const fs = require('fs');
const path = 'c:/Users/sathi/Desktop/Coding Projects/Avenlo Core/avenlo-core/packages/shared/src/types/events.ts';
let lines = fs.readFileSync(path, 'utf-8').split('\n');

// Find line with "// EVENT REGISTRY - TYPE-SAFE MAPPING"
const registryIndex = lines.findIndex(l => l.includes('EVENT REGISTRY - TYPE-SAFE MAPPING'));
console.log('Registry index:', registryIndex);

if (registryIndex === -1) {
  console.log('Could not find EventPayloadMap');
  process.exit(1);
}

// Find the blank line before it
let insertIndex = registryIndex - 1;
while (insertIndex > 0 && lines[insertIndex].trim() === '') insertIndex--;
insertIndex++; // place at the blank line

const payloadInterfaces = [
  '// ====================================',
  '// VERIFICATION EVENT PAYLOADS',
  '// ====================================',
  '',
  'export interface VerificationStartedPayload {',
  "  guildId: string;",
  "  userId: string;",
  "  username: string;",
  "  accountAgeDays: number;",
  "  riskLevel: 'low' | 'medium' | 'high';",
  "  startedAt: string;",
  '};',
  '',
  'export interface VerificationCompletedPayload {',
  "  guildId: string;",
  "  userId: string;",
  "  username: string;",
  "  timeTakenMs: number;",
  "  riskLevel: 'low' | 'medium' | 'high';",
  "  stagesPassed: number;",
  "  completedAt: string;",
  '};',
  '',
  'export interface VerificationFailedPayload {',
  "  guildId: string;",
  "  userId: string;",
  "  username: string;",
  "  reason: 'timeout' | 'captcha_fail' | 'puzzle_fail' | 'high_risk_alt' | 'raid_lockdown';",
  "  stageReached: number;",
  "  failedAt: string;",
  '};',
  '',
  'export interface RaidLockdownPayload {',
  "  guildId: string;",
  "  guildName: string;",
  "  joinCount: number;",
  "  windowMs: number;",
  "  triggeredBy: 'velocity' | 'manual' | 'system';",
  "  lockdownDurationMs: number;",
  "  triggeredAt: string;",
  '};',
  '',
];

// Check if already present
if (!lines.some(l => l.includes('VerificationStartedPayload'))) {
  lines.splice(insertIndex, 0, ...payloadInterfaces);
  console.log('Inserted payload interfaces at line', insertIndex + 1);
} else {
  console.log('Payload interfaces already present');
}

// Now update EventPayloadMap
const systemIndex = lines.findIndex(l => l.includes('[EventTypes.SYSTEM_ERROR]: SystemErrorPayload'));
console.log('SYSTEM_ERROR index:', systemIndex);

if (systemIndex !== -1 && !lines.some(l => l.includes('VERIFICATION_STARTED]: VerificationStartedPayload'))) {
  // Find the blank line or comment before SYSTEM_ERROR
  let mapInsert = systemIndex;
  while (mapInsert > 0 && !lines[mapInsert].includes('//')) mapInsert--;
  
  const mapEntries = [
    '  // Verification',
    '  [EventTypes.VERIFICATION_STARTED]: VerificationStartedPayload;',
    '  [EventTypes.VERIFICATION_COMPLETED]: VerificationCompletedPayload;',
    '  [EventTypes.VERIFICATION_FAILED]: VerificationFailedPayload;',
    '  [EventTypes.RAID_LOCKDOWN]: RaidLockdownPayload;',
    '',
  ];
  
  lines.splice(mapInsert, 0, ...mapEntries);
  console.log('Inserted EventPayloadMap entries at line', mapInsert + 1);
} else if (lines.some(l => l.includes('VERIFICATION_STARTED]: VerificationStartedPayload'))) {
  console.log('EventPayloadMap already updated');
} else {
  console.log('Could not find SYSTEM_ERROR in EventPayloadMap');
}

fs.writeFileSync(path, lines.join('\n'), 'utf-8');
console.log('Done');
