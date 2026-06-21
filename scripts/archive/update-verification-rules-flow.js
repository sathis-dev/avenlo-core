const fs = require('fs');

// ==========================================
// 1. Update VerificationHandler.ts
// ==========================================
const vhPath = 'c:/Users/sathi/Desktop/Coding Projects/Avenlo Core/avenlo-core/services/gateway/src/handlers/VerificationHandler.ts';
let vh = fs.readFileSync(vhPath, 'utf-8');

// 1a. Replace grantVerifiedAccess with removeQuarantineRole + grantVerifiedAndMember
const oldGrant = `async function grantVerifiedAccess(member: GuildMember): Promise<void> {
  const config = PROTECTION_CONFIG.quarantine;
  const guild = member.guild;

  // Remove Quarantine role
  const quarantineRole = guild.roles.cache.find(
    (r) => r.name === config.quarantineRoleName
  );
  if (quarantineRole) {
    try {
      await member.roles.remove(quarantineRole, 'Verification completed');
    } catch (err) {
      logger.error('Failed to remove Quarantine role:', err);
    }
  }

  // Add Verified role
  const verifiedRole = guild.roles.cache.find(
    (r) => r.name === config.verifiedRoleName
  );
  if (verifiedRole) {
    try {
      await member.roles.add(verifiedRole, 'Verification completed');
    } catch (err) {
      logger.error('Failed to add Verified role:', err);
    }
  }

  // Add Member role
  const memberRole = guild.roles.cache.find(
    (r) => r.name === config.memberRoleName
  );
  if (memberRole) {
    try {
      await member.roles.add(memberRole, 'Verification completed');
    } catch (err) {
      logger.error('Failed to add Member role:', err);
    }
  }

  // Also handle legacy verifiedRoleId if configured
  if (PROTECTION_CONFIG.verification.verifiedRoleId) {
    try {
      const legacyRole = guild.roles.cache.get(
        PROTECTION_CONFIG.verification.verifiedRoleId
      );
      if (legacyRole) {
        await member.roles.add(legacyRole, 'Verification completed');
      }
    } catch (err) {
      logger.error('Failed to add legacy verified role:', err);
    }
  }
}`;

const newGrant = `async function removeQuarantineRole(member: GuildMember): Promise<void> {
  const config = PROTECTION_CONFIG.quarantine;
  const guild = member.guild;

  // Remove Quarantine role
  const quarantineRole = guild.roles.cache.find(
    (r) => r.name === config.quarantineRoleName
  );
  if (quarantineRole) {
    try {
      await member.roles.remove(quarantineRole, 'Verification completed');
    } catch (err) {
      logger.error('Failed to remove Quarantine role:', err);
    }
  }
}

export async function grantVerifiedAndMember(member: GuildMember): Promise<void> {
  const config = PROTECTION_CONFIG.quarantine;
  const guild = member.guild;

  // Add Verified role
  const verifiedRole = guild.roles.cache.find(
    (r) => r.name === config.verifiedRoleName
  );
  if (verifiedRole) {
    try {
      await member.roles.add(verifiedRole, 'Rules accepted after verification');
    } catch (err) {
      logger.error('Failed to add Verified role:', err);
    }
  }

  // Add Member role
  const memberRole = guild.roles.cache.find(
    (r) => r.name === config.memberRoleName
  );
  if (memberRole) {
    try {
      await member.roles.add(memberRole, 'Rules accepted after verification');
    } catch (err) {
      logger.error('Failed to add Member role:', err);
    }
  }

  // Also handle legacy verifiedRoleId if configured
  if (PROTECTION_CONFIG.verification.verifiedRoleId) {
    try {
      const legacyRole = guild.roles.cache.get(
        PROTECTION_CONFIG.verification.verifiedRoleId
      );
      if (legacyRole) {
        await member.roles.add(legacyRole, 'Rules accepted after verification');
      }
    } catch (err) {
      logger.error('Failed to add legacy verified role:', err);
    }
  }
}

export async function hasCompletedVerification(
  guildId: string,
  userId: string
): Promise<boolean> {
  try {
    const log = await VerificationLog.findOne({
      guildId,
      userId,
      status: 'completed',
    })
      .sort({ createdAt: -1 })
      .exec();
    return log !== null;
  } catch (err) {
    logger.error('Failed to check verification status:', err);
    return false;
  }
}`;

if (vh.includes(oldGrant)) {
  vh = vh.replace(oldGrant, newGrant);
  console.log('Updated VerificationHandler.ts: replaced grantVerifiedAccess');
} else {
  console.log('WARNING: Could not find oldGrant block in VerificationHandler.ts');
}

// 1b. Update Stage 3 success handler to NOT grant roles, just remove quarantine
const oldSuccess = `  // SUCCESS
  const timeTakenMs = Date.now() - session.startedAt;
  session.stage = 'complete';
  await setSession(member.id, session);

  await grantVerifiedAccess(member);
  await logVerificationComplete(member, session, timeTakenMs);`;

const newSuccess = `  // SUCCESS — verification passed, but roles are held until rules are accepted
  const timeTakenMs = Date.now() - session.startedAt;
  session.stage = 'complete';
  await setSession(member.id, session);

  await removeQuarantineRole(member);
  await logVerificationComplete(member, session, timeTakenMs);`;

if (vh.includes(oldSuccess)) {
  vh = vh.replace(oldSuccess, newSuccess);
  console.log('Updated VerificationHandler.ts: Stage 3 now only removes quarantine');
} else {
  console.log('WARNING: Could not find oldSuccess block');
}

// 1c. Update success embed message to direct to rules channel
const oldSuccessEmbed = `  const successEmbed = new EmbedBuilder()
    .setColor(AvenloColors.GREEN)
    .setTitle('Verification Complete')
    .setDescription(
      'You have been verified and granted access to the server. Welcome!'
    )
    .setFooter({ text: AvenloBranding.footer })
    .setTimestamp();`;

const newSuccessEmbed = `  const successEmbed = new EmbedBuilder()
    .setColor(AvenloColors.GREEN)
    .setTitle('Stage 3 Complete')
    .setDescription(
      '**Security check passed!**\n\n' +
        'One last step: go to the rules channel and click **✅ I Accept the Rules** to unlock full server access.\n\n' +
        'Welcome to the community!'
    )
    .setFooter({ text: AvenloBranding.footer })
    .setTimestamp();`;

if (vh.includes(oldSuccessEmbed)) {
  vh = vh.replace(oldSuccessEmbed, newSuccessEmbed);
  console.log('Updated VerificationHandler.ts: success embed now directs to rules');
} else {
  console.log('WARNING: Could not find oldSuccessEmbed block');
}

// 1d. Update exports
const oldExports = `export const VerificationHandlers = {
  handleBeginVerification,
  handleVerificationCaptcha,
  handlePuzzleClick,
  handleRequestReview,
  quarantineMember,
};`;

const newExports = `export const VerificationHandlers = {
  handleBeginVerification,
  handleVerificationCaptcha,
  handlePuzzleClick,
  handleRequestReview,
  quarantineMember,
  grantVerifiedAndMember,
  hasCompletedVerification,
};`;

if (vh.includes(oldExports)) {
  vh = vh.replace(oldExports, newExports);
  console.log('Updated VerificationHandler.ts exports');
} else {
  console.log('WARNING: Could not find old exports block');
}

fs.writeFileSync(vhPath, vh, 'utf-8');

// ==========================================
// 2. Update RulesHandler.ts
// ==========================================
const rhPath = 'c:/Users/sathi/Desktop/Coding Projects/Avenlo Core/avenlo-core/services/gateway/src/handlers/RulesHandler.ts';
let rh = fs.readFileSync(rhPath, 'utf-8');

// 2a. Add import for verification helpers
const oldImports = `import { resolveTextChannel } from './ChannelResolver';
import { liveBus } from './LiveBus';
import { rulesConfigStore } from './RulesConfigStore';`;

const newImports = `import { resolveTextChannel } from './ChannelResolver';
import { liveBus } from './LiveBus';
import { rulesConfigStore } from './RulesConfigStore';
import { hasCompletedVerification, grantVerifiedAndMember } from './VerificationHandler';`;

if (rh.includes(oldImports)) {
  rh = rh.replace(oldImports, newImports);
  console.log('Updated RulesHandler.ts imports');
} else {
  console.log('WARNING: Could not find RulesHandler imports');
}

// 2b. Update handleAcceptButton to check verification first
const oldHandleAccept = `  const { memberRoleGranted } = await recordAcceptance(
    guild,
    member,
    config,
    'button',
    interaction.message.id,
  );

  const lines = [
    \`✅ **Thanks for accepting the rules, \${interaction.user}!**\`,
    '',
    memberRoleGranted
      ? \`You now have the **Member** role — full server access unlocked.\`
      : \`Acceptance recorded. (No member role configured — ask an admin to set one in the dashboard.)\`,
  ];

  await interaction.reply({
    content: lines.join('\\n'),
    ephemeral: true,
  });

  logger.info(\`📜 \${member.user.tag} accepted rules in \${guild.name}\`);`;

const newHandleAccept = `  // Block rules acceptance until verification is completed
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
    'button',
    interaction.message.id,
  );

  const lines = [
    \`✅ **Thanks for accepting the rules, \${interaction.user}!**\`,
    '',
    memberRoleGranted
      ? \`You now have the **Member** and **Verified** roles — full server access unlocked.\`
      : \`Acceptance recorded. (No member role configured — ask an admin to set one in the dashboard.)\`,
  ];

  await interaction.reply({
    content: lines.join('\\n'),
    ephemeral: true,
  });

  logger.info(\`📜 \${member.user.tag} accepted rules in \${guild.name}\`);`;

if (rh.includes(oldHandleAccept)) {
  rh = rh.replace(oldHandleAccept, newHandleAccept);
  console.log('Updated RulesHandler.ts handleAcceptButton');
} else {
  console.log('WARNING: Could not find oldHandleAccept block');
}

// 2c. Update handleCaptchaSubmit to check verification first
const oldCaptchaSubmit = `  const { memberRoleGranted } = await recordAcceptance(
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

const newCaptchaSubmit = `  // Block rules acceptance until verification is completed
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

if (rh.includes(oldCaptchaSubmit)) {
  rh = rh.replace(oldCaptchaSubmit, newCaptchaSubmit);
  console.log('Updated RulesHandler.ts handleCaptchaSubmit');
} else {
  console.log('WARNING: Could not find oldCaptchaSubmit block');
}

// 2d. Update manuallyAcceptRules to check verification first
const oldManualAccept = `export async function manuallyAcceptRules(guild: Guild, member: GuildMember): Promise<{ memberRoleGranted: boolean }> {
  const config = await rulesConfigStore.get(guild.id);
  return recordAcceptance(guild, member, config, 'command');
}`;

const newManualAccept = `export async function manuallyAcceptRules(guild: Guild, member: GuildMember): Promise<{ memberRoleGranted: boolean; verificationRequired: boolean }> {
  const isVerified = await hasCompletedVerification(guild.id, member.id);
  if (!isVerified) {
    return { memberRoleGranted: false, verificationRequired: true };
  }

  const config = await rulesConfigStore.get(guild.id);
  await grantVerifiedAndMember(member);
  const result = await recordAcceptance(guild, member, config, 'command');
  return { ...result, verificationRequired: false };
}`;

if (rh.includes(oldManualAccept)) {
  rh = rh.replace(oldManualAccept, newManualAccept);
  console.log('Updated RulesHandler.ts manuallyAcceptRules');
} else {
  console.log('WARNING: Could not find oldManualAccept block');
}

fs.writeFileSync(rhPath, rh, 'utf-8');

// ==========================================
// 3. Update rules.ts command to handle verificationRequired
// ==========================================
const rulesCmdPath = 'c:/Users/sathi/Desktop/Coding Projects/Avenlo Core/avenlo-core/services/gateway/src/commands/rules.ts';
let rulesCmd = fs.readFileSync(rulesCmdPath, 'utf-8');

const oldAcceptCmd = `    if (sub === 'accept') {
      const member = await guild.members.fetch(interaction.user.id).catch(() => null);
      if (!member) {
        await interaction.reply({
          content: '⚠️ Could not locate your member object — rejoin and retry.',
          ephemeral: true,
        });
        return;
      }
      const { memberRoleGranted } = await manuallyAcceptRules(guild, member);
      await interaction.reply({
        content: memberRoleGranted
          ? '✅ Acceptance recorded — you now have the **Member** role.'
          : '✅ Acceptance recorded.',
        ephemeral: true,
      });
      return;
    }`;

const newAcceptCmd = `    if (sub === 'accept') {
      const member = await guild.members.fetch(interaction.user.id).catch(() => null);
      if (!member) {
        await interaction.reply({
          content: '⚠️ Could not locate your member object — rejoin and retry.',
          ephemeral: true,
        });
        return;
      }
      const { memberRoleGranted, verificationRequired } = await manuallyAcceptRules(guild, member);
      if (verificationRequired) {
        await interaction.reply({
          content:
            '⚠️ **Please complete verification first.**\\n' +
            'Go to <#1511101077184053388> and click **Begin Verification** before accepting the rules.',
          ephemeral: true,
        });
        return;
      }
      await interaction.reply({
        content: memberRoleGranted
          ? '✅ Acceptance recorded — you now have the **Member** and **Verified** roles.'
          : '✅ Acceptance recorded.',
        ephemeral: true,
      });
      return;
    }`;

if (rulesCmd.includes(oldAcceptCmd)) {
  rulesCmd = rulesCmd.replace(oldAcceptCmd, newAcceptCmd);
  fs.writeFileSync(rulesCmdPath, rulesCmd, 'utf-8');
  console.log('Updated rules.ts command');
} else {
  console.log('WARNING: Could not find oldAcceptCmd block in rules.ts');
}

console.log('\nAll updates applied. Run pnpm build to verify.');
