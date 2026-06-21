// ====================================
// AVENLO CORE - LEDGER HEALTH SERVER
// Event-Sourced System Monitoring
// ====================================

import express from 'express';
import { createLogger, getMongoClient, getEventBus, ConsumerStats } from '@avenlo/shared';
import { githubWebhookRouter } from './webhooks/github';

const logger = createLogger('ledger-server');

export interface HealthServerOptions {
  getConsumerStats?: () => ConsumerStats;
  getDlqStats?: () => Promise<{
    length: number;
    oldestMessageAge: number | null;
    byEventType: Record<string, number>;
  }>;
}

export function startHealthServer(port: number, options?: HealthServerOptions): void {
  const app = express();
  app.use(express.json());

  // Webhook routes
  app.use('/api/webhooks', githubWebhookRouter);

  // Detailed health check with event bus stats
  app.get('/health', async (req, res) => {
    const health: Record<string, unknown> = {
      status: 'ok',
      service: 'ledger',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      eventBus: {
        connected: false,
      },
      mongodb: {
        connected: false,
      },
    };

    try {
      // Check Event Bus (Redis Streams)
      const eventBus = getEventBus();
      const redis = eventBus.getRedis();
      await redis.ping();
      health.eventBus = { connected: true };
      
      // Check MongoDB
      const mongo = getMongoClient();
      health.mongodb = { connected: mongo.isConnected() };

      if (!mongo.isConnected()) {
        health.status = 'degraded';
      }

      // Add consumer stats if available
      if (options?.getConsumerStats) {
        const stats = options.getConsumerStats();
        health.consumer = {
          processed: stats.processed,
          failed: stats.failed,
          retried: stats.retried,
          deadLettered: stats.deadLettered,
          eventsPerSecond: Math.round(stats.eventsPerSecond * 100) / 100,
          uptime: stats.uptime,
          lastProcessedAt: stats.lastProcessedAt,
        };
      }

      // Add DLQ stats if available
      if (options?.getDlqStats) {
        const dlqStats = await options.getDlqStats();
        health.deadLetterQueue = {
          length: dlqStats.length,
          oldestMessageAgeMs: dlqStats.oldestMessageAge,
          byEventType: dlqStats.byEventType,
        };

        // Alert if DLQ has items
        if (dlqStats.length > 0) {
          health.status = health.status === 'ok' ? 'warning' : health.status;
          health.alerts = health.alerts || [];
          (health.alerts as string[]).push(`DLQ has ${dlqStats.length} unprocessed events`);
        }
      }

    } catch (error) {
      health.status = 'degraded';
      health.error = (error as Error).message;
    }

    const statusCode = health.status === 'ok' ? 200 : health.status === 'warning' ? 200 : 503;
    res.status(statusCode).json(health);
  });

  // Consumer metrics endpoint (for Prometheus/Grafana)
  app.get('/metrics', async (req, res) => {
    const lines: string[] = [];
    
    // Basic metrics
    lines.push(`# HELP ledger_uptime_seconds Service uptime in seconds`);
    lines.push(`# TYPE ledger_uptime_seconds gauge`);
    lines.push(`ledger_uptime_seconds ${Math.floor(process.uptime())}`);

    if (options?.getConsumerStats) {
      const stats = options.getConsumerStats();
      
      lines.push(`# HELP ledger_events_processed_total Total events processed`);
      lines.push(`# TYPE ledger_events_processed_total counter`);
      lines.push(`ledger_events_processed_total ${stats.processed}`);

      lines.push(`# HELP ledger_events_failed_total Total events failed`);
      lines.push(`# TYPE ledger_events_failed_total counter`);
      lines.push(`ledger_events_failed_total ${stats.failed}`);

      lines.push(`# HELP ledger_events_retried_total Total events retried`);
      lines.push(`# TYPE ledger_events_retried_total counter`);
      lines.push(`ledger_events_retried_total ${stats.retried}`);

      lines.push(`# HELP ledger_events_dlq_total Total events sent to DLQ`);
      lines.push(`# TYPE ledger_events_dlq_total counter`);
      lines.push(`ledger_events_dlq_total ${stats.deadLettered}`);

      lines.push(`# HELP ledger_events_per_second Current throughput`);
      lines.push(`# TYPE ledger_events_per_second gauge`);
      lines.push(`ledger_events_per_second ${stats.eventsPerSecond.toFixed(2)}`);
    }

    if (options?.getDlqStats) {
      const dlqStats = await options.getDlqStats();
      
      lines.push(`# HELP ledger_dlq_length Current DLQ length`);
      lines.push(`# TYPE ledger_dlq_length gauge`);
      lines.push(`ledger_dlq_length ${dlqStats.length}`);
    }

    res.set('Content-Type', 'text/plain');
    res.send(lines.join('\n'));
  });

  // DLQ management endpoints
  app.get('/dlq', async (req, res) => {
    try {
      const eventBus = getEventBus();
      const events = await eventBus.readDeadLetterQueue(100);
      
      res.json({
        count: events.length,
        events: events.map(e => ({
          id: e.id,
          eventType: e.event.originalEvent.type,
          eventId: e.event.originalEvent.meta.eventId,
          failureCount: e.event.failureCount,
          lastError: e.event.lastError,
          movedToDlqAt: e.event.movedToDlqAt,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Retry a DLQ event
  app.post('/dlq/:messageId/retry', async (req, res) => {
    try {
      const eventBus = getEventBus();
      const newMessageId = await eventBus.retryDeadLetterEvent(req.params.messageId);
      
      if (newMessageId) {
        res.json({ success: true, newMessageId });
      } else {
        res.status(404).json({ error: 'Message not found in DLQ' });
      }
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Ready probe
  app.get('/ready', async (req, res) => {
    try {
      const eventBus = getEventBus();
      await eventBus.getRedis().ping();
      res.status(200).json({ ready: true });
    } catch (error) {
      res.status(503).json({ ready: false });
    }
  });

  // Liveness probe
  app.get('/live', (req, res) => {
    res.status(200).json({ alive: true });
  });

  app.listen(port, '0.0.0.0', () => {
    logger.info(`Ledger health server listening on port ${port}`);
    logger.info(`  - /health   : Detailed health check with consumer stats`);
    logger.info(`  - /metrics  : Prometheus-compatible metrics`);
    logger.info(`  - /dlq      : View dead letter queue`);
    logger.info(`  - /dlq/:id/retry : Retry a DLQ event`);
  });
}
