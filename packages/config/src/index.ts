import { z } from 'zod';
import { appConfigSchema, Environment } from './schema';

/**
 * Parsed application configuration values.
 */
export type AppConfig = z.infer<typeof appConfigSchema>;

/**
 * Load environment configuration and validate it with Zod.
 */
export const loadConfig = (env: NodeJS.ProcessEnv = process.env): AppConfig => {
  const parsed = appConfigSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.flatten().fieldErrors;
    throw new Error(`Config validation failed: ${JSON.stringify(issues)}`);
  }

  return parsed.data;
};

/**
 * Returns true if the current environment is development.
 */
export const isDevelopment = (env: string): boolean => env === 'development';

/**
 * Returns true if the current environment is test.
 */
export const isTest = (env: string): boolean => env === 'test';

/**
 * Returns true if the current environment is production.
 */
export const isProduction = (env: string): boolean => env === 'production';

export type { Environment } from './schema';
export { appConfigSchema } from './schema';
