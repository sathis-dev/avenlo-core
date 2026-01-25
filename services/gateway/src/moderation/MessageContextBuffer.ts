// ====================================
// AVENLO CORE - MESSAGE CONTEXT BUFFER
// Sliding Window Context for AI Analysis
// ====================================

import {
  Message,
  TextChannel,
  Collection,
  Snowflake,
  GuildMember,
} from 'discord.js';
import { createLogger, getRedisClient } from '@avenlo/shared';
import { IMessageContext, ISocialContext } from '@avenlo/shared';

const logger = createLogger('guardian-context-buffer');

// ====================================
// CONSTANTS
// ====================================

const CONTEXT_WINDOW_SIZE = 7;
const VELOCITY_WINDOW_SECONDS = 60;
const HEAT_DECAY_RATE = 0.95;
const TECHNICAL_KEYWORDS = [
  'function', 'class', 'const', 'let', 'var', 'import', 'export',
  'async', 'await', 'promise', 'callback', 'api', 'endpoint',
  'database', 'query', 'docker', 'kubernetes', 'nginx', 'redis',
  'mongodb', 'postgres', 'sql', 'typescript', 'javascript', 'python',
  'react', 'vue', 'angular', 'node', 'npm', 'yarn', 'pnpm',
  'git', 'commit', 'push', 'pull', 'merge', 'branch', 'deploy',
  'server', 'client', 'http', 'https', 'websocket', 'rest', 'graphql',
  'dockerfile', 'container', 'image', 'build', 'compile', 'runtime',
  'bug', 'error', 'exception', 'debug', 'stack', 'trace', 'lint',
  'test', 'spec', 'mock', 'stub', 'coverage', 'ci', 'cd', 'pipeline',
];

// ====================================
// SENTIMENT ANALYZER
// ====================================

/**
 * Simple rule-based sentiment scorer
 * Returns value between -1 (negative) and 1 (positive)
 */
function analyzeSentiment(text: string): number {
  const lowerText = text.toLowerCase();

  // Positive indicators
  const positiveWords = [
    'thanks', 'thank you', 'awesome', 'great', 'amazing', 'love',
    'helpful', 'excellent', 'perfect', 'good', 'nice', 'appreciate',
    'happy', 'glad', 'wonderful', 'fantastic', 'brilliant', 'cool',
    '👍', '❤️', '😊', '🎉', '✅', '💯',
  ];

  // Negative indicators
  const negativeWords = [
    'hate', 'stupid', 'idiot', 'dumb', 'trash', 'garbage', 'terrible',
    'awful', 'worst', 'bad', 'sucks', 'annoying', 'frustrated', 'angry',
    'wtf', 'stfu', 'die', 'kill', 'pathetic', 'useless', 'broken',
    '😡', '🤬', '💀', '🖕', '👎', '😤',
  ];

  // Hostility amplifiers
  const hostilityMarkers = [
    '!', '!!!', 'you are', "you're", 'ur', 'u are', '@',
  ];

  let score = 0;
  let hostilityBoost = 0;

  // Count positive
  for (const word of positiveWords) {
    if (lowerText.includes(word)) score += 0.15;
  }

  // Count negative
  for (const word of negativeWords) {
    if (lowerText.includes(word)) score -= 0.2;
  }

  // Check hostility markers
  for (const marker of hostilityMarkers) {
    if (lowerText.includes(marker)) hostilityBoost += 0.1;
  }

  // ALL CAPS amplifies sentiment
  const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (capsRatio > 0.5 && text.length > 10) {
    score *= 1.5;
    hostilityBoost += 0.2;
  }

  // Apply hostility boost to negative scores only
  if (score < 0) {
    score -= hostilityBoost;
  }

  // Clamp to [-1, 1]
  return Math.max(-1, Math.min(1, score));
}

/**
 * Detect if message is in a technical context
 */
function detectTechnicalContext(text: string): boolean {
  const lowerText = text.toLowerCase();
  let technicalCount = 0;

  for (const keyword of TECHNICAL_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      technicalCount++;
    }
  }

  // Also check for code blocks
  if (text.includes('```') || text.includes('`')) {
    technicalCount += 2;
  }

  return technicalCount >= 2;
}

// ====================================
// MESSAGE CONTEXT BUFFER
// ====================================

export interface ContextBufferResult {
  /** Last N messages in the channel */
  messages: IMessageContext[];
  /** Social context analysis */
  socialContext: ISocialContext;
  /** Raw messages for further processing */
  rawMessages: Message[];
}

export class MessageContextBuffer {
  private channelId: string;
  private guildId: string;

  constructor(channelId: string, guildId: string) {
    this.channelId = channelId;
    this.guildId = guildId;
  }

  /**
   * Fetch the sliding window of messages and analyze context
   */
  async getContext(
    channel: TextChannel,
    triggerMessage: Message
  ): Promise<ContextBufferResult> {
    const startTime = Date.now();

    try {
      // Fetch last N messages before the trigger
      const messages = await channel.messages.fetch({
        limit: CONTEXT_WINDOW_SIZE + 1,
        before: triggerMessage.id,
      });

      // Add the trigger message
      const allMessages = new Collection<Snowflake, Message>();
      allMessages.set(triggerMessage.id, triggerMessage);
      messages.forEach((msg, id) => allMessages.set(id, msg));

      // Convert to sorted array (oldest first)
      const sortedMessages = Array.from(allMessages.values())
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
        .slice(-CONTEXT_WINDOW_SIZE);

      // Analyze each message
      const messageContexts: IMessageContext[] = sortedMessages.map(msg => ({
        messageId: msg.id,
        authorId: msg.author.id,
        authorUsername: msg.author.username,
        content: msg.content.slice(0, 500), // Truncate for storage
        timestamp: msg.createdAt,
        sentiment: analyzeSentiment(msg.content),
      }));

      // Calculate social context
      const socialContext = await this.calculateSocialContext(
        sortedMessages,
        messageContexts
      );

      logger.debug(
        `Context buffer fetched ${messageContexts.length} messages in ${Date.now() - startTime}ms`
      );

      return {
        messages: messageContexts,
        socialContext,
        rawMessages: sortedMessages,
      };
    } catch (error) {
      logger.error('Error fetching message context:', error);

      // Return minimal context on error
      return {
        messages: [
          {
            messageId: triggerMessage.id,
            authorId: triggerMessage.author.id,
            authorUsername: triggerMessage.author.username,
            content: triggerMessage.content.slice(0, 500),
            timestamp: triggerMessage.createdAt,
            sentiment: analyzeSentiment(triggerMessage.content),
          },
        ],
        socialContext: {
          channelHeat: 0,
          messageVelocity: 0,
          sentimentDelta: 0,
          activeUsers: 1,
          isHeatedDiscussion: false,
          technicalContext: false,
        },
        rawMessages: [triggerMessage],
      };
    }
  }

  /**
   * Calculate social context metrics
   */
  private async calculateSocialContext(
    messages: Message[],
    contexts: IMessageContext[]
  ): Promise<ISocialContext> {
    // Calculate message velocity (messages per minute)
    const now = Date.now();
    const recentMessages = messages.filter(
      m => now - m.createdTimestamp < VELOCITY_WINDOW_SECONDS * 1000
    );
    const messageVelocity = recentMessages.length / (VELOCITY_WINDOW_SECONDS / 60);

    // Calculate sentiment delta
    let sentimentDelta = 0;
    if (contexts.length >= 2) {
      const firstHalf = contexts.slice(0, Math.floor(contexts.length / 2));
      const secondHalf = contexts.slice(Math.floor(contexts.length / 2));

      const firstAvg =
        firstHalf.reduce((sum, m) => sum + m.sentiment, 0) / firstHalf.length;
      const secondAvg =
        secondHalf.reduce((sum, m) => sum + m.sentiment, 0) / secondHalf.length;

      sentimentDelta = secondAvg - firstAvg;
    }

    // Count unique active users
    const uniqueAuthors = new Set(messages.map(m => m.author.id));
    const activeUsers = uniqueAuthors.size;

    // Detect technical context
    const technicalMessages = messages.filter(m =>
      detectTechnicalContext(m.content)
    );
    const technicalContext = technicalMessages.length >= 2;

    // Get channel heat from Redis
    const channelHeat = await this.getChannelHeat();

    // Is this a heated discussion?
    const avgSentiment =
      contexts.reduce((sum, m) => sum + m.sentiment, 0) / contexts.length;
    const isHeatedDiscussion =
      avgSentiment < -0.3 || messageVelocity > 5 || channelHeat > 60;

    // Detect conversation topic (simplified)
    let conversationTopic: string | undefined;
    if (technicalContext) {
      conversationTopic = 'technical_discussion';
    } else if (avgSentiment < -0.3) {
      conversationTopic = 'conflict';
    } else if (avgSentiment > 0.3) {
      conversationTopic = 'positive_interaction';
    }

    return {
      channelHeat,
      messageVelocity,
      sentimentDelta,
      activeUsers,
      isHeatedDiscussion,
      conversationTopic,
      technicalContext,
    };
  }

  /**
   * Get channel heat from Redis
   */
  private async getChannelHeat(): Promise<number> {
    try {
      const redis = getRedisClient().getClient();
      const key = `guardian:heat:${this.guildId}:${this.channelId}`;
      const heat = await redis.get(key);
      return heat ? parseFloat(heat) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Update channel heat based on new message
   */
  async updateHeat(sentiment: number, isViolation: boolean): Promise<number> {
    try {
      const redis = getRedisClient().getClient();
      const key = `guardian:heat:${this.guildId}:${this.channelId}`;

      let heat = await this.getChannelHeat();

      // Apply decay
      heat *= HEAT_DECAY_RATE;

      // Add heat based on sentiment and violations
      if (isViolation) {
        heat += 20;
      } else if (sentiment < -0.5) {
        heat += 10;
      } else if (sentiment < -0.2) {
        heat += 5;
      } else if (sentiment > 0.3) {
        heat = Math.max(0, heat - 5);
      }

      // Clamp to [0, 100]
      heat = Math.max(0, Math.min(100, heat));

      // Store with 1 hour expiry
      await redis.set(key, heat.toString(), 'EX', 3600);

      return heat;
    } catch (error) {
      logger.error('Error updating channel heat:', error);
      return 0;
    }
  }
}

// ====================================
// EXPORTS
// ====================================

export { analyzeSentiment, detectTechnicalContext };
