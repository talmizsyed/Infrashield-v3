import type { TimestampString } from './primitives';
import { toTimestampString } from './primitives';

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
export class SystemClock implements IClock {
  public now(): Date {
    return new Date();
  }

  public nowIso(): TimestampString {
    return toTimestampString(this.now().toISOString());
  }
}

/**
 * Fixed clock for deterministic behavior in tests.
 */
export class FixedClock implements IClock {
  public constructor(private readonly fixedDate: Date) {}

  public now(): Date {
    return new Date(this.fixedDate);
  }

  public nowIso(): TimestampString {
    return toTimestampString(this.now().toISOString());
  }
}

/**
 * Clock wrapper that offsets another clock.
 */
export class OffsetClock implements IClock {
  public constructor(
    private readonly baseClock: IClock,
    private readonly offsetMs: number,
  ) {}

  public now(): Date {
    return new Date(this.baseClock.now().getTime() + this.offsetMs);
  }

  public nowIso(): TimestampString {
    return toTimestampString(this.now().toISOString());
  }
}
