// ====================================
// AVENLO CORE - GATEWAY SERVICE ENTRY
// ====================================

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from project root
config({ path: resolve(__dirname, '../../../.env') });

import { GatewayClient } from './client';
import { initRedis, initMongo, initEncryption, createLogger, RedisClient } from '@avenlo/shared';
import { startHealthServer, attachGatewayClient } from './health';
import { welcomeConfigStore } from './handlers/WelcomeConfigStore';
import { liveBus } from './handlers/LiveBus';

const logger = createLogger('gateway');

async function connectWithRetry<T>(
  name: string,
  connectFn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 3000
): Promise<T | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`🔄 Connecting to ${name} (attempt ${attempt}/${maxRetries})...`);
      const result = await connectFn();
      logger.info(`✅ ${name} connected`);
      return result;
    } catch (error) {
      logger.warn(`⚠️ ${name} connection attempt ${attempt} failed:`, error);
      if (attempt === maxRetries) {
        return null; // Return null instead of throwing
      }
      logger.info(`⏳ Retrying ${name} connection in ${delayMs / 1000}s...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  return null;
}

async function bootstrap(): Promise<void> {
  logger.info('🚀 Starting Avenlo Gateway Service...');

  // Start Health Check Server FIRST (so Railway sees the container as healthy)
  const port = parseInt(process.env.PORT || '3000', 10);
  startHealthServer(port);
  logger.info(`✅ Health server running on port ${port}`);

  let redis: RedisClient | null = null;

  try {
    // Initialize Redis (optional - gateway can work without it)
    if (process.env.REDIS_URL) {
      redis = initRedis({
        url: process.env.REDIS_URL,
        keyPrefix: 'avenlo:',
      });
      
      try {
        await redis.connect();
        logger.info('✅ Redis connected');
      } catch (redisError) {
        logger.warn('⚠️ Redis connection failed, continuing without Redis:', redisError);
        redis = null;
      }
    } else {
      logger.warn('⚠️ REDIS_URL not set, skipping Redis connection');
    }

    // Initialize MongoDB (required)
    const mongo = initMongo({
      uri: process.env.MONGODB_URI!,
      dbName: process.env.MONGODB_DB_NAME || 'avenlo_core',
    });
    
    const mongoResult = await connectWithRetry('MongoDB', () => mongo.connect());
    if (!mongoResult) {
      throw new Error('MongoDB connection failed after retries');
    }

    // Initialize Encryption
    initEncryption({
      key: process.env.ENCRYPTION_KEY!,
    });
    logger.info('✅ Encryption initialized');

    // Subscribe the welcome config store to Redis so dashboard edits
    // are picked up live without restarting the gateway.
    if (redis) {
      try {
        await welcomeConfigStore.startSubscription(redis);
      } catch (err) {
        logger.warn('⚠️ Failed to subscribe welcome config store to Redis', err);
      }
      // Live bus uses raw Redis pub/sub for cross-service dashboard widgets.
      liveBus.setRedis(redis);
    }

    // Start Discord Client
    const client = new GatewayClient();
    await client.start();
    attachGatewayClient(client);
    logger.info('✅ Discord client connected');
    logger.info('🎉 Gateway fully initialized and running!');

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('🛑 Shutting down Gateway...');
      await client.destroy();
      if (redis) await redis.disconnect();
      await mongo.disconnect();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    logger.error('❌ Failed to start Gateway:', error);
    process.exit(1);
  }
}

bootstrap();
