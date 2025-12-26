// ====================================
// AVENLO CORE - MONGODB CONNECTION
// ====================================

import mongoose, { Connection, ConnectOptions } from 'mongoose';
import { logger } from './logger';

export interface MongoConfig {
  uri: string;
  dbName: string;
  options?: ConnectOptions;
}

/**
 * MongoDB connection manager
 */
export class MongoClient {
  private connection: Connection | null = null;
  private config: MongoConfig;

  constructor(config: MongoConfig) {
    this.config = config;
  }

  async connect(): Promise<Connection> {
    if (this.connection) {
      return this.connection;
    }

    try {
      const options: ConnectOptions = {
        dbName: this.config.dbName,
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        ...this.config.options,
      };

      await mongoose.connect(this.config.uri, options);
      this.connection = mongoose.connection;

      this.connection.on('error', (err) => {
        logger.error('MongoDB connection error:', err);
      });

      this.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
      });

      this.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected');
      });

      logger.info(`MongoDB connected to database: ${this.config.dbName}`);
      return this.connection;
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await mongoose.disconnect();
      this.connection = null;
      logger.info('MongoDB disconnected');
    }
  }

  getConnection(): Connection | null {
    return this.connection;
  }

  isConnected(): boolean {
    return this.connection?.readyState === 1;
  }
}

// Singleton instance
let mongoInstance: MongoClient | null = null;

export function getMongoClient(config?: MongoConfig): MongoClient {
  if (!mongoInstance) {
    if (!config) {
      throw new Error('MongoDB config required for initial setup');
    }
    mongoInstance = new MongoClient(config);
  }
  return mongoInstance;
}

export function initMongo(config: MongoConfig): MongoClient {
  mongoInstance = new MongoClient(config);
  return mongoInstance;
}
