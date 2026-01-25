// ====================================
// AVENLO CORE - USER REPUTATION SYSTEM
// Shadow Score & Elevated Observation
// ====================================

import { createLogger, getRedisClient, User } from '@avenlo/shared';

const logger = createLogger('guardian-reputation');

// ====================================
// CONSTANTS
// ====================================

const REPUTATION_KEY_PREFIX = 'guardian:reputation';
const OBSERVATION_KEY_PREFIX = 'guardian:observation';
const HISTORY_KEY_PREFIX = 'guardian:rep_history';

// Reputation bounds
const REPUTATION_MIN = 0;
const REPUTATION_MAX = 100;
const REPUTATION_DEFAULT = 50;

// Thresholds
const SUSPICION_THRESHOLD = 35;
const ELEVATED_OBSERVATION_DURATION = 30 * 60; // 30 minutes in seconds
const TRUSTED_THRESHOLD = 75;

// Reputation changes
const REP_VIOLATION_PENALTY = -15;
const REP_WARNING_PENALTY = -8;
const REP_FALSE_POSITIVE_BOOST = +10;
const REP_POSITIVE_CONTRIBUTION = +2;
const REP_DAILY_DECAY_TOWARD_NEUTRAL = 0.02; // 2% toward 50 per day

// ====================================
// TYPES
// ====================================

export type ObservationLevel = 'NORMAL' | 'ELEVATED' | 'PROBATION' | 'RESTRICTED';

export interface UserReputationState {
  /** User ID */
  userId: string;
  /** Guild ID */
  guildId: string;
  /** Current reputation score (0-100) */
  score: number;
  /** Trust level classification */
  trustLevel: 'UNTRUSTED' | 'SUSPICIOUS' | 'NEUTRAL' | 'TRUSTED' | 'VERIFIED';
  /** Current observation level */
  observationLevel: ObservationLevel;
  /** When elevated observation started */
  observationStartedAt?: Date;
  /** When elevated observation expires */
  observationExpiresAt?: Date;
  /** Moderation sensitivity multiplier */
  sensitivityMultiplier: number;
  /** Recent reputation changes */
  recentChanges: ReputationChange[];
}

export interface ReputationChange {
  timestamp: Date;
  delta: number;
  reason: string;
  infractionId?: string;
}

// ====================================
// USER REPUTATION MANAGER
// ====================================

export class UserReputationManager {
  private guildId: string;

  constructor(guildId: string) {
    this.guildId = guildId;
  }

  // ====================================
  // CORE REPUTATION METHODS
  // ====================================

  /**
   * Get current reputation state for a user
   */
  async getReputationState(userId: string): Promise<UserReputationState> {
    const redis = getRedisClient().getClient();

    const repKey = `${REPUTATION_KEY_PREFIX}:${this.guildId}:${userId}`;
    const obsKey = `${OBSERVATION_KEY_PREFIX}:${this.guildId}:${userId}`;
    const historyKey = `${HISTORY_KEY_PREFIX}:${this.guildId}:${userId}`;

    // Get current values
    const [scoreStr, obsData, historyJson] = await Promise.all([
      redis.get(repKey),
      redis.hgetall(obsKey),
      redis.get(historyKey),
    ]);

    const score = scoreStr ? parseFloat(scoreStr) : REPUTATION_DEFAULT;
    const recentChanges: ReputationChange[] = historyJson
      ? JSON.parse(historyJson)
      : [];

    // Determine trust level
    const trustLevel = this.calculateTrustLevel(score);

    // Check observation status
    let observationLevel: ObservationLevel = 'NORMAL';
    let observationStartedAt: Date | undefined;
    let observationExpiresAt: Date | undefined;

    if (obsData && obsData.level) {
      observationLevel = obsData.level as ObservationLevel;
      if (obsData.startedAt) {
        observationStartedAt = new Date(parseInt(obsData.startedAt, 10));
      }
      if (obsData.expiresAt) {
        observationExpiresAt = new Date(parseInt(obsData.expiresAt, 10));
      }
    }

    // Auto-enter observation if below threshold
    if (score < SUSPICION_THRESHOLD && observationLevel === 'NORMAL') {
      await this.enterElevatedObservation(userId, 'Score dropped below threshold');
      observationLevel = 'ELEVATED';
      observationStartedAt = new Date();
      observationExpiresAt = new Date(Date.now() + ELEVATED_OBSERVATION_DURATION * 1000);
    }

    // Calculate sensitivity multiplier
    const sensitivityMultiplier = this.calculateSensitivityMultiplier(
      score,
      observationLevel
    );

    return {
      userId,
      guildId: this.guildId,
      score,
      trustLevel,
      observationLevel,
      observationStartedAt,
      observationExpiresAt,
      sensitivityMultiplier,
      recentChanges: recentChanges.slice(-10), // Last 10 changes
    };
  }

  /**
   * Modify user reputation
   */
  async modifyReputation(
    userId: string,
    delta: number,
    reason: string,
    infractionId?: string
  ): Promise<UserReputationState> {
    const redis = getRedisClient().getClient();

    const repKey = `${REPUTATION_KEY_PREFIX}:${this.guildId}:${userId}`;
    const historyKey = `${HISTORY_KEY_PREFIX}:${this.guildId}:${userId}`;

    // Get current score
    const currentStr = await redis.get(repKey);
    let score = currentStr ? parseFloat(currentStr) : REPUTATION_DEFAULT;

    // Apply delta
    const oldScore = score;
    score = Math.max(REPUTATION_MIN, Math.min(REPUTATION_MAX, score + delta));

    // Store new score (no expiry - permanent)
    await redis.set(repKey, score.toString());

    // Update history
    const historyJson = await redis.get(historyKey);
    const history: ReputationChange[] = historyJson
      ? JSON.parse(historyJson)
      : [];

    history.push({
      timestamp: new Date(),
      delta,
      reason,
      infractionId,
    });

    // Keep last 100 changes
    while (history.length > 100) {
      history.shift();
    }

    await redis.set(historyKey, JSON.stringify(history), 'EX', 86400 * 30); // 30 days

    logger.info(
      `Reputation modified for ${userId}: ${oldScore.toFixed(1)} → ${score.toFixed(1)} (${delta > 0 ? '+' : ''}${delta}) - ${reason}`
    );

    // Check if needs elevated observation
    if (score < SUSPICION_THRESHOLD) {
      await this.enterElevatedObservation(userId, reason);
    }

    return this.getReputationState(userId);
  }

  /**
   * Record a violation
   */
  async recordViolation(
    userId: string,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    infractionId: string
  ): Promise<UserReputationState> {
    let delta: number;
    switch (severity) {
      case 'CRITICAL':
        delta = REP_VIOLATION_PENALTY * 2;
        break;
      case 'HIGH':
        delta = REP_VIOLATION_PENALTY * 1.5;
        break;
      case 'MEDIUM':
        delta = REP_VIOLATION_PENALTY;
        break;
      case 'LOW':
        delta = REP_WARNING_PENALTY;
        break;
    }

    return this.modifyReputation(
      userId,
      delta,
      `Violation: ${severity}`,
      infractionId
    );
  }

  /**
   * Record a positive contribution
   */
  async recordPositiveContribution(
    userId: string,
    type: 'HELPFUL_MESSAGE' | 'QUALITY_CONTENT' | 'COMMUNITY_SUPPORT'
  ): Promise<UserReputationState> {
    return this.modifyReputation(
      userId,
      REP_POSITIVE_CONTRIBUTION,
      `Positive contribution: ${type}`
    );
  }

  /**
   * Correct a false positive
   */
  async correctFalsePositive(
    userId: string,
    infractionId: string
  ): Promise<UserReputationState> {
    return this.modifyReputation(
      userId,
      REP_FALSE_POSITIVE_BOOST,
      'False positive corrected',
      infractionId
    );
  }

  // ====================================
  // OBSERVATION MODE
  // ====================================

  /**
   * Enter elevated observation mode
   */
  async enterElevatedObservation(
    userId: string,
    reason: string
  ): Promise<void> {
    const redis = getRedisClient().getClient();
    const obsKey = `${OBSERVATION_KEY_PREFIX}:${this.guildId}:${userId}`;

    const now = Date.now();
    const expiresAt = now + ELEVATED_OBSERVATION_DURATION * 1000;

    await redis.hset(obsKey, {
      level: 'ELEVATED',
      startedAt: now.toString(),
      expiresAt: expiresAt.toString(),
      reason,
    });

    // Set TTL on the observation
    await redis.expire(obsKey, ELEVATED_OBSERVATION_DURATION + 60);

    logger.warn(
      `User ${userId} entered ELEVATED observation for 30 minutes: ${reason}`
    );
  }

  /**
   * Escalate to probation (longer observation)
   */
  async escalateToProbation(userId: string, reason: string): Promise<void> {
    const redis = getRedisClient().getClient();
    const obsKey = `${OBSERVATION_KEY_PREFIX}:${this.guildId}:${userId}`;

    const now = Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000; // 24 hours

    await redis.hset(obsKey, {
      level: 'PROBATION',
      startedAt: now.toString(),
      expiresAt: expiresAt.toString(),
      reason,
    });

    await redis.expire(obsKey, 24 * 60 * 60 + 60);

    logger.warn(`User ${userId} escalated to PROBATION: ${reason}`);
  }

  /**
   * Restrict user (maximum observation)
   */
  async restrictUser(userId: string, reason: string): Promise<void> {
    const redis = getRedisClient().getClient();
    const obsKey = `${OBSERVATION_KEY_PREFIX}:${this.guildId}:${userId}`;

    const now = Date.now();
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days

    await redis.hset(obsKey, {
      level: 'RESTRICTED',
      startedAt: now.toString(),
      expiresAt: expiresAt.toString(),
      reason,
    });

    await redis.expire(obsKey, 7 * 24 * 60 * 60 + 60);

    logger.warn(`User ${userId} RESTRICTED: ${reason}`);
  }

  /**
   * Clear observation status
   */
  async clearObservation(userId: string): Promise<void> {
    const redis = getRedisClient().getClient();
    const obsKey = `${OBSERVATION_KEY_PREFIX}:${this.guildId}:${userId}`;
    await redis.del(obsKey);

    logger.info(`Observation cleared for user ${userId}`);
  }

  // ====================================
  // HELPER METHODS
  // ====================================

  /**
   * Calculate trust level from score
   */
  private calculateTrustLevel(
    score: number
  ): UserReputationState['trustLevel'] {
    if (score >= 85) return 'VERIFIED';
    if (score >= TRUSTED_THRESHOLD) return 'TRUSTED';
    if (score >= 45) return 'NEUTRAL';
    if (score >= SUSPICION_THRESHOLD) return 'SUSPICIOUS';
    return 'UNTRUSTED';
  }

  /**
   * Calculate sensitivity multiplier
   */
  private calculateSensitivityMultiplier(
    score: number,
    observationLevel: ObservationLevel
  ): number {
    let multiplier = 1.0;

    // Base multiplier from observation level
    switch (observationLevel) {
      case 'RESTRICTED':
        multiplier = 3.0;
        break;
      case 'PROBATION':
        multiplier = 2.5;
        break;
      case 'ELEVATED':
        multiplier = 2.0;
        break;
      default:
        multiplier = 1.0;
    }

    // Adjust based on score
    if (score < 25) {
      multiplier *= 1.5;
    } else if (score < 40) {
      multiplier *= 1.25;
    } else if (score > 80) {
      multiplier *= 0.75; // More lenient for trusted users
    }

    return Math.max(0.5, Math.min(5.0, multiplier));
  }

  // ====================================
  // BULK OPERATIONS
  // ====================================

  /**
   * Get users in elevated observation
   */
  async getUsersInObservation(): Promise<string[]> {
    const redis = getRedisClient().getClient();
    const pattern = `${OBSERVATION_KEY_PREFIX}:${this.guildId}:*`;
    const keys = await redis.keys(pattern);

    return keys.map((key: string) => key.split(':').pop()!);
  }

  /**
   * Get users below suspicion threshold
   */
  async getSuspiciousUsers(): Promise<Array<{ userId: string; score: number }>> {
    const redis = getRedisClient().getClient();
    const pattern = `${REPUTATION_KEY_PREFIX}:${this.guildId}:*`;
    const keys = await redis.keys(pattern);

    const suspicious: Array<{ userId: string; score: number }> = [];

    for (const key of keys) {
      const scoreStr = await redis.get(key);
      const score = scoreStr ? parseFloat(scoreStr) : REPUTATION_DEFAULT;

      if (score < SUSPICION_THRESHOLD) {
        const userId = key.split(':').pop()!;
        suspicious.push({ userId, score });
      }
    }

    return suspicious.sort((a, b) => a.score - b.score);
  }

  /**
   * Apply daily reputation decay toward neutral
   */
  async applyDailyDecay(): Promise<number> {
    const redis = getRedisClient().getClient();
    const pattern = `${REPUTATION_KEY_PREFIX}:${this.guildId}:*`;
    const keys = await redis.keys(pattern);

    let updated = 0;

    for (const key of keys) {
      const scoreStr = await redis.get(key);
      if (!scoreStr) continue;

      let score = parseFloat(scoreStr);
      const neutral = REPUTATION_DEFAULT;

      // Move toward neutral by decay rate
      if (score > neutral) {
        score -= (score - neutral) * REP_DAILY_DECAY_TOWARD_NEUTRAL;
      } else if (score < neutral) {
        score += (neutral - score) * REP_DAILY_DECAY_TOWARD_NEUTRAL;
      }

      await redis.set(key, score.toString());
      updated++;
    }

    logger.info(`Applied daily decay to ${updated} user reputations`);
    return updated;
  }
}

// ====================================
// SINGLETON FACTORY
// ====================================

const managerCache = new Map<string, UserReputationManager>();

export function getUserReputationManager(guildId: string): UserReputationManager {
  if (!managerCache.has(guildId)) {
    managerCache.set(guildId, new UserReputationManager(guildId));
  }
  return managerCache.get(guildId)!;
}
