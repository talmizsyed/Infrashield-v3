'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.StaticConfigurationProvider = void 0;
exports.createConfigurationProvider = createConfigurationProvider;
const errors_1 = require('./errors');
const result_1 = require('./result');
/**
 * Configuration provider backed by an immutable in-memory map.
 */
class StaticConfigurationProvider {
  constructor(values) {
    this.values = Object.freeze({ ...values });
  }
  has(key) {
    return Object.prototype.hasOwnProperty.call(this.values, key);
  }
  get(key) {
    const value = this.values[key];
    return value;
  }
  getRequired(key) {
    const value = this.get(key);
    if (typeof value === 'undefined') {
      return (0, result_1.fail)(
        (0, errors_1.createError)({
          code: 'configuration.missing',
          message: `Missing required configuration value: ${key}`,
          severity: errors_1.ErrorSeverity.Error,
          details: { key },
        }),
      );
    }
    return (0, result_1.ok)(value);
  }
  snapshot() {
    return this.values;
  }
}
exports.StaticConfigurationProvider = StaticConfigurationProvider;
/**
 * Factory function for static configuration providers.
 */
function createConfigurationProvider(values) {
  return new StaticConfigurationProvider(values);
}
//# sourceMappingURL=configuration.js.map
