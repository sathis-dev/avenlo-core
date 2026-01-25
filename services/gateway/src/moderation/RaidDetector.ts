// ====================================
// AVENLO CORE - RAID DETECTOR
// Token Bucket Rate Limiter & Heat Map
// ====================================

import { GuildMember, Guild } from 'discord.js';
import { createLogger, getRedisClient, getEventBus, EventTypes } from '@avenlo/shared';

const logger = createLogger('guardian-raid-detector');

// ====================================
// CONSTANTS
// ====================================

const JOIN_BUCKET_KEY = 'guardian:raid:join_bucket';
const JOIN_HISTORY_KEY = 'guardian:raid:join_history';
const LOCKDOWN_KEY = 'guardian:raid:lockdown';
const VELOCITY_BASELINE_KEY = 'guardian:raid:velocity_baseline';

// Token Bucket Configuration
const BUCKET_CAPACITY = 20; // Max tokens
const BUCKET_REFILL_RATE = 0.5; // Tokens per second
const BUCKET_REFILL_INTERVAL = 2000; // ms

// Raid Detection
const VELOCITY_MULTIPLIER_THRESHOLD = 3.0; // 3x baseline = suspicious
const CRITICAL_JOINS_PER_MINUTE = 10;
const PATTERN_ANALYSIS_WINDOW = 300; // 5 minutes in seconds

// Lockdown Durations
const LOCKDOWN_DURATION_SOFT = 300; // 5 minutes
const LOCKDOWN_DURATION_HARD = 1800; // 30 minutes

// ====================================
// TYPES
// ====================================

export type LockdownLevel = 'NONE' | 'SOFT' | 'HARD' | 'EMERGENCY';

export interface RaidStatus {
  /** Current lockdown level */
  lockdownLevel: LockdownLevel;
  /** Current join velocity (joins/min) */
  currentVelocity: number;
  /** Baseline velocity (24h average) */
  baselineVelocity: number;
  /** Velocity multiplier vs baseline */
  velocityMultiplier: number;
  /** Tokens remaining in bucket */
  tokensRemaining: number;
  /** Recent joins (last 5 minutes) */
  recentJoins: JoinEvent[];
  /** Suspicious patterns detected */
  suspiciousPatterns: SuspiciousPattern[];
  /** When lockdown expires */
  lockdownExpiresAt?: Date;
}

export interface JoinEvent {
  userId: string;
  username: string;
  accountAge: number; // days
  timestamp: Date;
  hasAvatar: boolean;
  isBot: boolean;
}

export interface SuspiciousPattern {
  type: 'SIMILAR_NAMES' | 'NEW_ACCOUNTS' | 'NO_AVATARS' | 'BOT_NAMING' | 'VELOCITY_SPIKE';
  confidence: number;
  description: string;
  affectedUsers: string[];
}

export interface LockdownAction {
  level: LockdownLevel;
  duration: number;
  reason: string;
  triggerPatterns: SuspiciousPattern[];
  automaticActions: string[];
}

// ====================================
// RAID DETECTOR
// ====================================

export class RaidDetector {
  private guildId: string;
  private bucketRefillInterval?: NodeJS.Timeout;

  constructor(guildId: string) {
    this.guildId = guildId;
  }

  /**
   * Start the token bucket refill timer
   */
  start(): void {
    if (this.bucketRefillInterval) return;

    this.bucketRefillInterval = setInterval(async () => {
      await this.refillBucket();
    }, BUCKET_REFILL_INTERVAL);

    logger.info(`Raid detector started for guild ${this.guildId}`);
  }

  /**
   * Stop the detector
   */
  stop(): void {
    if (this.bucketRefillInterval) {
      clearInterval(this.bucketRefillInterval);
      this.bucketRefillInterval = undefined;
    }
  }

  // ====================================
  // MEMBER JOIN PROCESSING
  // ====================================

  /**
   * Process a member join event
   * Returns lockdown action if raid detected
   */
  async processJoin(member: GuildMember): Promise<LockdownAction | null> {
    const redis = getRedisClient();

    // Create join event
    const joinEvent: JoinEvent = {
      userId: member.id,
      username: member.user.username,
      accountAge: this.getAccountAgeDays(member.user.createdAt),
      timestamp: new Date(),
      hasAvatar: !!member.user.avatar,
      isBot: member.user.bot,
    };

    // Record the join
    await this.recordJoin(joinEvent);

    // Consume a token
    const tokensRemaining = await this.consumeToken();

    // If bucket empty, check for raid
    if (tokensRemaining <= 0) {
      return this.evaluateRaidConditions();
    }

    // Check velocity even if tokens remain
    const status = await this.getRaidStatus();
    if (status.velocityMultiplier >= VELOCITY_MULTIPLIER_THRESHOLD) {
      return this.evaluateRaidConditions();
    }

    return null;
  }

  /**
   * Record a join event
   */
  private async recordJoin(event: JoinEvent): Promise<void> {
    const redis = getRedisClient().getClient();
    const historyKey = `${JOIN_HISTORY_KEY}:${this.guildId}`;

    // Add to sorted set with timestamp as score
    await redis.zadd(
      historyKey,
      event.timestamp.getTime().toString(),
      JSON.stringify(event)
    );

    // Remove events older than analysis window
    const cutoff = Date.now() - PATTERN_ANALYSIS_WINDOW * 1000;
    await redis.zremrangebyscore(historyKey, '-inf', cutoff.toString());

    // Set TTL
    await redis.expire(historyKey, PATTERN_ANALYSIS_WINDOW * 2);
  }

  /**
   * Get recent joins
   */
  private async getRecentJoins(): Promise<JoinEvent[]> {
    const redis = getRedisClient().getClient();
    const historyKey = `${JOIN_HISTORY_KEY}:${this.guildId}`;

    const cutoff = Date.now() - PATTERN_ANALYSIS_WINDOW * 1000;
    const entries = await redis.zrangebyscore(historyKey, cutoff.toString(), '+inf');

    return entries.map(e => {
      const parsed = JSON.parse(e);
      return {
        ...parsed,
        timestamp: new Date(parsed.timestamp),
      };
    });
  }

  // ====================================
  // TOKEN BUCKET
  // ====================================

  /**
   * Consume a token from the bucket
   */
  private async consumeToken(): Promise<number> {
    const redis = getRedisClient().getClient();
    const bucketKey = `${JOIN_BUCKET_KEY}:${this.guildId}`;

    const tokensStr = await redis.get(bucketKey);
    let tokens = tokensStr ? parseFloat(tokensStr) : BUCKET_CAPACITY;

    tokens = Math.max(0, tokens - 1);
    await redis.set(bucketKey, tokens.toString(), 'EX', 3600);

    return tokens;
  }

  /**
   * Refill the token bucket
   */
  private async refillBucket(): Promise<void> {
    const redis = getRedisClient().getClient();
    const bucketKey = `${JOIN_BUCKET_KEY}:${this.guildId}`;

    const tokensStr = await redis.get(bucketKey);
    let tokens = tokensStr ? parseFloat(tokensStr) : BUCKET_CAPACITY;

    // Refill
    tokens = Math.min(BUCKET_CAPACITY, tokens + BUCKET_REFILL_RATE);
    await redis.set(bucketKey, tokens.toString(), 'EX', 3600);
  }

  // ====================================
  // VELOCITY TRACKING
  // ====================================

  /**
   * Calculate current join velocity (joins per minute)
   */
  private async getCurrentVelocity(): Promise<number> {
    const recentJoins = await this.getRecentJoins();
    
    // Joins in last minute
    const oneMinuteAgo = Date.now() - 60 * 1000;
    const joinsLastMinute = recentJoins.filter(
      j => j.timestamp.getTime() > oneMinuteAgo
    );

    return joinsLastMinute.length;
  }

  /**
   * Get baseline velocity from 24h average
   */
  private async getBaselineVelocity(): Promise<number> {
    const redis = getRedisClient().getClient();
    const key = `${VELOCITY_BASELINE_KEY}:${this.guildId}`;
    const baseline = await redis.get(key);
    return baseline ? parseFloat(baseline) : 1.0; // Default 1 join/min
  }

  /**
   * Update baseline velocity
   */
  async updateBaselineVelocity(velocity: number): Promise<void> {
    const redis = getRedisClient().getClient();
    const key = `${VELOCITY_BASELINE_KEY}:${this.guildId}`;

    // Exponential moving average
    const currentBaseline = await this.getBaselineVelocity();
    const alpha = 0.1; // Smoothing factor
    const newBaseline = alpha * velocity + (1 - alpha) * currentBaseline;

    await redis.set(key, newBaseline.toString(), 'EX', 86400 * 7); // 7 days
  }

  // ====================================
  // PATTERN ANALYSIS
  // ====================================

  /**
   * Analyze recent joins for suspicious patterns
   */
  private async analyzePatterns(): Promise<SuspiciousPattern[]> {
    const recentJoins = await this.getRecentJoins();
    const patterns: SuspiciousPattern[] = [];

    if (recentJoins.length < 3) return patterns;

    // Pattern 1: Similar usernames
    const similarNames = this.detectSimilarNames(recentJoins);
    if (similarNames) patterns.push(similarNames);

    // Pattern 2: New accounts (< 7 days old)
    const newAccounts = this.detectNewAccounts(recentJoins);
    if (newAccounts) patterns.push(newAccounts);

    // Pattern 3: No avatars
    const noAvatars = this.detectNoAvatars(recentJoins);
    if (noAvatars) patterns.push(noAvatars);

    // Pattern 4: Bot-like naming (user123, randomletters)
    const botNaming = this.detectBotNaming(recentJoins);
    if (botNaming) patterns.push(botNaming);

    // Pattern 5: Velocity spike
    const currentVelocity = await this.getCurrentVelocity();
    if (currentVelocity >= CRITICAL_JOINS_PER_MINUTE) {
      patterns.push({
        type: 'VELOCITY_SPIKE',
        confidence: Math.min(100, (currentVelocity / CRITICAL_JOINS_PER_MINUTE) * 100),
        description: `${currentVelocity} joins/min detected (critical threshold: ${CRITICAL_JOINS_PER_MINUTE})`,
        affectedUsers: recentJoins.slice(-10).map(j => j.userId),
      });
    }

    return patterns;
  }

  /**
   * Detect similar usernames pattern
   */
  private detectSimilarNames(joins: JoinEvent[]): SuspiciousPattern | null {
    // Group by name prefix (first 3 chars)
    const prefixGroups = new Map<string, JoinEvent[]>();

    for (const join of joins) {
      const prefix = join.username.slice(0, 3).toLowerCase();
      if (!prefixGroups.has(prefix)) {
        prefixGroups.set(prefix, []);
      }
      prefixGroups.get(prefix)!.push(join);
    }

    // Find groups with 3+ similar names
    for (const [prefix, group] of prefixGroups) {
      if (group.length >= 3) {
        return {
          type: 'SIMILAR_NAMES',
          confidence: Math.min(100, group.length * 25),
          description: `${group.length} users with similar name prefix "${prefix}"`,
          affectedUsers: group.map(j => j.userId),
        };
      }
    }

    return null;
  }

  /**
   * Detect new accounts pattern
   */
  private detectNewAccounts(joins: JoinEvent[]): SuspiciousPattern | null {
    const newAccounts = joins.filter(j => j.accountAge < 7);
    const percentage = (newAccounts.length / joins.length) * 100;

    if (newAccounts.length >= 3 && percentage >= 50) {
      return {
        type: 'NEW_ACCOUNTS',
        confidence: Math.min(100, percentage),
        description: `${newAccounts.length}/${joins.length} recent joins are accounts < 7 days old`,
        affectedUsers: newAccounts.map(j => j.userId),
      };
    }

    return null;
  }

  /**
   * Detect no avatars pattern
   */
  private detectNoAvatars(joins: JoinEvent[]): SuspiciousPattern | null {
    const noAvatar = joins.filter(j => !j.hasAvatar);
    const percentage = (noAvatar.length / joins.length) * 100;

    if (noAvatar.length >= 4 && percentage >= 60) {
      return {
        type: 'NO_AVATARS',
        confidence: Math.min(100, percentage),
        description: `${noAvatar.length}/${joins.length} recent joins have no profile picture`,
        affectedUsers: noAvatar.map(j => j.userId),
      };
    }

    return null;
  }

  /**
   * Detect bot-like naming pattern
   */
  private detectBotNaming(joins: JoinEvent[]): SuspiciousPattern | null {
    // Patterns: user12345, randomChars without vowels, etc.
    const botPatterns = [
      /^user\d{3,}$/i,
      /^\w+\d{4,}$/,
      /^[bcdfghjklmnpqrstvwxz]{5,}$/i, // No vowels
      /^[a-z]{2,4}\d{5,}$/i,
    ];

    const botLike = joins.filter(j =>
      botPatterns.some(pattern => pattern.test(j.username))
    );

    if (botLike.length >= 3) {
      return {
        type: 'BOT_NAMING',
        confidence: Math.min(100, botLike.length * 30),
        description: `${botLike.length} accounts match bot-like naming patterns`,
        affectedUsers: botLike.map(j => j.userId),
      };
    }

    return null;
  }

  // ====================================
  // RAID EVALUATION
  // ====================================

  /**
   * Evaluate if conditions warrant a lockdown
   */
  private async evaluateRaidConditions(): Promise<LockdownAction | null> {
    const patterns = await this.analyzePatterns();
    
    if (patterns.length === 0) return null;

    // Calculate threat score
    let threatScore = 0;
    for (const pattern of patterns) {
      threatScore += pattern.confidence;
    }

    // Determine lockdown level
    let level: LockdownLevel = 'NONE';
    let duration = 0;
    const actions: string[] = [];

    if (threatScore >= 300 || patterns.some(p => p.type === 'VELOCITY_SPIKE' && p.confidence >= 80)) {
      level = 'EMERGENCY';
      duration = LOCKDOWN_DURATION_HARD * 2;
      actions.push(
        'Pause all member joins',
        'Enable verification level: HIGHEST',
        'Auto-kick accounts < 1 day old',
        'Alert all staff via DM'
      );
    } else if (threatScore >= 200) {
      level = 'HARD';
      duration = LOCKDOWN_DURATION_HARD;
      actions.push(
        'Enable verification level: HIGH',
        'Slow mode in all channels (30s)',
        'New members cannot post for 10 minutes'
      );
    } else if (threatScore >= 100) {
      level = 'SOFT';
      duration = LOCKDOWN_DURATION_SOFT;
      actions.push(
        'Enable slow mode in public channels',
        'Increase moderation sensitivity',
        'Alert staff channel'
      );
    }

    if (level === 'NONE') return null;

    const action: LockdownAction = {
      level,
      duration,
      reason: `Raid detected: ${patterns.map(p => p.type).join(', ')}. Threat score: ${threatScore}`,
      triggerPatterns: patterns,
      automaticActions: actions,
    };

    // Activate lockdown
    await this.activateLockdown(action);

    return action;
  }

  /**
   * Activate lockdown mode
   */
  private async activateLockdown(action: LockdownAction): Promise<void> {
    const redis = getRedisClient().getClient();
    const lockdownKey = `${LOCKDOWN_KEY}:${this.guildId}`;

    const expiresAt = Date.now() + action.duration * 1000;

    await redis.hset(lockdownKey, {
      level: action.level,
      reason: action.reason,
      startedAt: Date.now().toString(),
      expiresAt: expiresAt.toString(),
      patterns: JSON.stringify(action.triggerPatterns),
    });

    await redis.expire(lockdownKey, action.duration + 60);

    // Publish lockdown event
    const eventBus = getEventBus();
    const affectedUsers = action.triggerPatterns.flatMap(p => p.affectedUsers).slice(0, 20);
    await eventBus.publish(EventTypes.MOD_RAID_DETECTED, {
      guildId: this.guildId,
      joinCount: affectedUsers.length,
      timeWindowMs: 60000, // 1 minute window
      suspiciousUsers: affectedUsers.map(u => ({
        userId: u,
        username: 'unknown',
        accountAge: 0,
        joinedAt: new Date().toISOString(),
      })),
      actionTaken: action.level.toLowerCase() as 'lockdown' | 'verification' | 'none',
      lockdownDuration: action.duration,
    });

    logger.error(`🚨 RAID LOCKDOWN ACTIVATED: ${this.guildId} - Level: ${action.level}`);
    logger.error(`   Reason: ${action.reason}`);
    logger.error(`   Actions: ${action.automaticActions.join(', ')}`);
  }

  // ====================================
  // STATUS & CONTROL
  // ====================================

  /**
   * Get current raid status
   */
  async getRaidStatus(): Promise<RaidStatus> {
    const redis = getRedisClient().getClient();

    // Get bucket tokens
    const bucketKey = `${JOIN_BUCKET_KEY}:${this.guildId}`;
    const tokensStr = await redis.get(bucketKey);
    const tokensRemaining = tokensStr ? parseFloat(tokensStr) : BUCKET_CAPACITY;

    // Get velocities
    const currentVelocity = await this.getCurrentVelocity();
    const baselineVelocity = await this.getBaselineVelocity();
    const velocityMultiplier = currentVelocity / Math.max(0.1, baselineVelocity);

    // Get recent joins
    const recentJoins = await this.getRecentJoins();

    // Get patterns
    const suspiciousPatterns = await this.analyzePatterns();

    // Get lockdown status
    const lockdownKey = `${LOCKDOWN_KEY}:${this.guildId}`;
    const lockdownData = await redis.hgetall(lockdownKey);

    let lockdownLevel: LockdownLevel = 'NONE';
    let lockdownExpiresAt: Date | undefined;

    if (lockdownData && lockdownData.level) {
      lockdownLevel = lockdownData.level as LockdownLevel;
      if (lockdownData.expiresAt) {
        lockdownExpiresAt = new Date(parseInt(lockdownData.expiresAt, 10));
      }
    }

    return {
      lockdownLevel,
      currentVelocity,
      baselineVelocity,
      velocityMultiplier,
      tokensRemaining,
      recentJoins,
      suspiciousPatterns,
      lockdownExpiresAt,
    };
  }

  /**
   * Manually trigger lockdown
   */
  async manualLockdown(level: LockdownLevel, duration: number, reason: string): Promise<void> {
    const action: LockdownAction = {
      level,
      duration,
      reason: `Manual lockdown: ${reason}`,
      triggerPatterns: [],
      automaticActions: ['Manual lockdown by staff'],
    };

    await this.activateLockdown(action);
  }

  /**
   * Clear lockdown
   */
  async clearLockdown(): Promise<void> {
    const redis = getRedisClient().getClient();
    const lockdownKey = `${LOCKDOWN_KEY}:${this.guildId}`;
    await redis.del(lockdownKey);

    logger.info(`Lockdown cleared for guild ${this.guildId}`);
  }

  // ====================================
  // UTILITIES
  // ====================================

  private getAccountAgeDays(createdAt: Date): number {
    const now = Date.now();
    const age = now - createdAt.getTime();
    return age / (1000 * 60 * 60 * 24);
  }
}

// ====================================
// SINGLETON FACTORY
// ====================================

const detectorCache = new Map<string, RaidDetector>();

export function getRaidDetector(guildId: string): RaidDetector {
  if (!detectorCache.has(guildId)) {
    const detector = new RaidDetector(guildId);
    detector.start();
    detectorCache.set(guildId, detector);
  }
  return detectorCache.get(guildId)!;
}

export function shutdownRaidDetectors(): void {
  for (const detector of detectorCache.values()) {
    detector.stop();
  }
  detectorCache.clear();
}
