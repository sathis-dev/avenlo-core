const fs = require('fs');
const path = 'c:/Users/sathi/Desktop/Coding Projects/Avenlo Core/avenlo-core/services/gateway/src/handlers/RulesHandler.ts';
let lines = fs.readFileSync(path, 'utf-8').split('\n');

// Find the exact line with the captcha recordAcceptance
let insertIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === "const { memberRoleGranted } = await recordAcceptance(" &&
      i + 2 < lines.length && lines[i + 2].trim() === "config,") {
    // Check if the line 2 down has 'captcha' to distinguish from button flow
    if (i + 3 < lines.length && lines[i + 3].includes("'captcha'")) {
      insertIdx = i;
      break;
    }
  }
}

if (insertIdx !== -1) {
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

  // Fix success message
  for (let i = insertIdx; i < Math.min(insertIdx + 30, lines.length); i++) {
    if (lines[i].includes('✅ Verified! You now have the **Member** role.')) {
      lines[i] = lines[i].replace('✅ Verified! You now have the **Member** role.', '✅ Verified! You now have the **Member** and **Verified** roles.');
      break;
    }
  }

  fs.writeFileSync(path, lines.join('\n'), 'utf-8');
  console.log('Fixed handleCaptchaSubmit at line', insertIdx + 1);
} else {
  console.log('Could not find captcha recordAcceptance');
}
