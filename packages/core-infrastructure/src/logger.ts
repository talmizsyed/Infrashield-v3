import type { IClock } from './clock';
import { SystemClock } from './clock';
import type { Identifier, SerializableObject } from './primitives';

/**
 * Log severity levels.
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Structured log payload.
 */
export interface LogRecord {
  readonly loggerId: Identifier;
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: string;
  readonly context?: SerializableObject;
}

/**
 * Sink contract for decoupled log transport.
 */
export interface ILogSink {
  write(record: LogRecord): Promise<void> | void;
}

/**
 * Generic logger contract.
 */
export interface ILogger {
  readonly loggerId: Identifier;
  readonly minLevel: LogLevel;
  child(context: SerializableObject): ILogger;
  log(level: LogLevel, message: string, context?: SerializableObject): Promise<void>;
  trace(message: string, context?: SerializableObject): Promise<void>;
  debug(message: string, context?: SerializableObject): Promise<void>;
  info(message: string, context?: SerializableObject): Promise<void>;
  warn(message: string, context?: SerializableObject): Promise<void>;
  error(message: string, context?: SerializableObject): Promise<void>;
  fatal(message: string, context?: SerializableObject): Promise<void>;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

/**
 * Constructor options for the structured logger.
 */
export interface StructuredLoggerOptions {
  readonly loggerId: Identifier;
  readonly sink: ILogSink;
  readonly minLevel?: LogLevel;
  readonly clock?: IClock;
  readonly baseContext?: SerializableObject;
}

/**
 * Provider-agnostic logger implementation based on a pluggable sink.
 */
export class StructuredLogger implements ILogger {
  public readonly loggerId: Identifier;
  public readonly minLevel: LogLevel;

  private readonly sink: ILogSink;
  private readonly clock: IClock;
  private readonly baseContext?: SerializableObject;

  public constructor(options: StructuredLoggerOptions) {
    this.loggerId = options.loggerId;
    this.minLevel = options.minLevel ?? 'info';
    this.sink = options.sink;
    this.clock = options.clock ?? new SystemClock();
    this.baseContext = options.baseContext;
  }

  public child(context: SerializableObject): ILogger {
    return new StructuredLogger({
      loggerId: this.loggerId,
      minLevel: this.minLevel,
      sink: this.sink,
      clock: this.clock,
      baseContext: {
        ...(this.baseContext ?? {}),
        ...context,
      },
    });
  }

  public async log(level: LogLevel, message: string, context?: SerializableObject): Promise<void> {
    if (!this.isEnabled(level)) {
      return;
    }

    await this.sink.write({
      loggerId: this.loggerId,
      level,
      message,
      timestamp: this.clock.nowIso(),
      context: this.mergeContext(context),
    });
  }

  public trace(message: string, context?: SerializableObject): Promise<void> {
    return this.log('trace', message, context);
  }

  public debug(message: string, context?: SerializableObject): Promise<void> {
    return this.log('debug', message, context);
  }

  public info(message: string, context?: SerializableObject): Promise<void> {
    return this.log('info', message, context);
  }

  public warn(message: string, context?: SerializableObject): Promise<void> {
    return this.log('warn', message, context);
  }

  public error(message: string, context?: SerializableObject): Promise<void> {
    return this.log('error', message, context);
  }

  public fatal(message: string, context?: SerializableObject): Promise<void> {
    return this.log('fatal', message, context);
  }

  private isEnabled(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[this.minLevel];
  }

  private mergeContext(context?: SerializableObject): SerializableObject | undefined {
    if (!this.baseContext && !context) {
      return undefined;
    }

    return {
      ...(this.baseContext ?? {}),
      ...(context ?? {}),
    };
  }
}

/**
 * In-memory sink used for tests and diagnostics.
 */
export class MemoryLogSink implements ILogSink {
  private readonly recordsInternal: LogRecord[] = [];

  public get records(): readonly LogRecord[] {
    return this.recordsInternal;
  }

  public write(record: LogRecord): void {
    this.recordsInternal.push(record);
  }

  public clear(): void {
    this.recordsInternal.length = 0;
  }
}

/**
 * Factory for memory log sinks.
 */
export function createMemoryLogSink(): MemoryLogSink {
  return new MemoryLogSink();
}
