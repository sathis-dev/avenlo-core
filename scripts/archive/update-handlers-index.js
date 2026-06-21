const fs = require('fs');
const path = 'c:/Users/sathi/Desktop/Coding Projects/Avenlo Core/avenlo-core/services/gateway/src/handlers/index.ts';
let lines = fs.readFileSync(path, 'utf-8').split('\n');

const idx = lines.findIndex(l => l.includes("export * from './ServerProtection';"));
if (idx !== -1 && !lines.some(l => l.includes("export * from './VerificationHandler';"))) {
  lines.splice(idx + 1, 0, "export * from './VerificationHandler';");
  fs.writeFileSync(path, lines.join('\n'), 'utf-8');
  console.log('Added VerificationHandler export at line', idx + 2);
} else {
  console.log('VerificationHandler already present or ServerProtection not found');
}
