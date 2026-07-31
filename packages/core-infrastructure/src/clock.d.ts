import type { TimestampString } from './primitives';
/**
 * Clock abstraction for deterministic and provider-agnostic time access.
 */
export interface IClock {
  now(): Date;
  nowIso(): TimestampString;
}
/**
 * Uses the platform system clock.
 */
export declare class SystemClock implements IClock {
  now(): Date;
  nowIso(): TimestampString;
}
/**
 * Fixed clock for deterministic behavior in tests.
 */
export declare class FixedClock implements IClock {
  private readonly fixedDate;
  constructor(fixedDate: Date);
  now(): Date;
  nowIso(): TimestampString;
}
/**
 * Clock wrapper that offsets another clock.
 */
export declare class OffsetClock implements IClock {
  private readonly baseClock;
  private readonly offsetMs;
  constructor(baseClock: IClock, offsetMs: number);
  now(): Date;
  nowIso(): TimestampString;
}
//# sourceMappingURL=clock.d.ts.map
