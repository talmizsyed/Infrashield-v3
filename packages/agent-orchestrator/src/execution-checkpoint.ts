import type { Identifier, TimestampString } from '@infrashield/contracts';

import type { ExecutionContext, ExecutionSession } from './execution-context.js';
import { OrchestrationStatus } from './foundation.js';

export class ExecutionCheckpoint {
  public readonly checkpointId: Identifier;
  public readonly workflowId: Identifier;
  public readonly completedNodeIds: readonly string[];
  public readonly nodeOutputs: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  public readonly status: OrchestrationStatus;
  public readonly metadata: Readonly<Record<string, unknown>>;
  public readonly createdAt: TimestampString;

  public constructor(options: {
    readonly checkpointId: Identifier;
    readonly workflowId: Identifier;
    readonly completedNodeIds: readonly string[];
    readonly nodeOutputs: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
    readonly status: OrchestrationStatus;
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly createdAt?: TimestampString;
  }) {
    this.checkpointId = options.checkpointId;
    this.workflowId = options.workflowId;
    this.completedNodeIds = Object.freeze([...options.completedNodeIds]);
    this.nodeOutputs = Object.freeze({ ...options.nodeOutputs });
    this.status = options.status;
    this.metadata = Object.freeze({ ...(options.metadata ?? {}) });
    this.createdAt = options.createdAt ?? new Date().toISOString();
  }

  public static fromSession(
    context: ExecutionContext,
    session: ExecutionSession,
  ): ExecutionCheckpoint {
    const nodeOutputs: Record<string, Readonly<Record<string, unknown>>> = {};
    for (const [nodeId, output] of context.nodeOutputs.entries()) {
      nodeOutputs[nodeId] = output;
    }

    return new ExecutionCheckpoint({
      checkpointId: `${session.workflowId}-checkpoint-${Date.now()}`,
      workflowId: session.workflowId,
      completedNodeIds: [...session.completedNodeIds],
      nodeOutputs,
      status: session.status,
      metadata: { correlationId: session.correlationId },
    });
  }
}
