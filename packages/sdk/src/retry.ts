import type { Identifier, SerializableValueObject, TimestampString } from '@infrashield/contracts';

/**
 * Retry policy kinds supported by the SDK.
 */
export type RetryPolicyKind = 'none' | 'fixed' | 'linear' | 'exponential' | 'circuitBreaker';

/**
 * Retry attempt context used by policy evaluation contracts.
 */
export interface IRetryContext {
  readonly executionId: Identifier;
  readonly attempt: number;
  readonly timestamp: TimestampString;
  readonly error?: SerializableValueObject;
  readonly metadata?: SerializableValueObject;
}

/**
 * Base retry policy contract.
 */
export interface IRetryPolicy {
  readonly policyId: Identifier;
  readonly name: string;
  readonly kind: RetryPolicyKind;
  readonly description?: string;
  readonly maxAttempts: number;

  evaluate(context: IRetryContext): Promise<boolean> | boolean;
}

/**
 * Policy contract that disables retries.
 */
export interface INoRetryPolicy extends IRetryPolicy {
  readonly kind: 'none';
}

/**
 * Policy contract that retries with a fixed delay.
 */
export interface IFixedRetryPolicy extends IRetryPolicy {
  readonly kind: 'fixed';
  readonly delayMs: number;
}

/**
 * Policy contract that retries with a linear delay increment.
 */
export interface ILinearRetryPolicy extends IRetryPolicy {
  readonly kind: 'linear';
  readonly initialDelayMs: number;
  readonly incrementMs: number;
}

/**
 * Policy contract that retries with exponential backoff.
 */
export interface IExponentialRetryPolicy extends IRetryPolicy {
  readonly kind: 'exponential';
  readonly initialDelayMs: number;
  readonly multiplier: number;
  readonly maxDelayMs?: number;
}

/**
 * Policy contract that protects downstream systems with circuit breaking.
 */
export interface ICircuitBreakerPolicy extends IRetryPolicy {
  readonly kind: 'circuitBreaker';
  readonly failureThreshold: number;
  readonly recoveryTimeoutMs: number;
  readonly halfOpenMaxAttempts?: number;
}
