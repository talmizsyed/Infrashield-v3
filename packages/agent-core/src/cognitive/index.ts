import type { Identifier, SerializableValueObject, TimestampString } from '@infrashield/contracts';

export type CognitiveDecisionType =
  | 'continue'
  | 'retry'
  | 'delegate'
  | 'escalate'
  | 'request_approval'
  | 'replan'
  | 'complete'
  | 'terminate';

export type CognitiveExecutionStatus = 'created' | 'running' | 'completed' | 'failed' | 'cancelled';

export class CognitivePolicy {
  public constructor(options: { readonly maxRetries?: number; readonly timeoutMs?: number } = {}) {
    this.maxRetries = options.maxRetries ?? 3;
    this.timeoutMs = options.timeoutMs ?? 1000;
  }

  public readonly maxRetries: number;
  public readonly timeoutMs: number;
}

export class CognitiveEvidence {
  public constructor(options: {
    readonly source: string;
    readonly detail?: string;
    readonly confidence?: number;
  }) {
    this.source = options.source;
    this.detail = options.detail;
    this.confidence = options.confidence ?? 1;
  }

  public readonly source: string;
  public readonly detail?: string;
  public readonly confidence: number;
}

export class CognitiveObservation {
  public constructor(options: { readonly message: string; readonly confidence?: number }) {
    this.message = options.message;
    this.confidence = options.confidence ?? 1;
  }

  public readonly message: string;
  public readonly confidence: number;
}

export class CognitiveRecommendation {
  public constructor(options: {
    readonly decision: CognitiveDecisionType;
    readonly reason: string;
  }) {
    this.decision = options.decision;
    this.reason = options.reason;
  }

  public readonly decision: CognitiveDecisionType;
  public readonly reason: string;
}

export class CognitiveDecision {
  public constructor(options: {
    readonly type: CognitiveDecisionType;
    readonly reason: string;
    readonly timestamp?: TimestampString;
  }) {
    this.type = options.type;
    this.reason = options.reason;
    this.timestamp = options.timestamp ?? new Date().toISOString();
  }

  public readonly type: CognitiveDecisionType;
  public readonly reason: string;
  public readonly timestamp: TimestampString;
}

export class CognitiveState {
  public constructor(options: {
    readonly id: Identifier;
    readonly currentDecision?: CognitiveDecisionType;
    readonly decisions?: readonly CognitiveDecision[];
    readonly observations?: readonly CognitiveObservation[];
    readonly recommendations?: readonly CognitiveRecommendation[];
  }) {
    this.id = options.id;
    this.currentDecision = options.currentDecision ?? 'continue';
    this.decisions = [...(options.decisions ?? [])];
    this.observations = [...(options.observations ?? [])];
    this.recommendations = [...(options.recommendations ?? [])];
  }

  public readonly id: Identifier;
  public readonly currentDecision: CognitiveDecisionType;
  public readonly decisions: readonly CognitiveDecision[];
  public readonly observations: readonly CognitiveObservation[];
  public readonly recommendations: readonly CognitiveRecommendation[];
}

export class CognitiveContext {
  public constructor(options: {
    readonly requestId: Identifier;
    readonly task: string;
    readonly tenantId?: Identifier;
    readonly context?: SerializableValueObject;
  }) {
    this.requestId = options.requestId;
    this.task = options.task;
    this.tenantId = options.tenantId;
    this.context = options.context ?? {};
  }

  public readonly requestId: Identifier;
  public readonly task: string;
  public readonly tenantId?: Identifier;
  public readonly context: SerializableValueObject;
}

export class CognitiveExecutionPlan {
  public constructor(options: {
    readonly id: Identifier;
    readonly steps: readonly string[];
    readonly metadata?: SerializableValueObject;
  }) {
    this.id = options.id;
    this.steps = [...options.steps];
    this.metadata = options.metadata ?? {};
  }

  public readonly id: Identifier;
  public readonly steps: readonly string[];
  public readonly metadata: SerializableValueObject;
}

export class CognitiveCheckpoint {
  public constructor(options: {
    readonly id: Identifier;
    readonly stage: string;
    readonly timestamp?: TimestampString;
  }) {
    this.id = options.id;
    this.stage = options.stage;
    this.timestamp = options.timestamp ?? new Date().toISOString();
  }

  public readonly id: Identifier;
  public readonly stage: string;
  public readonly timestamp: TimestampString;
}

export class CognitiveExecutionResult {
  public constructor(options: {
    readonly status: CognitiveExecutionStatus;
    readonly message?: string;
    readonly evidence?: readonly CognitiveEvidence[];
    readonly decision?: CognitiveDecision;
  }) {
    this.status = options.status;
    this.message = options.message;
    this.evidence = [...(options.evidence ?? [])];
    this.decision = options.decision;
  }

  public readonly status: CognitiveExecutionStatus;
  public readonly message?: string;
  public readonly evidence: readonly CognitiveEvidence[];
  public readonly decision?: CognitiveDecision;
}

export class CognitiveExecution {
  public constructor(options: {
    readonly id: Identifier;
    readonly requestId: Identifier;
    readonly state: CognitiveState;
    readonly checkpoints: readonly CognitiveCheckpoint[];
    readonly result: CognitiveExecutionResult;
    readonly createdAt?: TimestampString;
  }) {
    this.id = options.id;
    this.requestId = options.requestId;
    this.state = options.state;
    this.checkpoints = [...options.checkpoints];
    this.result = options.result;
    this.createdAt = options.createdAt ?? new Date().toISOString();
  }

  public readonly id: Identifier;
  public readonly requestId: Identifier;
  public readonly state: CognitiveState;
  public readonly checkpoints: readonly CognitiveCheckpoint[];
  public readonly result: CognitiveExecutionResult;
  public readonly createdAt: TimestampString;
}

export class CognitiveSession {
  public constructor(options: {
    readonly id: Identifier;
    readonly metadata?: SerializableValueObject;
  }) {
    this.id = options.id;
    this.metadata = options.metadata ?? {};
  }

  public readonly id: Identifier;
  public readonly metadata: SerializableValueObject;
}

export class CognitiveSnapshot {
  public constructor(options: {
    readonly name: string;
    readonly executions: number;
    readonly createdAt?: TimestampString;
  }) {
    this.name = options.name;
    this.executions = options.executions;
    this.createdAt = options.createdAt ?? new Date().toISOString();
  }

  public readonly name: string;
  public readonly executions: number;
  public readonly createdAt: TimestampString;
}

export class CognitiveStatistics {
  public constructor(options: {
    readonly executions?: number;
    readonly completed?: number;
    readonly failed?: number;
    readonly cancelled?: number;
  }) {
    this.executions = options.executions ?? 0;
    this.completed = options.completed ?? 0;
    this.failed = options.failed ?? 0;
    this.cancelled = options.cancelled ?? 0;
  }

  public readonly executions: number;
  public readonly completed: number;
  public readonly failed: number;
  public readonly cancelled: number;
}

export class CognitiveMetrics {
  public constructor(
    options: {
      readonly pipelineLatencyMs?: number;
      readonly decisionLatencyMs?: number;
      readonly contextAssemblyMs?: number;
      readonly planningDurationMs?: number;
      readonly workflowDurationMs?: number;
      readonly aiDurationMs?: number;
      readonly reflectionDurationMs?: number;
    } = {},
  ) {
    this.pipelineLatencyMs = options.pipelineLatencyMs ?? 0;
    this.decisionLatencyMs = options.decisionLatencyMs ?? 0;
    this.contextAssemblyMs = options.contextAssemblyMs ?? 0;
    this.planningDurationMs = options.planningDurationMs ?? 0;
    this.workflowDurationMs = options.workflowDurationMs ?? 0;
    this.aiDurationMs = options.aiDurationMs ?? 0;
    this.reflectionDurationMs = options.reflectionDurationMs ?? 0;
  }

  public pipelineLatencyMs: number;
  public decisionLatencyMs: number;
  public contextAssemblyMs: number;
  public planningDurationMs: number;
  public workflowDurationMs: number;
  public aiDurationMs: number;
  public reflectionDurationMs: number;
}

export class CognitiveAudit {
  public constructor(options: {
    readonly event: string;
    readonly details?: SerializableValueObject;
    readonly timestamp?: TimestampString;
  }) {
    this.event = options.event;
    this.details = options.details ?? {};
    this.timestamp = options.timestamp ?? new Date().toISOString();
  }

  public readonly event: string;
  public readonly details: SerializableValueObject;
  public readonly timestamp: TimestampString;
}

export interface ICognitiveOrchestrator {
  execute(
    session: CognitiveSession,
    request: CognitiveExecutionRequest,
  ): Promise<CognitiveExecution>;
}

export interface ICognitivePipeline {
  run(context: CognitiveContext, state: CognitiveState): Promise<CognitiveExecutionResult>;
}

export interface ICognitiveStrategy {
  decide(context: CognitiveContext, state: CognitiveState): Promise<CognitiveDecision>;
}

export interface ICognitiveCoordinator {
  coordinate(context: CognitiveContext, state: CognitiveState): Promise<CognitiveDecision>;
}

export interface ICognitiveDecision {
  decide(context: CognitiveContext, state: CognitiveState): Promise<CognitiveDecision>;
}

export interface CognitiveExecutionRequest {
  readonly requestId: Identifier;
  readonly task: string;
  readonly tenantId?: Identifier;
  readonly context?: SerializableValueObject;
}

export class CognitiveLifecycle {
  private status: CognitiveExecutionStatus = 'created';

  public getStatus(): CognitiveExecutionStatus {
    return this.status;
  }

  public transition(next: CognitiveExecutionStatus): void {
    this.status = next;
  }
}

export class CognitivePipeline implements ICognitivePipeline {
  public async run(
    context: CognitiveContext,
    _state: CognitiveState,
  ): Promise<CognitiveExecutionResult> {
    const evidence = [new CognitiveEvidence({ source: 'context', detail: context.task })];
    const decision = new CognitiveDecision({ type: 'complete', reason: 'pipeline completed' });
    return new CognitiveExecutionResult({
      status: 'completed',
      message: `processed ${context.task}`,
      evidence,
      decision,
    });
  }
}

export class CognitiveCoordinator implements ICognitiveCoordinator, ICognitiveStrategy {
  public async coordinate(
    context: CognitiveContext,
    state: CognitiveState,
  ): Promise<CognitiveDecision> {
    const decision = state.currentDecision === 'retry' ? 'retry' : 'continue';
    return new CognitiveDecision({ type: decision, reason: `coordinated ${context.task}` });
  }

  public async decide(
    context: CognitiveContext,
    state: CognitiveState,
  ): Promise<CognitiveDecision> {
    return this.coordinate(context, state);
  }
}

export class CognitiveOrchestrator implements ICognitiveOrchestrator {
  public constructor(
    options: {
      readonly policy?: CognitivePolicy;
      readonly pipeline?: CognitivePipeline;
      readonly coordinator?: CognitiveCoordinator;
      readonly strategy?: ICognitiveStrategy;
    } = {},
  ) {
    this.policy = options.policy ?? new CognitivePolicy();
    this.pipeline = options.pipeline ?? new CognitivePipeline();
    this.coordinator = options.coordinator ?? new CognitiveCoordinator();
    this.strategy = options.strategy ?? this.coordinator;
  }

  public readonly policy: CognitivePolicy;
  public readonly pipeline: CognitivePipeline;
  public readonly coordinator: CognitiveCoordinator;
  public readonly strategy: ICognitiveStrategy;
  private readonly executions: CognitiveExecution[] = [];
  private readonly snapshots: CognitiveSnapshot[] = [];
  private readonly metrics: CognitiveMetrics = new CognitiveMetrics();
  private readonly auditTrail: CognitiveAudit[] = [];

  public async execute(
    session: CognitiveSession,
    request: CognitiveExecutionRequest,
  ): Promise<CognitiveExecution> {
    const context = new CognitiveContext({
      requestId: request.requestId,
      task: request.task,
      tenantId: request.tenantId,
      context: request.context,
    });
    const state = new CognitiveState({ id: `state-${session.id}`, currentDecision: 'continue' });
    const checkpoints: CognitiveCheckpoint[] = [
      new CognitiveCheckpoint({ id: `checkpoint-${session.id}`, stage: 'received' }),
    ];

    const decision = await this.strategy.decide(context, state);
    const result = await this.pipeline.run(context, state);
    const finalDecision =
      decision.type === 'retry'
        ? new CognitiveDecision({ type: 'retry', reason: 'retry requested' })
        : (result.decision ?? decision);

    const execution = new CognitiveExecution({
      id: `execution-${session.id}`,
      requestId: request.requestId,
      state: new CognitiveState({
        id: state.id,
        currentDecision: finalDecision.type,
        decisions: [...state.decisions, finalDecision],
        observations: [new CognitiveObservation({ message: result.message ?? 'completed' })],
      }),
      checkpoints: [
        ...checkpoints,
        new CognitiveCheckpoint({ id: `checkpoint-${session.id}-complete`, stage: 'completed' }),
      ],
      result,
    });

    this.executions.push(execution);
    this.metrics.pipelineLatencyMs += 1;
    this.metrics.decisionLatencyMs += 1;
    this.auditTrail.push(
      new CognitiveAudit({
        event: 'ExecutionCompleted',
        details: { requestId: request.requestId },
      }),
    );
    return execution;
  }

  public async snapshot(name: string): Promise<CognitiveSnapshot> {
    const snapshot = new CognitiveSnapshot({ name, executions: this.executions.length });
    this.snapshots.push(snapshot);
    return snapshot;
  }

  public async getStatistics(): Promise<CognitiveStatistics> {
    return new CognitiveStatistics({
      executions: this.executions.length,
      completed: this.executions.filter((execution) => execution.result.status === 'completed')
        .length,
      failed: this.executions.filter((execution) => execution.result.status === 'failed').length,
      cancelled: this.executions.filter((execution) => execution.result.status === 'cancelled')
        .length,
    });
  }
}
