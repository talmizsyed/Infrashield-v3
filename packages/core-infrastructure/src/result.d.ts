import type { InfrastructureError } from './errors';
/**
 * Successful result shape.
 */
export interface Success<TValue> {
  readonly succeeded: true;
  readonly data: TValue;
}
/**
 * Failed result shape.
 */
export interface Failure<TError> {
  readonly succeeded: false;
  readonly error: TError;
}
/**
 * Generic result union.
 */
export type Result<TValue, TError = InfrastructureError> = Success<TValue> | Failure<TError>;
/**
 * Creates a successful result.
 */
export declare function ok<TValue>(data: TValue): Success<TValue>;
/**
 * Creates a failed result.
 */
export declare function fail<TError>(error: TError): Failure<TError>;
/**
 * Type guard for success results.
 */
export declare function isSuccess<TValue, TError>(
  result: Result<TValue, TError>,
): result is Success<TValue>;
/**
 * Type guard for failure results.
 */
export declare function isFailure<TValue, TError>(
  result: Result<TValue, TError>,
): result is Failure<TError>;
/**
 * Maps a successful result value.
 */
export declare function mapResult<TSource, TTarget, TError>(
  result: Result<TSource, TError>,
  mapper: (value: TSource) => TTarget,
): Result<TTarget, TError>;
/**
 * Maps a failed result error.
 */
export declare function mapError<TValue, TSourceError, TTargetError>(
  result: Result<TValue, TSourceError>,
  mapper: (error: TSourceError) => TTargetError,
): Result<TValue, TTargetError>;
//# sourceMappingURL=result.d.ts.map
