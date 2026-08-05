import type { TimestampString } from '@infrashield/contracts';

import { OrchestrationStatus } from './foundation.js';

export class ExecutionState {
  public readonly status: OrchestrationStatus;
  public readonly history: readonly OrchestrationStatus[];
  public readonly updatedAt: TimestampString;

  public constructor(options: {
    readonly status: OrchestrationStatus;
    readonly history?: readonly OrchestrationStatus[];
    readonly updatedAt?: TimestampString;
  }) {
    this.status = options.status;
    this.history = Object.freeze([...(options.history ?? [options.status])]);
    this.updatedAt = options.updatedAt ?? new Date().toISOString();
  }

  public transition(status: OrchestrationStatus): ExecutionState {
    return new ExecutionState({
      status,
      history: [...this.history, status],
    });
  }
}
