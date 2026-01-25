// ====================================
// AVENLO CORE - REDIS CLIENT & EVENT BUS
// ====================================

import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { EventType, BaseEvent } from '../types/events';
import { logger } from './logger';

export interface RedisConfig {
  url: string;
  keyPrefix?: string;
}

/**
 * Redis client wrapper with event bus capabilities
 */
export class RedisClient {
  private client: Redis;
  private subscriber: Redis;
  private publisher: Redis;
  private keyPrefix: string;
  private handlers: Map<EventType, Set<(event: BaseEvent) => Promise<void>>>;

  constructor(config: RedisConfig) {
    this.keyPrefix = config.keyPrefix || 'avenlo:';
    this.handlers = new Map();

    // Railway TCP proxy does NOT use TLS - use plain connection
    const commonOptions = {
      maxRetriesPerRequest: null, // Disable retry limit for long-running connections
      retryStrategy: (times: number) => Math.min(times * 100, 5000),
      lazyConnect: true,
      connectTimeout: 15000,
      enableReadyCheck: true,
      enableOfflineQueue: true,
      reconnectOnError: () => true, // Always attempt to reconnect on error
    };

    // Main client for general operations
    this.client = new Redis(config.url, commonOptions);

    // Dedicated subscriber connection
    this.subscriber = new Redis(config.url, commonOptions);

    // Dedicated publisher connection
    this.publisher = new Redis(config.url, commonOptions);

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('error', (err) => logger.error('Redis client error:', err));
    this.subscriber.on('error', (err) => logger.error('Redis subscriber error:', err));
    this.publisher.on('error', (err) => logger.error('Redis publisher error:', err));

    this.subscriber.on('message', async (channel, message) => {
      try {
        const event = JSON.parse(message) as BaseEvent;
        const handlers = this.handlers.get(event.type as EventType);
        
        if (handlers) {
          for (const handler of handlers) {
            try {
              await handler(event);
            } catch (err) {
              logger.error(`Event handler error for ${event.type}:`, err);
            }
          }
        }
      } catch (err) {
        logger.error('Failed to parse event message:', err);
      }
    });
  }

  async connect(): Promise<void> {
    // Only connect if not already connected
    const connectIfNeeded = async (redis: Redis, name: string) => {
      if (redis.status === 'ready' || redis.status === 'connecting') {
        logger.info(`${name} already ${redis.status}`);
        return;
      }
      await redis.connect();
    };

    await Promise.all([
      connectIfNeeded(this.client, 'Redis client'),
      connectIfNeeded(this.subscriber, 'Redis subscriber'),
      connectIfNeeded(this.publisher, 'Redis publisher'),
    ]);
    logger.info('Redis connections established');
  }

  async disconnect(): Promise<void> {
    await Promise.all([
      this.client.quit(),
      this.subscriber.quit(),
      this.publisher.quit(),
    ]);
    logger.info('Redis connections closed');
  }

  // ====================================
  // EVENT BUS METHODS
  // ====================================

  /**
   * Subscribe to an event type
   */
  async subscribe(
    eventType: EventType,
    handler: (event: BaseEvent) => Promise<void>
  ): Promise<void> {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
      await this.subscriber.subscribe(`${this.keyPrefix}events:${eventType}`);
    }
    this.handlers.get(eventType)!.add(handler);
    logger.debug(`Subscribed to event: ${eventType}`);
  }

  /**
   * Unsubscribe from an event type
   */
  async unsubscribe(
    eventType: EventType,
    handler?: (event: BaseEvent) => Promise<void>
  ): Promise<void> {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      if (handler) {
        handlers.delete(handler);
      } else {
        handlers.clear();
      }
      
      if (handlers.size === 0) {
        this.handlers.delete(eventType);
        await this.subscriber.unsubscribe(`${this.keyPrefix}events:${eventType}`);
      }
    }
  }

  /**
   * Publish an event to the bus
   */
  async publish<T extends BaseEvent>(
    eventType: EventType,
    payload: Omit<T, 'id' | 'type' | 'timestamp'>
  ): Promise<string> {
    const event: BaseEvent = {
      id: uuidv4(),
      type: eventType,
      timestamp: new Date(),
      ...payload,
    } as BaseEvent;

    await this.publisher.publish(
      `${this.keyPrefix}events:${eventType}`,
      JSON.stringify(event)
    );

    logger.debug(`Published event: ${eventType}`, { eventId: event.id });
    return event.id;
  }

  // ====================================
  // SESSION MANAGEMENT
  // ====================================

  /**
   * Store a user session
   */
  async setSession(
    userId: string,
    sessionData: Record<string, unknown>,
    ttlSeconds: number = 3600
  ): Promise<void> {
    const key = `${this.keyPrefix}session:${userId}`;
    await this.client.setex(key, ttlSeconds, JSON.stringify(sessionData));
  }

  /**
   * Get a user session
   */
  async getSession<T = Record<string, unknown>>(userId: string): Promise<T | null> {
    const key = `${this.keyPrefix}session:${userId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Update session data (merge with existing)
   */
  async updateSession(
    userId: string,
    updates: Record<string, unknown>,
    ttlSeconds: number = 3600
  ): Promise<void> {
    const existing = await this.getSession(userId);
    const merged = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await this.setSession(userId, merged, ttlSeconds);
  }

  /**
   * Delete a user session
   */
  async deleteSession(userId: string): Promise<void> {
    const key = `${this.keyPrefix}session:${userId}`;
    await this.client.del(key);
  }

  /**
   * Extend session TTL
   */
  async extendSession(userId: string, ttlSeconds: number = 3600): Promise<boolean> {
    const key = `${this.keyPrefix}session:${userId}`;
    const result = await this.client.expire(key, ttlSeconds);
    return result === 1;
  }

  // ====================================
  // CACHING
  // ====================================

  /**
   * Set a cached value
   */
  async setCache(
    key: string,
    value: unknown,
    ttlSeconds?: number
  ): Promise<void> {
    const fullKey = `${this.keyPrefix}cache:${key}`;
    const serialized = JSON.stringify(value);
    
    if (ttlSeconds) {
      await this.client.setex(fullKey, ttlSeconds, serialized);
    } else {
      await this.client.set(fullKey, serialized);
    }
  }

  /**
   * Get a cached value
   */
  async getCache<T>(key: string): Promise<T | null> {
    const fullKey = `${this.keyPrefix}cache:${key}`;
    const data = await this.client.get(fullKey);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Delete a cached value
   */
  async deleteCache(key: string): Promise<void> {
    const fullKey = `${this.keyPrefix}cache:${key}`;
    await this.client.del(fullKey);
  }

  /**
   * Get or set cache with callback
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = 300
  ): Promise<T> {
    const cached = await this.getCache<T>(key);
    if (cached !== null) {
      return cached;
    }
    
    const value = await fetcher();
    await this.setCache(key, value, ttlSeconds);
    return value;
  }

  // ====================================
  // RATE LIMITING
  // ====================================

  /**
   * Check and increment rate limit
   */
  async checkRateLimit(
    identifier: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
    const key = `${this.keyPrefix}ratelimit:${identifier}`;
    const now = Date.now();
    const windowStart = now - (windowSeconds * 1000);

    // Remove old entries
    await this.client.zremrangebyscore(key, 0, windowStart);

    // Count current requests
    const count = await this.client.zcard(key);

    if (count >= maxRequests) {
      const oldestEntry = await this.client.zrange(key, 0, 0, 'WITHSCORES');
      const resetIn = oldestEntry.length >= 2
        ? Math.ceil((parseInt(oldestEntry[1]) + (windowSeconds * 1000) - now) / 1000)
        : windowSeconds;
      
      return { allowed: false, remaining: 0, resetIn };
    }

    // Add new entry
    await this.client.zadd(key, now, `${now}-${Math.random()}`);
    await this.client.expire(key, windowSeconds);

    return {
      allowed: true,
      remaining: maxRequests - count - 1,
      resetIn: windowSeconds,
    };
  }

  // ====================================
  // RAW ACCESS
  // ====================================

  /**
   * Get raw Redis client for custom operations
   */
  getClient(): Redis {
    return this.client;
  }
}

// Singleton instance
let redisInstance: RedisClient | null = null;

export function getRedisClient(config?: RedisConfig): RedisClient {
  if (!redisInstance) {
    if (!config) {
      throw new Error('Redis config required for initial setup');
    }
    redisInstance = new RedisClient(config);
  }
  return redisInstance;
}

export function initRedis(config: RedisConfig): RedisClient {
  redisInstance = new RedisClient(config);
  return redisInstance;
}
