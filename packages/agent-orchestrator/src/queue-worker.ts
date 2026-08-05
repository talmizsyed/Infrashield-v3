import type { Identifier } from '@infrashield/contracts';

import { ExecutionDispatcher, type ExecutionDispatchResult } from './execution-dispatcher.js';
import type { ScheduledExecution } from './execution-scheduler.js';
import { ExecutionQueue } from './execution-scheduler.js';

export class QueueWorker<T = unknown> {
  public constructor(
    private readonly queue: ExecutionQueue,
    private readonly dispatcher: ExecutionDispatcher<T>,
  ) {}

  public async processNext(options?: {
    readonly now?: number;
    readonly signal?: AbortSignal;
  }): Promise<ExecutionDispatchResult | undefined> {
    const item = this.queue.dequeueReady(options?.now);
    if (!item) {
      return undefined;
    }

    return this.dispatcher.dispatch(item, { signal: options?.signal });
  }

  public async drain(options?: {
    readonly now?: number;
    readonly signal?: AbortSignal;
  }): Promise<readonly ExecutionDispatchResult[]> {
    const results: ExecutionDispatchResult[] = [];
    let result = await this.processNext(options);
    while (result) {
      results.push(result);
      result = await this.processNext(options);
    }
    return Object.freeze(results);
  }

  public cancel(workflowId: Identifier, reason = 'Execution cancelled'): boolean {
    return this.queue.cancel(workflowId, reason);
  }

  public peek(): ScheduledExecution | undefined {
    return this.queue.peek();
  }
}
