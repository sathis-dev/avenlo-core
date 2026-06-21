// ====================================
// AVENLO CORE - PULSE SERVICE ENTRY
// ====================================

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from project root
config({ path: resolve(__dirname, '../../../.env') });

import { initRedis, initMongo, createLogger } from '@avenlo/shared';
import { PulseService } from './service';
import { startWebhookServer } from './server';
import { DashboardUpdater } from './dashboard/updater';

const logger = createLogger('pulse');

async function bootstrap(): Promise<void> {
  logger.info('💓 Starting Avenlo Pulse Service...');

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

    // Initialize Pulse Service
    const pulse = new PulseService();
    await pulse.start();
    logger.info('✅ Pulse service started');

    // Initialize Dashboard Updater
    const dashboardUpdater = new DashboardUpdater();
    await dashboardUpdater.start();
    logger.info('✅ Dashboard updater started');

    // Start webhook server
    const port = parseInt(process.env.PORT || '3002', 10);
    startWebhookServer(port, pulse);
    logger.info(`✅ Webhook server running on port ${port}`);

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('🛑 Shutting down Pulse...');
      await pulse.stop();
      await dashboardUpdater.stop();
      await redis.disconnect();
      await mongo.disconnect();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    logger.error('❌ Failed to start Pulse:', error);
    process.exit(1);
  }
}

bootstrap();
