const fs = require('fs');
const path = 'c:/Users/sathi/Desktop/Coding Projects/Avenlo Core/avenlo-core/services/gateway/src/client.ts';
let lines = fs.readFileSync(path, 'utf-8').split('\n');

// 1. Add VerificationHandlers import after ServerProtection
const spIdx = lines.findIndex(l => l.includes("import { ServerProtection } from './handlers/ServerProtection';"));
if (spIdx !== -1 && !lines.some(l => l.includes("import { VerificationHandlers } from './handlers/VerificationHandler';"))) {
  lines.splice(spIdx + 1, 0, "import { VerificationHandlers } from './handlers/VerificationHandler';");
  console.log('Added VerificationHandlers import');
}

// 2. Update handleMemberJoin to include quarantine
const memberJoinIdx = lines.findIndex(l => l.includes('private async handleMemberJoin(member: GuildMember): Promise<void>'));
if (memberJoinIdx !== -1) {
  // Find the line with `await WelcomeHandlers.handleMemberJoin(member);`
  let welcomeLine = -1;
  for (let i = memberJoinIdx; i < Math.min(i + 30, lines.length); i++) {
    if (lines[i].includes('await WelcomeHandlers.handleMemberJoin(member);')) {
      welcomeLine = i;
      break;
    }
  }
  if (welcomeLine !== -1 && !lines.some(l => l.includes('await VerificationHandlers.quarantineMember(member);'))) {
    lines.splice(welcomeLine, 0, '    // Quarantine new member before welcome');
    lines.splice(welcomeLine + 1, 0, '    await VerificationHandlers.quarantineMember(member);');
    console.log('Added quarantineMember call in handleMemberJoin');
  }
}

// 3. Update handleButton verify routing
const handleButtonIdx = lines.findIndex(l => l.includes('private async handleButton(interaction: ButtonInteraction): Promise<void>'));
if (handleButtonIdx !== -1) {
  // Find the old verify block and replace it
  let verifyBlockStart = -1;
  for (let i = handleButtonIdx; i < Math.min(i + 60, lines.length); i++) {
    if (lines[i].includes("// Handle verification buttons") && lines[i+1].includes("if (action === 'verify')")) {
      verifyBlockStart = i;
      break;
    }
  }
  if (verifyBlockStart !== -1) {
    // Find end of verify block (next blank line or next handler comment)
    let verifyBlockEnd = verifyBlockStart;
    for (let i = verifyBlockStart; i < lines.length && i < verifyBlockStart + 10; i++) {
      if (lines[i].trim() === '' && lines[i+1] && lines[i+1].includes('// Handle ticket')) {
        verifyBlockEnd = i;
        break;
      }
    }
    // Replace the block
    const newBlock = [
      '    // Handle verification buttons',
      "    if (action === 'verify') {",
      "      if (subAction === 'start') {",
      '        await VerificationHandlers.handleBeginVerification(interaction);',
      '        return;',
      '      }',
      "      if (subAction === 'puzzle') {",
      '        const puzzleIndex = params[0];',
      '        await VerificationHandlers.handlePuzzleClick(interaction, puzzleIndex);',
      '        return;',
      '      }',
      "      if (subAction === 'request_review') {",
      '        await VerificationHandlers.handleRequestReview(interaction);',
      '        return;',
      '      }',
      '    }',
    ];
    lines.splice(verifyBlockStart, verifyBlockEnd - verifyBlockStart + 1, ...newBlock);
    console.log('Replaced verify button block');
  }
}

// 4. Update handleModal to route verify:captcha_submit
const handleModalIdx = lines.findIndex(l => l.includes('private async handleModal(interaction: ModalSubmitInteraction): Promise<void>'));
if (handleModalIdx !== -1) {
  // Find the rules captcha modal block end
  let insertIdx = -1;
  for (let i = handleModalIdx; i < Math.min(i + 30, lines.length); i++) {
    if (lines[i].includes("await RulesHandlers.handleCaptchaSubmit(interaction);")) {
      insertIdx = i + 1; // after return;
      break;
    }
  }
  if (insertIdx !== -1) {
    // Check if already inserted
    const hasVerifyModal = lines.some(l => l.includes("action === 'verify' && subAction === 'captcha_submit'"));
    if (!hasVerifyModal) {
      const newBlock = [
        '',
        '    // Handle verification captcha modal',
        "    if (action === 'verify' && subAction === 'captcha_submit') {",
        '      await VerificationHandlers.handleCaptchaSubmit(interaction);',
        '      return;',
        '    }',
      ];
      lines.splice(insertIdx, 0, ...newBlock);
      console.log('Added verify captcha modal route');
    }
  }
}

fs.writeFileSync(path, lines.join('\n'), 'utf-8');
console.log('Done updating client.ts');
