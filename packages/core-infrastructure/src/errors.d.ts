import type { SerializableObject, TimestampString } from './primitives';
/**
 * Error severity levels for infrastructure concerns.
 */
export declare enum ErrorSeverity {
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
export declare class CoreError extends Error implements InfrastructureError {
  readonly code: string;
  readonly severity: ErrorSeverity;
  readonly timestamp: TimestampString;
  readonly details?: SerializableObject;
  readonly cause?: unknown;
  constructor(input: CoreErrorInput);
}
/**
 * Creates a normalized infrastructure error instance.
 */
export declare function createError(input: CoreErrorInput): CoreError;
/**
 * Type guard for infrastructure errors.
 */
export declare function isInfrastructureError(value: unknown): value is InfrastructureError;
//# sourceMappingURL=errors.d.ts.map
