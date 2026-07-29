import type { SerializableValueObject, TimestampString } from '@infrashield/contracts';

/**
 * Standard health state contract for SDK-managed components.
 */
export interface IHealthStatus {
  readonly status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  readonly checkedAt: TimestampString;
  readonly message?: string;
  readonly details?: SerializableValueObject;
}

/**
 * Cooperative cancellation token used to stop long-running operations without leaking transport details.
 */
export interface ICancellationToken {
  readonly isCancellationRequested: boolean;
  readonly reason?: string;
  throwIfCancellationRequested(): void;
  onCancellationRequested(listener: (reason?: string) => void | Promise<void>): () => void;
}
