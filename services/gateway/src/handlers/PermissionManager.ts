// ====================================
// AVENLO CORE - PERMISSION MANAGER
// AI-Powered Channel & Permission Management
// ====================================

import {
  Guild,
  GuildChannel,
  TextChannel,
  VoiceChannel,
  CategoryChannel,
  PermissionOverwrites,
  PermissionFlagsBits,
  EmbedBuilder,
  Role,
  GuildMember,
  ChannelType,
  OverwriteType,
} from 'discord.js';
import OpenAI from 'openai';
import { createLogger, AvenloColors, AvenloBranding } from '@avenlo/shared';

const logger = createLogger('permission-manager');

// ====================================
// PERMISSION PRESETS
// ====================================

export const PERMISSION_PRESETS = {
  // Read-only channel
  readonly: {
    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
    deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions],
  },
  
  // Standard text channel
  standard: {
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.AddReactions,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.EmbedLinks,
    ],
    deny: [],
  },
  
  // Staff only
  staffOnly: {
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.ManageMessages,
    ],
    deny: [],
  },
  
  // Ticket channel
  ticket: {
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.EmbedLinks,
    ],
    deny: [],
  },
  
  // Voice channel standard
  voice: {
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak,
      PermissionFlagsBits.Stream,
      PermissionFlagsBits.UseVAD,
    ],
    deny: [],
  },
  
  // Hidden (no access)
  hidden: {
    allow: [],
    deny: [PermissionFlagsBits.ViewChannel],
  },
  
  // Muted
  muted: {
    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
    deny: [
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.AddReactions,
      PermissionFlagsBits.Speak,
      PermissionFlagsBits.Connect,
    ],
  },
};

// ====================================
// TYPES
// ====================================

interface PermissionAuditResult {
  channel: GuildChannel;
  issues: PermissionIssue[];
  score: number;
}

interface PermissionIssue {
  type: 'redundant' | 'conflicting' | 'dangerous' | 'missing' | 'inconsistent';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestion: string;
  affectedRoles?: Role[];
}

type GuildChannelTypes = 
  | ChannelType.GuildText 
  | ChannelType.GuildVoice 
  | ChannelType.GuildCategory 
  | ChannelType.GuildAnnouncement 
  | ChannelType.GuildStageVoice 
  | ChannelType.GuildForum;

interface ChannelTemplate {
  name: string;
  type: GuildChannelTypes;
  permissions: {
    roleId: string;
    allow: bigint[];
    deny: bigint[];
  }[];
  topic?: string;
  slowmode?: number;
  nsfw?: boolean;
}

// ====================================
// PERMISSION ANALYSIS
// ====================================

export function analyzeChannelPermissions(channel: GuildChannel): PermissionAuditResult {
  const issues: PermissionIssue[] = [];
  let score = 100;
  
  const overwrites = channel.permissionOverwrites.cache;
  
  // Check for @everyone having too many permissions
  const everyoneOverwrite = overwrites.get(channel.guild.id);
  if (everyoneOverwrite) {
    const allowed = everyoneOverwrite.allow.toArray();
    if (allowed.includes('Administrator')) {
      issues.push({
        type: 'dangerous',
        description: '@everyone has Administrator permission',
        severity: 'critical',
        suggestion: 'Remove Administrator from @everyone immediately',
      });
      score -= 50;
    }
    
    if (allowed.includes('MentionEveryone')) {
      issues.push({
        type: 'dangerous',
        description: '@everyone can use @everyone mentions',
        severity: 'high',
        suggestion: 'Restrict @everyone mention permissions',
      });
      score -= 15;
    }
  }
  
  // Check for redundant overwrites
  overwrites.forEach(overwrite => {
    if (overwrite.allow.bitfield === 0n && overwrite.deny.bitfield === 0n) {
      const target = overwrite.type === OverwriteType.Role
        ? channel.guild.roles.cache.get(overwrite.id)?.name || 'Unknown Role'
        : 'User';
      
      issues.push({
        type: 'redundant',
        description: `Empty permission overwrite for ${target}`,
        severity: 'low',
        suggestion: 'Remove unused permission overwrites',
      });
      score -= 2;
    }
  });
  
  // Check for conflicting permissions
  overwrites.forEach(overwrite => {
    const allow = overwrite.allow.toArray();
    const deny = overwrite.deny.toArray();
    
    // Check for nonsensical combinations
    if (allow.includes('SendMessages') && deny.includes('ViewChannel')) {
      issues.push({
        type: 'conflicting',
        description: 'Can send messages but cannot view channel',
        severity: 'medium',
        suggestion: 'Fix conflicting permission settings',
      });
      score -= 10;
    }
  });
  
  return {
    channel,
    issues,
    score: Math.max(0, score),
  };
}

export function auditGuildPermissions(guild: Guild): {
  overallScore: number;
  channelResults: PermissionAuditResult[];
  summary: string;
} {
  const channelResults: PermissionAuditResult[] = [];
  let totalScore = 0;
  
  guild.channels.cache.forEach(channel => {
    if (channel.type !== ChannelType.GuildCategory) {
      const result = analyzeChannelPermissions(channel as GuildChannel);
      channelResults.push(result);
      totalScore += result.score;
    }
  });
  
  const overallScore = channelResults.length > 0
    ? Math.round(totalScore / channelResults.length)
    : 100;
  
  const criticalIssues = channelResults.flatMap(r => r.issues).filter(i => i.severity === 'critical').length;
  const highIssues = channelResults.flatMap(r => r.issues).filter(i => i.severity === 'high').length;
  
  let summary = `Overall permission health: ${overallScore}%\n`;
  if (criticalIssues > 0) summary += `⚠️ ${criticalIssues} critical issues found!\n`;
  if (highIssues > 0) summary += `⚠️ ${highIssues} high-priority issues found!\n`;
  
  return { overallScore, channelResults, summary };
}

// ====================================
// PERMISSION OPERATIONS
// ====================================

export async function setChannelPermission(
  channel: GuildChannel,
  target: Role | GuildMember,
  preset: keyof typeof PERMISSION_PRESETS,
  reason?: string
): Promise<void> {
  const config = PERMISSION_PRESETS[preset];
  
  await channel.permissionOverwrites.edit(target, {
    ...Object.fromEntries(config.allow.map(p => [p.toString(), true])),
    ...Object.fromEntries(config.deny.map(p => [p.toString(), false])),
  }, { reason: reason || `Applied ${preset} preset via Avenlo Core` });
  
  logger.info(`Applied ${preset} preset to ${target instanceof Role ? target.name : target.user.tag} in #${channel.name}`);
}

export async function lockChannel(
  channel: TextChannel | VoiceChannel,
  reason?: string
): Promise<void> {
  // Deny send messages for @everyone
  await channel.permissionOverwrites.edit(channel.guild.id, {
    SendMessages: false,
    AddReactions: false,
    Connect: false,
  }, { reason: reason || 'Channel locked via Avenlo Core' });
  
  logger.info(`Locked channel #${channel.name}`);
}

export async function unlockChannel(
  channel: TextChannel | VoiceChannel,
  reason?: string
): Promise<void> {
  // Reset to null (inherit from category/server)
  await channel.permissionOverwrites.edit(channel.guild.id, {
    SendMessages: null,
    AddReactions: null,
    Connect: null,
  }, { reason: reason || 'Channel unlocked via Avenlo Core' });
  
  logger.info(`Unlocked channel #${channel.name}`);
}

export async function lockdownServer(
  guild: Guild,
  reason?: string
): Promise<number> {
  let lockedCount = 0;
  
  const textChannels = guild.channels.cache.filter(
    c => c.type === ChannelType.GuildText
  ) as Map<string, TextChannel>;
  
  for (const [, channel] of textChannels) {
    try {
      await lockChannel(channel, reason);
      lockedCount++;
    } catch (error) {
      logger.error(`Failed to lock ${channel.name}:`, error);
    }
  }
  
  logger.warn(`🔒 Server lockdown: Locked ${lockedCount} channels`);
  return lockedCount;
}

export async function unlockdownServer(
  guild: Guild,
  reason?: string
): Promise<number> {
  let unlockedCount = 0;
  
  const textChannels = guild.channels.cache.filter(
    c => c.type === ChannelType.GuildText
  ) as Map<string, TextChannel>;
  
  for (const [, channel] of textChannels) {
    try {
      await unlockChannel(channel, reason);
      unlockedCount++;
    } catch (error) {
      logger.error(`Failed to unlock ${channel.name}:`, error);
    }
  }
  
  logger.info(`🔓 Server unlocked: Unlocked ${unlockedCount} channels`);
  return unlockedCount;
}

export async function syncChannelToCategory(
  channel: GuildChannel
): Promise<void> {
  if (!channel.parent) {
    throw new Error('Channel is not in a category');
  }
  
  await channel.lockPermissions();
  logger.info(`Synced #${channel.name} permissions to category ${channel.parent.name}`);
}

export async function cloneChannelPermissions(
  source: GuildChannel,
  target: GuildChannel
): Promise<void> {
  // Clear existing overwrites
  for (const [id] of target.permissionOverwrites.cache) {
    await target.permissionOverwrites.delete(id);
  }
  
  // Copy from source
  for (const [id, overwrite] of source.permissionOverwrites.cache) {
    await target.permissionOverwrites.create(id, {
      ...Object.fromEntries(overwrite.allow.toArray().map(p => [p, true])),
      ...Object.fromEntries(overwrite.deny.toArray().map(p => [p, false])),
    });
  }
  
  logger.info(`Cloned permissions from #${source.name} to #${target.name}`);
}

// ====================================
// CHANNEL TEMPLATES
// ====================================

export async function createChannelFromTemplate(
  guild: Guild,
  template: ChannelTemplate,
  category?: CategoryChannel
): Promise<GuildChannel> {
  const channel = await guild.channels.create({
    name: template.name,
    type: template.type,
    parent: category,
    topic: template.topic,
    rateLimitPerUser: template.slowmode,
    nsfw: template.nsfw,
    reason: 'Created from template via Avenlo Core',
  });
  
  // Apply permissions
  for (const perm of template.permissions) {
    await channel.permissionOverwrites.create(perm.roleId, {
      ...Object.fromEntries(perm.allow.map(p => [p.toString(), true])),
      ...Object.fromEntries(perm.deny.map(p => [p.toString(), false])),
    });
  }
  
  logger.info(`Created channel #${template.name} from template`);
  return channel;
}

// ====================================
// EMBED BUILDERS
// ====================================

export function buildPermissionAuditEmbed(result: PermissionAuditResult): EmbedBuilder {
  const { channel, issues, score } = result;
  
  const color = score >= 80 ? AvenloColors.GREEN :
                score >= 60 ? AvenloColors.YELLOW :
                score >= 40 ? 0xFF6B6B : AvenloColors.RED;
  
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`🔐 Permission Audit: #${channel.name}`)
    .setDescription(`**Score:** ${score}/100`)
    .setFooter({ text: AvenloBranding.footer })
    .setTimestamp();
  
  if (issues.length === 0) {
    embed.addFields({
      name: '✅ No Issues Found',
      value: 'Channel permissions look good!',
      inline: false,
    });
  } else {
    const issueList = issues.map(issue => {
      const emoji = issue.severity === 'critical' ? '🔴' :
                    issue.severity === 'high' ? '🟠' :
                    issue.severity === 'medium' ? '🟡' : '🟢';
      return `${emoji} **${issue.type}**: ${issue.description}\n   └ ${issue.suggestion}`;
    }).join('\n\n');
    
    embed.addFields({
      name: `⚠️ Issues Found (${issues.length})`,
      value: issueList.slice(0, 1000),
      inline: false,
    });
  }
  
  return embed;
}

export function buildServerAuditEmbed(guild: Guild): EmbedBuilder {
  const audit = auditGuildPermissions(guild);
  
  const color = audit.overallScore >= 80 ? AvenloColors.GREEN :
                audit.overallScore >= 60 ? AvenloColors.YELLOW :
                audit.overallScore >= 40 ? 0xFF6B6B : AvenloColors.RED;
  
  const worstChannels = audit.channelResults
    .filter(r => r.score < 80)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);
  
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle('🔐 Server Permission Audit')
    .setDescription(
      `**Overall Health Score:** ${audit.overallScore}%\n\n` +
      `Analyzed ${audit.channelResults.length} channels.`
    )
    .setFooter({ text: AvenloBranding.footer })
    .setTimestamp();
  
  if (worstChannels.length > 0) {
    embed.addFields({
      name: '⚠️ Channels Needing Attention',
      value: worstChannels.map(r => 
        `#${r.channel.name} — Score: ${r.score}% (${r.issues.length} issues)`
      ).join('\n'),
      inline: false,
    });
  }
  
  const totalIssues = audit.channelResults.reduce((sum, r) => sum + r.issues.length, 0);
  const criticalCount = audit.channelResults
    .flatMap(r => r.issues)
    .filter(i => i.severity === 'critical').length;
  
  embed.addFields(
    { name: 'Total Issues', value: totalIssues.toString(), inline: true },
    { name: 'Critical', value: criticalCount.toString(), inline: true },
    { name: 'Channels Audited', value: audit.channelResults.length.toString(), inline: true },
  );
  
  return embed;
}

// ====================================
// EXPORTS
// ====================================

export const PermissionManager = {
  // Presets
  PERMISSION_PRESETS,
  
  // Analysis
  analyzeChannelPermissions,
  auditGuildPermissions,
  
  // Operations
  setChannelPermission,
  lockChannel,
  unlockChannel,
  lockdownServer,
  unlockdownServer,
  syncChannelToCategory,
  cloneChannelPermissions,
  
  // Templates
  createChannelFromTemplate,
  
  // Embeds
  buildPermissionAuditEmbed,
  buildServerAuditEmbed,
};

export default PermissionManager;
