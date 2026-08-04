export type ExecutionId = string;
export type ExecutionMetadata = Readonly<Record<string, unknown>>;

export enum ExecutionStatus {
  Created = 'created',
  Queued = 'queued',
  Starting = 'starting',
  Running = 'running',
  Completing = 'completing',
  Completed = 'completed',
  Cancelled = 'cancelled',
  Failed = 'failed',
  TimedOut = 'timedOut',
}

export enum ExecutionPriority {
  Low = 'low',
  Normal = 'normal',
  High = 'high',
  Critical = 'critical',
}

export enum ExecutionMode {
  Sync = 'sync',
  Async = 'async',
}

export interface ExecutionOwner {
  readonly id: string;
  readonly type: string;
  readonly name?: string;
}

export interface ExecutionReason {
  readonly code: string;
  readonly message: string;
  readonly details?: ExecutionMetadata;
}

export interface ExecutionError {
  readonly code: string;
  readonly message: string;
  readonly details?: ExecutionMetadata;
  readonly timestamp: string;
}

export interface ExecutionResult {
  readonly status: ExecutionStatus;
  readonly output?: ExecutionMetadata;
  readonly error?: ExecutionError;
  readonly metadata?: ExecutionMetadata;
}

export interface ExecutionDuration {
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly elapsedMs?: number;
}

export interface ExecutionSnapshot {
  readonly snapshotId: string;
  readonly executionId: ExecutionId;
  readonly status: ExecutionStatus;
  readonly timestamp: string;
  readonly metadata: ExecutionMetadata;
  readonly duration: ExecutionDuration;
  readonly result?: ExecutionResult;
  readonly error?: ExecutionError;
}

export interface ExecutionState {
  readonly status: ExecutionStatus;
  readonly history: readonly ExecutionStatus[];
  readonly updatedAt: string;
}

export interface ExecutionContextLike {
  readonly executionId: ExecutionId;
  readonly correlationId: string;
  readonly metadata?: ExecutionMetadata;
}

export interface RuntimeVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

export enum RuntimeHostState {
  Created = 'created',
  Configuring = 'configuring',
  Configured = 'configured',
  Starting = 'starting',
  Running = 'running',
  Stopping = 'stopping',
  Stopped = 'stopped',
  Failed = 'failed',
}

export interface RuntimeHostExecutionConfiguration {
  readonly timeoutMs: number;
  readonly concurrency: number;
}

export interface RuntimeHostPipelineConfiguration {
  readonly middleware: readonly RuntimeHostMiddleware[];
}

export interface RuntimeHostObserverConfiguration {
  readonly enabled: boolean;
}

export interface RuntimeHostMetricsConfiguration {
  readonly enabled: boolean;
}

export interface RuntimeHostConfiguration {
  readonly id: string;
  readonly name: string;
  readonly execution: RuntimeHostExecutionConfiguration;
  readonly pipeline: RuntimeHostPipelineConfiguration;
  readonly observer?: RuntimeHostObserverConfiguration;
  readonly metrics?: RuntimeHostMetricsConfiguration;
  readonly requiredServices?: readonly string[];
}

export interface RuntimeHostObserver {
  readonly id: string;
  onStateChange(snapshot: RuntimeHostSnapshot): void | Promise<void>;
}

export interface RuntimeHostEvent {
  readonly type: string;
  readonly timestamp: string;
  readonly payload?: ExecutionMetadata;
}

export interface RuntimeHostEventBus {
  publish(event: RuntimeHostEvent): Promise<void> | void;
}

export interface RuntimeHostMiddleware {
  readonly id: string;
  execute(context: RuntimeHostContext, next: () => Promise<void>): Promise<void>;
}

export interface RuntimeHostSnapshot {
  readonly state: RuntimeHostState;
  readonly timestamp: string;
  readonly configuration: RuntimeHostConfiguration;
  readonly diagnostics: RuntimeHostDiagnostics;
  readonly context: RuntimeHostContext;
}

export interface RuntimeHostServices {
  readonly rootScope: RuntimeHostServiceScope;
}

export interface RuntimeHostOptions {
  readonly configuration: RuntimeHostConfiguration;
  readonly runtime?: IRuntime;
  readonly services?: ReadonlyMap<string, unknown>;
  readonly observers?: readonly RuntimeHostObserver[];
}

export interface IRuntime {
  readonly id: string;
  readonly name: string;
  readonly version: RuntimeVersion;
  readonly metrics: IRuntimeMetrics;
  createExecution(options: RuntimeExecutionDefinitionOptions): IRuntimeExecution;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface IRuntimeHost {
  readonly runtime: IRuntime;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface IRuntimeContext extends ExecutionContextLike {
  readonly createdAt: string;
  readonly properties?: Readonly<Record<string, unknown>>;
}

export interface IRuntimeExecution {
  readonly id: ExecutionId;
  readonly owner: ExecutionOwner;
  readonly correlationId: string;
  readonly priority: ExecutionPriority;
  readonly mode: ExecutionMode;
  readonly metadata: ExecutionMetadata;
  readonly status: ExecutionStatus;
  readonly history: readonly ExecutionStatus[];
  readonly context: IRuntimeContext;
  readonly cancellation?: IRuntimeCancellation;
  readonly result?: ExecutionResult;
  readonly error?: ExecutionError;
  queue(): Promise<void>;
  start(): Promise<void>;
  complete(result: ExecutionResult | ExecutionMetadata): Promise<void>;
  fail(error: ExecutionError | string): Promise<void>;
  cancel(reason?: string): Promise<void>;
  timeout(reason?: string): Promise<void>;
  snapshot(): ExecutionSnapshot;
}

export interface IRuntimeExecutor<TContext extends IRuntimeContext = IRuntimeContext> {
  execute(execution: IRuntimeExecution, context: TContext): Promise<ExecutionResult>;
}

export interface IRuntimeMiddleware<TContext extends IRuntimeContext = IRuntimeContext> {
  readonly id: string;
  execute(context: TContext, next: () => Promise<ExecutionResult>): Promise<ExecutionResult>;
}

export interface IRuntimePipeline<TContext extends IRuntimeContext = IRuntimeContext> {
  execute(context: TContext, delegate: () => Promise<ExecutionResult>): Promise<ExecutionResult>;
}

export interface IRuntimeScope {
  readonly parentId?: string;
  readonly id: string;
  readonly context: IRuntimeContext;
  child(context: IRuntimeContext): IRuntimeScope;
}

export interface IRuntimeCancellation {
  readonly signal: AbortSignal;
  readonly isCancellationRequested: boolean;
  readonly reason?: string;
  cancel(reason?: string): void;
  addObserver(observer: (reason?: string) => void): () => void;
  throwIfCancellationRequested(): void;
}

export interface IRuntimeResult extends ExecutionResult {
  readonly executionId: ExecutionId;
}

export interface IRuntimeOptions {
  readonly id: string;
  readonly name: string;
  readonly version?: RuntimeVersion;
  readonly metrics?: IRuntimeMetrics;
}

export interface IRuntimeLifecycle {
  addObserver(
    observer: (
      execution: IRuntimeExecution,
      from: ExecutionStatus,
      to: ExecutionStatus,
    ) => void | Promise<void>,
  ): () => void;
  notify(execution: IRuntimeExecution, from: ExecutionStatus, to: ExecutionStatus): Promise<void>;
}

export interface IRuntimeObserver<TSnapshot> {
  onObserved(snapshot: TSnapshot): void | Promise<void>;
}

export interface IRuntimeMetrics {
  recordQueued(): void;
  recordCompleted(durationMs: number): void;
  recordFailed(durationMs: number): void;
  recordCancelled(durationMs: number): void;
  recordTimedOut(durationMs: number): void;
  recordCheckpoint(): void;
  recordTimeout(): void;
  recordCancellation(): void;
  recordPipelineDuration(durationMs: number): void;
  recordMiddlewareDuration(durationMs: number): void;
  recordSchedulerLatency(durationMs: number): void;
  recordWorkerUtilization(utilization: number): void;
  recordConcurrentExecution(): void;
  recordThroughput(): void;
  snapshot(): RuntimeMetricsSnapshot;
}

export interface RuntimeMetricsSnapshot {
  readonly timestamp?: string;
  readonly executionCount?: number;
  readonly completed?: number;
  readonly failed?: number;
  readonly cancelled?: number;
  readonly averageDurationMs?: number;
  readonly maximumDurationMs?: number;
  readonly minimumDurationMs?: number;
  readonly concurrentExecutions?: number;
  readonly totalExecutions?: number;
  readonly successfulExecutions?: number;
  readonly failedExecutions?: number;
  readonly cancelledExecutions?: number;
  readonly timedOutExecutions?: number;
  readonly queuedExecutions?: number;
  readonly averageExecutionDurationMs?: number;
  readonly maximumExecutionDurationMs?: number;
  readonly minimumExecutionDurationMs?: number;
  readonly pipelineDurationMs?: number;
  readonly middlewareDurationMs?: number;
  readonly schedulerLatencyMs?: number;
  readonly workerUtilization?: number;
  readonly checkpointCount?: number;
  readonly timeoutCount?: number;
  readonly cancellationCount?: number;
  readonly throughput?: number;
  readonly metrics?: Readonly<Record<string, number>>;
}

export interface RuntimeExecutionDefinitionOptions {
  readonly id?: string;
  readonly owner?: ExecutionOwner;
  readonly correlationId?: string;
  readonly priority?: ExecutionPriority;
  readonly mode?: ExecutionMode;
  readonly metadata?: ExecutionMetadata;
}

export interface RuntimeHostContext {
  readonly executionId: ExecutionId;
  readonly correlationId: string;
  readonly metadata?: ExecutionMetadata;
}

export interface RuntimeHostDiagnostics {
  readonly message?: string;
  readonly details?: ExecutionMetadata;
}

export interface RuntimeHostServiceScope {
  readonly id: string;
  readonly context?: RuntimeHostContext;
}
