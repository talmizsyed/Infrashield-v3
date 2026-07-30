import type { SerializableObject, TimestampString } from './primitives';
import { toTimestampString } from './primitives';

/**
 * Error severity levels for infrastructure concerns.
 */
export enum ErrorSeverity {
  Info = 'info',
  Warning = 'warning',
  Error = 'error',
  Critical = 'critical',
}

/**
 * Common infrastructure error contract.
 */
export interface InfrastructureError {
  readonly code: string;
  readonly message: string;
  readonly severity: ErrorSeverity;
  readonly timestamp: TimestampString;
  readonly details?: SerializableObject;
  readonly cause?: unknown;
}

/**
 * Input used to create a core error instance.
 */
export interface CoreErrorInput {
  readonly code: string;
  readonly message: string;
  readonly severity?: ErrorSeverity;
  readonly details?: SerializableObject;
  readonly cause?: unknown;
  readonly timestamp?: Date;
}

/**
 * Generic infrastructure error implementation.
 */
export class CoreError extends Error implements InfrastructureError {
  public readonly code: string;
  public readonly severity: ErrorSeverity;
  public readonly timestamp: TimestampString;
  public readonly details?: SerializableObject;
  public readonly cause?: unknown;

  public constructor(input: CoreErrorInput) {
    super(input.message);
    this.name = 'CoreError';
    this.code = input.code;
    this.severity = input.severity ?? ErrorSeverity.Error;
    this.details = input.details;
    this.cause = input.cause;
    this.timestamp = toTimestampString((input.timestamp ?? new Date()).toISOString());
  }
}

/**
 * Creates a normalized infrastructure error instance.
 */
export function createError(input: CoreErrorInput): CoreError {
  return new CoreError(input);
}

/**
 * Type guard for infrastructure errors.
 */
export function isInfrastructureError(value: unknown): value is InfrastructureError {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const maybeError = value as Partial<InfrastructureError>;
  return (
    typeof maybeError.code === 'string' &&
    typeof maybeError.message === 'string' &&
    typeof maybeError.timestamp === 'string'
  );
}
