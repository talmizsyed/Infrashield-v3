import type { BaseError } from './errors';

/**
 * Successful result for a kernel operation.
 */
export interface SuccessResult<T> {
  readonly succeeded: true;
  readonly data: T;
  readonly message?: string;
}

/**
 * Failed result for a kernel operation.
 */
export interface FailureResult {
  readonly succeeded: false;
  readonly error: BaseError;
  readonly message?: string;
}

/**
 * Outcome contract for operations that can succeed or fail.
 */
export type Result<T> = SuccessResult<T> | FailureResult;
