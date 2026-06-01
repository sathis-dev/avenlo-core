// ====================================
// AVENLO CORE - HEALTH + INTERNAL API SERVER
// Exposes /health and the dashboard-facing Discord discovery endpoints
// (channels, roles) used by the WelcomeConfig page.
// ====================================

import express from 'express';
import {
  getRedisClient,
  getMongoClient,
  createLogger,
} from '@avenlo/shared';
import type { Client } from 'discord.js';
import { listTextChannels, listAssignableRoles } from './handlers/ChannelResolver';
import { liveBus, LIVE_BUS_REDIS_CHANNEL } from './handlers/LiveBus';
import { handleMemberJoin } from './handlers/WelcomeHandler';
import { publishRulesToGuild } from './handlers/RulesHandler';
import { RuleAcceptance } from '@avenlo/shared';

const logger = createLogger('gateway-health');

let attachedClient: Client | null = null;

/**
 * Allow the bootstrap code to expose the Discord client to the HTTP layer
 * so the dashboard can read live channel / role data.
 */
export function attachGatewayClient(client: Client): void {
  attachedClient = client;
}

export function startHealthServer(port: number): void {
  const app = express();

  // Health check endpoint - always returns 200 to keep container alive
  // Dependencies may still be connecting but that's okay
  app.get('/health', async (_req, res) => {
    const health = {
      status: 'ok',
      service: 'gateway',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        redis: false,
        mongodb: false,
        discord: Boolean(attachedClient?.isReady()),
      },
    };

    try {
      const redis = getRedisClient();
      if (redis) {
        const client = redis.getClient();
        if (client.status === 'ready') {
          await client.ping();
          health.checks.redis = true;
        }
      }
    } catch {
      // Silent - Redis might still be connecting
    }

    try {
      const mongo = getMongoClient();
      if (mongo) {
        health.checks.mongodb = mongo.isConnected();
      }
    } catch {
      // Silent - MongoDB might still be connecting
    }

    const allHealthy = Object.values(health.checks).every(Boolean);
    health.status = allHealthy ? 'ok' : 'starting';
    res.status(200).json(health);
  });

  app.get('/ready', async (_req, res) => {
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

  app.get('/live', (_req, res) => {
    res.status(200).json({ alive: true });
  });

  // =====================================================
  // INTERNAL API: Discord discovery for dashboard widgets
  // =====================================================

  app.get('/api/discord/guilds', (_req, res) => {
    const client = attachedClient;
    if (!client?.isReady()) {
      return res.status(503).json({ error: 'Discord client not ready' });
    }
    const guilds = client.guilds.cache.map((g) => ({
      id: g.id,
      name: g.name,
      memberCount: g.memberCount,
      iconUrl: g.iconURL({ size: 128 }) ?? null,
    }));
    return res.json({ guilds });
  });

  app.get('/api/discord/channels', (req, res) => {
    const client = attachedClient;
    if (!client?.isReady()) {
      return res.status(503).json({ error: 'Discord client not ready' });
    }
    const guildId = (req.query.guildId as string) || process.env.DISCORD_GUILD_ID;
    if (!guildId) {
      return res.status(400).json({ error: 'guildId required' });
    }
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).json({ error: 'Guild not found' });
    }
    return res.json({ channels: listTextChannels(guild) });
  });

  app.get('/api/discord/roles', (req, res) => {
    const client = attachedClient;
    if (!client?.isReady()) {
      return res.status(503).json({ error: 'Discord client not ready' });
    }
    const guildId = (req.query.guildId as string) || process.env.DISCORD_GUILD_ID;
    if (!guildId) {
      return res.status(400).json({ error: 'guildId required' });
    }
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).json({ error: 'Guild not found' });
    }
    return res.json({ roles: listAssignableRoles(guild) });
  });

  app.get('/api/discord/live-events', (_req, res) => {
    res.json({ events: liveBus.recent(50), busChannel: LIVE_BUS_REDIS_CHANNEL });
  });

  // Trigger a test welcome flow for a specific member (admin-only — gated by
  // the dashboard, this endpoint is only reachable on the internal port).
  app.post('/api/welcome/test', express.json(), async (req, res) => {
    const client = attachedClient;
    if (!client?.isReady()) {
      return res.status(503).json({ error: 'Discord client not ready' });
    }
    const body = (req.body ?? {}) as { guildId?: string; userId?: string };
    const guildId = body.guildId || process.env.DISCORD_GUILD_ID;
    const userId = body.userId;
    if (!guildId || !userId) {
      return res.status(400).json({ error: 'guildId and userId required' });
    }
    try {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return res.status(404).json({ error: 'Member not found' });
      await handleMemberJoin(member);
      return res.json({ ok: true });
    } catch (err) {
      logger.error('Test welcome failed', err);
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  // ====================================
  // RULES API
  // ====================================
  app.post('/api/rules/publish', express.json(), async (req, res) => {
    const client = attachedClient;
    if (!client?.isReady()) {
      return res.status(503).json({ error: 'Discord client not ready' });
    }
    const body = (req.body ?? {}) as {
      guildId?: string;
      publishedBy?: string;
      forceRepost?: boolean;
    };
    const guildId = body.guildId || process.env.DISCORD_GUILD_ID;
    if (!guildId) {
      return res.status(400).json({ error: 'guildId required' });
    }
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).json({ error: 'Guild not found' });
    }
    try {
      const result = await publishRulesToGuild(guild, {
        publishedBy: body.publishedBy ?? 'dashboard',
        forceRepost: Boolean(body.forceRepost),
      });
      if (!result.ok) return res.status(400).json({ error: result.error });
      return res.json(result);
    } catch (err) {
      logger.error('Rules publish failed', err);
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/rules/analytics', async (req, res) => {
    const guildId = (req.query.guildId as string | undefined) || process.env.DISCORD_GUILD_ID;
    if (!guildId) return res.status(400).json({ error: 'guildId required' });
    try {
      const totalAccepted = await RuleAcceptance.countDocuments({ guildId }).exec();
      const last24h = await RuleAcceptance.countDocuments({
        guildId,
        acceptedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }).exec();
      const last7d = await RuleAcceptance.countDocuments({
        guildId,
        acceptedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }).exec();
      const recent = await RuleAcceptance.find({ guildId })
        .sort({ acceptedAt: -1 })
        .limit(25)
        .lean()
        .exec();
      const byMethod = await RuleAcceptance.aggregate([
        { $match: { guildId } },
        { $group: { _id: '$method', count: { $sum: 1 } } },
      ]).exec();
      return res.json({
        guildId,
        totalAccepted,
        last24h,
        last7d,
        byMethod: byMethod.map((b: { _id: string; count: number }) => ({
          method: b._id,
          count: b.count,
        })),
        recent: recent.map((r) => ({
          userId: r.userId,
          username: r.username,
          method: r.method,
          memberRoleGranted: r.memberRoleGranted,
          acceptedAt: r.acceptedAt instanceof Date ? r.acceptedAt.toISOString() : r.acceptedAt,
        })),
      });
    } catch (err) {
      logger.error('Rules analytics failed', err);
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  app.listen(port, '0.0.0.0', () => {
    logger.info(`Health + internal API server listening on port ${port}`);
  });
}
