import type { Identifier, SerializableValueObject } from '@agentic/sdk';
import type { ITraceSpan, ILogger, ITracer } from '@agentic/sdk';

class NoopTraceSpan implements ITraceSpan {
  public readonly spanId: Identifier;
  public readonly traceId: Identifier;
  public readonly name: string;

  public constructor(traceId: Identifier, spanId: Identifier, name: string) {
    this.traceId = traceId;
    this.spanId = spanId;
    this.name = name;
  }

  public setAttribute(): void {
    return;
  }

  public addEvent(): void {
    return;
  }

  public end(): void {
    return;
  }
}

class NoopLogger implements ILogger {
  public readonly loggerId: Identifier = 'logger-noop';
  public readonly name = 'noop';
  public readonly level = 'info';

  public child(): ILogger {
    return this;
  }

  public isEnabled(): boolean {
    return false;
  }

  public log(): void {
    return;
  }

  public trace(): void {
    return;
  }

  public debug(): void {
    return;
  }

  public info(): void {
    return;
  }

  public warn(): void {
    return;
  }

  public error(): void {
    return;
  }

  public fatal(): void {
    return;
  }
}

class NoopTracer implements ITracer {
  public readonly tracerId: Identifier = 'tracer-noop';

  public async startSpan(name: string): Promise<ITraceSpan> {
    return new NoopTraceSpan(this.tracerId, `${name}-span`, name);
  }

  public currentSpan(): undefined {
    return undefined;
  }
}

/**
 * Creates a no-op logger for runtime defaults and tests.
 */
export function createNoopLogger(): ILogger {
  return new NoopLogger();
}

/**
 * Creates a no-op tracer for runtime defaults and tests.
 */
export function createNoopTracer(): ITracer {
  return new NoopTracer();
}

/**
 * Creates a shallow logger child context without mutating the base logger.
 */
export function createLoggerContext(
  context: SerializableValueObject | undefined,
): SerializableValueObject {
  return context ?? {};
}
