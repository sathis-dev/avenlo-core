const fs = require('fs');
const path = 'c:/Users/sathi/Desktop/Coding Projects/Avenlo Core/avenlo-core/services/gateway/src/commands/index.ts';
let lines = fs.readFileSync(path, 'utf-8').split('\n');

const idx = lines.findIndex(l => l.includes('rulesCommand,'));
if (idx !== -1 && !lines.some(l => l.includes('verifyCommand,'))) {
  lines.splice(idx + 1, 0, '  verifyCommand,');
  fs.writeFileSync(path, lines.join('\n'), 'utf-8');
  console.log('Added verifyCommand to array at line', idx + 2);
} else {
  console.log('verifyCommand already present or rulesCommand not found');
}
