import type { Identifier } from '@infrashield/contracts';

import type { ExecutionSession } from './execution-context.js';
import { ExecutionCheckpoint } from './execution-checkpoint.js';
import type { ExecutionPlan } from './execution-planner.js';
import type { OrchestrationRunRequest, OrchestrationRunResult } from './foundation.js';
import type { OrchestrationSessionSnapshot } from './foundation.js';

export class ExecutionStateStore {
  private readonly sessions = new Map<Identifier, ExecutionSession>();
  private readonly requests = new Map<Identifier, OrchestrationRunRequest>();
  private readonly plans = new Map<Identifier, ExecutionPlan>();
  private readonly results = new Map<Identifier, OrchestrationRunResult>();
  private readonly checkpoints = new Map<Identifier, ExecutionCheckpoint>();
  private readonly outputs = new Map<Identifier, Readonly<Record<string, unknown>>>();

  public saveSession(session: ExecutionSession): void {
    this.sessions.set(session.workflowId, session);
  }

  public getSession(workflowId: Identifier): ExecutionSession | undefined {
    return this.sessions.get(workflowId);
  }

  public listSessions(): readonly ExecutionSession[] {
    return Object.freeze([...this.sessions.values()]);
  }

  public saveRequest(workflowId: Identifier, request: OrchestrationRunRequest): void {
    this.requests.set(workflowId, request);
  }

  public getRequest(workflowId: Identifier): OrchestrationRunRequest | undefined {
    return this.requests.get(workflowId);
  }

  public savePlan(workflowId: Identifier, plan: ExecutionPlan): void {
    this.plans.set(workflowId, plan);
  }

  public getPlan(workflowId: Identifier): ExecutionPlan | undefined {
    return this.plans.get(workflowId);
  }

  public saveResult(result: OrchestrationRunResult): void {
    this.results.set(result.workflowId, result);
  }

  public getResult(workflowId: Identifier): OrchestrationRunResult | undefined {
    return this.results.get(workflowId);
  }

  public saveCheckpoint(checkpoint: ExecutionCheckpoint): void {
    this.checkpoints.set(checkpoint.checkpointId, checkpoint);
    const session = this.sessions.get(checkpoint.workflowId);
    if (session) {
      session.currentCheckpointId = checkpoint.checkpointId;
    }
  }

  public getCheckpoint(checkpointId: Identifier): ExecutionCheckpoint | undefined {
    return this.checkpoints.get(checkpointId);
  }

  public getLatestCheckpoint(workflowId: Identifier): ExecutionCheckpoint | undefined {
    const checkpoints = [...this.checkpoints.values()]
      .filter((checkpoint) => checkpoint.workflowId === workflowId)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return checkpoints[0];
  }

  public saveOutput(workflowId: Identifier, output: Readonly<Record<string, unknown>>): void {
    this.outputs.set(workflowId, Object.freeze({ ...output }));
  }

  public getOutput(workflowId: Identifier): Readonly<Record<string, unknown>> | undefined {
    return this.outputs.get(workflowId);
  }

  public toSnapshot(session: ExecutionSession): OrchestrationSessionSnapshot {
    const plan = this.plans.get(session.workflowId);
    const allNodeIds = plan?.topologicalOrder ?? [];
    const pendingNodeIds = allNodeIds.filter(
      (nodeId) =>
        !session.completedNodeIds.includes(nodeId) && !session.failedNodeIds.includes(nodeId),
    );

    return {
      workflowId: session.workflowId,
      graphId: session.graphId,
      status: session.status,
      correlationId: session.correlationId,
      completedNodeIds: Object.freeze([...session.completedNodeIds]),
      failedNodeIds: Object.freeze([...session.failedNodeIds]),
      pendingNodeIds: Object.freeze([...pendingNodeIds]),
      metadata: session.metadata,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }
}
