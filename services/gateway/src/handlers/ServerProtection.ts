// ====================================
// AVENLO CORE - SERVER PROTECTION
// Anti-Raid, Anti-Nuke, Verification System
// ====================================

import {
  Guild,
  GuildMember,
  GuildChannel,
  Role,
  EmbedBuilder,
  TextChannel,
  PermissionFlagsBits,
  AuditLogEvent,
  GuildAuditLogsEntry,
  User,
  Webhook,
  GuildBan,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { createLogger, AvenloColors, AvenloBranding } from '@avenlo/shared';

const logger = createLogger('server-protection');

// ====================================
// CONFIGURATION
// ====================================

export const PROTECTION_CONFIG = {
  // Anti-Raid
  raid: {
    enabled: true,
    joinThreshold: 10,      // Joins per window
    joinWindow: 30000,      // 30 seconds
    accountAgeMin: 7,       // Days - accounts younger are suspicious
    lockdownDuration: 300000, // 5 minutes auto-lockdown
    autoKickNewAccounts: true,
  },
  
  // Anti-Nuke
  nuke: {
    enabled: true,
    channelDeleteLimit: 3,   // Max channel deletes per window
    roleDeleteLimit: 3,      // Max role deletes per window
    banLimit: 5,             // Max bans per window
    kickLimit: 10,           // Max kicks per window
    webhookCreateLimit: 3,   // Max webhook creates per window
    actionWindow: 60000,     // 1 minute window
    autoStripRoles: true,    // Remove all roles from attacker
    autoBan: true,           // Ban the attacker
  },
  
  // Anti-Spam (Message level - complements AI moderation)
  spam: {
    enabled: true,
    messageLimit: 5,
    messageWindow: 5000,
    mentionLimit: 5,
    linkLimit: 3,
    duplicateLimit: 3,
  },
  
  // Verification
  verification: {
    enabled: false,
    channelId: '',
    verifiedRoleId: '',
    unverifiedRoleId: '',
    requireCaptcha: true,
  },
  
  // Logging
  logChannelId: process.env.CHANNEL_LOGS || '',
};

// ====================================
// TRACKING STATE
// ====================================

interface ActionTracker {
  userId: string;
  actions: { type: string; timestamp: number }[];
}

interface JoinTracker {
  timestamp: number;
  userId: string;
  accountAge: number;
}

const actionTrackers = new Map<string, ActionTracker>();
const joinHistory: JoinTracker[] = [];
let isLockdown = false;
let lockdownEndTime: number | null = null;

// ====================================
// ANTI-RAID SYSTEM
// ====================================

export function trackJoin(member: GuildMember): {
  isRaid: boolean;
  isSuspicious: boolean;
  joinCount: number;
} {
  const now = Date.now();
  const accountAge = Math.floor(
    (now - member.user.createdTimestamp) / (1000 * 60 * 60 * 24)
  );
  
  // Clean old joins
  const cutoff = now - PROTECTION_CONFIG.raid.joinWindow;
  while (joinHistory.length > 0 && joinHistory[0].timestamp < cutoff) {
    joinHistory.shift();
  }
  
  // Add this join
  joinHistory.push({
    timestamp: now,
    userId: member.id,
    accountAge,
  });
  
  const joinCount = joinHistory.length;
  const isRaid = joinCount >= PROTECTION_CONFIG.raid.joinThreshold;
  const isSuspicious = accountAge < PROTECTION_CONFIG.raid.accountAgeMin;
  
  return { isRaid, isSuspicious, joinCount };
}

export async function handlePotentialRaid(
  guild: Guild,
  logChannel?: TextChannel
): Promise<void> {
  if (isLockdown) return;
  
  isLockdown = true;
  lockdownEndTime = Date.now() + PROTECTION_CONFIG.raid.lockdownDuration;
  
  logger.warn(`🚨 RAID DETECTED in ${guild.name}! Activating protection.`);
  
  // Set verification level to maximum
  try {
    await guild.setVerificationLevel(4); // VERY_HIGH
  } catch (err) {
    logger.error('Failed to set verification level:', err);
  }
  
  // Log the event
  if (logChannel) {
    const recentJoins = joinHistory.slice(-20);
    const joinList = recentJoins
      .map(j => `<@${j.userId}> (${j.accountAge}d old)`)
      .join('\n');
    
    const embed = new EmbedBuilder()
      .setColor(AvenloColors.RED)
      .setTitle('🚨 RAID PROTECTION ACTIVATED')
      .setDescription(
        `**${joinHistory.length} members joined in ${PROTECTION_CONFIG.raid.joinWindow / 1000} seconds!**\n\n` +
        `**Automatic Actions:**\n` +
        `• Verification level set to maximum\n` +
        `• New members require phone verification\n` +
        `• Lockdown will auto-lift in ${PROTECTION_CONFIG.raid.lockdownDuration / 60000} minutes\n\n` +
        `**Recent Joins:**\n${joinList.slice(0, 1000)}`
      )
      .addFields(
        { name: 'Status', value: '🔴 LOCKDOWN ACTIVE', inline: true },
        { name: 'Auto-Lift', value: `<t:${Math.floor(lockdownEndTime! / 1000)}:R>`, inline: true },
      )
      .setFooter({ text: AvenloBranding.footer })
      .setTimestamp();
    
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('protection:lift_lockdown')
        .setLabel('Lift Lockdown Early')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('protection:mass_kick')
        .setLabel('Kick Raid Accounts')
        .setStyle(ButtonStyle.Secondary),
    );
    
    await logChannel.send({ embeds: [embed], components: [buttons] });
  }
  
  // Auto-lift after duration
  setTimeout(() => liftLockdown(guild, logChannel), PROTECTION_CONFIG.raid.lockdownDuration);
}

export async function liftLockdown(
  guild: Guild,
  logChannel?: TextChannel
): Promise<void> {
  if (!isLockdown) return;
  
  isLockdown = false;
  lockdownEndTime = null;
  joinHistory.length = 0;
  
  // Reset verification level
  try {
    await guild.setVerificationLevel(2); // MEDIUM
  } catch (err) {
    logger.error('Failed to reset verification level:', err);
  }
  
  logger.info(`✅ Lockdown lifted for ${guild.name}`);
  
  if (logChannel) {
    const embed = new EmbedBuilder()
      .setColor(AvenloColors.GREEN)
      .setTitle('✅ LOCKDOWN LIFTED')
      .setDescription(
        'Raid protection lockdown has been lifted.\n' +
        'Server is back to normal operation.'
      )
      .setFooter({ text: AvenloBranding.footer })
      .setTimestamp();
    
    await logChannel.send({ embeds: [embed] });
  }
}

// ====================================
// ANTI-NUKE SYSTEM
// ====================================

function trackAction(userId: string, actionType: string): number {
  const now = Date.now();
  
  let tracker = actionTrackers.get(userId);
  if (!tracker) {
    tracker = { userId, actions: [] };
    actionTrackers.set(userId, tracker);
  }
  
  // Clean old actions
  tracker.actions = tracker.actions.filter(
    a => now - a.timestamp < PROTECTION_CONFIG.nuke.actionWindow
  );
  
  // Add new action
  tracker.actions.push({ type: actionType, timestamp: now });
  
  // Count this action type
  return tracker.actions.filter(a => a.type === actionType).length;
}

export async function handleChannelDelete(
  channel: GuildChannel,
  executor: User | null
): Promise<boolean> {
  if (!executor || executor.bot) return false;
  
  const count = trackAction(executor.id, 'channel_delete');
  
  if (count >= PROTECTION_CONFIG.nuke.channelDeleteLimit) {
    await handleNukeAttempt(channel.guild, executor, 'channel_delete', count);
    return true;
  }
  
  return false;
}

export async function handleRoleDelete(
  role: Role,
  executor: User | null
): Promise<boolean> {
  if (!executor || executor.bot) return false;
  
  const count = trackAction(executor.id, 'role_delete');
  
  if (count >= PROTECTION_CONFIG.nuke.roleDeleteLimit) {
    await handleNukeAttempt(role.guild, executor, 'role_delete', count);
    return true;
  }
  
  return false;
}

export async function handleMassBan(
  guild: Guild,
  executor: User | null
): Promise<boolean> {
  if (!executor || executor.bot) return false;
  
  const count = trackAction(executor.id, 'ban');
  
  if (count >= PROTECTION_CONFIG.nuke.banLimit) {
    await handleNukeAttempt(guild, executor, 'mass_ban', count);
    return true;
  }
  
  return false;
}

export async function handleMassKick(
  guild: Guild,
  executor: User | null
): Promise<boolean> {
  if (!executor || executor.bot) return false;
  
  const count = trackAction(executor.id, 'kick');
  
  if (count >= PROTECTION_CONFIG.nuke.kickLimit) {
    await handleNukeAttempt(guild, executor, 'mass_kick', count);
    return true;
  }
  
  return false;
}

async function handleNukeAttempt(
  guild: Guild,
  attacker: User,
  attackType: string,
  actionCount: number
): Promise<void> {
  logger.warn(`🚨 NUKE ATTEMPT detected in ${guild.name} by ${attacker.tag} (${attackType})`);
  
  const logChannel = guild.channels.cache.get(PROTECTION_CONFIG.logChannelId) as TextChannel;
  
  // Get the member
  let member: GuildMember | null = null;
  try {
    member = await guild.members.fetch(attacker.id);
  } catch {
    // Member might have left
  }
  
  // Strip roles if configured
  if (PROTECTION_CONFIG.nuke.autoStripRoles && member) {
    try {
      const rolesToRemove = member.roles.cache.filter(
        r => r.id !== guild.id && r.position < guild.members.me!.roles.highest.position
      );
      await member.roles.remove(rolesToRemove, 'Anti-nuke: Stripped roles from attacker');
      logger.info(`Stripped ${rolesToRemove.size} roles from ${attacker.tag}`);
    } catch (err) {
      logger.error('Failed to strip roles:', err);
    }
  }
  
  // Ban if configured
  if (PROTECTION_CONFIG.nuke.autoBan) {
    try {
      await guild.members.ban(attacker.id, {
        reason: `Anti-nuke: ${attackType} (${actionCount} actions)`,
        deleteMessageSeconds: 86400, // 24 hours
      });
      logger.info(`Banned ${attacker.tag} for nuke attempt`);
    } catch (err) {
      logger.error('Failed to ban attacker:', err);
    }
  }
  
  // Log the event
  if (logChannel) {
    const embed = new EmbedBuilder()
      .setColor(AvenloColors.RED)
      .setTitle('🚨 NUKE ATTEMPT BLOCKED')
      .setDescription(
        `**Attacker:** ${attacker.tag} (${attacker.id})\n` +
        `**Attack Type:** ${attackType.replace('_', ' ').toUpperCase()}\n` +
        `**Actions Detected:** ${actionCount} in ${PROTECTION_CONFIG.nuke.actionWindow / 1000}s\n\n` +
        `**Automatic Response:**\n` +
        `${PROTECTION_CONFIG.nuke.autoStripRoles ? '✅' : '❌'} Roles stripped\n` +
        `${PROTECTION_CONFIG.nuke.autoBan ? '✅' : '❌'} User banned`
      )
      .setThumbnail(attacker.displayAvatarURL())
      .setFooter({ text: AvenloBranding.footer })
      .setTimestamp();
    
    await logChannel.send({ embeds: [embed] });
  }
}

// ====================================
// VERIFICATION SYSTEM
// ====================================

export function buildVerificationEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(AvenloColors.CYAN)
    .setTitle('🔐 Server Verification Required')
    .setDescription(
      `Welcome to the server! To access all channels, please verify your account.\n\n` +
      `**Why Verify?**\n` +
      `• Protects the server from bots and raiders\n` +
      `• Ensures a safe community for everyone\n` +
      `• Unlocks access to all server features\n\n` +
      `Click the button below to start verification.`
    )
    .setFooter({ text: AvenloBranding.footer })
    .setTimestamp();
}

export function buildVerificationButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('verify:start')
      .setLabel('✅ Verify Me')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('verify:help')
      .setLabel('❓ Help')
      .setStyle(ButtonStyle.Secondary),
  );
}

export function buildCaptchaModal(captchaCode: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('verify:captcha_submit')
    .setTitle('Verification')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('captcha_input')
          .setLabel(`Enter the code: ${captchaCode}`)
          .setPlaceholder('Type the code exactly as shown above')
          .setStyle(TextInputStyle.Short)
          .setMinLength(4)
          .setMaxLength(10)
          .setRequired(true)
      )
    );
}

const verificationCaptchas = new Map<string, string>();

export function generateCaptcha(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function startVerification(
  member: GuildMember,
  interaction: any
): Promise<void> {
  const captcha = generateCaptcha();
  verificationCaptchas.set(member.id, captcha);
  
  const modal = buildCaptchaModal(captcha);
  await interaction.showModal(modal);
}

export async function completeVerification(
  member: GuildMember,
  input: string
): Promise<boolean> {
  const expectedCaptcha = verificationCaptchas.get(member.id);
  
  if (!expectedCaptcha) {
    return false;
  }
  
  if (input.toUpperCase() === expectedCaptcha) {
    // Grant verified role
    if (PROTECTION_CONFIG.verification.verifiedRoleId) {
      try {
        const role = member.guild.roles.cache.get(PROTECTION_CONFIG.verification.verifiedRoleId);
        if (role) {
          await member.roles.add(role, 'Verification completed');
        }
      } catch (err) {
        logger.error('Failed to add verified role:', err);
      }
    }
    
    // Remove unverified role
    if (PROTECTION_CONFIG.verification.unverifiedRoleId) {
      try {
        const role = member.guild.roles.cache.get(PROTECTION_CONFIG.verification.unverifiedRoleId);
        if (role) {
          await member.roles.remove(role, 'Verification completed');
        }
      } catch (err) {
        logger.error('Failed to remove unverified role:', err);
      }
    }
    
    verificationCaptchas.delete(member.id);
    logger.info(`✅ ${member.user.tag} verified successfully`);
    return true;
  }
  
  return false;
}

// ====================================
// AUDIT LOG MONITORING
// ====================================

export async function monitorAuditLogs(guild: Guild): Promise<void> {
  try {
    const auditLogs = await guild.fetchAuditLogs({ limit: 10 });
    
    for (const entry of auditLogs.entries.values()) {
      const timeDiff = Date.now() - entry.createdTimestamp;
      
      // Only process recent entries (within 5 seconds)
      if (timeDiff > 5000) continue;
      
      const executor = entry.executor as User | null;
      
      switch (entry.action) {
        case AuditLogEvent.ChannelDelete:
          await handleChannelDelete(entry.target as GuildChannel, executor);
          break;
        case AuditLogEvent.RoleDelete:
          await handleRoleDelete(entry.target as Role, executor);
          break;
        case AuditLogEvent.MemberBanAdd:
          await handleMassBan(guild, executor);
          break;
        case AuditLogEvent.MemberKick:
          await handleMassKick(guild, executor);
          break;
      }
    }
  } catch (error) {
    logger.error('Failed to monitor audit logs:', error);
  }
}

// ====================================
// STATUS EMBED
// ====================================

export function buildProtectionStatusEmbed(guild: Guild): EmbedBuilder {
  const config = PROTECTION_CONFIG;
  
  return new EmbedBuilder()
    .setColor(AvenloColors.CYAN)
    .setTitle('🛡️ Server Protection Status')
    .setDescription(`Protection systems for **${guild.name}**`)
    .addFields(
      {
        name: '🚨 Anti-Raid',
        value: 
          `**Status:** ${config.raid.enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
          `**Threshold:** ${config.raid.joinThreshold} joins/${config.raid.joinWindow / 1000}s\n` +
          `**Lockdown:** ${isLockdown ? '🔴 ACTIVE' : '🟢 Inactive'}`,
        inline: true,
      },
      {
        name: '💣 Anti-Nuke',
        value: 
          `**Status:** ${config.nuke.enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
          `**Channel Limit:** ${config.nuke.channelDeleteLimit}/${config.nuke.actionWindow / 1000}s\n` +
          `**Auto-Ban:** ${config.nuke.autoBan ? 'Yes' : 'No'}`,
        inline: true,
      },
      {
        name: '🔐 Verification',
        value: 
          `**Status:** ${config.verification.enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
          `**Captcha:** ${config.verification.requireCaptcha ? 'Required' : 'Not required'}`,
        inline: true,
      },
    )
    .setFooter({ text: AvenloBranding.footer })
    .setTimestamp();
}

// ====================================
// EXPORTS
// ====================================

export const ServerProtection = {
  // Config
  PROTECTION_CONFIG,
  
  // Anti-Raid
  trackJoin,
  handlePotentialRaid,
  liftLockdown,
  isLockdownActive: () => isLockdown,
  
  // Anti-Nuke
  handleChannelDelete,
  handleRoleDelete,
  handleMassBan,
  handleMassKick,
  
  // Verification
  buildVerificationEmbed,
  buildVerificationButtons,
  startVerification,
  completeVerification,
  generateCaptcha,
  
  // Monitoring
  monitorAuditLogs,
  
  // Status
  buildProtectionStatusEmbed,
};

export default ServerProtection;
