// ====================================
// AVENLO CORE - SHARED UTILITIES HEALTH TEST
// Proves the MongoDB (Mongoose) and Redis (ioredis Pub/Sub) singletons
// work end-to-end against in-memory instances.
// ====================================

// Swap the real ioredis driver for an in-memory implementation. ioredis-mock
// is a drop-in replacement that shares state across connections in-process,
// so the publisher/subscriber duplex used by RedisClient works for real.
jest.mock('ioredis', () => {
  const RedisMock = require('ioredis-mock');
  return { __esModule: true, default: RedisMock.default ?? RedisMock };
});

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { initMongo, getMongoClient } from './mongodb';
import { initRedis, RedisClient } from './redis';
import { EventTypes, type BaseEvent } from '../types/events';

describe('@avenlo/shared health', () => {
  describe('MongoDB (Mongoose) singleton', () => {
    let mongod: MongoMemoryServer;

    beforeAll(async () => {
      mongod = await MongoMemoryServer.create();
      initMongo({ uri: mongod.getUri(), dbName: 'avenlo_health' });
    });

    afterAll(async () => {
      await getMongoClient().disconnect();
      await mongod.stop();
    });

    it('connects to an in-memory MongoDB and reports a healthy connection', async () => {
      const client = getMongoClient();
      const connection = await client.connect();

      expect(connection.readyState).toBe(1);
      expect(client.isConnected()).toBe(true);
    });

    it('round-trips a document through Mongoose', async () => {
      const client = getMongoClient();
      await client.connect();

      const Probe =
        mongoose.models.HealthProbe ||
        mongoose.model(
          'HealthProbe',
          new mongoose.Schema({ name: String, value: Number }),
        );

      const created = await Probe.create({ name: 'ping', value: 42 });
      const found = await Probe.findById(created._id).lean();

      expect(found).not.toBeNull();
      expect(found?.name).toBe('ping');
      expect(found?.value).toBe(42);
    });
  });

  describe('Redis (ioredis Pub/Sub) singleton', () => {
    let redis: RedisClient;

    beforeAll(async () => {
      redis = initRedis({ url: 'redis://127.0.0.1:6379', keyPrefix: 'avenlo-test:' });
      await redis.connect();
    });

    afterAll(async () => {
      await redis.disconnect();
    });

    it('publishes an event and delivers it to a subscriber over the bus', async () => {
      const received: BaseEvent[] = [];

      const delivered = new Promise<void>((resolve) => {
        void redis.subscribe(EventTypes.SYSTEM_HEALTH, async (event) => {
          received.push(event);
          resolve();
        });
      });

      // Give the subscription a tick to register before publishing.
      await new Promise((r) => setTimeout(r, 50));

      const eventId = await redis.publish(EventTypes.SYSTEM_HEALTH, {
        source: 'gateway',
        payload: { service: 'gateway', status: 'healthy' },
      });

      await Promise.race([
        delivered,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('event was not delivered')), 5000),
        ),
      ]);

      expect(received).toHaveLength(1);
      expect(received[0].type).toBe(EventTypes.SYSTEM_HEALTH);
      expect(received[0].id).toBe(eventId);
    });

    it('stores and retrieves a session via the cache layer', async () => {
      await redis.setSession('user-1', { credits: 100 }, 60);
      const session = await redis.getSession<{ credits: number }>('user-1');

      expect(session).not.toBeNull();
      expect(session?.credits).toBe(100);
    });
  });
});
