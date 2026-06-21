const fs = require('fs');
const path = 'c:/Users/sathi/Desktop/Coding Projects/Avenlo Core/avenlo-core/services/gateway/src/handlers/RulesHandler.ts';
let content = fs.readFileSync(path, 'utf-8');

const oldBlock = `  const { memberRoleGranted } = await recordAcceptance(
    guild,
    member,
    config,
    'captcha',
    interaction.message?.id,
  );

  await interaction.reply({
    content: memberRoleGranted
      ? \`✅ Verified! You now have the **Member** role.\`
      : \`✅ Acceptance recorded.\`,
    ephemeral: true,
  });

  logger.info(\`📜 \${member.user.tag} passed captcha + accepted rules in \${guild.name}\`);`;

if (content.includes(oldBlock)) {
  const newBlock = `  // Block rules acceptance until verification is completed
  const isVerified = await hasCompletedVerification(guild.id, member.id);
  if (!isVerified) {
    await interaction.reply({
      content:
        '⚠️ **Please complete verification first.**\\n' +
        'Go to <#1511101077184053388> and click **Begin Verification** to unlock the server.',
      ephemeral: true,
    });
    return;
  }

  // Grant Verified + Member roles now that both verification and rules are complete
  await grantVerifiedAndMember(member);

  const { memberRoleGranted } = await recordAcceptance(
    guild,
    member,
    config,
    'captcha',
    interaction.message?.id,
  );

  await interaction.reply({
    content: memberRoleGranted
      ? \`✅ Verified! You now have the **Member** and **Verified** roles.\`
      : \`✅ Acceptance recorded.\`,
    ephemeral: true,
  });

  logger.info(\`📜 \${member.user.tag} passed captcha + accepted rules in \${guild.name}\`);`;

  content = content.replace(oldBlock, newBlock);
  fs.writeFileSync(path, content, 'utf-8');
  console.log('Fixed handleCaptchaSubmit');
} else {
  console.log('Old block not found - trying alternative');

  // Try finding just by the recordAcceptance line
  const idx = content.indexOf("const { memberRoleGranted } = await recordAcceptance(\n    guild,\n    member,\n    config,\n    'captcha',");
  if (idx !== -1) {
    console.log('Found captcha recordAcceptance at char index', idx);
  } else {
    console.log('Could not find captcha recordAcceptance');
  }
}
