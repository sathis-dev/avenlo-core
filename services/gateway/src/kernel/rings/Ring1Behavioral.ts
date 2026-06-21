// ====================================
// AVENLO CORE - RING 1: BEHAVIORAL
// ThreatMatrix lookup, Sentiment Probe, Context Weaver
// ====================================

import { Message } from 'discord.js';
import { createLogger, getRedisClient } from '@avenlo/shared';
import { ThreatMatrix } from '../ThreatMatrix';

const logger = createLogger('ring1-behavioral');

// ====================================
// TYPES
// ====================================

export interface Ring1Result {
  compositeThreatScore: number;
  channelHeat: number;
  isCrossChannelSpill: boolean;
  contextBuffer: string[];
  typingSpeedMsPerWord: number;
}

const CONTEXT_BUFFER_KEY = 'kernel:context:';
const CHANNEL_HEAT_KEY = 'kernel:heat:';
const USER_ACTIVE_CHANNELS_KEY = 'kernel:active_channels:';

// ====================================
// RING 1 IMPLEMENTATION
// ====================================

export class Ring1Behavioral {
  private static instance: Ring1Behavioral;
  private threatMatrix: ThreatMatrix;

  private constructor() {
    this.threatMatrix = ThreatMatrix.getInstance();
  }

  public static getInstance(): Ring1Behavioral {
    if (!Ring1Behavioral.instance) {
      Ring1Behavioral.instance = new Ring1Behavioral();
    }
    return Ring1Behavioral.instance;
  }

  /**
   * Process a message through the behavioral ring
   */
  async processMessage(message: Message): Promise<Ring1Result> {
    const userId = message.author.id;
    const guildId = message.guild!.id;
    const channelId = message.channel.id;

    // 1. Get current threat score
    const threatProfile = await this.threatMatrix.getProfile(userId, guildId);

    // 2. Update and fetch context buffer
    const contextBuffer = await this.updateContextBuffer(guildId, channelId, message.content);

    // 3. Update and fetch channel heat
    const channelHeat = await this.updateChannelHeat(guildId, channelId, message.content);

    // 4. Cross-channel correlation check
    const isCrossChannelSpill = await this.checkCrossChannelSpill(userId, guildId, channelId);

    // 5. Behavioral Biometrics (Typing Speed)
    const typingSpeedMsPerWord = await this.calculateTypingSpeed(userId, guildId, message.content);

    // 6. Calculate behavioral anomaly
    // High heat + high cross-channel + low prior threat = highly anomalous
    let anomalyScore = 0;
    if (channelHeat > 70 && threatProfile.compositeScore < 20) anomalyScore += 30;
    if (isCrossChannelSpill) anomalyScore += 40;
    
    // Mathematically impossible typing speed (< 100ms per word usually means copy/paste or bot)
    if (typingSpeedMsPerWord > 0 && typingSpeedMsPerWord < 50) {
       anomalyScore += 80; 
       logger.warn(`Inhuman typing speed detected for ${userId}: ${typingSpeedMsPerWord}ms/word`);
    }

    return {
      compositeThreatScore: threatProfile.compositeScore,
      channelHeat,
      isCrossChannelSpill,
      contextBuffer,
      typingSpeedMsPerWord
    };
  }

  // ====================================
  // INTERNAL CHECKS
  // ====================================

  /**
   * Maintain a sliding window of the last 10 messages in a channel
   */
  private async updateContextBuffer(guildId: string, channelId: string, content: string): Promise<string[]> {
    if (!content.trim()) return [];

    const redis = getRedisClient().getClient();
    const key = `${CONTEXT_BUFFER_KEY}${guildId}:${channelId}`;

    await redis.lpush(key, content);
    await redis.ltrim(key, 0, 9); // Keep last 10
    await redis.expire(key, 3600); // Expire after 1 hour

    return redis.lrange(key, 0, 9);
  }

  /**
   * Calculate relative 'heat' of a channel based on message velocity
   */
  private async updateChannelHeat(guildId: string, channelId: string, content: string): Promise<number> {
    const redis = getRedisClient().getClient();
    const key = `${CHANNEL_HEAT_KEY}${guildId}:${channelId}`;

    // Increment message count for this minute
    const currentMin = Math.floor(Date.now() / 60000);
    const minuteKey = `${key}:${currentMin}`;
    
    await redis.incr(minuteKey);
    await redis.expire(minuteKey, 120); // Keep for 2 mins

    // Get velocity (messages in last minute)
    const velocityStr = await redis.get(minuteKey);
    const velocity = velocityStr ? parseInt(velocityStr, 10) : 1;

    // Heat is a logarithmic scale of velocity. 60 msgs/min = 100 heat
    const rawHeat = (Math.log(velocity) / Math.log(60)) * 100;
    return Math.min(100, Math.max(0, rawHeat));
  }

  /**
   * Check if user is active in multiple channels concurrently (often indicates spam/raid)
   */
  private async checkCrossChannelSpill(userId: string, guildId: string, currentChannelId: string): Promise<boolean> {
    const redis = getRedisClient().getClient();
    const key = `${USER_ACTIVE_CHANNELS_KEY}${guildId}:${userId}`;

    // Add current channel to set
    await redis.sadd(key, currentChannelId);
    await redis.expire(key, 60); // Channels reset after 1 min of inactivity

    // Count unique channels active in the last minute
    const channelCount = await redis.scard(key);

    return channelCount >= 3; // Active in 3+ channels simultaneously
  }

  /**
   * Calculate typing speed based on the delta between typingStart and messageCreate.
   * Returns ms per word. If no typing event found, returns 0 (instant).
   */
  private async calculateTypingSpeed(userId: string, guildId: string, content: string): Promise<number> {
    const redis = getRedisClient().getClient();
    const key = `kernel:typing:${guildId}:${userId}`;
    
    const startStr = await redis.get(key);
    if (!startStr) {
      // If the message is long but they never triggered a typing event, it's 0 (instant)
      const wordCount = content.split(/\s+/).length;
      if (wordCount > 10) return 0.1; // Extremely suspicious
      return -1; // Not enough data / ignored
    }

    const startTime = parseInt(startStr, 10);
    const timeDeltaMs = Date.now() - startTime;
    const wordCount = Math.max(1, content.split(/\s+/).length);
    
    // Clear the typing marker
    await redis.del(key);

    return Math.floor(timeDeltaMs / wordCount);
  }
}
