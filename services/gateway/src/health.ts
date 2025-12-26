// ====================================
// AVENLO CORE - HEALTH CHECK SERVER
// ====================================

import express from 'express';
import { getRedisClient, getMongoClient, createLogger } from '@avenlo/shared';

const logger = createLogger('gateway-health');

export function startHealthServer(port: number): void {
  const app = express();

  // Health check endpoint
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
      await redis.getClient().ping();
      health.checks.redis = true;
    } catch (error) {
      logger.warn('Redis health check failed:', error);
    }

    try {
      // Check MongoDB
      const mongo = getMongoClient();
      health.checks.mongodb = mongo.isConnected();
    } catch (error) {
      logger.warn('MongoDB health check failed:', error);
    }

    // Determine overall status
    const allHealthy = Object.values(health.checks).every(Boolean);
    health.status = allHealthy ? 'ok' : 'degraded';

    const statusCode = allHealthy ? 200 : 503;
    res.status(statusCode).json(health);
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
