const fs = require('fs');
const path = 'c:/Users/sathi/Desktop/Coding Projects/Avenlo Core/avenlo-core/services/gateway/src/handlers/RulesHandler.ts';
let lines = fs.readFileSync(path, 'utf-8').split('\n');

// 1. Add VerificationHandler import after RulesConfigStore import
const importIdx = lines.findIndex(l => l.includes("import { rulesConfigStore } from './RulesConfigStore';"));
if (importIdx !== -1 && !lines.some(l => l.includes("import { hasCompletedVerification"))) {
  lines.splice(importIdx + 1, 0, "import { hasCompletedVerification, grantVerifiedAndMember } from './VerificationHandler';");
  console.log('Added VerificationHandler import at line', importIdx + 2);
}

// 2. Find handleAcceptButton and add verification check before recordAcceptance
const acceptBtnIdx = lines.findIndex(l => l.includes('export async function handleAcceptButton('));
if (acceptBtnIdx !== -1) {
  // Find the recordAcceptance call
  let recordIdx = -1;
  for (let i = acceptBtnIdx; i < Math.min(i + 30, lines.length); i++) {
    if (lines[i].includes('const { memberRoleGranted } = await recordAcceptance(')) {
      recordIdx = i;
      break;
    }
  }

  if (recordIdx !== -1 && !lines.some(l => l.includes('isVerified = await hasCompletedVerification'))) {
    const block = [
      '  // Block rules acceptance until verification is completed',
      '  const isVerified = await hasCompletedVerification(guild.id, member.id);',
      '  if (!isVerified) {',
      '    await interaction.reply({',
      '      content:',
      "        '⚠️ **Please complete verification first.**\\n' +",
      "        'Go to <#1511101077184053388> and click **Begin Verification** to unlock the server.',",
      '      ephemeral: true,',
      '    });',
      '    return;',
      '  }',
      '',
      '  // Grant Verified + Member roles now that both verification and rules are complete',
      '  await grantVerifiedAndMember(member);',
      '',
    ];
    lines.splice(recordIdx, 0, ...block);
    console.log('Added verification check in handleAcceptButton at line', recordIdx + 1);

    // Update the success message
    for (let i = recordIdx; i < Math.min(i + 25, lines.length); i++) {
      if (lines[i].includes('You now have the **Member** role')) {
        lines[i] = lines[i].replace('You now have the **Member** role', 'You now have the **Member** and **Verified** roles');
        console.log('Updated success message in handleAcceptButton');
        break;
      }
    }
  }
}

// 3. Find handleCaptchaSubmit and add verification check before recordAcceptance
const captchaIdx = lines.findIndex(l => l.includes('export async function handleCaptchaSubmit('));
if (captchaIdx !== -1) {
  let recordIdx = -1;
  for (let i = captchaIdx; i < Math.min(i + 40, lines.length); i++) {
    if (lines[i].includes('const { memberRoleGranted } = await recordAcceptance(')) {
      recordIdx = i;
      break;
    }
  }

  if (recordIdx !== -1 && !lines.some(l => l.includes('isVerified = await hasCompletedVerification'))) {
    const block = [
      '  // Block rules acceptance until verification is completed',
      '  const isVerified = await hasCompletedVerification(guild.id, member.id);',
      '  if (!isVerified) {',
      '    await interaction.reply({',
      '      content:',
      "        '⚠️ **Please complete verification first.**\\n' +",
      "        'Go to <#1511101077184053388> and click **Begin Verification** to unlock the server.',",
      '      ephemeral: true,',
      '    });',
      '    return;',
      '  }',
      '',
      '  // Grant Verified + Member roles now that both verification and rules are complete',
      '  await grantVerifiedAndMember(member);',
      '',
    ];
    lines.splice(recordIdx, 0, ...block);
    console.log('Added verification check in handleCaptchaSubmit at line', recordIdx + 1);

    // Update success message
    for (let i = recordIdx; i < Math.min(i + 25, lines.length); i++) {
      if (lines[i].includes('✅ Verified! You now have the **Member** role.')) {
        lines[i] = lines[i].replace('✅ Verified! You now have the **Member** role.', '✅ Verified! You now have the **Member** and **Verified** roles.');
        console.log('Updated success message in handleCaptchaSubmit');
        break;
      }
    }
  }
}

// 4. Update manuallyAcceptRules
const manualIdx = lines.findIndex(l => l.includes('export async function manuallyAcceptRules('));
if (manualIdx !== -1) {
  let endIdx = -1;
  for (let i = manualIdx; i < Math.min(i + 10, lines.length); i++) {
    if (lines[i].includes('return recordAcceptance(')) {
      endIdx = i;
      break;
    }
  }
  if (endIdx !== -1) {
    const newBlock = [
      'export async function manuallyAcceptRules(guild: Guild, member: GuildMember): Promise<{ memberRoleGranted: boolean; verificationRequired: boolean }> {',
      '  const isVerified = await hasCompletedVerification(guild.id, member.id);',
      '  if (!isVerified) {',
      '    return { memberRoleGranted: false, verificationRequired: true };',
      '  }',
      '',
      '  const config = await rulesConfigStore.get(guild.id);',
      '  await grantVerifiedAndMember(member);',
      '  const result = await recordAcceptance(guild, member, config, \'command\');',
      '  return { ...result, verificationRequired: false };',
      '}',
    ];
    lines.splice(manualIdx, endIdx - manualIdx + 1, ...newBlock);
    console.log('Updated manuallyAcceptRules at line', manualIdx + 1);
  }
}

fs.writeFileSync(path, lines.join('\n'), 'utf-8');
console.log('Done updating RulesHandler.ts');
