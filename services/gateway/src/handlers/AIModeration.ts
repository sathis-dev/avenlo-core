// ====================================
// AVENLO CORE - AI MODERATION HANDLER
// GPT-4 Powered Intelligent Moderation
// ====================================

import {
  Message,
  GuildMember,
  EmbedBuilder,
  TextChannel,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AuditLogEvent,
  Guild,
  User,
  GuildBan,
  ChannelType,
} from 'discord.js';
import OpenAI from 'openai';
import { createLogger, AvenloColors, AvenloBranding } from '@avenlo/shared';

const logger = createLogger('ai-moderation');

// ====================================
// CONFIGURATION
// ====================================

export const MODERATION_CONFIG = {
  // AI Analysis
  aiModel: 'gpt-4o',
  analysisTimeout: 5000,
  
  // Thresholds (0-100)
  thresholds: {
    warn: 40,      // Warning threshold
    mute: 60,      // Auto-mute threshold
    kick: 80,      // Auto-kick threshold
    ban: 95,       // Auto-ban threshold
  },
  
  // Mute durations (minutes)
  muteDurations: {
    first: 5,
    second: 30,
    third: 120,
    fourth: 1440, // 24 hours
  },
  
  // Anti-spam
  spam: {
    messageLimit: 5,      // Messages
    timeWindow: 5000,     // 5 seconds
    duplicateLimit: 3,    // Same message limit
    mentionLimit: 5,      // Max mentions per message
    emojiLimit: 15,       // Max emojis per message
    capsPercentage: 70,   // Max caps percentage
  },
  
  // Anti-raid
  raid: {
    joinLimit: 10,        // Joins per window
    joinWindow: 30000,    // 30 seconds
    lockdownDuration: 300000, // 5 minutes
  },
  
  // Exempt roles (will be filled from env)
  exemptRoles: [] as string[],
  
  // Log channel
  logChannelId: process.env.CHANNEL_LOGS || '',
};

// ====================================
// TYPES
// ====================================

interface ModerationResult {
  shouldModerate: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  categories: {
    toxicity: number;
    spam: number;
    harassment: number;
    hate_speech: number;
    sexual: number;
    violence: number;
    self_harm: number;
    illegal: number;
  };
  reason: string;
  suggestedAction: 'none' | 'warn' | 'delete' | 'mute' | 'kick' | 'ban';
  aiExplanation: string;
}

interface UserWarningData {
  count: number;
  lastWarning: Date;
  reasons: string[];
}

interface SpamTracker {
  messages: { content: string; timestamp: number }[];
  duplicates: Map<string, number>;
}

interface RaidTracker {
  joins: number[];
  isLockdown: boolean;
  lockdownEnd?: number;
}

// ====================================
// STATE MANAGEMENT
// ====================================

const userWarnings = new Map<string, UserWarningData>();
const spamTrackers = new Map<string, SpamTracker>();
const raidTracker: RaidTracker = { joins: [], isLockdown: false };
const recentMessages = new Map<string, Message[]>();

// Initialize OpenAI
let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

// ====================================
// AI CONTENT ANALYSIS
// ====================================

export async function analyzeContent(
  content: string,
  context?: {
    username?: string;
    channelName?: string;
    previousMessages?: string[];
  }
): Promise<ModerationResult> {
  try {
    const ai = getOpenAI();
    
    const systemPrompt = `You are an advanced Discord moderation AI. Analyze the following message for policy violations.

Server Rules:
1. No harassment, bullying, or targeted attacks
2. No hate speech, slurs, or discrimination
3. No NSFW/sexual content
4. No spam, excessive caps, or flooding
5. No threats or violent content
6. No self-harm promotion
7. No illegal activity discussion
8. Be respectful to all members

Respond ONLY with valid JSON in this exact format:
{
  "shouldModerate": boolean,
  "severity": "low" | "medium" | "high" | "critical",
  "score": number (0-100),
  "categories": {
    "toxicity": number (0-100),
    "spam": number (0-100),
    "harassment": number (0-100),
    "hate_speech": number (0-100),
    "sexual": number (0-100),
    "violence": number (0-100),
    "self_harm": number (0-100),
    "illegal": number (0-100)
  },
  "reason": "Brief explanation of violation",
  "suggestedAction": "none" | "warn" | "delete" | "mute" | "kick" | "ban",
  "aiExplanation": "Detailed explanation for moderators"
}`;

    const userPrompt = `Analyze this message:
"${content}"

${context?.username ? `From user: ${context.username}` : ''}
${context?.channelName ? `In channel: #${context.channelName}` : ''}
${context?.previousMessages?.length ? `Recent context: ${context.previousMessages.slice(-3).join(' | ')}` : ''}`;

    const response = await ai.chat.completions.create({
      model: MODERATION_CONFIG.aiModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0]?.message?.content || '{}');
    
    return {
      shouldModerate: result.shouldModerate ?? false,
      severity: result.severity ?? 'low',
      score: result.score ?? 0,
      categories: result.categories ?? {
        toxicity: 0, spam: 0, harassment: 0, hate_speech: 0,
        sexual: 0, violence: 0, self_harm: 0, illegal: 0,
      },
      reason: result.reason ?? 'No issues detected',
      suggestedAction: result.suggestedAction ?? 'none',
      aiExplanation: result.aiExplanation ?? 'Message appears safe',
    };
  } catch (error) {
    logger.error('AI analysis failed:', error);
    // Fallback to basic checks
    return performBasicAnalysis(content);
  }
}

function performBasicAnalysis(content: string): ModerationResult {
  const lowerContent = content.toLowerCase();
  let score = 0;
  const reasons: string[] = [];
  
  // Basic keyword detection (fallback)
  const toxicPatterns = [
    /\b(fuck|shit|bitch|asshole|dick|cunt)\b/gi,
    /\b(kill yourself|kys|die)\b/gi,
    /\b(n[i1]gg[ae3]r|f[a4]gg?[o0]t|ret[a4]rd)\b/gi,
  ];
  
  for (const pattern of toxicPatterns) {
    if (pattern.test(lowerContent)) {
      score += 30;
      reasons.push('Inappropriate language detected');
    }
  }
  
  // Caps detection
  const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
  if (capsRatio > 0.7 && content.length > 10) {
    score += 15;
    reasons.push('Excessive caps');
  }
  
  // Spam detection
  if (content.length > 500) {
    score += 10;
    reasons.push('Very long message');
  }
  
  const severity = score >= 80 ? 'critical' : score >= 60 ? 'high' : score >= 40 ? 'medium' : 'low';
  const suggestedAction = score >= 95 ? 'ban' : score >= 80 ? 'kick' : score >= 60 ? 'mute' : score >= 40 ? 'warn' : 'none';
  
  return {
    shouldModerate: score >= 40,
    severity,
    score,
    categories: {
      toxicity: score, spam: 0, harassment: 0, hate_speech: 0,
      sexual: 0, violence: 0, self_harm: 0, illegal: 0,
    },
    reason: reasons.join(', ') || 'No issues detected',
    suggestedAction,
    aiExplanation: 'Basic analysis performed (AI unavailable)',
  };
}

// ====================================
// SPAM DETECTION
// ====================================

export function checkSpam(message: Message): { isSpam: boolean; reason?: string } {
  const userId = message.author.id;
  const content = message.content;
  const now = Date.now();
  
  // Get or create tracker
  let tracker = spamTrackers.get(userId);
  if (!tracker) {
    tracker = { messages: [], duplicates: new Map() };
    spamTrackers.set(userId, tracker);
  }
  
  // Clean old messages
  tracker.messages = tracker.messages.filter(
    m => now - m.timestamp < MODERATION_CONFIG.spam.timeWindow
  );
  
  // Add current message
  tracker.messages.push({ content, timestamp: now });
  
  // Check message rate
  if (tracker.messages.length > MODERATION_CONFIG.spam.messageLimit) {
    return { isSpam: true, reason: 'Message rate limit exceeded' };
  }
  
  // Check duplicates
  const duplicateCount = (tracker.duplicates.get(content) || 0) + 1;
  tracker.duplicates.set(content, duplicateCount);
  if (duplicateCount > MODERATION_CONFIG.spam.duplicateLimit) {
    return { isSpam: true, reason: 'Duplicate message spam' };
  }
  
  // Check mentions
  const mentionCount = message.mentions.users.size + message.mentions.roles.size;
  if (mentionCount > MODERATION_CONFIG.spam.mentionLimit) {
    return { isSpam: true, reason: 'Mention spam' };
  }
  
  // Check emojis
  const emojiCount = (content.match(/<a?:\w+:\d+>|[\u{1F600}-\u{1F64F}]/gu) || []).length;
  if (emojiCount > MODERATION_CONFIG.spam.emojiLimit) {
    return { isSpam: true, reason: 'Emoji spam' };
  }
  
  // Check caps
  if (content.length > 10) {
    const capsCount = (content.match(/[A-Z]/g) || []).length;
    const capsPercentage = (capsCount / content.length) * 100;
    if (capsPercentage > MODERATION_CONFIG.spam.capsPercentage) {
      return { isSpam: true, reason: 'Excessive caps' };
    }
  }
  
  return { isSpam: false };
}

// ====================================
// RAID DETECTION
// ====================================

export function checkRaid(guild: Guild): { isRaid: boolean; joinCount: number } {
  const now = Date.now();
  
  // Clean old joins
  raidTracker.joins = raidTracker.joins.filter(
    timestamp => now - timestamp < MODERATION_CONFIG.raid.joinWindow
  );
  
  // Add current join
  raidTracker.joins.push(now);
  
  const isRaid = raidTracker.joins.length >= MODERATION_CONFIG.raid.joinLimit;
  
  return { isRaid, joinCount: raidTracker.joins.length };
}

export async function activateLockdown(guild: Guild, logChannel?: TextChannel): Promise<void> {
  if (raidTracker.isLockdown) return;
  
  raidTracker.isLockdown = true;
  raidTracker.lockdownEnd = Date.now() + MODERATION_CONFIG.raid.lockdownDuration;
  
  logger.warn(`🚨 RAID DETECTED - Activating lockdown for ${guild.name}`);
  
  // Set verification level to highest
  try {
    await guild.setVerificationLevel(4); // VERY_HIGH
  } catch (err) {
    logger.error('Failed to set verification level:', err);
  }
  
  if (logChannel) {
    const embed = new EmbedBuilder()
      .setColor(AvenloColors.RED)
      .setTitle('🚨 RAID LOCKDOWN ACTIVATED')
      .setDescription(
        `**Automatic raid protection has been triggered!**\n\n` +
        `Detected ${raidTracker.joins.length} joins in ${MODERATION_CONFIG.raid.joinWindow / 1000} seconds.\n\n` +
        `**Actions Taken:**\n` +
        `• Verification level set to maximum\n` +
        `• New members will require phone verification\n` +
        `• Lockdown will auto-lift in ${MODERATION_CONFIG.raid.lockdownDuration / 60000} minutes`
      )
      .setTimestamp();
    
    await logChannel.send({ embeds: [embed] });
  }
  
  // Auto-lift lockdown after duration
  setTimeout(() => deactivateLockdown(guild, logChannel), MODERATION_CONFIG.raid.lockdownDuration);
}

export async function deactivateLockdown(guild: Guild, logChannel?: TextChannel): Promise<void> {
  if (!raidTracker.isLockdown) return;
  
  raidTracker.isLockdown = false;
  raidTracker.lockdownEnd = undefined;
  raidTracker.joins = [];
  
  logger.info(`✅ Lockdown lifted for ${guild.name}`);
  
  // Reset verification level
  try {
    await guild.setVerificationLevel(2); // MEDIUM
  } catch (err) {
    logger.error('Failed to reset verification level:', err);
  }
  
  if (logChannel) {
    const embed = new EmbedBuilder()
      .setColor(AvenloColors.GREEN)
      .setTitle('✅ LOCKDOWN LIFTED')
      .setDescription('Raid protection lockdown has been automatically lifted. Server is back to normal.')
      .setTimestamp();
    
    await logChannel.send({ embeds: [embed] });
  }
}

// ====================================
// MODERATION ACTIONS
// ====================================

export async function warnUser(
  member: GuildMember,
  reason: string,
  moderator?: User
): Promise<void> {
  const userId = member.id;
  const guildId = member.guild.id;
  const key = `${guildId}:${userId}`;
  
  // Get or create warning data
  let data = userWarnings.get(key);
  if (!data) {
    data = { count: 0, lastWarning: new Date(), reasons: [] };
  }
  
  data.count++;
  data.lastWarning = new Date();
  data.reasons.push(reason);
  userWarnings.set(key, data);
  
  // DM the user
  try {
    const embed = new EmbedBuilder()
      .setColor(AvenloColors.YELLOW)
      .setTitle('⚠️ Warning')
      .setDescription(
        `You have been warned in **${member.guild.name}**\n\n` +
        `**Reason:** ${reason}\n` +
        `**Warning #:** ${data.count}\n\n` +
        `Please review the server rules to avoid further action.`
      )
      .setFooter({ text: AvenloBranding.footer })
      .setTimestamp();
    
    await member.send({ embeds: [embed] });
  } catch (err) {
    logger.debug('Could not DM user warning');
  }
  
  logger.info(`⚠️ Warned ${member.user.tag} (${data.count} total) - ${reason}`);
}

export async function muteUser(
  member: GuildMember,
  duration: number,
  reason: string,
  moderator?: User
): Promise<void> {
  try {
    // Use Discord's timeout feature
    await member.timeout(duration * 60 * 1000, reason);
    
    // DM the user
    try {
      const embed = new EmbedBuilder()
        .setColor(AvenloColors.RED)
        .setTitle('🔇 Muted')
        .setDescription(
          `You have been muted in **${member.guild.name}**\n\n` +
          `**Duration:** ${duration} minutes\n` +
          `**Reason:** ${reason}\n\n` +
          `You will be automatically unmuted when the timeout expires.`
        )
        .setFooter({ text: AvenloBranding.footer })
        .setTimestamp();
      
      await member.send({ embeds: [embed] });
    } catch (err) {
      logger.debug('Could not DM user mute notification');
    }
    
    logger.info(`🔇 Muted ${member.user.tag} for ${duration} minutes - ${reason}`);
  } catch (error) {
    logger.error('Failed to mute user:', error);
  }
}

export async function kickUser(
  member: GuildMember,
  reason: string,
  moderator?: User
): Promise<void> {
  try {
    // DM before kick
    try {
      const embed = new EmbedBuilder()
        .setColor(AvenloColors.RED)
        .setTitle('👢 Kicked')
        .setDescription(
          `You have been kicked from **${member.guild.name}**\n\n` +
          `**Reason:** ${reason}\n\n` +
          `You may rejoin if you receive a new invite, but please follow the rules.`
        )
        .setFooter({ text: AvenloBranding.footer })
        .setTimestamp();
      
      await member.send({ embeds: [embed] });
    } catch (err) {
      logger.debug('Could not DM user kick notification');
    }
    
    await member.kick(reason);
    logger.info(`👢 Kicked ${member.user.tag} - ${reason}`);
  } catch (error) {
    logger.error('Failed to kick user:', error);
  }
}

export async function banUser(
  member: GuildMember | { id: string; guild: Guild },
  reason: string,
  deleteMessageDays: number = 1,
  moderator?: User
): Promise<void> {
  try {
    const guild = member.guild;
    const userId = member.id;
    
    // Try to DM before ban (if GuildMember)
    if ('send' in member) {
      try {
        const embed = new EmbedBuilder()
          .setColor(AvenloColors.RED)
          .setTitle('🔨 Banned')
          .setDescription(
            `You have been banned from **${guild.name}**\n\n` +
            `**Reason:** ${reason}\n\n` +
            `This action is permanent unless appealed.`
          )
          .setFooter({ text: AvenloBranding.footer })
          .setTimestamp();
        
        await (member as GuildMember).send({ embeds: [embed] });
      } catch (err) {
        logger.debug('Could not DM user ban notification');
      }
    }
    
    await guild.members.ban(userId, { 
      reason,
      deleteMessageSeconds: deleteMessageDays * 24 * 60 * 60,
    });
    
    logger.info(`🔨 Banned user ${userId} - ${reason}`);
  } catch (error) {
    logger.error('Failed to ban user:', error);
  }
}

// ====================================
// MESSAGE HANDLER
// ====================================

export async function handleMessage(message: Message): Promise<void> {
  // Ignore bots and DMs
  if (message.author.bot || !message.guild || !message.member) return;
  
  // Check if user has exempt role
  const exemptRoles = [
    process.env.ROLE_MANAGEMENT,
    process.env.ROLE_MODERATOR,
    process.env.ROLE_STUDIO_LEAD,
  ].filter(Boolean) as string[];
  
  if (message.member.roles.cache.some(role => exemptRoles.includes(role.id))) {
    return;
  }
  
  // Quick spam check first
  const spamResult = checkSpam(message);
  if (spamResult.isSpam) {
    await handleViolation(message, {
      shouldModerate: true,
      severity: 'medium',
      score: 60,
      categories: { toxicity: 0, spam: 80, harassment: 0, hate_speech: 0, sexual: 0, violence: 0, self_harm: 0, illegal: 0 },
      reason: spamResult.reason || 'Spam detected',
      suggestedAction: 'mute',
      aiExplanation: `Automatic spam detection: ${spamResult.reason}`,
    });
    return;
  }
  
  // AI content analysis for non-trivial messages
  if (message.content.length > 3) {
    // Get recent messages for context
    const recent = recentMessages.get(message.channel.id) || [];
    
    const result = await analyzeContent(message.content, {
      username: message.author.username,
      channelName: (message.channel as TextChannel).name,
      previousMessages: recent.slice(-3).map(m => m.content),
    });
    
    // Store message for context
    recent.push(message);
    if (recent.length > 10) recent.shift();
    recentMessages.set(message.channel.id, recent);
    
    if (result.shouldModerate) {
      await handleViolation(message, result);
    }
  }
}

async function handleViolation(message: Message, result: ModerationResult): Promise<void> {
  const { member, guild } = message;
  if (!member || !guild) return;
  
  const logChannel = guild.channels.cache.get(MODERATION_CONFIG.logChannelId) as TextChannel;
  
  // Delete the message
  try {
    await message.delete();
  } catch (err) {
    logger.debug('Could not delete message');
  }
  
  // Log the violation
  if (logChannel) {
    const embed = new EmbedBuilder()
      .setColor(
        result.severity === 'critical' ? AvenloColors.RED :
        result.severity === 'high' ? 0xFF6B6B :
        result.severity === 'medium' ? AvenloColors.YELLOW :
        AvenloColors.BLUE
      )
      .setAuthor({
        name: `${message.author.tag}`,
        iconURL: message.author.displayAvatarURL(),
      })
      .setTitle(`🛡️ AI Moderation - ${result.severity.toUpperCase()}`)
      .setDescription(
        `**Channel:** ${message.channel}\n` +
        `**Content:** ${message.content.slice(0, 500)}${message.content.length > 500 ? '...' : ''}\n\n` +
        `**AI Analysis:**\n${result.aiExplanation}`
      )
      .addFields(
        { name: 'Severity Score', value: `${result.score}/100`, inline: true },
        { name: 'Action Taken', value: result.suggestedAction, inline: true },
        { name: 'Reason', value: result.reason, inline: false },
      )
      .setFooter({ text: `User ID: ${message.author.id}` })
      .setTimestamp();
    
    // Add category breakdown if any are significant
    const significantCategories = Object.entries(result.categories)
      .filter(([_, score]) => score > 20)
      .map(([cat, score]) => `${cat}: ${score}%`)
      .join(' | ');
    
    if (significantCategories) {
      embed.addFields({ name: 'Categories', value: significantCategories, inline: false });
    }
    
    await logChannel.send({ embeds: [embed] });
  }
  
  // Take action based on severity
  const { thresholds, muteDurations } = MODERATION_CONFIG;
  const warningData = userWarnings.get(`${guild.id}:${member.id}`);
  const warningCount = warningData?.count || 0;
  
  if (result.score >= thresholds.ban) {
    await banUser(member, result.reason);
  } else if (result.score >= thresholds.kick) {
    if (warningCount >= 3) {
      await kickUser(member, result.reason);
    } else {
      // Mute instead for first-time severe violations
      const duration = muteDurations.third;
      await muteUser(member, duration, result.reason);
    }
  } else if (result.score >= thresholds.mute) {
    const duration = warningCount === 0 ? muteDurations.first :
                     warningCount === 1 ? muteDurations.second :
                     warningCount === 2 ? muteDurations.third :
                     muteDurations.fourth;
    await muteUser(member, duration, result.reason);
  } else if (result.score >= thresholds.warn) {
    await warnUser(member, result.reason);
  }
}

// ====================================
// MEMBER JOIN HANDLER (RAID PROTECTION)
// ====================================

export async function handleMemberJoin(member: GuildMember): Promise<{ isRaid: boolean }> {
  const guild = member.guild;
  const logChannel = guild.channels.cache.get(MODERATION_CONFIG.logChannelId) as TextChannel;
  
  const raidCheck = checkRaid(guild);
  
  if (raidCheck.isRaid && !raidTracker.isLockdown) {
    await activateLockdown(guild, logChannel);
    return { isRaid: true };
  }
  
  // Check suspicious account patterns
  const accountAge = Date.now() - member.user.createdTimestamp;
  const isNewAccount = accountAge < 7 * 24 * 60 * 60 * 1000; // Less than 7 days old
  const hasDefaultAvatar = !member.user.avatar;
  
  if (isNewAccount && hasDefaultAvatar && raidTracker.isLockdown) {
    // Auto-kick suspicious accounts during lockdown
    try {
      await member.kick('Suspicious account during raid lockdown');
      logger.info(`Kicked suspicious account during lockdown: ${member.user.tag}`);
    } catch (err) {
      logger.error('Failed to kick suspicious account:', err);
    }
  }
  
  return { isRaid: false };
}

// ====================================
// EXPORTS
// ====================================

export const AIModerationHandlers = {
  handleMessage,
  handleMemberJoin,
  analyzeContent,
  checkSpam,
  checkRaid,
  activateLockdown,
  deactivateLockdown,
  warnUser,
  muteUser,
  kickUser,
  banUser,
};

export default AIModerationHandlers;
