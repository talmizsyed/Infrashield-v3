import type { Identifier, TimestampString } from '@infrashield/contracts';

import type { ScheduledExecution } from './execution-scheduler.js';
import { OrchestrationStatus } from './foundation.js';
import { RetryPolicy } from './retry-policy.js';

export interface ExecutionDispatchResult {
  readonly workflowId: Identifier;
  readonly status: OrchestrationStatus;
  readonly attempts: number;
  readonly startedAt: TimestampString;
  readonly completedAt: TimestampString;
  readonly result?: unknown;
  readonly error?: string;
  readonly timedOut: boolean;
  readonly cancelled: boolean;
}

export type QueueExecutionHandler<T = unknown> = (
  item: ScheduledExecution,
  attempt: number,
) => Promise<T>;

export interface ExecutionDispatcherOptions<T = unknown> {
  readonly handler?: QueueExecutionHandler<T>;
  readonly retryPolicy?: RetryPolicy;
  readonly timeoutMs?: number;
}

export class ExecutionDispatcher<T = unknown> {
  private readonly handler: QueueExecutionHandler<T>;
  private readonly retryPolicy: RetryPolicy;
  private readonly timeoutMs: number;

  public constructor(handler?: QueueExecutionHandler<T>);
  public constructor(options?: ExecutionDispatcherOptions<T>);
  public constructor(handlerOrOptions?: QueueExecutionHandler<T> | ExecutionDispatcherOptions<T>) {
    if (typeof handlerOrOptions === 'function') {
      this.handler = handlerOrOptions;
      this.retryPolicy = new RetryPolicy();
      this.timeoutMs = 0;
      return;
    }

    this.handler = handlerOrOptions?.handler ?? (async (item) => item as T);
    this.retryPolicy = handlerOrOptions?.retryPolicy ?? new RetryPolicy();
    this.timeoutMs = handlerOrOptions?.timeoutMs ?? 0;
  }

  public async dispatch(
    item: ScheduledExecution,
    options?: { readonly signal?: AbortSignal; readonly now?: TimestampString },
  ): Promise<ExecutionDispatchResult> {
    const startedAt = new Date().toISOString();
    const signal = options?.signal;
    const timeoutMs = item.timeoutMs ?? this.timeoutMs ?? 0;
    const retryPolicy = item.retryPolicy ?? this.retryPolicy;
    const maxAttempts = Math.max(1, item.maxAttempts ?? retryPolicy.maxAttempts);

    if (signal?.aborted || item.cancelledAt) {
      const completedAt = new Date().toISOString();
      return {
        workflowId: item.workflowId,
        status: OrchestrationStatus.Cancelled,
        attempts: item.attempts ?? 0,
        startedAt,
        completedAt,
        error: item.cancelledReason ?? 'Execution cancelled',
        timedOut: false,
        cancelled: true,
      };
    }

    let lastError: string | undefined;
    let timedOut = false;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (signal?.aborted || item.cancelledAt) {
        const completedAt = new Date().toISOString();
        return {
          workflowId: item.workflowId,
          status: OrchestrationStatus.Cancelled,
          attempts: attempt - 1,
          startedAt,
          completedAt,
          error: item.cancelledReason ?? 'Execution cancelled',
          timedOut: false,
          cancelled: true,
        };
      }

      item.attempts = attempt;
      item.status = OrchestrationStatus.Running;

      try {
        const result =
          timeoutMs > 0
            ? await this.withTimeout(this.handler(item, attempt), timeoutMs, signal)
            : await this.handler(item, attempt);

        item.status = OrchestrationStatus.Completed;
        const completedAt = new Date().toISOString();
        item.completedAt = completedAt;
        item.result = result as Readonly<Record<string, unknown>>;

        return {
          workflowId: item.workflowId,
          status: OrchestrationStatus.Completed,
          attempts: attempt,
          startedAt,
          completedAt,
          result,
          timedOut: false,
          cancelled: false,
        };
      } catch (error) {
        if (signal?.aborted || item.cancelledAt) {
          const completedAt = new Date().toISOString();
          return {
            workflowId: item.workflowId,
            status: OrchestrationStatus.Cancelled,
            attempts: attempt,
            startedAt,
            completedAt,
            error: item.cancelledReason ?? 'Execution cancelled',
            timedOut: false,
            cancelled: true,
          };
        }

        const message = error instanceof Error ? error.message : 'Execution failed';
        lastError = message;
        timedOut = message === 'Execution timed out';
        item.lastError = message;

        if (!retryPolicy.canRetry(attempt) || item.cancelledAt) {
          break;
        }

        const delayMs = item.delayMs ?? retryPolicy.getDelayMs();
        if (delayMs > 0) {
          await this.sleep(delayMs, signal);
        }
      }
    }

    const completedAt = new Date().toISOString();
    item.completedAt = completedAt;
    item.status = OrchestrationStatus.Failed;

    return {
      workflowId: item.workflowId,
      status: OrchestrationStatus.Failed,
      attempts: item.attempts ?? maxAttempts,
      startedAt,
      completedAt,
      error: lastError ?? 'Execution failed',
      timedOut,
      cancelled: false,
    };
  }

  private async withTimeout(work: Promise<T>, timeoutMs: number, signal?: AbortSignal): Promise<T> {
    if (timeoutMs <= 0) {
      return work;
    }

    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Execution timed out'));
      }, timeoutMs);

      const abortHandler = (): void => {
        clearTimeout(timeoutId);
        reject(new Error('Execution cancelled'));
      };

      if (signal) {
        if (signal.aborted) {
          abortHandler();
          return;
        }
        signal.addEventListener('abort', abortHandler, { once: true });
      }

      work
        .then((result) => {
          clearTimeout(timeoutId);
          if (signal) {
            signal.removeEventListener('abort', abortHandler);
          }
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          if (signal) {
            signal.removeEventListener('abort', abortHandler);
          }
          reject(error);
        });
    });
  }

  private async sleep(delayMs: number, signal?: AbortSignal): Promise<void> {
    if (delayMs <= 0) {
      return;
    }

    await new Promise<void>((resolve) => {
      const timeoutId = setTimeout(() => {
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        }
        resolve();
      }, delayMs);

      const onAbort = (): void => {
        clearTimeout(timeoutId);
        resolve();
      };

      if (signal) {
        if (signal.aborted) {
          onAbort();
          return;
        }
        signal.addEventListener('abort', onAbort, { once: true });
      }
    });
  }
}
