const fs = require('fs');
const path = 'c:/Users/sathi/Desktop/Coding Projects/Avenlo Core/avenlo-core/services/gateway/src/handlers/RulesHandler.ts';
let lines = fs.readFileSync(path, 'utf-8').split('\n');

// Find the extra } after manuallyAcceptRules
for (let i = 0; i < lines.length - 1; i++) {
  if (lines[i].trim() === 'return { ...result, verificationRequired: false };' &&
      lines[i+1].trim() === '}') {
    lines.splice(i+1, 1);
    console.log('Removed extra } at line', i+2);
    fs.writeFileSync(path, lines.join('\n'), 'utf-8');
    break;
  }
}
