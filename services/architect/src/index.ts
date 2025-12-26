// ====================================
// AVENLO CORE - ARCHITECT SERVICE ENTRY
// ====================================

import 'dotenv/config';
import { initRedis, initMongo, initEncryption, createLogger, EventTypes } from '@avenlo/shared';
import { ArchitectService } from './service';
import { startWebhookServer } from './server';

const logger = createLogger('architect');

async function bootstrap(): Promise<void> {
  logger.info('🏛️ Starting Avenlo Architect Service...');

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

    // Initialize Architect Service
    const architect = new ArchitectService();
    await architect.start();
    logger.info('✅ Architect service started');

    // Start webhook server
    const port = parseInt(process.env.PORT || '3001', 10);
    startWebhookServer(port);
    logger.info(`✅ Webhook server running on port ${port}`);

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('🛑 Shutting down Architect...');
      await architect.stop();
      await redis.disconnect();
      await mongo.disconnect();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    logger.error('❌ Failed to start Architect:', error);
    process.exit(1);
  }
}

bootstrap();
