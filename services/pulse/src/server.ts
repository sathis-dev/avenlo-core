// ====================================
// AVENLO CORE - PULSE WEBHOOK SERVER
// ====================================

import express from 'express';
import crypto from 'crypto';
import { createLogger, getRedisClient, getMongoClient } from '@avenlo/shared';
import { PulseService } from './service';

const logger = createLogger('pulse-server');

export function startWebhookServer(port: number, pulseService: PulseService): void {
  const app = express();

  // Raw body for signature verification
  app.use('/webhook/github', express.raw({ type: 'application/json' }));
  app.use(express.json());

  // Health check
  app.get('/health', async (req, res) => {
    const health = {
      status: 'ok',
      service: 'pulse',
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

  // GitHub Webhook Endpoint
  app.post('/webhook/github', async (req, res) => {
    try {
      const signature = req.headers['x-hub-signature-256'] as string;
      const event = req.headers['x-github-event'] as string;
      const deliveryId = req.headers['x-github-delivery'] as string;

      // Verify signature
      if (process.env.GITHUB_WEBHOOK_SECRET) {
        const body = req.body as Buffer;
        const expectedSignature = 'sha256=' + crypto
          .createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET)
          .update(body)
          .digest('hex');

        if (!crypto.timingSafeEqual(
          Buffer.from(signature || ''),
          Buffer.from(expectedSignature)
        )) {
          logger.warn(`Invalid webhook signature for delivery ${deliveryId}`);
          return res.status(401).json({ error: 'Invalid signature' });
        }
      }

      const payload = JSON.parse(req.body.toString());

      logger.info(`Received GitHub webhook: ${event} (${deliveryId})`);

      // Handle different event types
      switch (event) {
        case 'push':
          await pulseService.handlePush(payload);
          break;

        case 'pull_request':
          await pulseService.handlePullRequest(payload);
          break;

        case 'workflow_run':
          await pulseService.handleWorkflowRun(payload);
          break;

        case 'ping':
          logger.info('GitHub webhook ping received');
          break;

        default:
          logger.debug(`Unhandled GitHub event: ${event}`);
      }

      res.status(200).json({ received: true, event, deliveryId });
    } catch (error) {
      logger.error('Webhook processing error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GitLab Webhook Endpoint (optional)
  app.post('/webhook/gitlab', async (req, res) => {
    try {
      const token = req.headers['x-gitlab-token'] as string;
      const event = req.headers['x-gitlab-event'] as string;

      // Verify token
      if (process.env.GITLAB_WEBHOOK_SECRET && token !== process.env.GITLAB_WEBHOOK_SECRET) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      logger.info(`Received GitLab webhook: ${event}`);

      // Convert GitLab payload to GitHub-compatible format and process
      // Implementation would depend on specific GitLab events needed

      res.status(200).json({ received: true, event });
    } catch (error) {
      logger.error('GitLab webhook processing error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.listen(port, '0.0.0.0', () => {
    logger.info(`Pulse webhook server listening on port ${port}`);
  });
}
