import type {
  Identifier,
  SerializableValue,
  SerializableValueObject,
} from '@infrashield/contracts';

/**
 * Log level contract shared by all SDK logging abstractions.
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Structured logging contract used by agents, runtime services, and plugins.
 */
export interface ILogger {
  readonly loggerId: Identifier;
  readonly name: string;
  readonly level: LogLevel;

  child(context?: SerializableValueObject): ILogger;
  isEnabled(level: LogLevel): boolean;
  log(level: LogLevel, message: string, context?: SerializableValueObject): Promise<void> | void;
  trace(message: string, context?: SerializableValueObject): Promise<void> | void;
  debug(message: string, context?: SerializableValueObject): Promise<void> | void;
  info(message: string, context?: SerializableValueObject): Promise<void> | void;
  warn(message: string, context?: SerializableValueObject): Promise<void> | void;
  error(message: string, context?: SerializableValueObject): Promise<void> | void;
  fatal(message: string, context?: SerializableValueObject): Promise<void> | void;
}

/**
 * Span state contract used by the tracer abstraction.
 */
export type TraceSpanStatus = 'ok' | 'error' | 'cancelled';

/**
 * Span contract for trace propagation and timing.
 */
export interface ITraceSpan {
  readonly spanId: Identifier;
  readonly traceId: Identifier;
  readonly name: string;

  setAttribute(key: string, value: SerializableValue): void;
  addEvent(name: string, attributes?: SerializableValueObject): void;
  end(status?: TraceSpanStatus): Promise<void> | void;
}

/**
 * Tracing contract used to create and manage spans.
 */
export interface ITracer {
  readonly tracerId: Identifier;

  startSpan(name: string, context?: SerializableValueObject): Promise<ITraceSpan>;
  currentSpan(): ITraceSpan | undefined;
}
