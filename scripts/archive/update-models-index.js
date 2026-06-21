const fs = require('fs');
const path = 'c:/Users/sathi/Desktop/Coding Projects/Avenlo Core/avenlo-core/packages/shared/src/models/index.ts';
let content = fs.readFileSync(path, 'utf-8');

const oldLine = "export * from './RuleAcceptance';";
const newLine = "export * from './RuleAcceptance';\nexport * from './VerificationLog';";

if (!content.includes('VerificationLog')) {
  content = content.replace(oldLine, newLine);
  fs.writeFileSync(path, content, 'utf-8');
  console.log('Added VerificationLog export');
} else {
  console.log('VerificationLog export already present');
}
