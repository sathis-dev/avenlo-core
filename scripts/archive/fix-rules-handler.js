const fs = require('fs');
const path = 'c:/Users/sathi/Desktop/Coding Projects/Avenlo Core/avenlo-core/services/gateway/src/handlers/RulesHandler.ts';
let lines = fs.readFileSync(path, 'utf-8').split('\n');

// Find the broken block starting at line 568 (0-indexed 567)
let startIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const { memberRoleGranted } = await recordAcceptance(') &&
      i + 1 < lines.length && lines[i+1].includes('// Block rules acceptance')) {
    startIdx = i;
    break;
  }
}

if (startIdx !== -1) {
  // Find the end of the broken block - the closing ); after interaction.message?.id,
  let endIdx = -1;
  for (let i = startIdx; i < Math.min(startIdx + 30, lines.length); i++) {
    if (lines[i].trim() === ');') {
      endIdx = i;
      break;
    }
  }

  if (endIdx !== -1) {
    const newBlock = [
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
      '  const { memberRoleGranted } = await recordAcceptance(',
      '    guild,',
      '    member,',
      '    config,',
      "    'captcha',",
      '    interaction.message?.id,',
      '  );',
    ];
    lines.splice(startIdx, endIdx - startIdx + 1, ...newBlock);
    fs.writeFileSync(path, lines.join('\n'), 'utf-8');
    console.log('Fixed broken captcha block from lines', startIdx+1, 'to', endIdx+1);
  } else {
    console.log('Could not find end of broken block');
  }
} else {
  console.log('Could not find broken block');
}
