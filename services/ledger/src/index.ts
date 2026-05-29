// ====================================
// AVENLO CORE - LEDGER SERVICE ENTRY
// Event-Sourced Credit Processing System
// ====================================

import 'dotenv/config';
import { 
  initMongo, 
  initEventBus,
  createLogger,
} from '@avenlo/shared';
import { getLedgerConsumer } from './consumer';
import { LedgerService } from './service';
import { getRoleManager } from './roles/manager';
import { startHealthServer } from './server';

const logger = createLogger('ledger');

async function bootstrap(): Promise<void> {
  logger.info('📒 Starting Avenlo Ledger Service (Event-Sourced)...');

  try {
    // Initialize MongoDB first
    const mongo = initMongo({
      uri: process.env.MONGODB_URI!,
      dbName: process.env.MONGODB_DB_NAME || 'avenlo_core',
    });
    await mongo.connect();
    logger.info('✅ MongoDB connected');

    // Initialize Event Bus (Redis Streams)
    const eventBus = initEventBus({
      redisUrl: process.env.REDIS_URL!,
      serviceName: 'ledger',
      keyPrefix: 'avenlo:',
      debug: process.env.NODE_ENV !== 'production',
    });
    await eventBus.connect();
    logger.info('✅ Event Bus connected (Redis Streams)');

    // Initialize Stream Consumer for credit processing
    const consumer = getLedgerConsumer();
    await consumer.start();
    logger.info('✅ Ledger Consumer started (exactly-once processing enabled)');

    // Initialize Legacy Ledger Service (for backward compatibility)
    const ledger = new LedgerService();
    await ledger.start();
    logger.info('✅ Legacy Ledger service started');

    // Initialize Role Manager (shared singleton; consumer drives promotions)
    const roleManager = getRoleManager();
    await roleManager.start();
    logger.info('✅ Role manager started');

    // Start health server
    const port = parseInt(process.env.PORT || '3003', 10);
    startHealthServer(port, {
      getConsumerStats: () => consumer.getStats(),
      getDlqStats: () => eventBus.getDeadLetterQueueStats(),
    });
    logger.info(`✅ Health server running on port ${port}`);

    // Log initial stats
    logger.info('📊 System ready for high-throughput event processing');
    logger.info('   - Idempotency: ENABLED');
    logger.info('   - Dead Letter Queue: ENABLED');
    logger.info('   - Atomic Transactions: ENABLED');

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('🛑 Shutting down Ledger (graceful)...');
      
      // Stop consumer first (finish processing current batch)
      await consumer.stop();
      logger.info('   - Consumer stopped');
      
      await ledger.stop();
      await roleManager.stop();
      
      // Disconnect event bus
      await eventBus.disconnect();
      logger.info('   - Event bus disconnected');
      
      await mongo.disconnect();
      logger.info('   - MongoDB disconnected');
      
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
