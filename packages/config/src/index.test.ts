import { describe, expect, it } from 'vitest';
import { loadConfig, isDevelopment, isProduction, isTest } from './index';

describe('config package', () => {
  it('loads valid configuration', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      PORT: '4000',
      LOG_LEVEL: 'debug',
      CORRELATION_ID_HEADER: 'x-request-id',
    });
    expect(config.NODE_ENV).toBe('test');
    expect(config.PORT).toBe(4000);
    expect(config.LOG_LEVEL).toBe('debug');
  });

  it('throws when configuration is invalid', () => {
    expect(() => loadConfig({ NODE_ENV: 'invalid', PORT: 'not-a-number' })).toThrow();
  });

  it('detects environment modes', () => {
    expect(isDevelopment('development')).toBe(true);
    expect(isTest('test')).toBe(true);
    expect(isProduction('production')).toBe(true);
  });
});
