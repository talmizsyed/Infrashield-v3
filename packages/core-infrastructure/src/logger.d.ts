import type { IClock } from './clock';
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
export declare class StructuredLogger implements ILogger {
  readonly loggerId: Identifier;
  readonly minLevel: LogLevel;
  private readonly sink;
  private readonly clock;
  private readonly baseContext?;
  constructor(options: StructuredLoggerOptions);
  child(context: SerializableObject): ILogger;
  log(level: LogLevel, message: string, context?: SerializableObject): Promise<void>;
  trace(message: string, context?: SerializableObject): Promise<void>;
  debug(message: string, context?: SerializableObject): Promise<void>;
  info(message: string, context?: SerializableObject): Promise<void>;
  warn(message: string, context?: SerializableObject): Promise<void>;
  error(message: string, context?: SerializableObject): Promise<void>;
  fatal(message: string, context?: SerializableObject): Promise<void>;
  private isEnabled;
  private mergeContext;
}
/**
 * In-memory sink used for tests and diagnostics.
 */
export declare class MemoryLogSink implements ILogSink {
  private readonly recordsInternal;
  get records(): readonly LogRecord[];
  write(record: LogRecord): void;
  clear(): void;
}
/**
 * Factory for memory log sinks.
 */
export declare function createMemoryLogSink(): MemoryLogSink;
//# sourceMappingURL=logger.d.ts.map
