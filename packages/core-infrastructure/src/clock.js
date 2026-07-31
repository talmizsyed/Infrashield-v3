'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.OffsetClock = exports.FixedClock = exports.SystemClock = void 0;
const primitives_1 = require('./primitives');
/**
 * Uses the platform system clock.
 */
class SystemClock {
  now() {
    return new Date();
  }
  nowIso() {
    return (0, primitives_1.toTimestampString)(this.now().toISOString());
  }
}
exports.SystemClock = SystemClock;
/**
 * Fixed clock for deterministic behavior in tests.
 */
class FixedClock {
  constructor(fixedDate) {
    this.fixedDate = fixedDate;
  }
  now() {
    return new Date(this.fixedDate);
  }
  nowIso() {
    return (0, primitives_1.toTimestampString)(this.now().toISOString());
  }
}
exports.FixedClock = FixedClock;
/**
 * Clock wrapper that offsets another clock.
 */
class OffsetClock {
  constructor(baseClock, offsetMs) {
    this.baseClock = baseClock;
    this.offsetMs = offsetMs;
  }
  now() {
    return new Date(this.baseClock.now().getTime() + this.offsetMs);
  }
  nowIso() {
    return (0, primitives_1.toTimestampString)(this.now().toISOString());
  }
}
exports.OffsetClock = OffsetClock;
//# sourceMappingURL=clock.js.map
