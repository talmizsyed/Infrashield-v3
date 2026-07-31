'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.OptionsBuilder = exports.Options = void 0;
exports.mergeOptions = mergeOptions;
exports.createOptionsValidator = createOptionsValidator;
const errors_1 = require('./errors');
const result_1 = require('./result');
/**
 * Options wrapper implementation.
 */
class Options {
  constructor(value) {
    this.value = Object.freeze({ ...value });
  }
}
exports.Options = Options;
/**
 * Builder for provider-agnostic options assembly.
 */
class OptionsBuilder {
  constructor(defaults) {
    this.validators = [];
    this.overrides = {};
    this.defaults = { ...defaults };
  }
  override(values) {
    this.overrides = {
      ...this.overrides,
      ...values,
    };
    return this;
  }
  addValidator(validator) {
    this.validators.push(validator);
    return this;
  }
  build() {
    const merged = mergeOptions(this.defaults, this.overrides);
    for (const validator of this.validators) {
      const validation = validator.validate(merged);
      if (!validation.succeeded) {
        return validation;
      }
    }
    return (0, result_1.ok)(merged);
  }
  create() {
    const result = this.build();
    if (!result.succeeded) {
      return result;
    }
    return (0, result_1.ok)(new Options(result.data));
  }
}
exports.OptionsBuilder = OptionsBuilder;
/**
 * Merges defaults and overrides using shallow object composition.
 */
function mergeOptions(defaults, overrides) {
  return {
    ...defaults,
    ...(overrides ?? {}),
  };
}
/**
 * Creates a validator from a predicate and an error message.
 */
function createOptionsValidator(predicate, input) {
  return {
    validate(options) {
      if (predicate(options)) {
        return (0, result_1.ok)(undefined);
      }
      return (0, result_1.fail)(
        (0, errors_1.createError)({
          code: input.code,
          message: input.message,
          severity: input.severity ?? errors_1.ErrorSeverity.Error,
        }),
      );
    },
  };
}
//# sourceMappingURL=options.js.map
