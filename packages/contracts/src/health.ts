import type { SerializableValueObject, TimestampString } from './primitives';

/**
 * Health states exposed by runtime and service contracts.
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Individual health indicator for a service or component.
 */
export interface HealthIndicator {
  readonly name: string;
  readonly status: HealthStatus;
  readonly description?: string;
  readonly timestamp: TimestampString;
  readonly details?: SerializableValueObject;
}

/**
 * Aggregated health report for a runtime or service boundary.
 */
export interface HealthReport {
  readonly overallStatus: HealthStatus;
  readonly components: readonly HealthIndicator[];
  readonly timestamp: TimestampString;
}
