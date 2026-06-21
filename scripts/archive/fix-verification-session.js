const fs = require('fs');
const path = 'c:/Users/sathi/Desktop/Coding Projects/Avenlo Core/avenlo-core/services/gateway/src/handlers/VerificationHandler.ts';
let content = fs.readFileSync(path, 'utf-8');

// 1. Remove unused IVerificationLog import
content = content.replace(
  "  VerificationLog,\n  type IVerificationLog,",
  "  VerificationLog,"
);

// 2. Change interface to extend Record<string, unknown>
content = content.replace(
  'interface VerificationSession {',
  'interface VerificationSession extends Record<string, unknown> {'
);

// 3. Remove all as Record<string, unknown> casts in setSession calls
content = content.replaceAll(
  'await setSession(member.id, session as Record<string, unknown>);',
  'await setSession(member.id, session);'
);

fs.writeFileSync(path, content, 'utf-8');
console.log('Fixed VerificationSession interface and casts');
