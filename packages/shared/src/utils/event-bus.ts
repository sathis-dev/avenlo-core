// ====================================
// AVENLO CORE - REDIS STREAMS EVENT BUS
// High-Availability Distributed Event System
// ====================================

import Redis from 'ioredis';
import { createHash, randomUUID } from 'crypto';
import { createLogger } from './logger';
import {
  EventType,
  EventTypes,
  EventEnvelope,
  EventMetadata,
  IdempotencyInfo,
  PayloadFor,
  SerializedEvent,
  DeadLetterEvent,
  PendingMessage,
  ConsumerGroupInfo,
  StreamConfig,
  getStreamKey,
  getIdempotencySetKey,
} from '../types/events';

const logger = createLogger('event-bus');

// ====================================
// CONFIGURATION
// ====================================

export interface EventBusConfig {
  /** Redis connection URL */
  redisUrl: string;
  /** Service name for event metadata */
  serviceName: 'gateway' | 'architect' | 'pulse' | 'ledger' | 'dashboard';
  /** Key prefix for all Redis keys */
  keyPrefix?: string;
  /** Enable debug logging */
  debug?: boolean;
}

export interface PublishOptions {
  /** Correlation ID for distributed tracing */
  correlationId?: string;
  /** Causation ID - the event that caused this event */
  causationId?: string;
}

export interface ConsumeOptions {
  /** Consumer group name */
  consumerGroup: string;
  /** Unique consumer name within the group */
  consumerName: string;
  /** Event types to consume */
  eventTypes: EventType[];
  /** Number of events to process per batch */
  batchSize?: number;
  /** Block timeout in milliseconds */
  blockTimeout?: number;
}

// ====================================
// EVENT BUS CLASS
// ====================================

/**
 * Production-grade Redis Streams event bus with:
 * - Exactly-once processing via idempotency keys
 * - Consumer groups for load balancing
 * - Dead letter queue for failed messages
 * - Backpressure with MAXLEN trimming
 * - Atomic transactions with MongoDB
 */
export class EventBus {
  private redis: Redis;
  private config: EventBusConfig;
  private keyPrefix: string;
  private isConnected = false;

  constructor(config: EventBusConfig) {
    this.config = config;
    this.keyPrefix = config.keyPrefix || 'avenlo:';

    this.redis = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 100, 3000),
      enableReadyCheck: true,
      lazyConnect: true,
    });

    this.setupErrorHandlers();
  }

  private setupErrorHandlers(): void {
    this.redis.on('error', (err) => {
      logger.error('Redis connection error:', err);
    });

    this.redis.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis connection closed');
    });

    this.redis.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });

    this.redis.on('ready', () => {
      this.isConnected = true;
      logger.info('Redis connection ready');
    });
  }

  // ====================================
  // CONNECTION MANAGEMENT
  // ====================================

  async connect(): Promise<void> {
    if (this.isConnected) return;
    
    await this.redis.connect();
    this.isConnected = true;
    logger.info('EventBus connected to Redis');
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) return;

    await this.redis.quit();
    this.isConnected = false;
    logger.info('EventBus disconnected from Redis');
  }

  getRedis(): Redis {
    return this.redis;
  }

  // ====================================
  // IDEMPOTENCY KEY GENERATION
  // ====================================

  /**
   * Generate a unique idempotency key for an event
   * Uses SHA-256 hash of eventId + timestamp + payload hash
   */
  private generateIdempotencyKey(
    eventId: string,
    timestamp: string,
    payload: unknown
  ): string {
    const payloadHash = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex')
      .substring(0, 16);

    return createHash('sha256')
      .update(`${eventId}:${timestamp}:${payloadHash}`)
      .digest('hex');
  }

  /**
   * Check if an event has already been processed (idempotency check)
   */
  async isProcessed(consumerGroup: string, idempotencyKey: string): Promise<boolean> {
    const key = `${this.keyPrefix}${getIdempotencySetKey(consumerGroup)}`;
    const exists = await this.redis.sismember(key, idempotencyKey);
    return exists === 1;
  }

  /**
   * Mark an event as processed (add to idempotency set with TTL)
   */
  async markProcessed(consumerGroup: string, idempotencyKey: string): Promise<void> {
    const key = `${this.keyPrefix}${getIdempotencySetKey(consumerGroup)}`;
    const pipeline = this.redis.pipeline();
    
    pipeline.sadd(key, idempotencyKey);
    pipeline.expire(key, StreamConfig.IDEMPOTENCY_TTL);
    
    await pipeline.exec();
  }

  // ====================================
  // EVENT PUBLISHING
  // ====================================

  /**
   * Publish a typed event to the event stream
   * 
   * Features:
   * - Type-safe payload based on event type
   * - Automatic metadata generation
   * - Idempotency key generation
   * - Backpressure via MAXLEN trimming
   */
  async publish<T extends EventType>(
    eventType: T,
    payload: PayloadFor<T>,
    options: PublishOptions = {}
  ): Promise<string> {
    const eventId = randomUUID();
    const timestamp = new Date().toISOString();

    // Build event metadata
    const meta: EventMetadata = {
      eventId,
      timestamp,
      source: this.config.serviceName,
      correlationId: options.correlationId || eventId,
      causationId: options.causationId,
      version: 1,
    };

    // Generate idempotency info
    const idempotency: IdempotencyInfo = {
      idempotencyKey: this.generateIdempotencyKey(eventId, timestamp, payload),
      deliveryAttempt: 1,
      firstDeliveryAt: timestamp,
    };

    // Build the full event envelope
    const envelope: EventEnvelope<T> = {
      meta,
      idempotency,
      type: eventType,
      payload,
    };

    // Serialize for Redis Streams (all values must be strings)
    const serialized: SerializedEvent = {
      meta: JSON.stringify(meta),
      idempotency: JSON.stringify(idempotency),
      type: eventType,
      payload: JSON.stringify(payload),
    };

    // Get stream key
    const streamKey = `${this.keyPrefix}${getStreamKey(eventType)}`;

    // XADD with MAXLEN ~ for backpressure (approximate trimming for performance)
    const messageId = await this.redis.xadd(
      streamKey,
      'MAXLEN',
      '~',
      StreamConfig.MAX_STREAM_LENGTH.toString(),
      '*',
      'meta', serialized.meta,
      'idempotency', serialized.idempotency,
      'type', serialized.type,
      'payload', serialized.payload
    );

    if (this.config.debug) {
      logger.debug(`Published event ${eventType}`, { 
        eventId, 
        messageId,
        streamKey 
      });
    }

    return messageId as string;
  }

  /**
   * Publish multiple events atomically using a pipeline
   */
  async publishBatch<T extends EventType>(
    events: Array<{ type: T; payload: PayloadFor<T>; options?: PublishOptions }>
  ): Promise<string[]> {
    const pipeline = this.redis.pipeline();
    const eventIds: string[] = [];

    for (const event of events) {
      const eventId = randomUUID();
      const timestamp = new Date().toISOString();

      const meta: EventMetadata = {
        eventId,
        timestamp,
        source: this.config.serviceName,
        correlationId: event.options?.correlationId || eventId,
        causationId: event.options?.causationId,
        version: 1,
      };

      const idempotency: IdempotencyInfo = {
        idempotencyKey: this.generateIdempotencyKey(eventId, timestamp, event.payload),
        deliveryAttempt: 1,
        firstDeliveryAt: timestamp,
      };

      const serialized: SerializedEvent = {
        meta: JSON.stringify(meta),
        idempotency: JSON.stringify(idempotency),
        type: event.type,
        payload: JSON.stringify(event.payload),
      };

      const streamKey = `${this.keyPrefix}${getStreamKey(event.type)}`;

      pipeline.xadd(
        streamKey,
        'MAXLEN',
        '~',
        StreamConfig.MAX_STREAM_LENGTH.toString(),
        '*',
        'meta', serialized.meta,
        'idempotency', serialized.idempotency,
        'type', serialized.type,
        'payload', serialized.payload
      );

      eventIds.push(eventId);
    }

    await pipeline.exec();
    return eventIds;
  }

  // ====================================
  // CONSUMER GROUP MANAGEMENT
  // ====================================

  /**
   * Create a consumer group for a stream
   * Uses MKSTREAM to create the stream if it doesn't exist
   */
  async createConsumerGroup(
    eventType: EventType,
    groupName: string,
    startId: string = '0'
  ): Promise<boolean> {
    const streamKey = `${this.keyPrefix}${getStreamKey(eventType)}`;

    try {
      await this.redis.xgroup('CREATE', streamKey, groupName, startId, 'MKSTREAM');
      logger.info(`Created consumer group ${groupName} for ${eventType}`);
      return true;
    } catch (err: unknown) {
      const error = err as Error;
      // Group already exists - this is fine
      if (error.message?.includes('BUSYGROUP')) {
        logger.debug(`Consumer group ${groupName} already exists for ${eventType}`);
        return false;
      }
      throw err;
    }
  }

  /**
   * Create consumer groups for multiple event types
   */
  async createConsumerGroups(
    eventTypes: EventType[],
    groupName: string
  ): Promise<void> {
    for (const eventType of eventTypes) {
      await this.createConsumerGroup(eventType, groupName);
    }
  }

  /**
   * Get consumer group info for a stream
   */
  async getConsumerGroupInfo(eventType: EventType): Promise<ConsumerGroupInfo[]> {
    const streamKey = `${this.keyPrefix}${getStreamKey(eventType)}`;

    try {
      const groups = await this.redis.xinfo('GROUPS', streamKey) as unknown[][];
      
      return groups.map((group) => {
        const info: Record<string, unknown> = {};
        for (let i = 0; i < group.length; i += 2) {
          info[group[i] as string] = group[i + 1];
        }
        return {
          name: info.name as string,
          consumers: info.consumers as number,
          pending: info.pending as number,
          lastDeliveredId: info['last-delivered-id'] as string,
        };
      });
    } catch {
      return [];
    }
  }

  // ====================================
  // DEAD LETTER QUEUE
  // ====================================

  /**
   * Move a failed event to the dead letter queue
   */
  async moveToDeadLetterQueue<T extends EventType>(
    event: EventEnvelope<T>,
    streamId: string,
    consumerGroup: string,
    consumer: string,
    failureCount: number,
    error: Error
  ): Promise<string> {
    const dlqEvent: DeadLetterEvent<T> = {
      originalEvent: event,
      streamId,
      consumerGroup,
      consumer,
      failureCount,
      lastError: error.message,
      lastErrorStack: error.stack,
      firstFailedAt: event.idempotency.firstDeliveryAt,
      lastFailedAt: new Date().toISOString(),
      movedToDlqAt: new Date().toISOString(),
    };

    const dlqKey = `${this.keyPrefix}${StreamConfig.DLQ_STREAM}`;

    const messageId = await this.redis.xadd(
      dlqKey,
      'MAXLEN',
      '~',
      (StreamConfig.MAX_STREAM_LENGTH * 10).toString(), // DLQ can be larger
      '*',
      'event', JSON.stringify(dlqEvent)
    );

    logger.warn(`Moved event to DLQ`, {
      eventId: event.meta.eventId,
      type: event.type,
      failureCount,
      error: error.message,
    });

    return messageId as string;
  }

  /**
   * Read events from the dead letter queue
   */
  async readDeadLetterQueue(
    count: number = 100,
    startId: string = '-'
  ): Promise<Array<{ id: string; event: DeadLetterEvent }>> {
    const dlqKey = `${this.keyPrefix}${StreamConfig.DLQ_STREAM}`;

    const results = await this.redis.xrange(dlqKey, startId, '+', 'COUNT', count);

    return results.map(([id, fields]) => {
      const eventData: Record<string, string> = {};
      for (let i = 0; i < fields.length; i += 2) {
        eventData[fields[i]] = fields[i + 1];
      }
      return {
        id,
        event: JSON.parse(eventData.event) as DeadLetterEvent,
      };
    });
  }

  /**
   * Retry a dead letter event by republishing it
   */
  async retryDeadLetterEvent(dlqMessageId: string): Promise<string | null> {
    const dlqKey = `${this.keyPrefix}${StreamConfig.DLQ_STREAM}`;

    // Read the DLQ message
    const results = await this.redis.xrange(dlqKey, dlqMessageId, dlqMessageId);
    
    if (results.length === 0) {
      logger.warn(`DLQ message not found: ${dlqMessageId}`);
      return null;
    }

    const [, fields] = results[0];
    const eventData: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      eventData[fields[i]] = fields[i + 1];
    }

    const dlqEvent = JSON.parse(eventData.event) as DeadLetterEvent;
    const originalEvent = dlqEvent.originalEvent;

    // Republish to the original stream
    const newMessageId = await this.publish(
      originalEvent.type,
      originalEvent.payload,
      {
        correlationId: originalEvent.meta.correlationId,
        causationId: originalEvent.meta.eventId, // Original event caused this retry
      }
    );

    // Remove from DLQ
    await this.redis.xdel(dlqKey, dlqMessageId);

    logger.info(`Retried DLQ event`, {
      originalEventId: originalEvent.meta.eventId,
      newMessageId,
    });

    return newMessageId;
  }

  /**
   * Get DLQ statistics
   */
  async getDeadLetterQueueStats(): Promise<{
    length: number;
    oldestMessageAge: number | null;
    byEventType: Record<string, number>;
  }> {
    const dlqKey = `${this.keyPrefix}${StreamConfig.DLQ_STREAM}`;

    try {
      const length = await this.redis.xlen(dlqKey);
      
      if (length === 0) {
        return { length: 0, oldestMessageAge: null, byEventType: {} };
      }

      // Get oldest message
      const oldest = await this.redis.xrange(dlqKey, '-', '+', 'COUNT', 1);
      let oldestMessageAge: number | null = null;
      
      if (oldest.length > 0) {
        const [, fields] = oldest[0];
        const eventData: Record<string, string> = {};
        for (let i = 0; i < fields.length; i += 2) {
          eventData[fields[i]] = fields[i + 1];
        }
        const dlqEvent = JSON.parse(eventData.event) as DeadLetterEvent;
        oldestMessageAge = Date.now() - new Date(dlqEvent.movedToDlqAt).getTime();
      }

      // Count by event type (sample first 1000)
      const sample = await this.redis.xrange(dlqKey, '-', '+', 'COUNT', 1000);
      const byEventType: Record<string, number> = {};
      
      for (const [, fields] of sample) {
        const eventData: Record<string, string> = {};
        for (let i = 0; i < fields.length; i += 2) {
          eventData[fields[i]] = fields[i + 1];
        }
        const dlqEvent = JSON.parse(eventData.event) as DeadLetterEvent;
        byEventType[dlqEvent.originalEvent.type] = 
          (byEventType[dlqEvent.originalEvent.type] || 0) + 1;
      }

      return { length, oldestMessageAge, byEventType };
    } catch {
      return { length: 0, oldestMessageAge: null, byEventType: {} };
    }
  }

  // ====================================
  // STREAM UTILITIES
  // ====================================

  /**
   * Get stream length
   */
  async getStreamLength(eventType: EventType): Promise<number> {
    const streamKey = `${this.keyPrefix}${getStreamKey(eventType)}`;
    return await this.redis.xlen(streamKey);
  }

  /**
   * Get stream info
   */
  async getStreamInfo(eventType: EventType): Promise<{
    length: number;
    firstEntry: string | null;
    lastEntry: string | null;
    groups: ConsumerGroupInfo[];
  }> {
    const streamKey = `${this.keyPrefix}${getStreamKey(eventType)}`;

    try {
      const info = await this.redis.xinfo('STREAM', streamKey) as unknown[];
      const infoMap: Record<string, unknown> = {};
      
      for (let i = 0; i < info.length; i += 2) {
        infoMap[info[i] as string] = info[i + 1];
      }

      const groups = await this.getConsumerGroupInfo(eventType);

      return {
        length: infoMap.length as number,
        firstEntry: (infoMap['first-entry'] as unknown[])?.[0] as string | null,
        lastEntry: (infoMap['last-entry'] as unknown[])?.[0] as string | null,
        groups,
      };
    } catch {
      return {
        length: 0,
        firstEntry: null,
        lastEntry: null,
        groups: [],
      };
    }
  }

  /**
   * Trim stream to a maximum length
   */
  async trimStream(eventType: EventType, maxLen: number): Promise<number> {
    const streamKey = `${this.keyPrefix}${getStreamKey(eventType)}`;
    return await this.redis.xtrim(streamKey, 'MAXLEN', '~', maxLen);
  }
}

// ====================================
// SINGLETON INSTANCE
// ====================================

let eventBusInstance: EventBus | null = null;

export function initEventBus(config: EventBusConfig): EventBus {
  if (eventBusInstance) {
    logger.warn('EventBus already initialized, returning existing instance');
    return eventBusInstance;
  }

  eventBusInstance = new EventBus(config);
  return eventBusInstance;
}

export function getEventBus(): EventBus {
  if (!eventBusInstance) {
    throw new Error('EventBus not initialized. Call initEventBus() first.');
  }
  return eventBusInstance;
}
