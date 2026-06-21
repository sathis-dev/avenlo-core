const fs = require('fs');
const path = 'c:/Users/sathi/Desktop/Coding Projects/Avenlo Core/avenlo-core/services/gateway/src/handlers/ServerProtection.ts';
let lines = fs.readFileSync(path, 'utf-8').split('\n');

const idx = lines.findIndex(l => l.includes("verifiedRoleName: 'Verified',"));
if (idx !== -1 && !lines.some(l => l.includes('memberRoleName'))) {
  lines.splice(idx + 1, 0, "    memberRoleName: 'Member',");
  fs.writeFileSync(path, lines.join('\n'), 'utf-8');
  console.log('Added memberRoleName to PROTECTION_CONFIG.quarantine');
} else {
  console.log('memberRoleName already present or not found');
}
