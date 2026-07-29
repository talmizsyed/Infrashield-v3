import type { IExponentialRetryPolicy, IFixedRetryPolicy, IRetryPolicy } from '@agentic/sdk';

import type { CancellationToken } from './cancellation.js';

/**
 * Retry strategy contract.
 */
export interface RetryStrategy {
  readonly name: string;
  readonly maxAttempts: number;
  delayMs(attempt: number): number;
  shouldRetry(attempt: number): boolean;
}

class NoRetryStrategy implements RetryStrategy {
  public readonly name = 'no-retry';
  public readonly maxAttempts = 1;

  public delayMs(): number {
    return 0;
  }

  public shouldRetry(): boolean {
    return false;
  }
}

class FixedRetryStrategy implements RetryStrategy {
  public readonly name = 'fixed-retry';

  public constructor(
    public readonly maxAttempts: number,
    private readonly delay: number,
  ) {}

  public delayMs(): number {
    return this.delay;
  }

  public shouldRetry(attempt: number): boolean {
    return attempt < this.maxAttempts;
  }
}

class ExponentialRetryStrategy implements RetryStrategy {
  public readonly name = 'exponential-retry';

  public constructor(
    public readonly maxAttempts: number,
    private readonly initialDelay: number,
    private readonly multiplier: number,
    private readonly maxDelay?: number,
  ) {}

  public delayMs(attempt: number): number {
    const delay = Math.floor(this.initialDelay * this.multiplier ** Math.max(attempt - 1, 0));
    return typeof this.maxDelay === 'number' ? Math.min(delay, this.maxDelay) : delay;
  }

  public shouldRetry(attempt: number): boolean {
    return attempt < this.maxAttempts;
  }
}

/**
 * Creates a retry strategy from a retry policy contract.
 */
export function createRetryStrategy(policy?: IRetryPolicy): RetryStrategy {
  if (!policy || policy.kind === 'none') {
    return new NoRetryStrategy();
  }

  if (policy.kind === 'fixed') {
    const fixedPolicy = policy as IFixedRetryPolicy;
    return new FixedRetryStrategy(Math.max(1, fixedPolicy.maxAttempts), fixedPolicy.delayMs);
  }

  if (policy.kind === 'exponential') {
    const exponentialPolicy = policy as IExponentialRetryPolicy;
    return new ExponentialRetryStrategy(
      Math.max(1, exponentialPolicy.maxAttempts),
      exponentialPolicy.initialDelayMs,
      exponentialPolicy.multiplier,
      exponentialPolicy.maxDelayMs,
    );
  }

  if (policy.kind === 'linear') {
    const linearPolicy = policy as import('@agentic/sdk').ILinearRetryPolicy;
    return new FixedRetryStrategy(
      Math.max(1, linearPolicy.maxAttempts),
      linearPolicy.initialDelayMs,
    );
  }

  return new NoRetryStrategy();
}

/**
 * Executes operations with a retry strategy and cancellation safety.
 */
export class RetryManager {
  public async execute<T>(
    operation: () => Promise<T>,
    policy?: IRetryPolicy,
    cancellationToken?: CancellationToken,
  ): Promise<T> {
    const strategy = createRetryStrategy(policy);
    let attempt = 1;
    let lastError: unknown;

    while (attempt <= strategy.maxAttempts) {
      cancellationToken?.throwIfCancellationRequested();

      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (!strategy.shouldRetry(attempt) || attempt === strategy.maxAttempts) {
          throw error;
        }

        const delay = strategy.delayMs(attempt + 1);
        if (delay > 0) {
          await this.sleep(delay, cancellationToken);
        }
      }

      attempt += 1;
    }

    throw lastError instanceof Error ? lastError : new Error('Retry operation failed');
  }

  private async sleep(ms: number, cancellationToken?: CancellationToken): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        resolve();
      }, ms);

      cancellationToken?.onCancellationRequested((reason) => {
        clearTimeout(timeout);
        reject(new Error(reason ?? 'Operation cancelled during retry delay'));
      });
    });
  }
}
