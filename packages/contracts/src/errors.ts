import type { SerializableValueObject, TimestampString } from './primitives';

/**
 * Base error contract for kernel-level failures.
 */
export interface BaseError {
  readonly code: string;
  readonly message: string;
  readonly details?: SerializableValueObject;
  readonly timestamp: TimestampString;
}

/**
 * Severity categories for kernel errors.
 */
export enum ErrorSeverity {
  Warning = 'warning',
  Error = 'error',
  Critical = 'critical',
}

/**
 * Typed error with optional category and severity.
 */
export interface TypedError extends BaseError {
  readonly severity: ErrorSeverity;
  readonly category?: string;
}
