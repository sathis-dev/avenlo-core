const fs = require('fs');
const path = 'c:/Users/sathi/Desktop/Coding Projects/Avenlo Core/avenlo-core/services/gateway/src/client.ts';
let lines = fs.readFileSync(path, 'utf-8').split('\n');

const startIdx = lines.findIndex(l => l.includes("// Handle rules captcha modal"));
if (startIdx === -1) {
  console.log('Could not find rules captcha modal block');
  process.exit(1);
}

// Find the malformed inner block start
const innerStart = lines.findIndex((l, i) => i > startIdx && l.includes("// Handle verification captcha modal"));
const endIdx = lines.findIndex((l, i) => i > innerStart && l.trim() === '' && lines[i-1].trim() === '}');

console.log('Start:', startIdx, 'Inner:', innerStart, 'End:', endIdx);

if (startIdx !== -1 && innerStart !== -1 && endIdx !== -1) {
  const newBlock = [
    "    // Handle rules captcha modal",
    "    if (action === 'rules' && subAction === 'captcha-submit') {",
    "      await RulesHandlers.handleCaptchaSubmit(interaction);",
    "      return;",
    "    }",
    "",
    "    // Handle verification captcha modal",
    "    if (action === 'verify' && subAction === 'captcha_submit') {",
    "      await VerificationHandlers.handleCaptchaSubmit(interaction);",
    "      return;",
    "    }",
  ];
  lines.splice(startIdx, endIdx - startIdx + 1, ...newBlock);
  fs.writeFileSync(path, lines.join('\n'), 'utf-8');
  console.log('Fixed modal routing block');
} else {
  console.log('Could not locate block boundaries');
}
