const fs = require('fs');
const path = 'c:/Users/sathi/Desktop/Coding Projects/Avenlo Core/avenlo-core/services/gateway/src/commands/rules.ts';
let lines = fs.readFileSync(path, 'utf-8').split('\n');

// Find the manuallyAcceptRules call in /rules accept
let acceptIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const { memberRoleGranted } = await manuallyAcceptRules(')) {
    acceptIdx = i;
    break;
  }
}

if (acceptIdx !== -1) {
  // Replace the destructuring
  lines[acceptIdx] = lines[acceptIdx].replace(
    'const { memberRoleGranted } = await manuallyAcceptRules(',
    'const { memberRoleGranted, verificationRequired } = await manuallyAcceptRules('
  );

  // Find the reply block after it
  let replyIdx = -1;
  for (let i = acceptIdx; i < Math.min(i + 15, lines.length); i++) {
    if (lines[i].includes("await interaction.reply({") && lines[i+1].includes('content: memberRoleGranted')) {
      replyIdx = i;
      break;
    }
  }

  if (replyIdx !== -1) {
    const newBlock = [
      '      if (verificationRequired) {',
      '        await interaction.reply({',
      '          content:',
      "            '⚠️ **Please complete verification first.**\\n' +",
      "            'Go to <#1511101077184053388> and click **Begin Verification** before accepting the rules.',",
      '          ephemeral: true,',
      '        });',
      '        return;',
      '      }',
      "      await interaction.reply({",
      '        content: memberRoleGranted',
      '          ? \'✅ Acceptance recorded — you now have the **Member** and **Verified** roles.\'',
      '          : \'✅ Acceptance recorded.\',',
      '        ephemeral: true,',
      '      });',
    ];
    // Find the end of the old reply block
    let endIdx = replyIdx;
    for (let i = replyIdx; i < Math.min(i + 10, lines.length); i++) {
      if (lines[i].includes('});') && lines[i+1].trim() === 'return;') {
        endIdx = i + 1;
        break;
      }
    }
    lines.splice(replyIdx, endIdx - replyIdx + 1, ...newBlock);
    console.log('Updated rules.ts /rules accept');
  } else {
    console.log('Could not find reply block in rules.ts');
  }
} else {
  console.log('Could not find manuallyAcceptRules call in rules.ts');
}

fs.writeFileSync(path, lines.join('\n'), 'utf-8');
