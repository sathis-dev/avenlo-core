// ====================================
// AVENLO CORE - SENTIMENT ENGINE
// Redis-Backed Channel Heat Tracking
// ====================================

import { createLogger, getRedisClient } from '@avenlo/shared';

const logger = createLogger('guardian-sentiment-engine');

// ====================================
// CONSTANTS
// ====================================

const HEAT_KEY_PREFIX = 'guardian:heat';
const VELOCITY_KEY_PREFIX = 'guardian:velocity';
const SENTIMENT_HISTORY_PREFIX = 'guardian:sentiment_history';

const HEAT_DECAY_INTERVAL = 60 * 1000; // 1 minute
const HEAT_DECAY_RATE = 0.92;
const HEAT_MAX = 100;
const HEAT_WARNING_THRESHOLD = 50;
const HEAT_CRITICAL_THRESHOLD = 75;
const HEAT_LOCKDOWN_THRESHOLD = 90;

const VELOCITY_WINDOW_SECONDS = 60;
const SENTIMENT_HISTORY_SIZE = 50;

// ====================================
// TYPES
// ====================================

export interface ChannelHeatStatus {
  /** Current heat level (0-100) */
  heat: number;
  /** Heat status classification */
  status: 'COOL' | 'WARM' | 'HOT' | 'CRITICAL' | 'LOCKDOWN';
  /** Message velocity (msgs/min) */
  velocity: number;
  /** Average sentiment over history */
  avgSentiment: number;
  /** Sentiment trend direction */
  trend: 'COOLING' | 'STABLE' | 'HEATING';
  /** Is moderation sensitivity elevated? */
  elevatedSensitivity: boolean;
}

export interface SentimentEntry {
  timestamp: number;
  sentiment: number;
  userId: string;
  wasViolation: boolean;
}

// ====================================
// SENTIMENT ENGINE
// ====================================

export class SentimentEngine {
  private guildId: string;
  private decayInterval?: NodeJS.Timeout;

  constructor(guildId: string) {
    this.guildId = guildId;
  }

  /**
   * Start the decay timer for all channels
   */
  startDecayTimer(): void {
    if (this.decayInterval) return;

    this.decayInterval = setInterval(async () => {
      await this.applyHeatDecay();
    }, HEAT_DECAY_INTERVAL);

    logger.info(`Sentiment engine started for guild ${this.guildId}`);
  }

  /**
   * Stop the decay timer
   */
  stopDecayTimer(): void {
    if (this.decayInterval) {
      clearInterval(this.decayInterval);
      this.decayInterval = undefined;
    }
  }

  // ====================================
  // HEAT MANAGEMENT
  // ====================================

  /**
   * Get current heat status for a channel
   */
  async getChannelHeatStatus(channelId: string): Promise<ChannelHeatStatus> {
    const redis = getRedisClient().getClient();

    const heatKey = `${HEAT_KEY_PREFIX}:${this.guildId}:${channelId}`;
    const velocityKey = `${VELOCITY_KEY_PREFIX}:${this.guildId}:${channelId}`;
    const historyKey = `${SENTIMENT_HISTORY_PREFIX}:${this.guildId}:${channelId}`;

    // Get current values
    const [heatStr, velocityStr, historyJson] = await Promise.all([
      redis.get(heatKey),
      redis.get(velocityKey),
      redis.get(historyKey),
    ]);

    const heat = heatStr ? parseFloat(heatStr) : 0;
    const velocity = velocityStr ? parseFloat(velocityStr) : 0;
    const history: SentimentEntry[] = historyJson
      ? JSON.parse(historyJson)
      : [];

    // Calculate average sentiment
    const avgSentiment =
      history.length > 0
        ? history.reduce((sum, e) => sum + e.sentiment, 0) / history.length
        : 0;

    // Calculate trend
    const trend = this.calculateTrend(history);

    // Determine status
    let status: ChannelHeatStatus['status'] = 'COOL';
    if (heat >= HEAT_LOCKDOWN_THRESHOLD) {
      status = 'LOCKDOWN';
    } else if (heat >= HEAT_CRITICAL_THRESHOLD) {
      status = 'CRITICAL';
    } else if (heat >= HEAT_WARNING_THRESHOLD) {
      status = 'HOT';
    } else if (heat >= 25) {
      status = 'WARM';
    }

    return {
      heat,
      status,
      velocity,
      avgSentiment,
      trend,
      elevatedSensitivity: heat >= HEAT_WARNING_THRESHOLD,
    };
  }

  /**
   * Record a message and update heat metrics
   */
  async recordMessage(
    channelId: string,
    userId: string,
    sentiment: number,
    wasViolation: boolean
  ): Promise<ChannelHeatStatus> {
    const redis = getRedisClient().getClient();

    const heatKey = `${HEAT_KEY_PREFIX}:${this.guildId}:${channelId}`;
    const velocityKey = `${VELOCITY_KEY_PREFIX}:${this.guildId}:${channelId}`;
    const historyKey = `${SENTIMENT_HISTORY_PREFIX}:${this.guildId}:${channelId}`;

    // Get current heat
    const currentHeatStr = await redis.get(heatKey);
    let heat = currentHeatStr ? parseFloat(currentHeatStr) : 0;

    // Calculate heat delta
    const heatDelta = this.calculateHeatDelta(sentiment, wasViolation);
    heat = Math.max(0, Math.min(HEAT_MAX, heat + heatDelta));

    // Update velocity
    const now = Date.now();
    await redis.zadd(velocityKey, now.toString(), `msg:${now}`);
    await redis.zremrangebyscore(
      velocityKey,
      '-inf',
      (now - VELOCITY_WINDOW_SECONDS * 1000).toString()
    );
    const velocityCount = await redis.zcard(velocityKey);
    const velocity = velocityCount / (VELOCITY_WINDOW_SECONDS / 60);

    // Add velocity heat boost
    if (velocity > 10) {
      heat = Math.min(HEAT_MAX, heat + (velocity - 10) * 0.5);
    }

    // Update sentiment history
    const historyJson = await redis.get(historyKey);
    const history: SentimentEntry[] = historyJson
      ? JSON.parse(historyJson)
      : [];

    history.push({
      timestamp: now,
      sentiment,
      userId,
      wasViolation,
    });

    // Trim history to max size
    while (history.length > SENTIMENT_HISTORY_SIZE) {
      history.shift();
    }

    // Store updated values with TTL
    await Promise.all([
      redis.set(heatKey, heat.toString(), 'EX', 7200), // 2 hours
      redis.expire(velocityKey, VELOCITY_WINDOW_SECONDS * 2),
      redis.set(historyKey, JSON.stringify(history), 'EX', 3600), // 1 hour
    ]);

    logger.debug(
      `Channel ${channelId}: heat=${heat.toFixed(1)}, velocity=${velocity.toFixed(1)}, sentiment=${sentiment.toFixed(2)}`
    );

    return this.getChannelHeatStatus(channelId);
  }

  /**
   * Calculate heat delta based on message sentiment
   */
  private calculateHeatDelta(sentiment: number, wasViolation: boolean): number {
    if (wasViolation) {
      return 15; // Violations add significant heat
    }

    if (sentiment <= -0.7) {
      return 8; // Very negative
    } else if (sentiment <= -0.4) {
      return 5; // Moderately negative
    } else if (sentiment <= -0.1) {
      return 2; // Slightly negative
    } else if (sentiment >= 0.5) {
      return -3; // Positive cools things down
    } else if (sentiment >= 0.2) {
      return -1; // Slightly positive
    }

    return 0; // Neutral
  }

  /**
   * Calculate trend from sentiment history
   */
  private calculateTrend(history: SentimentEntry[]): ChannelHeatStatus['trend'] {
    if (history.length < 5) return 'STABLE';

    // Compare first half to second half
    const midpoint = Math.floor(history.length / 2);
    const firstHalf = history.slice(0, midpoint);
    const secondHalf = history.slice(midpoint);

    const firstAvg =
      firstHalf.reduce((sum, e) => sum + e.sentiment, 0) / firstHalf.length;
    const secondAvg =
      secondHalf.reduce((sum, e) => sum + e.sentiment, 0) / secondHalf.length;

    const delta = secondAvg - firstAvg;

    if (delta < -0.15) {
      return 'HEATING'; // Sentiment getting worse
    } else if (delta > 0.15) {
      return 'COOLING'; // Sentiment improving
    }

    return 'STABLE';
  }

  /**
   * Apply heat decay to all tracked channels
   */
  private async applyHeatDecay(): Promise<void> {
    try {
      const redis = getRedisClient().getClient();
      const pattern = `${HEAT_KEY_PREFIX}:${this.guildId}:*`;
      
      // Scan for all heat keys
      const keys = await redis.keys(pattern);

      for (const key of keys) {
        const currentStr = await redis.get(key);
        if (!currentStr) continue;

        let heat = parseFloat(currentStr);
        heat *= HEAT_DECAY_RATE;

        if (heat < 0.5) {
          await redis.del(key);
        } else {
          await redis.set(key, heat.toString(), 'EX', 7200);
        }
      }
    } catch (error) {
      logger.error('Error applying heat decay:', error);
    }
  }

  // ====================================
  // SERVER-WIDE METRICS
  // ====================================

  /**
   * Get server-wide heat map
   */
  async getServerHeatMap(): Promise<Map<string, ChannelHeatStatus>> {
    const redis = getRedisClient().getClient();
    const pattern = `${HEAT_KEY_PREFIX}:${this.guildId}:*`;
    const keys = await redis.keys(pattern);

    const heatMap = new Map<string, ChannelHeatStatus>();

    for (const key of keys) {
      // Extract channel ID from key
      const parts = key.split(':');
      const channelId = parts[parts.length - 1];

      const status = await this.getChannelHeatStatus(channelId);
      heatMap.set(channelId, status);
    }

    return heatMap;
  }

  /**
   * Get hottest channels
   */
  async getHottestChannels(limit: number = 5): Promise<Array<{
    channelId: string;
    status: ChannelHeatStatus;
  }>> {
    const heatMap = await this.getServerHeatMap();

    return Array.from(heatMap.entries())
      .sort((a, b) => b[1].heat - a[1].heat)
      .slice(0, limit)
      .map(([channelId, status]) => ({ channelId, status }));
  }

  /**
   * Check if server is in overall heated state
   */
  async isServerHeated(): Promise<boolean> {
    const hottest = await this.getHottestChannels(3);
    const avgHeat =
      hottest.reduce((sum, c) => sum + c.status.heat, 0) / hottest.length;
    return avgHeat > HEAT_WARNING_THRESHOLD;
  }

  // ====================================
  // MODERATION SENSITIVITY MULTIPLIER
  // ====================================

  /**
   * Get moderation sensitivity multiplier for a channel
   * Returns 1.0 for normal, up to 2.0 for elevated
   */
  async getSensitivityMultiplier(channelId: string): Promise<number> {
    const status = await this.getChannelHeatStatus(channelId);

    if (status.heat >= HEAT_CRITICAL_THRESHOLD) {
      return 2.0; // Maximum sensitivity
    } else if (status.heat >= HEAT_WARNING_THRESHOLD) {
      // Scale from 1.5 to 2.0
      const normalizedHeat =
        (status.heat - HEAT_WARNING_THRESHOLD) /
        (HEAT_CRITICAL_THRESHOLD - HEAT_WARNING_THRESHOLD);
      return 1.5 + normalizedHeat * 0.5;
    } else if (status.heat >= 25) {
      // Scale from 1.0 to 1.5
      const normalizedHeat = (status.heat - 25) / (HEAT_WARNING_THRESHOLD - 25);
      return 1.0 + normalizedHeat * 0.5;
    }

    return 1.0;
  }
}

// ====================================
// SINGLETON FACTORY
// ====================================

const engineCache = new Map<string, SentimentEngine>();

export function getSentimentEngine(guildId: string): SentimentEngine {
  if (!engineCache.has(guildId)) {
    const engine = new SentimentEngine(guildId);
    engine.startDecayTimer();
    engineCache.set(guildId, engine);
  }
  return engineCache.get(guildId)!;
}

export function shutdownSentimentEngines(): void {
  for (const engine of engineCache.values()) {
    engine.stopDecayTimer();
  }
  engineCache.clear();
}
