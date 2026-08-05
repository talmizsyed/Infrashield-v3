import type { CorrelationId, Identifier, TimestampString } from '@infrashield/contracts';

export enum OrchestrationStatus {
  Pending = 'pending',
  Planned = 'planned',
  AwaitingApproval = 'awaiting-approval',
  Queued = 'queued',
  Scheduled = 'scheduled',
  Running = 'running',
  Paused = 'paused',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
  Retrying = 'retrying',
  RolledBack = 'rolled-back',
}

export enum NodeExecutionMode {
  Sequential = 'sequential',
  Parallel = 'parallel',
  Conditional = 'conditional',
  FanOut = 'fan-out',
  FanIn = 'fan-in',
  Loop = 'loop',
}

export enum ScheduleTrigger {
  Immediate = 'immediate',
  Scheduled = 'scheduled',
  Cron = 'cron',
  EventDriven = 'event-driven',
  Webhook = 'webhook',
  Manual = 'manual',
}

export enum ApprovalMode {
  Manual = 'manual',
  Auto = 'auto',
  Policy = 'policy',
  MultiStage = 'multi-stage',
}

export type AgentExecutorFn = (
  agentId: string,
  input?: Readonly<Record<string, unknown>>,
) => Promise<Readonly<Record<string, unknown>>>;

export interface OrchestrationNodeDefinition {
  readonly id: string;
  readonly agentId: string;
  readonly mode?: NodeExecutionMode;
  readonly dependsOn?: readonly string[];
  readonly condition?: string;
  readonly loop?: { readonly maxIterations: number };
  readonly retry?: { readonly maxAttempts: number; readonly delayMs?: number };
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface OrchestrationGraphDefinition {
  readonly id: string;
  readonly name: string;
  readonly nodes: readonly OrchestrationNodeDefinition[];
  readonly entryNodeId?: string;
  readonly exitNodeId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface OrchestrationRunRequest {
  readonly graph: OrchestrationGraphDefinition;
  readonly correlationId?: CorrelationId;
  readonly schedule?: {
    readonly trigger: ScheduleTrigger;
    readonly scheduledAt?: TimestampString;
    readonly cronExpression?: string;
    readonly eventName?: string;
    readonly webhookId?: string;
  };
  readonly approval?: {
    readonly mode: ApprovalMode;
    readonly approvers?: readonly string[];
    readonly requestorId?: string;
  };
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface OrchestrationPlanResult {
  readonly workflowId: Identifier;
  readonly graphId: string;
  readonly topologicalOrder: readonly string[];
  readonly entryNodeId: string;
  readonly exitNodeId: string;
  readonly parallelGroups: readonly (readonly string[])[];
  readonly validated: boolean;
  readonly createdAt: TimestampString;
}

export interface OrchestrationNodeResult {
  readonly nodeId: string;
  readonly agentId: string;
  readonly status: OrchestrationStatus;
  readonly output?: Readonly<Record<string, unknown>>;
  readonly error?: string;
  readonly attempts: number;
  readonly startedAt?: TimestampString;
  readonly completedAt?: TimestampString;
}

export interface OrchestrationRunResult {
  readonly workflowId: Identifier;
  readonly status: OrchestrationStatus;
  readonly nodeResults: readonly OrchestrationNodeResult[];
  readonly startedAt: TimestampString;
  readonly completedAt?: TimestampString;
  readonly checkpointId?: Identifier;
}

export interface OrchestrationSessionSnapshot {
  readonly workflowId: Identifier;
  readonly graphId: string;
  readonly status: OrchestrationStatus;
  readonly correlationId: CorrelationId;
  readonly completedNodeIds: readonly string[];
  readonly failedNodeIds: readonly string[];
  readonly pendingNodeIds: readonly string[];
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: TimestampString;
  readonly updatedAt: TimestampString;
}

export class OrchestratorException extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'OrchestratorException';
  }
}

export class GraphValidationException extends OrchestratorException {
  public constructor(message: string) {
    super(message);
    this.name = 'GraphValidationException';
  }
}

export class PlanningException extends OrchestratorException {
  public constructor(message: string) {
    super(message);
    this.name = 'PlanningException';
  }
}

export class CoordinationException extends OrchestratorException {
  public constructor(message: string) {
    super(message);
    this.name = 'CoordinationException';
  }
}

export class ApprovalRequiredException extends OrchestratorException {
  public constructor(
    message: string,
    public readonly workflowId: Identifier,
  ) {
    super(message);
    this.name = 'ApprovalRequiredException';
  }
}

export function createWorkflowId(): Identifier {
  return `workflow-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createCorrelationId(): CorrelationId {
  return `corr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
