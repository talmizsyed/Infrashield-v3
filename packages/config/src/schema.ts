import { z } from 'zod';

/**
 * Supported application environments.
 */
export const environmentSchema = z.enum(['development', 'test', 'production']);

/**
 * Shared environment configuration schema.
 */
export const appConfigSchema = z.object({
  NODE_ENV: environmentSchema.default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.string().default('info'),
  CORRELATION_ID_HEADER: z.string().default('x-correlation-id'),
});

export type AppConfigSchema = z.infer<typeof appConfigSchema>;
export type Environment = z.infer<typeof environmentSchema>;
