const fs = require('fs');
const path = 'c:/Users/sathi/Desktop/Coding Projects/Avenlo Core/avenlo-core/services/gateway/src/handlers/ServerProtection.ts';
let lines = fs.readFileSync(path, 'utf-8').split('\n');

const idx = lines.findIndex(l => l.includes("verificationChannelName: 'verification',"));
if (idx !== -1 && !lines.some(l => l.includes('verificationChannelId'))) {
  lines.splice(idx + 1, 0, "    verificationChannelId: '1511101077184053388',");
  fs.writeFileSync(path, lines.join('\n'), 'utf-8');
  console.log('Added verificationChannelId');
} else {
  console.log('verificationChannelId already present or marker not found');
}
