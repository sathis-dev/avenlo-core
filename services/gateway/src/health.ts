// ====================================
// AVENLO CORE - HEALTH CHECK SERVER
// ====================================

import express from 'express';
import { getRedisClient, getMongoClient, createLogger } from '@avenlo/shared';

const logger = createLogger('gateway-health');

export function startHealthServer(port: number): void {
  const app = express();

  // Health check endpoint - always returns 200 to keep container alive
  // Dependencies may still be connecting but that's okay
  app.get('/health', async (req, res) => {
    const health = {
      status: 'ok',
      service: 'gateway',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        redis: false,
        mongodb: false,
      },
    };

    try {
      // Check Redis
      const redis = getRedisClient();
      if (redis) {
        const client = redis.getClient();
        if (client.status === 'ready') {
          await client.ping();
          health.checks.redis = true;
        }
      }
    } catch (error) {
      // Silent - Redis might still be connecting
    }

    try {
      // Check MongoDB
      const mongo = getMongoClient();
      if (mongo) {
        health.checks.mongodb = mongo.isConnected();
      }
    } catch (error) {
      // Silent - MongoDB might still be connecting
    }

    // Mark as degraded if dependencies aren't ready, but still return 200
    const allHealthy = Object.values(health.checks).every(Boolean);
    health.status = allHealthy ? 'ok' : 'starting';

    // Always return 200 - container is alive
    res.status(200).json(health);
  });

  // Readiness probe
  app.get('/ready', async (req, res) => {
    try {
      const redis = getRedisClient();
      await redis.getClient().ping();
      
      const mongo = getMongoClient();
      if (!mongo.isConnected()) {
        throw new Error('MongoDB not connected');
      }

      res.status(200).json({ ready: true });
    } catch (error) {
      res.status(503).json({ ready: false, error: (error as Error).message });
    }
  });

  // Liveness probe
  app.get('/live', (req, res) => {
    res.status(200).json({ alive: true });
  });

  app.listen(port, '0.0.0.0', () => {
    logger.info(`Health server listening on port ${port}`);
  });
}
