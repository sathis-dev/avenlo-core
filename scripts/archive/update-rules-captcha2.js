const fs = require('fs');
const path = 'c:/Users/sathi/Desktop/Coding Projects/Avenlo Core/avenlo-core/services/gateway/src/handlers/RulesHandler.ts';
let lines = fs.readFileSync(path, 'utf-8').split('\n');

const captchaIdx = lines.findIndex(l => l.includes('export async function handleCaptchaSubmit('));
if (captchaIdx !== -1) {
  let recordIdx = -1;
  for (let i = captchaIdx; i < Math.min(i + 40, lines.length); i++) {
    if (lines[i].includes('const { memberRoleGranted } = await recordAcceptance(')) {
      // Check if this is the captcha one by looking at the line two lines down for 'captcha'
      if (lines[i+2] && lines[i+2].includes("'captcha'")) {
        recordIdx = i;
        break;
      }
    }
  }

  if (recordIdx !== -1) {
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
    for (let i = recordIdx; i < Math.min(i + 30, lines.length); i++) {
      if (lines[i].includes('✅ Verified! You now have the **Member** role.')) {
        lines[i] = lines[i].replace('✅ Verified! You now have the **Member** role.', '✅ Verified! You now have the **Member** and **Verified** roles.');
        console.log('Updated success message in handleCaptchaSubmit at line', i + 1);
        break;
      }
    }

    fs.writeFileSync(path, lines.join('\n'), 'utf-8');
    console.log('Done');
  } else {
    console.log('Could not find captcha recordAcceptance');
  }
} else {
  console.log('Could not find handleCaptchaSubmit');
}
