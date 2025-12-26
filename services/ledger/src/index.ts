// ====================================
// AVENLO CORE - LEDGER SERVICE ENTRY
// ====================================

import 'dotenv/config';
import { initRedis, initMongo, createLogger } from '@avenlo/shared';
import { LedgerService } from './service';
import { RoleManager } from './roles/manager';
import { startHealthServer } from './server';

const logger = createLogger('ledger');

async function bootstrap(): Promise<void> {
  logger.info('📒 Starting Avenlo Ledger Service...');

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

    // Initialize Ledger Service
    const ledger = new LedgerService();
    await ledger.start();
    logger.info('✅ Ledger service started');

    // Initialize Role Manager
    const roleManager = new RoleManager();
    await roleManager.start();
    logger.info('✅ Role manager started');

    // Start health server
    const port = parseInt(process.env.PORT || '3003', 10);
    startHealthServer(port);
    logger.info(`✅ Health server running on port ${port}`);

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('🛑 Shutting down Ledger...');
      await ledger.stop();
      await roleManager.stop();
      await redis.disconnect();
      await mongo.disconnect();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    logger.error('❌ Failed to start Ledger:', error);
    process.exit(1);
  }
}

bootstrap();
