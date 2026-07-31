'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.MemoryLogSink = exports.StructuredLogger = void 0;
exports.createMemoryLogSink = createMemoryLogSink;
const clock_1 = require('./clock');
const LEVEL_ORDER = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};
/**
 * Provider-agnostic logger implementation based on a pluggable sink.
 */
class StructuredLogger {
  constructor(options) {
    this.loggerId = options.loggerId;
    this.minLevel = options.minLevel ?? 'info';
    this.sink = options.sink;
    this.clock = options.clock ?? new clock_1.SystemClock();
    this.baseContext = options.baseContext;
  }
  child(context) {
    return new StructuredLogger({
      loggerId: this.loggerId,
      minLevel: this.minLevel,
      sink: this.sink,
      clock: this.clock,
      baseContext: {
        ...(this.baseContext ?? {}),
        ...context,
      },
    });
  }
  async log(level, message, context) {
    if (!this.isEnabled(level)) {
      return;
    }
    await this.sink.write({
      loggerId: this.loggerId,
      level,
      message,
      timestamp: this.clock.nowIso(),
      context: this.mergeContext(context),
    });
  }
  trace(message, context) {
    return this.log('trace', message, context);
  }
  debug(message, context) {
    return this.log('debug', message, context);
  }
  info(message, context) {
    return this.log('info', message, context);
  }
  warn(message, context) {
    return this.log('warn', message, context);
  }
  error(message, context) {
    return this.log('error', message, context);
  }
  fatal(message, context) {
    return this.log('fatal', message, context);
  }
  isEnabled(level) {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[this.minLevel];
  }
  mergeContext(context) {
    if (!this.baseContext && !context) {
      return undefined;
    }
    return {
      ...(this.baseContext ?? {}),
      ...(context ?? {}),
    };
  }
}
exports.StructuredLogger = StructuredLogger;
/**
 * In-memory sink used for tests and diagnostics.
 */
class MemoryLogSink {
  constructor() {
    this.recordsInternal = [];
  }
  get records() {
    return this.recordsInternal;
  }
  write(record) {
    this.recordsInternal.push(record);
  }
  clear() {
    this.recordsInternal.length = 0;
  }
}
exports.MemoryLogSink = MemoryLogSink;
/**
 * Factory for memory log sinks.
 */
function createMemoryLogSink() {
  return new MemoryLogSink();
}
//# sourceMappingURL=logger.js.map
