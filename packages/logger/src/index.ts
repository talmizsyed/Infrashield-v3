import pino, { Logger, LoggerOptions } from 'pino';
import { CORRELATION_ID_HEADER } from '@infrashield/shared';

export type LoggerConfig = {
  level?: string;
  environment?: 'development' | 'production' | 'test';
  correlationId?: string;
};

const getTransport = (environment: string | undefined) =>
  environment === 'development'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'yyyy-mm-dd HH:MM:ss.l o',
          ignore: 'pid,hostname',
        },
      }
    : undefined;

/**
 * Creates a configured Pino logger instance.
 */
export const createLogger = (config: LoggerConfig = {}): Logger => {
  const environment = config.environment ?? process.env.NODE_ENV ?? 'development';
  const level = config.level ?? process.env.LOG_LEVEL ?? 'info';

  const options: LoggerOptions = {
    level,
    base: {
      ...(config.correlationId ? { [CORRELATION_ID_HEADER]: config.correlationId } : {}),
    },
    transport: getTransport(environment),
  };

  return pino(options);
};

/**
 * Creates a child logger with additional bindings.
 */
export const createChildLogger = (logger: Logger, bindings: Record<string, unknown>): Logger =>
  logger.child(bindings);

/**
 * Returns the default correlation header name.
 */
export const getCorrelationHeader = (): string => CORRELATION_ID_HEADER;
