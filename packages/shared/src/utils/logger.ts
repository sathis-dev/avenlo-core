// ====================================
// AVENLO CORE - WINSTON LOGGER
// ====================================

import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

/**
 * Custom log format
 */
const logFormat = printf(({ level, message, timestamp, service, ...metadata }) => {
  let log = `${timestamp} [${service || 'avenlo'}] ${level}: ${message}`;
  
  if (Object.keys(metadata).length > 0 && metadata.stack === undefined) {
    log += ` ${JSON.stringify(metadata)}`;
  }
  
  if (metadata.stack) {
    log += `\n${metadata.stack}`;
  }
  
  return log;
});

/**
 * Create a logger instance
 */
export function createLogger(serviceName: string): winston.Logger {
  const isProduction = process.env.NODE_ENV === 'production';

  return winston.createLogger({
    level: isProduction ? 'info' : 'debug',
    format: combine(
      errors({ stack: true }),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      logFormat
    ),
    defaultMeta: { service: serviceName },
    transports: [
      new winston.transports.Console({
        format: combine(
          colorize({ all: !isProduction }),
          logFormat
        ),
      }),
    ],
  });
}

// Default logger instance
export const logger = createLogger('avenlo-core');
