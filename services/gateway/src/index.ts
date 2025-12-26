// ====================================
// AVENLO CORE - GATEWAY SERVICE ENTRY
// ====================================

import 'dotenv/config';
import { GatewayClient } from './client';
import { initRedis, initMongo, initEncryption, createLogger } from '@avenlo/shared';
import { startHealthServer } from './health';

const logger = createLogger('gateway');

async function bootstrap(): Promise<void> {
  logger.info('🚀 Starting Avenlo Gateway Service...');

  try {
    // Initialize Redis
    const redis = initRedis({
      url: process.env.REDIS_URL!,
      keyPrefix: 'avenlo:',
    });
    await redis.connect();
    logger.info('✅ Redis connected');

    // Initialize MongoDB
    const mongo = initMongo({
      uri: process.env.MONGODB_URI!,
      dbName: process.env.MONGODB_DB_NAME || 'avenlo_core',
    });
    await mongo.connect();
    logger.info('✅ MongoDB connected');

    // Initialize Encryption
    initEncryption({
      key: process.env.ENCRYPTION_KEY!,
    });
    logger.info('✅ Encryption initialized');

    // Start Discord Client
    const client = new GatewayClient();
    await client.start();
    logger.info('✅ Discord client connected');

    // Start Health Check Server
    const port = parseInt(process.env.PORT || '3000', 10);
    startHealthServer(port);
    logger.info(`✅ Health server running on port ${port}`);

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('🛑 Shutting down Gateway...');
      await client.destroy();
      await redis.disconnect();
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
