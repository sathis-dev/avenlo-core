// ====================================
// AVENLO CORE - THREAT MATRIX
// Real-time Threat Intelligence Database
// ====================================

import { createLogger, getRedisClient, getEventBus, EventTypes } from '@avenlo/shared';

const logger = createLogger('threat-matrix');

// ====================================
// CONSTANTS
// ====================================

const THREAT_MATRIX_KEY_PREFIX = 'kernel:threat:';
const THREAT_GLOBAL_KEY_PREFIX = 'kernel:threat:global:';

// Decay properties
const THREAT_DECAY_RATE = 0.05; // 5% per day
const BASELINE_THREAT = 0;
const MAX_THREAT = 100;

// Threat vectors & weights
export const ThreatVectors = {
  TOXICITY: 0.8,
  SPAM: 0.6,
  RAID_PARTICIPATION: 1.5,
  NUKE_ATTEMPT: 3.0,
  PHISHING: 2.5,
  EVASION: 1.2,
};

// ====================================
// TYPES
// ====================================

export interface ThreatProfile {
  userId: string;
  guildId: string;
  compositeScore: number;
  vectors: Record<string, number>;
  lastUpdate: number;
  fingerprintHash?: string;
  knownAlts: string[];
}

// ====================================
// THREAT MATRIX
// ====================================

export class ThreatMatrix {
  private static instance: ThreatMatrix;

  private constructor() {}

  public static getInstance(): ThreatMatrix {
    if (!ThreatMatrix.instance) {
      ThreatMatrix.instance = new ThreatMatrix();
    }
    return ThreatMatrix.instance;
  }

  /**
   * Add to a specific threat vector, recalculating the composite score.
   */
  async addThreatSignal(userId: string, guildId: string, vector: string, amount: number): Promise<ThreatProfile> {
    const profile = await this.getProfile(userId, guildId);
    
    // Apply weight
    const weight = ThreatVectors[vector as keyof typeof ThreatVectors] || 1.0;
    const weightedAmount = amount * weight;

    // Update vector
    profile.vectors[vector] = (profile.vectors[vector] || 0) + weightedAmount;
    
    // Recalculate composite
    profile.compositeScore = this.calculateCompositeScore(profile);
    profile.lastUpdate = Date.now();

    await this.saveProfile(profile);

    // Global intelligence sharing
    if (profile.compositeScore > 50) {
      await this.shareGlobalIntelligence(userId, vector, weightedAmount);
      
      // HIVE MIND SYNC: Blast this threat signature to all other guilds instantly
      const eventBus = getEventBus();
      await eventBus.publish('security:hive_mind_sync' as any, {
         source: 'threat-matrix',
         payload: {
           userId,
           originGuildId: guildId,
           vector,
           score: profile.compositeScore,
           timestamp: Date.now()
         }
      });
    }

    logger.warn(`Threat signal added for ${userId} in ${guildId}: +${weightedAmount.toFixed(1)} (${vector}). New score: ${profile.compositeScore.toFixed(1)}`);
    return profile;
  }

  /**
   * Get a user's threat profile (applies decay on read)
   */
  async getProfile(userId: string, guildId: string): Promise<ThreatProfile> {
    const redis = getRedisClient().getClient();
    const key = `${THREAT_MATRIX_KEY_PREFIX}${guildId}:${userId}`;

    const data = await redis.get(key);
    if (!data) {
      return {
        userId,
        guildId,
        compositeScore: BASELINE_THREAT,
        vectors: {},
        lastUpdate: Date.now(),
        knownAlts: [],
      };
    }

    const profile: ThreatProfile = JSON.parse(data);
    
    // Apply temporal decay
    this.applyDecay(profile);

    return profile;
  }

  /**
   * Reduces the threat score for false positives
   */
  async clearThreatSignal(userId: string, guildId: string, amount: number): Promise<ThreatProfile> {
    const profile = await this.getProfile(userId, guildId);
    
    // Distribute reduction across vectors proportionally
    let totalVectors = 0;
    for (const v in profile.vectors) totalVectors += profile.vectors[v];

    if (totalVectors > 0) {
      for (const v in profile.vectors) {
        const ratio = profile.vectors[v] / totalVectors;
        profile.vectors[v] = Math.max(0, profile.vectors[v] - (amount * ratio));
      }
    }

    profile.compositeScore = this.calculateCompositeScore(profile);
    profile.lastUpdate = Date.now();
    await this.saveProfile(profile);
    
    return profile;
  }

  /**
   * Get global threat intelligence
   */
  async getGlobalThreatScore(userId: string): Promise<number> {
    const redis = getRedisClient().getClient();
    const key = `${THREAT_GLOBAL_KEY_PREFIX}${userId}`;
    const score = await redis.get(key);
    return score ? parseFloat(score) : 0;
  }

  // ====================================
  // INTERNAL HELPERS
  // ====================================

  private calculateCompositeScore(profile: ThreatProfile): number {
    let score = 0;
    for (const v in profile.vectors) {
      score += profile.vectors[v];
    }
    return Math.min(MAX_THREAT, Math.max(BASELINE_THREAT, score));
  }

  private applyDecay(profile: ThreatProfile): void {
    const now = Date.now();
    const daysSinceUpdate = (now - profile.lastUpdate) / (1000 * 60 * 60 * 24);
    
    if (daysSinceUpdate > 0) {
      // Exponential decay: score * (1 - rate)^days
      const decayFactor = Math.pow(1 - THREAT_DECAY_RATE, daysSinceUpdate);
      
      for (const v in profile.vectors) {
        profile.vectors[v] *= decayFactor;
      }
      
      profile.compositeScore = this.calculateCompositeScore(profile);
      profile.lastUpdate = now;
    }
  }

  private async saveProfile(profile: ThreatProfile): Promise<void> {
    const redis = getRedisClient().getClient();
    const key = `${THREAT_MATRIX_KEY_PREFIX}${profile.guildId}:${profile.userId}`;
    // Store for 90 days
    await redis.set(key, JSON.stringify(profile), 'EX', 90 * 24 * 60 * 60);
  }

  private async shareGlobalIntelligence(userId: string, vector: string, amount: number): Promise<void> {
    const redis = getRedisClient().getClient();
    const key = `${THREAT_GLOBAL_KEY_PREFIX}${userId}`;
    
    // Add 10% of local threat to global pool
    const globalAmount = amount * 0.1;
    await redis.incrbyfloat(key, globalAmount);
    await redis.expire(key, 90 * 24 * 60 * 60);
  }
}
