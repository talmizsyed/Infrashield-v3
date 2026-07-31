'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.DefaultIdFactory = void 0;
exports.toIdentifier = toIdentifier;
exports.toCorrelationId = toCorrelationId;
exports.toTraceId = toTraceId;
exports.toTimestampString = toTimestampString;
/**
 * Creates a branded infrastructure identifier from a string.
 */
function toIdentifier(value) {
  return value;
}
/**
 * Creates a branded correlation identifier from a string.
 */
function toCorrelationId(value) {
  return value;
}
/**
 * Creates a branded trace identifier from a string.
 */
function toTraceId(value) {
  return value;
}
/**
 * Creates a branded timestamp string from a string.
 */
function toTimestampString(value) {
  return value;
}
/**
 * Deterministic ID factory that remains provider-agnostic.
 */
class DefaultIdFactory {
  constructor(options = {}) {
    this.counter = options.seed ?? 0;
    this.prefix = options.prefix ?? 'id';
  }
  create(namespace = 'default') {
    this.counter += 1;
    const value = `${this.prefix}.${namespace}.${this.counter.toString(36)}`;
    return toIdentifier(value);
  }
  createCorrelationId() {
    return toCorrelationId(this.create('correlation'));
  }
  createTraceId() {
    return toTraceId(this.create('trace'));
  }
}
exports.DefaultIdFactory = DefaultIdFactory;
//# sourceMappingURL=primitives.js.map
