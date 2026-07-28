import { describe, expect, it } from 'vitest';
import { createLogger, createChildLogger, getCorrelationHeader } from './index';

describe('logger package', () => {
  it('creates a logger instance', () => {
    const logger = createLogger({ environment: 'test', level: 'debug', correlationId: 'abc-123' });
    expect(logger).toBeDefined();
    expect(getCorrelationHeader()).toBe('x-correlation-id');
  });

  it('creates a child logger with bindings', () => {
    const logger = createLogger({ environment: 'test' });
    const child = createChildLogger(logger, { component: 'test' });
    expect(child).toBeDefined();
    expect(typeof child.child).toBe('function');
  });
});
