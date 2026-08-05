import type { CorrelationId, Identifier, TimestampString } from '@infrashield/contracts';

import type { ExecutionGraph } from './execution-graph.js';
import type { ExecutionPlan } from './execution-planner.js';
import { OrchestrationStatus, ScheduleTrigger } from './foundation.js';
import type { OrchestrationNodeResult, OrchestrationRunRequest } from './foundation.js';

export class ExecutionContext {
  public readonly workflowId: Identifier;
  public readonly correlationId: CorrelationId;
  public readonly graph: ExecutionGraph;
  public readonly plan: ExecutionPlan;
  public readonly request: OrchestrationRunRequest;
  public readonly nodeOutputs: Map<string, Readonly<Record<string, unknown>>>;
  public readonly metadata: Readonly<Record<string, unknown>>;
  public readonly createdAt: TimestampString;

  public constructor(options: {
    readonly workflowId: Identifier;
    readonly correlationId: CorrelationId;
    readonly graph: ExecutionGraph;
    readonly plan: ExecutionPlan;
    readonly request: OrchestrationRunRequest;
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly createdAt?: TimestampString;
  }) {
    this.workflowId = options.workflowId;
    this.correlationId = options.correlationId;
    this.graph = options.graph;
    this.plan = options.plan;
    this.request = options.request;
    this.nodeOutputs = new Map();
    this.metadata = Object.freeze({ ...(options.metadata ?? options.request.metadata ?? {}) });
    this.createdAt = options.createdAt ?? new Date().toISOString();
  }

  public setNodeOutput(nodeId: string, output: Readonly<Record<string, unknown>>): void {
    this.nodeOutputs.set(nodeId, Object.freeze({ ...output }));
  }

  public getNodeOutput(nodeId: string): Readonly<Record<string, unknown>> | undefined {
    return this.nodeOutputs.get(nodeId);
  }

  public evaluateCondition(condition: string | undefined): boolean {
    if (!condition) {
      return true;
    }
    if (condition === 'always') {
      return true;
    }
    if (condition === 'never') {
      return false;
    }
    if (condition.startsWith('output:')) {
      const [, nodeId, key] = condition.split(':');
      if (!nodeId || !key) {
        return false;
      }
      const output = this.getNodeOutput(nodeId);
      return Boolean(output?.[key]);
    }
    return true;
  }
}

export class ExecutionSession {
  public readonly workflowId: Identifier;
  public readonly graphId: string;
  public readonly correlationId: CorrelationId;
  public status: OrchestrationStatus;
  public readonly scheduleTrigger: ScheduleTrigger;
  public readonly nodeResults: OrchestrationNodeResult[];
  public readonly completedNodeIds: string[];
  public readonly failedNodeIds: string[];
  public readonly retryHistory: Array<{
    readonly nodeId: string;
    readonly attempt: number;
    readonly reason: string;
    readonly timestamp: TimestampString;
  }>;
  public readonly logs: string[];
  public readonly metadata: Readonly<Record<string, unknown>>;
  public readonly createdAt: TimestampString;
  public updatedAt: TimestampString;
  public startedAt?: TimestampString;
  public completedAt?: TimestampString;
  public currentCheckpointId?: Identifier;
  public approvalRequired: boolean;
  public approved: boolean;

  public constructor(options: {
    readonly workflowId: Identifier;
    readonly graphId: string;
    readonly correlationId: CorrelationId;
    readonly scheduleTrigger?: ScheduleTrigger;
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly approvalRequired?: boolean;
    readonly createdAt?: TimestampString;
  }) {
    this.workflowId = options.workflowId;
    this.graphId = options.graphId;
    this.correlationId = options.correlationId;
    this.status = OrchestrationStatus.Pending;
    this.scheduleTrigger = options.scheduleTrigger ?? ScheduleTrigger.Immediate;
    this.nodeResults = [];
    this.completedNodeIds = [];
    this.failedNodeIds = [];
    this.retryHistory = [];
    this.logs = [];
    this.metadata = Object.freeze({ ...(options.metadata ?? {}) });
    this.createdAt = options.createdAt ?? new Date().toISOString();
    this.updatedAt = this.createdAt;
    this.approvalRequired = options.approvalRequired ?? false;
    this.approved = !this.approvalRequired;
  }

  public appendLog(message: string): void {
    this.logs.push(`${new Date().toISOString()} ${message}`);
    this.updatedAt = new Date().toISOString();
  }

  public recordNodeResult(result: OrchestrationNodeResult): void {
    this.nodeResults.push(result);
    if (result.status === OrchestrationStatus.Completed) {
      this.completedNodeIds.push(result.nodeId);
    }
    if (result.status === OrchestrationStatus.Failed) {
      this.failedNodeIds.push(result.nodeId);
    }
    this.updatedAt = new Date().toISOString();
  }

  public recordRetry(nodeId: string, attempt: number, reason: string): void {
    this.retryHistory.push({
      nodeId,
      attempt,
      reason,
      timestamp: new Date().toISOString(),
    });
    this.updatedAt = new Date().toISOString();
  }

  public transition(status: OrchestrationStatus): void {
    this.status = status;
    this.updatedAt = new Date().toISOString();
    if (status === OrchestrationStatus.Running && !this.startedAt) {
      this.startedAt = this.updatedAt;
    }
    if (
      status === OrchestrationStatus.Completed ||
      status === OrchestrationStatus.Failed ||
      status === OrchestrationStatus.Cancelled ||
      status === OrchestrationStatus.RolledBack
    ) {
      this.completedAt = this.updatedAt;
    }
  }
}
