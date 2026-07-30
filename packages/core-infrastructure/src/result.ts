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
export function ok<TValue>(data: TValue): Success<TValue> {
  return {
    succeeded: true,
    data,
  };
}

/**
 * Creates a failed result.
 */
export function fail<TError>(error: TError): Failure<TError> {
  return {
    succeeded: false,
    error,
  };
}

/**
 * Type guard for success results.
 */
export function isSuccess<TValue, TError>(
  result: Result<TValue, TError>,
): result is Success<TValue> {
  return result.succeeded;
}

/**
 * Type guard for failure results.
 */
export function isFailure<TValue, TError>(
  result: Result<TValue, TError>,
): result is Failure<TError> {
  return !result.succeeded;
}

/**
 * Maps a successful result value.
 */
export function mapResult<TSource, TTarget, TError>(
  result: Result<TSource, TError>,
  mapper: (value: TSource) => TTarget,
): Result<TTarget, TError> {
  if (isFailure(result)) {
    return result;
  }

  return ok(mapper(result.data));
}

/**
 * Maps a failed result error.
 */
export function mapError<TValue, TSourceError, TTargetError>(
  result: Result<TValue, TSourceError>,
  mapper: (error: TSourceError) => TTargetError,
): Result<TValue, TTargetError> {
  if (isSuccess(result)) {
    return result;
  }

  return fail(mapper(result.error));
}
