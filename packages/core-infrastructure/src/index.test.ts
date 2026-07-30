import { describe, expect, it } from 'vitest';

import * as infrastructure from './index';
import { FixedClock, OffsetClock, SystemClock } from './clock';
import { createConfigurationProvider, StaticConfigurationProvider } from './configuration';
import { createInjectionToken } from './di';
import { CoreError, createError, ErrorSeverity, isInfrastructureError } from './errors';
import { createMemoryLogSink, StructuredLogger } from './logger';
import { createOptionsValidator, mergeOptions, OptionsBuilder } from './options';
import { DefaultIdFactory, toIdentifier } from './primitives';
import { fail, isFailure, isSuccess, mapError, mapResult, ok } from './result';
import { JsonSerializer } from './serializer';

describe('core-infrastructure', () => {
  describe('shared ids', () => {
    it('generates deterministic identifiers from a factory', () => {
      const ids = new DefaultIdFactory({ seed: 40, prefix: 'core' });

      expect(ids.create('service')).toBe('core.service.15');
      expect(ids.createCorrelationId()).toBe('core.correlation.16');
      expect(ids.createTraceId()).toBe('core.trace.17');
    });

    it('casts identifiers using branding helpers', () => {
      const id = toIdentifier('service-1');
      expect(id).toBe('service-1');
    });
  });

  describe('error model', () => {
    it('creates typed infrastructure errors', () => {
      const error = new CoreError({
        code: 'core.invalid',
        message: 'Invalid operation.',
        severity: ErrorSeverity.Warning,
      });

      expect(error.code).toBe('core.invalid');
      expect(error.severity).toBe(ErrorSeverity.Warning);
      expect(isInfrastructureError(error)).toBe(true);
    });

    it('normalizes error construction with createError', () => {
      const error = createError({
        code: 'core.failed',
        message: 'Operation failed.',
      });

      expect(error.message).toBe('Operation failed.');
      expect(error.severity).toBe(ErrorSeverity.Error);
    });
  });

  describe('result pattern', () => {
    it('maps successful values and failed errors', () => {
      const value = ok(4);
      const mapped = mapResult(value, (input) => input * 2);

      expect(isSuccess(mapped)).toBe(true);
      if (mapped.succeeded) {
        expect(mapped.data).toBe(8);
      }

      const failed = fail(createError({ code: 'core.bad', message: 'bad' }));
      const mappedError = mapError(failed, (error) => error.code);

      expect(isFailure(mappedError)).toBe(true);
      if (!mappedError.succeeded) {
        expect(mappedError.error).toBe('core.bad');
      }
    });
  });

  describe('clock', () => {
    it('supports fixed and offset clocks', () => {
      const fixed = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));
      const offset = new OffsetClock(fixed, 5000);

      expect(fixed.nowIso()).toBe('2026-01-01T00:00:00.000Z');
      expect(offset.nowIso()).toBe('2026-01-01T00:00:05.000Z');
      expect(new SystemClock().now()).toBeInstanceOf(Date);
    });
  });

  describe('logger', () => {
    it('writes structured log records through a sink', async () => {
      const sink = createMemoryLogSink();
      const logger = new StructuredLogger({
        loggerId: toIdentifier('logger-1'),
        sink,
        minLevel: 'debug',
        clock: new FixedClock(new Date('2026-01-01T10:00:00.000Z')),
      });

      await logger.info('started', { area: 'test' });
      await logger.trace('ignored');

      expect(sink.records).toHaveLength(1);
      expect(sink.records[0]).toMatchObject({
        loggerId: 'logger-1',
        level: 'info',
        message: 'started',
        timestamp: '2026-01-01T10:00:00.000Z',
      });
    });
  });

  describe('configuration', () => {
    it('resolves optional and required values', () => {
      const configuration = new StaticConfigurationProvider({
        retries: 3,
        endpoint: 'https://example.test',
      });

      expect(configuration.has('retries')).toBe(true);
      expect(configuration.get<number>('retries')).toBe(3);

      const required = configuration.getRequired<number>('retries');
      expect(required.succeeded).toBe(true);

      const missing = configuration.getRequired('missing');
      expect(missing.succeeded).toBe(false);
    });

    it('creates providers via factory function', () => {
      const provider = createConfigurationProvider({ mode: 'test' });
      expect(provider.snapshot()).toEqual({ mode: 'test' });
    });
  });

  describe('serializer', () => {
    it('serializes and deserializes values safely', () => {
      const serializer = new JsonSerializer();

      const encoded = serializer.safeSerialize({ ok: true });
      expect(encoded.succeeded).toBe(true);

      const decoded = serializer.safeDeserialize<{ ok: boolean }>('{"ok":true}');
      expect(decoded.succeeded).toBe(true);
      if (decoded.succeeded) {
        expect(decoded.data.ok).toBe(true);
      }

      const broken = serializer.safeDeserialize('not-json');
      expect(broken.succeeded).toBe(false);
    });
  });

  describe('dependency injection contracts', () => {
    it('creates stable symbolic tokens', () => {
      const tokenA = createInjectionToken<{ value: number }>('service-a');
      const tokenB = createInjectionToken<{ value: number }>('service-a');

      expect(typeof tokenA).toBe('symbol');
      expect(tokenA).not.toBe(tokenB);
    });

    it('keeps the package entrypoint focused on public DI contracts', () => {
      expect(infrastructure.ServiceCollection).toBeDefined();
      expect(infrastructure.ServiceProvider).toBeDefined();
      expect('DependencyValidator' in infrastructure).toBe(false);
      expect('ServiceResolver' in infrastructure).toBe(false);
      expect('ScopedServiceProvider' in infrastructure).toBe(false);
    });
  });

  describe('options pattern', () => {
    it('merges options and validates through validators', () => {
      const validator = createOptionsValidator<{ retries: number; timeoutMs: number }>(
        (options) => options.retries >= 0 && options.timeoutMs > 0,
        {
          code: 'options.invalid',
          message: 'Options are invalid.',
          severity: ErrorSeverity.Error,
        },
      );

      const builder = new OptionsBuilder({ retries: 1, timeoutMs: 1000 })
        .override({ timeoutMs: 1500 })
        .addValidator(validator);

      const merged = mergeOptions({ retries: 1, timeoutMs: 1000 }, { retries: 2 });
      expect(merged).toEqual({ retries: 2, timeoutMs: 1000 });

      const options = builder.create();
      expect(options.succeeded).toBe(true);
      if (options.succeeded) {
        expect(options.data.value.timeoutMs).toBe(1500);
      }

      const invalid = new OptionsBuilder({ retries: 0, timeoutMs: 10 })
        .override({ timeoutMs: 0 })
        .addValidator(validator)
        .build();

      expect(invalid.succeeded).toBe(false);
    });
  });
});
