// ====================================
// AVENLO CORE - ARCHITECT WEBHOOK SERVER
// ====================================

import express from 'express';
import { createLogger, getRedisClient, getMongoClient } from '@avenlo/shared';

const logger = createLogger('architect-server');

export function startWebhookServer(port: number): void {
  const app = express();
  app.use(express.json());

  // Health check
  app.get('/health', async (req, res) => {
    const health = {
      status: 'ok',
      service: 'architect',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };

    try {
      const redis = getRedisClient();
      await redis.getClient().ping();
      
      const mongo = getMongoClient();
      if (!mongo.isConnected()) {
        health.status = 'degraded';
      }
    } catch (error) {
      health.status = 'degraded';
    }

    res.status(health.status === 'ok' ? 200 : 503).json(health);
  });

  // Ready probe
  app.get('/ready', async (req, res) => {
    try {
      const redis = getRedisClient();
      await redis.getClient().ping();
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
    logger.info(`Architect server listening on port ${port}`);
  });
}
