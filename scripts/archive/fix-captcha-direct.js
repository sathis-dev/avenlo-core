const fs = require('fs');
const path = 'c:/Users/sathi/Desktop/Coding Projects/Avenlo Core/avenlo-core/services/gateway/src/handlers/RulesHandler.ts';
let lines = fs.readFileSync(path, 'utf-8').split('\n');

// Line 568 (0-indexed 567) is where we want to insert
const insertIdx = 568;
if (insertIdx < lines.length) {
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
  lines.splice(insertIdx, 0, ...block);

  // Fix success message - should be around line 590 now
  for (let i = insertIdx; i < Math.min(insertIdx + 30, lines.length); i++) {
    if (lines[i].includes('✅ Verified! You now have the **Member** role.')) {
      lines[i] = lines[i].replace('✅ Verified! You now have the **Member** role.', '✅ Verified! You now have the **Member** and **Verified** roles.');
      break;
    }
  }

  fs.writeFileSync(path, lines.join('\n'), 'utf-8');
  console.log('Fixed handleCaptchaSubmit at line', insertIdx + 1);
} else {
  console.log('Line index out of bounds');
}
