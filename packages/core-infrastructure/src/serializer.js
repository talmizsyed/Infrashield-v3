'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.JsonSerializer = void 0;
const errors_1 = require('./errors');
const result_1 = require('./result');
/**
 * JSON serializer implementation.
 */
class JsonSerializer {
  serialize(value) {
    return JSON.stringify(value);
  }
  deserialize(value) {
    return JSON.parse(value);
  }
  safeSerialize(value) {
    try {
      return (0, result_1.ok)(this.serialize(value));
    } catch (cause) {
      return (0, result_1.fail)(
        (0, errors_1.createError)({
          code: 'serializer.serialize_failed',
          message: 'Failed to serialize value.',
          severity: errors_1.ErrorSeverity.Error,
          cause,
        }),
      );
    }
  }
  safeDeserialize(value) {
    try {
      return (0, result_1.ok)(this.deserialize(value));
    } catch (cause) {
      return (0, result_1.fail)(
        (0, errors_1.createError)({
          code: 'serializer.deserialize_failed',
          message: 'Failed to deserialize value.',
          severity: errors_1.ErrorSeverity.Error,
          cause,
          details: { value },
        }),
      );
    }
  }
}
exports.JsonSerializer = JsonSerializer;
//# sourceMappingURL=serializer.js.map
