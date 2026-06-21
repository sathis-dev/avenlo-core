const fs = require('fs');
const path = 'c:/Users/sathi/Desktop/Coding Projects/Avenlo Core/avenlo-core/packages/shared/src/types/events.ts';
let content = fs.readFileSync(path, 'utf-8');

const dup = `  // ====================================
  // VERIFICATION EVENTS
  // ====================================
  VERIFICATION_STARTED: 'verification:started',
  VERIFICATION_COMPLETED: 'verification:completed',
  VERIFICATION_FAILED: 'verification:failed',
  RAID_LOCKDOWN: 'raid:lockdown',

  // ====================================
  // VERIFICATION EVENTS
  // ====================================
  VERIFICATION_STARTED: 'verification:started',
  VERIFICATION_COMPLETED: 'verification:completed',
  VERIFICATION_FAILED: 'verification:failed',
  RAID_LOCKDOWN: 'raid:lockdown',`;

const fixed = `  // ====================================
  // VERIFICATION EVENTS
  // ====================================
  VERIFICATION_STARTED: 'verification:started',
  VERIFICATION_COMPLETED: 'verification:completed',
  VERIFICATION_FAILED: 'verification:failed',
  RAID_LOCKDOWN: 'raid:lockdown',`;

content = content.replace(dup, fixed);
fs.writeFileSync(path, content, 'utf-8');
console.log('Fixed duplicate events');
