const fs = require('fs');

// Fix VerificationHandler.ts
const vhPath = 'c:/Users/sathi/Desktop/Coding Projects/Avenlo Core/avenlo-core/services/gateway/src/handlers/VerificationHandler.ts';
let vhContent = fs.readFileSync(vhPath, 'utf-8');
vhContent = vhContent.replace(/export async function handleCaptchaSubmit\(/g, 'export async function handleVerificationCaptcha(');
vhContent = vhContent.replace(/handleCaptchaSubmit,/g, 'handleVerificationCaptcha,');
fs.writeFileSync(vhPath, vhContent, 'utf-8');
console.log('Renamed in VerificationHandler.ts');

// Fix client.ts
const clientPath = 'c:/Users/sathi/Desktop/Coding Projects/Avenlo Core/avenlo-core/services/gateway/src/client.ts';
let clientContent = fs.readFileSync(clientPath, 'utf-8');
clientContent = clientContent.replace(
  'await VerificationHandlers.handleCaptchaSubmit(interaction);',
  'await VerificationHandlers.handleVerificationCaptcha(interaction);'
);
fs.writeFileSync(clientPath, clientContent, 'utf-8');
console.log('Updated client.ts');
