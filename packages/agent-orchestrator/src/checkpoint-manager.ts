import type { Identifier } from '@infrashield/contracts';

import type { ExecutionContext, ExecutionSession } from './execution-context.js';
import { ExecutionCheckpoint } from './execution-checkpoint.js';
import type { ExecutionStateStore } from './execution-state-store.js';

export class CheckpointManager {
  public constructor(private readonly stateStore: ExecutionStateStore) {}

  public createCheckpoint(
    context: ExecutionContext,
    session: ExecutionSession,
    metadata?: Readonly<Record<string, unknown>>,
  ): ExecutionCheckpoint {
    const checkpoint = ExecutionCheckpoint.fromSession(context, session, metadata);
    this.stateStore.saveCheckpoint(checkpoint);
    return checkpoint;
  }

  public save(checkpoint: ExecutionCheckpoint): ExecutionCheckpoint {
    this.stateStore.saveCheckpoint(checkpoint);
    return checkpoint;
  }

  public get(checkpointId: Identifier): ExecutionCheckpoint | undefined {
    return this.stateStore.getCheckpoint(checkpointId);
  }

  public getLatest(workflowId: Identifier): ExecutionCheckpoint | undefined {
    return this.stateStore.getLatestCheckpoint(workflowId);
  }

  public requireLatest(workflowId: Identifier): ExecutionCheckpoint {
    const checkpoint = this.getLatest(workflowId);
    if (!checkpoint) {
      throw new Error(`No checkpoint found for workflow ${workflowId}`);
    }

    return checkpoint;
  }
}
