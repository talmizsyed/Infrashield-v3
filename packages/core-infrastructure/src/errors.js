'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.CoreError = exports.ErrorSeverity = void 0;
exports.createError = createError;
exports.isInfrastructureError = isInfrastructureError;
const primitives_1 = require('./primitives');
/**
 * Error severity levels for infrastructure concerns.
 */
var ErrorSeverity;
(function (ErrorSeverity) {
  ErrorSeverity['Info'] = 'info';
  ErrorSeverity['Warning'] = 'warning';
  ErrorSeverity['Error'] = 'error';
  ErrorSeverity['Critical'] = 'critical';
})(ErrorSeverity || (exports.ErrorSeverity = ErrorSeverity = {}));
/**
 * Generic infrastructure error implementation.
 */
class CoreError extends Error {
  constructor(input) {
    super(input.message);
    this.name = 'CoreError';
    this.code = input.code;
    this.severity = input.severity ?? ErrorSeverity.Error;
    this.details = input.details;
    this.cause = input.cause;
    this.timestamp = (0, primitives_1.toTimestampString)(
      (input.timestamp ?? new Date()).toISOString(),
    );
  }
}
exports.CoreError = CoreError;
/**
 * Creates a normalized infrastructure error instance.
 */
function createError(input) {
  return new CoreError(input);
}
/**
 * Type guard for infrastructure errors.
 */
function isInfrastructureError(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const maybeError = value;
  return (
    typeof maybeError.code === 'string' &&
    typeof maybeError.message === 'string' &&
    typeof maybeError.timestamp === 'string'
  );
}
//# sourceMappingURL=errors.js.map
