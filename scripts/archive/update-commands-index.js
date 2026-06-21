const fs = require('fs');
const path = 'c:/Users/sathi/Desktop/Coding Projects/Avenlo Core/avenlo-core/services/gateway/src/commands/index.ts';
let content = fs.readFileSync(path, 'utf-8');

// Add import
if (!content.includes("import { verifyCommand } from './verify';")) {
  const importMarker = "import { rulesCommand } from './rules';";
  const newImport = "import { rulesCommand } from './rules';\nimport { verifyCommand } from './verify';";
  content = content.replace(importMarker, newImport);
  console.log('Added verifyCommand import');
}

// Add to array
if (!content.includes('verifyCommand')) {
  const arrayMarker = '  rulesCommand,';
  const newArray = '  rulesCommand,\n  verifyCommand,';
  content = content.replace(arrayMarker, newArray);
  console.log('Added verifyCommand to array');
}

fs.writeFileSync(path, content, 'utf-8');
console.log('Done');
