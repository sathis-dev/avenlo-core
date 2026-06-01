// ====================================
// AVENLO CORE - LIVE BUS
// Cross-service event broadcast for the dashboard's real-time widgets.
// Publishes to Redis; dashboard server subscribes and pushes to Socket.IO.
// ====================================

import { createLogger, type RedisClient } from '@avenlo/shared';

const logger = createLogger('live-bus');

const LIVE_BUS_CHANNEL = 'avenlo:live-bus';

export interface LiveBusEvent {
  type:
    | 'member:join'
    | 'member:leave'
    | 'member:verified'
    | 'member:quarantined'
    | 'mod:action'
    | 'ticket:opened';
  guildId: string;
  at: string;
  [key: string]: unknown;
}

class LiveBus {
  private redis: RedisClient | null = null;
  private buffer: LiveBusEvent[] = [];
  private maxBuffer = 200;

  setRedis(client: RedisClient): void {
    this.redis = client;
  }

  /** Fire-and-forget broadcast. Also keeps a short in-memory ring so dashboards opened a few seconds late still see recent activity. */
  broadcast(event: LiveBusEvent): void {
    this.buffer.push(event);
    if (this.buffer.length > this.maxBuffer) {
      this.buffer.splice(0, this.buffer.length - this.maxBuffer);
    }
    if (!this.redis) return;
    this.redis
      .rawPublish(LIVE_BUS_CHANNEL, JSON.stringify(event))
      .catch((err: unknown) => logger.debug('Live bus publish failed', err));
  }

  /** Last N buffered events (best-effort, in-memory only). */
  recent(limit = 50): LiveBusEvent[] {
    return this.buffer.slice(-limit).reverse();
  }
}

export const liveBus = new LiveBus();
export const LIVE_BUS_REDIS_CHANNEL = LIVE_BUS_CHANNEL;
