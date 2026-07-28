import { describe, expect, it } from 'vitest';
import { createHealthServer, isHealthEndpoint, HEALTH_ENDPOINTS } from './index';

describe('shared package', () => {
  it('exports health constants', () => {
    expect(HEALTH_ENDPOINTS).toContain('/health');
  });

  it('detects health endpoints', () => {
    expect(isHealthEndpoint('/ready')).toBe(true);
    expect(isHealthEndpoint('/invalid')).toBe(false);
  });

  it('creates a health server', () => {
    const server = createHealthServer();
    expect(server).toBeDefined();
    expect(typeof server.listen).toBe('function');
    server.close();
  });

  it('returns default port', () => {
    expect(getDefaultPort()).toBe(3000);
  });
});
