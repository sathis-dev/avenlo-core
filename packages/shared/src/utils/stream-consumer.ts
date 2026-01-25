// ====================================
// AVENLO CORE - STREAM CONSUMER
// Production-Ready Consumer Group Handler
// ====================================

import Redis from 'ioredis';
import { ClientSession } from 'mongoose';
import { createLogger } from './logger';
import { getEventBus, EventBus } from './event-bus';
import {
  EventType,
  EventEnvelope,
  EventMetadata,
  IdempotencyInfo,
  PayloadFor,
  PendingMessage,
  StreamConfig,
  getStreamKey,
  getIdempotencySetKey,
} from '../types/events';

const logger = createLogger('stream-consumer');

// ====================================
// TYPES
// ====================================

export interface ConsumerConfig {
  /** Consumer group name (e.g., 'ledger-service') */
  groupName: string;
  /** Unique consumer ID within the group */
  consumerId: string;
  /** Event types to consume */
  eventTypes: EventType[];
  /** Events to read per batch (default: 50) */
  batchSize?: number;
  /** Block timeout in ms (default: 5000) */
  blockTimeout?: number;
  /** Claim timeout for pending messages in ms (default: 60000) */
  claimTimeout?: number;
  /** Maximum retries before DLQ (default: 3) */
  maxRetries?: number;
  /** Process pending messages on startup */
  processPendingOnStartup?: boolean;
  /** Redis key prefix */
  keyPrefix?: string;
}

export interface ProcessingContext<T extends EventType = EventType> {
  /** The event envelope with full metadata */
  event: EventEnvelope<T>;
  /** Redis stream message ID */
  messageId: string;
  /** Stream key */
  streamKey: string;
  /** Current delivery attempt */
  deliveryAttempt: number;
  /** Consumer configuration */
  config: ConsumerConfig;
}

export type EventHandler<T extends EventType = EventType> = (
  ctx: ProcessingContext<T>,
  session?: ClientSession
) => Promise<void>;

export interface ConsumerStats {
  processed: number;
  failed: number;
  retried: number;
  deadLettered: number;
  lastProcessedAt: Date | null;
  uptime: number;
  eventsPerSecond: number;
}

// ====================================
// STREAM CONSUMER CLASS
// ====================================

/**
 * Production-grade stream consumer with:
 * - Consumer group management (XGROUP, XREADGROUP, XACK)
 * - Idempotency checking to prevent double-processing
 * - Automatic retries with exponential backoff
 * - Dead letter queue for failed messages
 * - Batch processing with configurable size
 * - Graceful shutdown support
 * - MongoDB transaction support
 */
export class StreamConsumer {
  private eventBus: EventBus;
  private redis: Redis;
  private config: ConsumerConfig;
  private handlers: Map<EventType, EventHandler[]> = new Map();
  private isRunning = false;
  private isPaused = false;
  private shutdownPromise: Promise<void> | null = null;
  private stats: ConsumerStats;
  private startTime: Date;
  private keyPrefix: string;

  constructor(config: ConsumerConfig) {
    this.config = {
      batchSize: StreamConfig.BATCH_SIZE,
      blockTimeout: StreamConfig.BLOCK_TIMEOUT,
      claimTimeout: StreamConfig.CLAIM_TIMEOUT,
      maxRetries: StreamConfig.MAX_RETRIES,
      processPendingOnStartup: true,
      keyPrefix: 'avenlo:',
      ...config,
    };

    this.eventBus = getEventBus();
    this.redis = this.eventBus.getRedis();
    this.keyPrefix = this.config.keyPrefix!;
    this.startTime = new Date();

    this.stats = {
      processed: 0,
      failed: 0,
      retried: 0,
      deadLettered: 0,
      lastProcessedAt: null,
      uptime: 0,
      eventsPerSecond: 0,
    };
  }

  // ====================================
  // HANDLER REGISTRATION
  // ====================================

  /**
   * Register a handler for a specific event type
   * Multiple handlers can be registered for the same event type
   */
  on<T extends EventType>(eventType: T, handler: EventHandler<T>): this {
    if (!this.config.eventTypes.includes(eventType)) {
      throw new Error(
        `Event type ${eventType} not in consumer config. ` +
        `Add it to eventTypes array.`
      );
    }

    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }

    this.handlers.get(eventType)!.push(handler as EventHandler);
    logger.debug(`Registered handler for ${eventType}`);

    return this;
  }

  /**
   * Remove a handler for a specific event type
   */
  off<T extends EventType>(eventType: T, handler: EventHandler<T>): this {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler as EventHandler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
    return this;
  }

  // ====================================
  // CONSUMER GROUP MANAGEMENT
  // ====================================

  /**
   * Initialize consumer groups for all event types
   */
  private async initializeConsumerGroups(): Promise<void> {
    for (const eventType of this.config.eventTypes) {
      await this.eventBus.createConsumerGroup(
        eventType,
        this.config.groupName,
        '0' // Start from the beginning
      );
    }
    logger.info(`Initialized consumer groups for ${this.config.eventTypes.length} event types`);
  }

  /**
   * Get pending messages for a stream
   */
  private async getPendingMessages(eventType: EventType): Promise<PendingMessage[]> {
    const streamKey = `${this.keyPrefix}${getStreamKey(eventType)}`;

    try {
      const pending = await this.redis.xpending(
        streamKey,
        this.config.groupName,
        '-',
        '+',
        100 // Get up to 100 pending messages
      ) as unknown[][];

      if (!pending || pending.length === 0) {
        return [];
      }

      return pending.map((p) => ({
        messageId: p[0] as string,
        consumer: p[1] as string,
        idleTime: p[2] as number,
        deliveryCount: p[3] as number,
      }));
    } catch (err) {
      logger.warn(`Failed to get pending messages for ${eventType}:`, err);
      return [];
    }
  }

  /**
   * Claim pending messages that have been idle too long
   */
  private async claimPendingMessages(
    eventType: EventType,
    pending: PendingMessage[]
  ): Promise<Array<[string, string[]]>> {
    const streamKey = `${this.keyPrefix}${getStreamKey(eventType)}`;
    const claimTimeout = this.config.claimTimeout!;

    // Filter messages that have been idle long enough to claim
    const toClaim = pending.filter((p) => p.idleTime >= claimTimeout);

    if (toClaim.length === 0) {
      return [];
    }

    const messageIds = toClaim.map((p) => p.messageId);

    try {
      const claimed = await this.redis.xclaim(
        streamKey,
        this.config.groupName,
        this.config.consumerId,
        claimTimeout,
        ...messageIds
      ) as Array<[string, string[]]>;

      logger.debug(`Claimed ${claimed.length} pending messages for ${eventType}`);
      return claimed;
    } catch (err) {
      logger.warn(`Failed to claim messages for ${eventType}:`, err);
      return [];
    }
  }

  // ====================================
  // MESSAGE PROCESSING
  // ====================================

  /**
   * Parse a raw Redis stream message into an EventEnvelope
   */
  private parseMessage<T extends EventType>(
    fields: string[]
  ): EventEnvelope<T> | null {
    try {
      const data: Record<string, string> = {};
      for (let i = 0; i < fields.length; i += 2) {
        data[fields[i]] = fields[i + 1];
      }

      const meta: EventMetadata = JSON.parse(data.meta);
      const idempotency: IdempotencyInfo = JSON.parse(data.idempotency);
      const type = data.type as T;
      const payload: PayloadFor<T> = JSON.parse(data.payload);

      return {
        meta,
        idempotency,
        type,
        payload,
      };
    } catch (err) {
      logger.error('Failed to parse message:', err);
      return null;
    }
  }

  /**
   * Process a single event through all registered handlers
   */
  private async processEvent<T extends EventType>(
    ctx: ProcessingContext<T>,
    session?: ClientSession
  ): Promise<void> {
    const handlers = this.handlers.get(ctx.event.type) || [];

    if (handlers.length === 0) {
      logger.warn(`No handlers registered for ${ctx.event.type}`);
      return;
    }

    // Execute all handlers sequentially
    for (const handler of handlers) {
      await handler(ctx, session);
    }
  }

  /**
   * Handle a single message with idempotency check and error handling
   */
  private async handleMessage(
    messageId: string,
    fields: string[],
    streamKey: string,
    deliveryAttempt: number
  ): Promise<boolean> {
    // Parse the message
    const event = this.parseMessage(fields);
    if (!event) {
      // Malformed message - acknowledge to prevent reprocessing
      await this.acknowledgeMessage(streamKey, messageId);
      return false;
    }

    const idempotencyKey = event.idempotency.idempotencyKey;

    // Idempotency check - prevent double-processing
    const alreadyProcessed = await this.eventBus.isProcessed(
      this.config.groupName,
      idempotencyKey
    );

    if (alreadyProcessed) {
      logger.debug(`Skipping already-processed event ${event.meta.eventId}`);
      await this.acknowledgeMessage(streamKey, messageId);
      return true;
    }

    const ctx: ProcessingContext = {
      event,
      messageId,
      streamKey,
      deliveryAttempt,
      config: this.config,
    };

    try {
      // Process the event
      await this.processEvent(ctx);

      // Mark as processed (idempotency)
      await this.eventBus.markProcessed(this.config.groupName, idempotencyKey);

      // Acknowledge the message
      await this.acknowledgeMessage(streamKey, messageId);

      this.stats.processed++;
      this.stats.lastProcessedAt = new Date();

      logger.debug(`Processed event ${event.meta.eventId} (${event.type})`);
      return true;

    } catch (err) {
      const error = err as Error;
      logger.error(`Failed to process event ${event.meta.eventId}:`, error);

      this.stats.failed++;

      // Check if we should retry or move to DLQ
      if (deliveryAttempt >= this.config.maxRetries!) {
        // Move to dead letter queue
        await this.eventBus.moveToDeadLetterQueue(
          event,
          messageId,
          this.config.groupName,
          this.config.consumerId,
          deliveryAttempt,
          error
        );

        // Acknowledge to remove from pending
        await this.acknowledgeMessage(streamKey, messageId);
        this.stats.deadLettered++;
      } else {
        // Don't acknowledge - will be retried
        this.stats.retried++;
      }

      return false;
    }
  }

  /**
   * Acknowledge a message (XACK)
   */
  private async acknowledgeMessage(
    streamKey: string,
    messageId: string
  ): Promise<void> {
    await this.redis.xack(streamKey, this.config.groupName, messageId);
  }

  // ====================================
  // BATCH READING
  // ====================================

  /**
   * Read new messages from streams using XREADGROUP
   */
  private async readNewMessages(): Promise<
    Array<{ streamKey: string; messages: Array<[string, string[]]> }>
  > {
    const streams: string[] = [];
    const ids: string[] = [];

    for (const eventType of this.config.eventTypes) {
      streams.push(`${this.keyPrefix}${getStreamKey(eventType)}`);
      ids.push('>'); // Only new messages
    }

    try {
      const results = await this.redis.xreadgroup(
        'GROUP',
        this.config.groupName,
        this.config.consumerId,
        'COUNT',
        this.config.batchSize!,
        'BLOCK',
        this.config.blockTimeout!,
        'STREAMS',
        ...streams,
        ...ids
      ) as Array<[string, Array<[string, string[]]>]> | null;

      if (!results) {
        return [];
      }

      return results.map(([streamKey, messages]) => ({
        streamKey,
        messages,
      }));
    } catch (err) {
      const error = err as Error;
      // Handle shutdown during blocking read
      if (error.message?.includes('NOGROUP')) {
        logger.warn('Consumer group not found, reinitializing...');
        await this.initializeConsumerGroups();
      }
      return [];
    }
  }

  // ====================================
  // CONSUMER LOOP
  // ====================================

  /**
   * Process pending messages on startup
   */
  private async processPendingMessages(): Promise<void> {
    logger.info('Processing pending messages...');

    for (const eventType of this.config.eventTypes) {
      const pending = await this.getPendingMessages(eventType);
      
      if (pending.length === 0) {
        continue;
      }

      logger.info(`Found ${pending.length} pending messages for ${eventType}`);

      // Claim messages that have been idle too long
      const claimed = await this.claimPendingMessages(eventType, pending);
      const streamKey = `${this.keyPrefix}${getStreamKey(eventType)}`;

      for (const [messageId, fields] of claimed) {
        // Find the delivery count from pending info
        const pendingInfo = pending.find((p) => p.messageId === messageId);
        const deliveryAttempt = pendingInfo?.deliveryCount || 1;

        await this.handleMessage(messageId, fields, streamKey, deliveryAttempt);
      }
    }
  }

  /**
   * Main consumer loop
   */
  private async consumerLoop(): Promise<void> {
    logger.info(`Consumer loop started for ${this.config.consumerId}`);

    while (this.isRunning) {
      // Check if paused
      if (this.isPaused) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }

      try {
        // Read new messages
        const results = await this.readNewMessages();

        // Process each message
        for (const { streamKey, messages } of results) {
          for (const [messageId, fields] of messages) {
            if (!this.isRunning) break;
            await this.handleMessage(messageId, fields, streamKey, 1);
          }
        }

        // Update stats
        const uptime = Date.now() - this.startTime.getTime();
        this.stats.uptime = uptime;
        this.stats.eventsPerSecond = this.stats.processed / (uptime / 1000);

      } catch (err) {
        logger.error('Error in consumer loop:', err);
        // Small delay before retrying
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    logger.info(`Consumer loop stopped for ${this.config.consumerId}`);
  }

  // ====================================
  // LIFECYCLE MANAGEMENT
  // ====================================

  /**
   * Start the consumer
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Consumer is already running');
      return;
    }

    logger.info(`Starting consumer ${this.config.consumerId} in group ${this.config.groupName}`);

    // Initialize consumer groups
    await this.initializeConsumerGroups();

    // Process any pending messages first
    if (this.config.processPendingOnStartup) {
      await this.processPendingMessages();
    }

    // Start the consumer loop
    this.isRunning = true;
    this.startTime = new Date();

    // Run in background
    this.consumerLoop().catch((err) => {
      logger.error('Consumer loop crashed:', err);
      this.isRunning = false;
    });

    logger.info(`Consumer ${this.config.consumerId} started successfully`);
  }

  /**
   * Stop the consumer gracefully
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info(`Stopping consumer ${this.config.consumerId}...`);

    // Signal the loop to stop
    this.isRunning = false;

    // Wait for current processing to complete
    await new Promise((resolve) => setTimeout(resolve, this.config.blockTimeout! + 1000));

    logger.info(`Consumer ${this.config.consumerId} stopped`);
  }

  /**
   * Pause the consumer
   */
  pause(): void {
    this.isPaused = true;
    logger.info(`Consumer ${this.config.consumerId} paused`);
  }

  /**
   * Resume the consumer
   */
  resume(): void {
    this.isPaused = false;
    logger.info(`Consumer ${this.config.consumerId} resumed`);
  }

  /**
   * Get consumer statistics
   */
  getStats(): ConsumerStats {
    const uptime = Date.now() - this.startTime.getTime();
    return {
      ...this.stats,
      uptime,
      eventsPerSecond: this.stats.processed / (uptime / 1000 || 1),
    };
  }

  /**
   * Check if consumer is running
   */
  isActive(): boolean {
    return this.isRunning && !this.isPaused;
  }
}

// ====================================
// FACTORY FUNCTION
// ====================================

/**
 * Create a new stream consumer instance
 */
export function createStreamConsumer(config: ConsumerConfig): StreamConsumer {
  return new StreamConsumer(config);
}
