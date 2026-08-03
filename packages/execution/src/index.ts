import type {
  CorrelationId,
  Identifier,
  Result,
  SerializableValueObject,
  TimestampString,
} from '@infrashield/contracts';
import type { Context } from '@infrashield/context';

export enum ExecutionStatus {
  Created = 'created',
  Queued = 'queued',
  Scheduled = 'scheduled',
  Running = 'running',
  Paused = 'paused',
  Waiting = 'waiting',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
  TimedOut = 'timedOut',
  Retrying = 'retrying',
}

export interface ExecutionSnapshot {
  readonly snapshotId: Identifier;
  readonly executionId: Identifier;
  readonly status: ExecutionStatus;
  readonly timestamp: TimestampString;
  readonly metadata?: SerializableValueObject;
  readonly progress?: number;
  readonly details?: SerializableValueObject;
}

export interface ExecutionCheckpointData {
  readonly checkpointId: Identifier;
  readonly executionId: Identifier;
  readonly createdAt: TimestampString;
  readonly state: ExecutionSnapshot;
}

export interface ExecutionResult {
  readonly executionId: Identifier;
  readonly status: ExecutionStatus;
  readonly succeeded: boolean;
  readonly startedAt: TimestampString;
  readonly completedAt?: TimestampString;
  readonly output?: SerializableValueObject;
  readonly error?: ExecutionError;
}

export interface ExecutionError {
  readonly code: string;
  readonly message: string;
  readonly correlationId?: CorrelationId;
  readonly details?: SerializableValueObject;
  readonly timestamp: TimestampString;
}

export interface ExecutionStrategy {
  readonly strategyId: Identifier;
  readonly name: string;
  readonly description?: string;
  readonly maxRetries?: number;
  readonly timeoutMs?: number;
}

export interface ExecutionOptions {
  readonly timeoutMs?: number;
  readonly retryCount?: number;
  readonly retryDelayMs?: number;
  readonly enableCheckpointing?: boolean;
  readonly metadata?: SerializableValueObject;
}

export interface ExecutionMetrics {
  readonly executionId: Identifier;
  readonly startTime: TimestampString;
  readonly endTime?: TimestampString;
  readonly durationMs?: number;
  readonly progress?: number;
  readonly retries: number;
  readonly checkpointCount: number;
}

export interface ExecutionStatistics {
  readonly totalExecutions: number;
  readonly runningExecutions: number;
  readonly queuedExecutions: number;
  readonly failedExecutions: number;
  readonly completedExecutions: number;
  readonly cancelledExecutions: number;
  readonly timedOutExecutions: number;
}

export interface ExecutionHooks {
  beforeExecute?(context: ExecutionContext): Promise<void>;
  afterExecute?(result: ExecutionResult): Promise<void>;
  onError?(error: ExecutionError): Promise<void>;
  onRetry?(executionId: Identifier, attempt: number): Promise<void>;
}

export interface ExecutionValidator {
  validate(context: ExecutionContext): Promise<Result<void>>;
}

export interface ExecutionInterceptor {
  intercept(
    context: ExecutionContext,
    next: () => Promise<ExecutionResult>,
  ): Promise<ExecutionResult>;
}

export interface ExecutionMiddleware {
  execute(
    context: ExecutionContext,
    next: () => Promise<ExecutionResult>,
  ): Promise<ExecutionResult>;
}

export interface ExecutionStep {
  readonly stepId: Identifier;
  readonly name: string;
  execute(context: ExecutionContext): Promise<ExecutionResult>;
}

export interface ExecutionPipeline {
  readonly pipelineId: Identifier;
  readonly steps: readonly ExecutionStep[];
  run(context: ExecutionContext): Promise<ExecutionResult>;
}

export interface ExecutionManagerContract {
  enqueue(context: ExecutionContext, options?: ExecutionOptions): Promise<ExecutionResult>;
  schedule(context: ExecutionContext, options?: ExecutionOptions): Promise<ExecutionResult>;
  cancel(executionId: Identifier): Promise<ExecutionResult>;
  pause(executionId: Identifier): Promise<ExecutionResult>;
  resume(executionId: Identifier): Promise<ExecutionResult>;
  getStatus(executionId: Identifier): Promise<ExecutionStatus>;
  getStatistics(): ExecutionStatistics;
}

export interface ExecutionEngineContract {
  readonly engineId: Identifier;
  readonly options: ExecutionOptions;
  readonly hooks?: ExecutionHooks;
  readonly interceptors?: readonly ExecutionInterceptor[];
  readonly middleware?: readonly ExecutionMiddleware[];
  readonly pipeline: ExecutionPipeline;

  execute(context: ExecutionContext): Promise<ExecutionResult>;
  createExecutionContext(requestContext: Context, options?: ExecutionOptions): ExecutionContext;
  getMetrics(executionId: Identifier): Promise<ExecutionMetrics>;
}

export interface ExecutionContextFactory {
  create(requestContext: Context, options?: ExecutionOptions): ExecutionContext;
}

export interface ExecutionContext {
  readonly executionId: Identifier;
  readonly correlationId: CorrelationId;
  readonly status: ExecutionStatus;
  readonly requestContext: Context;
  readonly options: ExecutionOptions;
  readonly strategy?: ExecutionStrategy;
  readonly metadata?: SerializableValueObject;
  readonly timestamp: TimestampString;
}

export interface IExecutionEngine {
  execute(context: ExecutionContext): Promise<ExecutionResult>;
  createExecutionContext(requestContext: Context, options?: ExecutionOptions): ExecutionContext;
}

export interface IExecutionScheduler {
  schedule(tasks: readonly ExecutionTask[]): readonly ExecutionTask[];
}

export interface IExecutionDispatcher {
  dispatch(task: ExecutionTask, context: ExecutionContext): Promise<ExecutionResult>;
}

export interface IExecutionCoordinator {
  coordinate(context: ExecutionContext, tasks: readonly ExecutionTask[]): Promise<ExecutionResult>;
}

export interface IExecutionHost {
  execute(context: ExecutionContext): Promise<ExecutionResult>;
}

export class ExecutionException extends Error {
  public constructor(
    message: string,
    public readonly details?: SerializableValueObject,
  ) {
    super(message);
    this.name = 'ExecutionException';
  }
}

export class ExecutionTask {
  public constructor(options: {
    readonly id: Identifier;
    readonly name: string;
    readonly mode?: 'sequential' | 'parallel' | 'fan-out' | 'fan-in';
    readonly dependsOn?: readonly Identifier[];
    readonly metadata?: SerializableValueObject;
  }) {
    this.id = options.id;
    this.name = options.name;
    this.mode = options.mode ?? 'sequential';
    this.dependsOn = [...(options.dependsOn ?? [])];
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }

  public readonly id: Identifier;
  public readonly name: string;
  public readonly mode: 'sequential' | 'parallel' | 'fan-out' | 'fan-in';
  public readonly dependsOn: readonly Identifier[];
  public readonly metadata?: Readonly<SerializableValueObject>;
}

export class ExecutionQueue {
  private readonly items: ExecutionTask[] = [];

  public enqueue(task: ExecutionTask): void {
    this.items.push(task);
  }

  public dequeue(): ExecutionTask | undefined {
    return this.items.shift();
  }

  public size(): number {
    return this.items.length;
  }

  public peek(): ExecutionTask | undefined {
    return this.items[0];
  }
}

export class ExecutionScheduler implements IExecutionScheduler {
  public schedule(tasks: readonly ExecutionTask[]): readonly ExecutionTask[] {
    return [...tasks];
  }
}

export class ExecutionRetryPolicy {
  public constructor(
    options: { readonly maxAttempts?: number; readonly retryDelayMs?: number } = {},
  ) {
    this.maxAttempts = options.maxAttempts ?? 1;
    this.retryDelayMs = options.retryDelayMs ?? 0;
  }

  public readonly maxAttempts: number;
  public readonly retryDelayMs: number;
}

export class ExecutionTimeoutPolicy {
  public constructor(options: { readonly timeoutMs?: number } = {}) {
    this.timeoutMs = options.timeoutMs ?? 1000;
  }

  public readonly timeoutMs: number;
}

export class ExecutionRecoveryPolicy {
  public constructor(options: { readonly enabled?: boolean } = {}) {
    this.enabled = options.enabled ?? false;
  }

  public readonly enabled: boolean;
}

export class ExecutionCheckpoint {
  public constructor(options: {
    readonly checkpointId: Identifier;
    readonly executionId: Identifier;
    readonly state: ExecutionSnapshot;
    readonly createdAt?: TimestampString;
  }) {
    this.checkpointId = options.checkpointId;
    this.executionId = options.executionId;
    this.state = options.state;
    this.createdAt = options.createdAt ?? new Date().toISOString();
  }

  public readonly checkpointId: Identifier;
  public readonly executionId: Identifier;
  public readonly state: ExecutionSnapshot;
  public readonly createdAt: TimestampString;
}

export class ExecutionHistory {
  private readonly entries: string[] = [];

  public record(event: string): void {
    this.entries.push(event);
  }

  public getEntries(): readonly string[] {
    return [...this.entries];
  }
}

export class ExecutionMetricsCollector {
  public constructor(
    public readonly executionId: Identifier,
    public readonly startedAt: TimestampString = new Date().toISOString(),
  ) {}

  public readonly retries = 0;
  public readonly checkpointCount = 0;
}

export class ExecutionMetricsModelImpl implements ExecutionMetrics {
  public constructor(options: {
    readonly executionId: Identifier;
    readonly startTime: TimestampString;
    readonly retries?: number;
    readonly checkpointCount?: number;
    readonly progress?: number;
    readonly durationMs?: number;
    readonly endTime?: TimestampString;
  }) {
    this.executionId = options.executionId;
    this.startTime = options.startTime;
    this.retries = options.retries ?? 0;
    this.checkpointCount = options.checkpointCount ?? 0;
    this.progress = options.progress ?? 0;
    this.durationMs = options.durationMs ?? 0;
    this.endTime = options.endTime;
  }

  public readonly executionId: Identifier;
  public readonly startTime: TimestampString;
  public readonly endTime?: TimestampString;
  public readonly durationMs?: number;
  public readonly progress?: number;
  public readonly retries: number;
  public readonly checkpointCount: number;
}

export class ExecutionStatisticsState {
  public constructor(
    options: {
      readonly totalExecutions?: number;
      readonly runningExecutions?: number;
      readonly queuedExecutions?: number;
      readonly failedExecutions?: number;
      readonly completedExecutions?: number;
      readonly cancelledExecutions?: number;
      readonly timedOutExecutions?: number;
    } = {},
  ) {
    this.totalExecutions = options.totalExecutions ?? 0;
    this.runningExecutions = options.runningExecutions ?? 0;
    this.queuedExecutions = options.queuedExecutions ?? 0;
    this.failedExecutions = options.failedExecutions ?? 0;
    this.completedExecutions = options.completedExecutions ?? 0;
    this.cancelledExecutions = options.cancelledExecutions ?? 0;
    this.timedOutExecutions = options.timedOutExecutions ?? 0;
  }

  public totalExecutions: number;
  public runningExecutions: number;
  public queuedExecutions: number;
  public failedExecutions: number;
  public completedExecutions: number;
  public cancelledExecutions: number;
  public timedOutExecutions: number;
}

export class ExecutionAudit {
  private readonly entries: string[] = [];

  public record(entry: string): void {
    this.entries.push(entry);
  }

  public getEntries(): readonly string[] {
    return [...this.entries];
  }
}

export class ExecutionContextModel implements ExecutionContext {
  public constructor(
    public readonly executionId: Identifier,
    public readonly correlationId: CorrelationId,
    public readonly requestContext: Context,
    public readonly options: ExecutionOptions,
    public readonly timestamp: TimestampString = new Date().toISOString(),
    public readonly strategy?: ExecutionStrategy,
    public readonly metadata?: SerializableValueObject,
  ) {}

  public readonly status: ExecutionStatus = ExecutionStatus.Created;
}

export class ExecutionPipelineModel implements ExecutionPipeline {
  public readonly pipelineId = 'execution-pipeline';
  public readonly steps: readonly ExecutionStep[] = [];

  public async run(context: ExecutionContext): Promise<ExecutionResult> {
    return {
      executionId: context.executionId,
      status: ExecutionStatus.Completed,
      succeeded: true,
      startedAt: context.timestamp,
      completedAt: new Date().toISOString(),
    };
  }
}

export class ExecutionEngine implements IExecutionEngine {
  public constructor(
    public readonly engineId: Identifier = 'execution-engine',
    public readonly options: ExecutionOptions = {},
    public readonly hooks?: ExecutionHooks,
    public readonly interceptors?: readonly ExecutionInterceptor[],
    public readonly middleware?: readonly ExecutionMiddleware[],
    public readonly pipeline: ExecutionPipeline = new ExecutionPipelineModel(),
  ) {}

  public async execute(context: ExecutionContext): Promise<ExecutionResult> {
    return this.pipeline.run(context);
  }

  public createExecutionContext(
    requestContext: Context,
    options: ExecutionOptions = {},
  ): ExecutionContext {
    return new ExecutionContextModel(
      `exec-${Date.now()}`,
      requestContext.request.correlationId,
      requestContext,
      options,
      new Date().toISOString(),
    );
  }

  public async getMetrics(executionId: Identifier): Promise<ExecutionMetrics> {
    return new ExecutionMetricsModelImpl({ executionId, startTime: new Date().toISOString() });
  }
}

export class ExecutionManager {
  private readonly state = new ExecutionStatisticsState();
  private readonly executions = new Map<Identifier, ExecutionContext>();
  private readonly checkpoints = new Map<Identifier, ExecutionCheckpoint>();
  private readonly history = new Map<Identifier, ExecutionHistory>();

  public constructor(
    private readonly retryPolicy: ExecutionRetryPolicy = new ExecutionRetryPolicy(),
    private readonly timeoutPolicy: ExecutionTimeoutPolicy = new ExecutionTimeoutPolicy(),
    private readonly recoveryPolicy: ExecutionRecoveryPolicy = new ExecutionRecoveryPolicy(),
  ) {}

  public async enqueue(
    context: ExecutionContext,
    options: ExecutionOptions = {},
  ): Promise<ExecutionResult> {
    const effectiveOptions = { ...context.options, ...options };
    const timeoutMs = effectiveOptions.timeoutMs ?? this.timeoutPolicy.timeoutMs;
    const maxAttempts = effectiveOptions.retryCount ?? this.retryPolicy.maxAttempts;
    const executionId = context.executionId;

    this.executions.set(executionId, context);
    this.state.totalExecutions += 1;
    this.state.queuedExecutions += 1;

    if (timeoutMs <= 0) {
      const result = {
        executionId,
        status: ExecutionStatus.TimedOut,
        succeeded: false,
        startedAt: context.timestamp,
        completedAt: new Date().toISOString(),
      };
      this.state.timedOutExecutions += 1;
      this.state.queuedExecutions -= 1;
      this.state.runningExecutions = Math.max(0, this.state.runningExecutions);
      return result;
    }

    if (effectiveOptions.enableCheckpointing) {
      this.checkpoints.set(
        executionId,
        new ExecutionCheckpoint({
          checkpointId: `${executionId}-checkpoint`,
          executionId,
          state: {
            snapshotId: `${executionId}-snapshot`,
            executionId,
            status: ExecutionStatus.Queued,
            timestamp: new Date().toISOString(),
          },
        }),
      );
    }

    const historyEntry = this.history.get(executionId) ?? new ExecutionHistory();
    historyEntry.record('queued');
    this.history.set(executionId, historyEntry);

    const result = await this.runWithRetry(context, maxAttempts, timeoutMs);

    if (result.status === ExecutionStatus.Completed) {
      this.state.completedExecutions += 1;
    } else if (result.status === ExecutionStatus.Failed) {
      this.state.failedExecutions += 1;
    } else if (result.status === ExecutionStatus.Cancelled) {
      this.state.cancelledExecutions += 1;
    } else if (result.status === ExecutionStatus.TimedOut) {
      this.state.timedOutExecutions += 1;
    }

    this.state.queuedExecutions = Math.max(0, this.state.queuedExecutions - 1);
    this.state.runningExecutions = Math.max(0, this.state.runningExecutions - 1);
    return result;
  }

  public async schedule(
    context: ExecutionContext,
    options: ExecutionOptions = {},
  ): Promise<ExecutionResult> {
    return this.enqueue(context, options);
  }

  public async cancel(executionId: Identifier): Promise<ExecutionResult> {
    const context = this.executions.get(executionId);
    if (!context) {
      return {
        executionId,
        status: ExecutionStatus.Cancelled,
        succeeded: false,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };
    }

    this.state.cancelledExecutions += 1;
    this.state.runningExecutions = Math.max(0, this.state.runningExecutions - 1);
    this.state.queuedExecutions = Math.max(0, this.state.queuedExecutions - 1);
    return {
      executionId,
      status: ExecutionStatus.Cancelled,
      succeeded: false,
      startedAt: context.timestamp,
      completedAt: new Date().toISOString(),
    };
  }

  public async pause(executionId: Identifier): Promise<ExecutionResult> {
    return {
      executionId,
      status: ExecutionStatus.Paused,
      succeeded: false,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
  }

  public async resume(executionId: Identifier): Promise<ExecutionResult> {
    return {
      executionId,
      status: ExecutionStatus.Completed,
      succeeded: true,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
  }

  public async getStatus(executionId: Identifier): Promise<ExecutionStatus> {
    return this.executions.has(executionId) ? ExecutionStatus.Running : ExecutionStatus.Created;
  }

  public getStatistics(): ExecutionStatistics {
    return {
      totalExecutions: this.state.totalExecutions,
      runningExecutions: this.state.runningExecutions,
      queuedExecutions: this.state.queuedExecutions,
      failedExecutions: this.state.failedExecutions,
      completedExecutions: this.state.completedExecutions,
      cancelledExecutions: this.state.cancelledExecutions,
      timedOutExecutions: this.state.timedOutExecutions,
    };
  }

  private async runWithRetry(
    context: ExecutionContext,
    maxAttempts: number,
    timeoutMs: number,
  ): Promise<ExecutionResult> {
    this.state.runningExecutions += 1;
    const historyEntry = this.history.get(context.executionId) ?? new ExecutionHistory();
    historyEntry.record('running');
    this.history.set(context.executionId, historyEntry);

    if (maxAttempts <= 0 || timeoutMs <= 0) {
      const startedAt = new Date().toISOString();
      return {
        executionId: context.executionId,
        status: ExecutionStatus.TimedOut,
        succeeded: false,
        startedAt,
        completedAt: new Date().toISOString(),
      };
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const startedAt = new Date().toISOString();
      await new Promise((resolve) => setTimeout(resolve, Math.min(Math.max(timeoutMs, 1), 10)));

      if (Date.now() - Date.parse(startedAt) >= timeoutMs) {
        return {
          executionId: context.executionId,
          status: ExecutionStatus.TimedOut,
          succeeded: false,
          startedAt,
          completedAt: new Date().toISOString(),
        };
      }

      const result = {
        executionId: context.executionId,
        status: ExecutionStatus.Completed,
        succeeded: true,
        startedAt,
        completedAt: new Date().toISOString(),
      };

      if (attempt < maxAttempts) {
        continue;
      }

      return result;
    }

    return {
      executionId: context.executionId,
      status: ExecutionStatus.Completed,
      succeeded: true,
      startedAt: context.timestamp,
      completedAt: new Date().toISOString(),
    };
  }
}
