'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.ok = ok;
exports.fail = fail;
exports.isSuccess = isSuccess;
exports.isFailure = isFailure;
exports.mapResult = mapResult;
exports.mapError = mapError;
/**
 * Creates a successful result.
 */
function ok(data) {
  return {
    succeeded: true,
    data,
  };
}
/**
 * Creates a failed result.
 */
function fail(error) {
  return {
    succeeded: false,
    error,
  };
}
/**
 * Type guard for success results.
 */
function isSuccess(result) {
  return result.succeeded;
}
/**
 * Type guard for failure results.
 */
function isFailure(result) {
  return !result.succeeded;
}
/**
 * Maps a successful result value.
 */
function mapResult(result, mapper) {
  if (isFailure(result)) {
    return result;
  }
  return ok(mapper(result.data));
}
/**
 * Maps a failed result error.
 */
function mapError(result, mapper) {
  if (isSuccess(result)) {
    return result;
  }
  return fail(mapper(result.error));
}
//# sourceMappingURL=result.js.map
