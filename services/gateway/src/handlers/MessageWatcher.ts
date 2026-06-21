// ====================================
// AVENLO CORE - KINETIC ENGINE (L3 Forensic Visionary)
// AI-powered moderation system analyzing a sliding window of user messages
// to detect complex raid intent and psychological manipulation.
// ====================================

import { Message, TextChannel, GuildMember, EmbedBuilder, Client } from 'discord.js';
import {
  createLogger,
  getRedisClient,
  EventTypes,
  ModerationLog,
  AvenloColors,
} from '@avenlo/shared';

const logger = createLogger('kinetic-watcher');

// ====================================
// CONFIGURATION
// ====================================

const MESSAGE_KEY = (userId: string): string => `avenlo:kinetic:window:${userId}`;
const WINDOW_MS = 20000; // 20-second rolling window
const THRESHOLD = 4; // 4 messages within the window triggers a scan
const LIST_MAX = 7; // Keep only the last 7 messages
const LIST_TTL = 3600; // Rolling 1-hour TTL — self-deletes idle context windows

// ====================================
// TYPES
// ====================================

interface MessageEntry {
  content: string;
  timestamp: number;
  channelId: string;
  messageId: string;
}

interface KineticScanResult {
  guildId: string;
  userId: string;
  username: string;
  messages: MessageEntry[];
  triggeredAt: string;
}

// ====================================
// REDIS SLIDING WINDOW
// ====================================

/**
 * Process a single message: push it to the Redis list, trim to last 7,
 * set TTL, and check if the 4-in-20 threshold has been crossed.
 */
export async function processMessage(message: Message): Promise<void> {
  if (message.author.bot || !message.guild) return;

  // Async guardrail — a Redis failure must never lag the user's message delivery.
  try {
    const redis = getRedisClient().getClient();
    const key = MESSAGE_KEY(message.author.id);

    const entry: MessageEntry = {
      content: message.content,
      timestamp: Date.now(),
      channelId: message.channel.id,
      messageId: message.id,
    };

    // 1. Push to head of list
    await redis.lpush(key, JSON.stringify(entry));

    // 2. Trim to last LIST_MAX messages
    await redis.ltrim(key, 0, LIST_MAX - 1);

    // 3. Apply a rolling 1-hour TTL on every push so idle context self-deletes
    await redis.expire(key, LIST_TTL);

    // 4. Pull the full window and check threshold
    const entriesRaw = await redis.lrange(key, 0, -1);
    const entries: MessageEntry[] = entriesRaw.map((raw: string) => JSON.parse(raw) as MessageEntry);

    const now = Date.now();
    const recent = entries.filter((e) => now - e.timestamp <= WINDOW_MS);

    if (recent.length >= THRESHOLD) {
      logger.info(
        `Kinetic threshold reached for ${message.author.tag}: ${recent.length} messages in ${WINDOW_MS}ms`
      );

      const scan: KineticScanResult = {
        guildId: message.guild.id,
        userId: message.author.id,
        username: message.author.tag,
        messages: entries,
        triggeredAt: new Date().toISOString(),
      };

      // Publish the 7-message bundle to the Redis event bus
      const redisClient = getRedisClient();
      await redisClient.publish(EventTypes.KINETIC_VISIONARY_SCAN, {
        source: 'gateway',
        payload: scan,
      });
    }
  } catch (err) {
    logger.warn('Kinetic watcher failed (failing silently):', err instanceof Error ? err.message : err);
  }
}

// ====================================
// PUNISHMENT EXECUTION
// ====================================

/**
 * Subscribe to KINETIC_THREAT_DETECTED events published by the Architect
 * service after Claude analysis. If the recommendation is 'mute',
 * immediately timeout the user and log to the mod channel.
 */
export function initPunishmentListener(client: Client): void {
  const redis = getRedisClient();

  redis
    .subscribe(EventTypes.KINETIC_THREAT_DETECTED, async (event) => {
      const payload = event.payload as {
        guildId: string;
        channelId: string;
        userId: string;
        username: string;
        messageId?: string;
        vector: string;
        severity: string;
        confidence: number;
        recommendedAction: string;
        signals: string[];
        detectedAt: string;
      };

      if (!payload || payload.recommendedAction !== 'mute') {
        return;
      }

      const guild = client.guilds.cache.get(payload.guildId);
      if (!guild) {
        logger.warn(`Guild ${payload.guildId} not found for kinetic punishment`);
        return;
      }

      let member: GuildMember | null = null;
      try {
        member = await guild.members.fetch(payload.userId);
      } catch {
        logger.warn(`Member ${payload.userId} not found in guild ${payload.guildId}`);
        return;
      }

      if (!member) return;

      // Execute Discord timeout (1 hour)
      const durationMs = 60 * 60 * 1000;
      const reason = `Kinetic Engine: ${payload.signals.join(', ')}`;

      try {
        await member.timeout(durationMs, reason);
        logger.warn(
          `Kinetic Engine muted ${payload.username} for 1h | confidence: ${(payload.confidence * 100).toFixed(1)}%`
        );
      } catch (err) {
        logger.error('Failed to timeout user:', err);
        return;
      }

      // Persist to MongoDB ModerationLog
      try {
        await ModerationLog.create({
          guildId: payload.guildId,
          moderatorId: 'kinetic_engine',
          moderatorName: 'Kinetic Engine',
          targetId: payload.userId,
          targetName: payload.username,
          action: 'timeout',
          reason: `AI-detected ${payload.vector}: ${payload.signals.join(', ')}`,
          aiDetected: true,
          aiScore: payload.confidence,
          aiCategories: payload.signals,
          channelId: payload.channelId,
          duration: durationMs / 1000,
        });
      } catch (err) {
        logger.error('Failed to write ModerationLog:', err);
      }

      // Log explanation to the mod channel
      const logChannelId = process.env.CHANNEL_LOGS || '';
      if (logChannelId) {
        const logChannel = guild.channels.cache.get(logChannelId) as TextChannel | undefined;
        if (logChannel?.isTextBased()) {
          const embed = new EmbedBuilder()
            .setColor(AvenloColors.RED)
            .setTitle('Kinetic Engine — Automated Mute')
            .setDescription(
              `**User:** <@${payload.userId}> (${payload.username})\n` +
                `**Vector:** ${payload.vector}\n` +
                `**Severity:** ${payload.severity}\n` +
                `**Confidence:** ${(payload.confidence * 100).toFixed(1)}%\n` +
                `**Action:** Timeout 1 hour\n` +
                `**Reason:** ${payload.signals.join(', ')}`
            )
            .setTimestamp();

          await logChannel.send({ embeds: [embed] }).catch(() => {
            // Ignore permission errors
          });
        }
      }
    })
    .catch((err) => {
      logger.error('Failed to subscribe to KINETIC_THREAT_DETECTED:', err);
    });
}
