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

export interface IRuntime {
  readonly id: string;
  readonly name: string;
  readonly version: RuntimeVersion;
  readonly metrics: IRuntimeMetrics;
  createExecution(options: RuntimeExecutionDefinitionOptions): IRuntimeExecution;
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
  recordCompleted(durationMs: number): void;
  recordFailed(durationMs: number): void;
  recordCancelled(durationMs: number): void;
  snapshot(): RuntimeMetricsSnapshot;
}

export class InvalidRuntimeStateException extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'InvalidRuntimeStateException';
  }
}

export class ExecutionCancelledException extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ExecutionCancelledException';
  }
}

export class ExecutionTimeoutException extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ExecutionTimeoutException';
  }
}

export class RuntimePipelineException extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'RuntimePipelineException';
  }
}

export class RuntimeValidationException extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'RuntimeValidationException';
  }
}

export class RuntimeContext implements IRuntimeContext {
  public readonly executionId: ExecutionId;
  public readonly correlationId: string;
  public readonly createdAt: string;
  public readonly metadata: ExecutionMetadata;
  public readonly properties: Readonly<Record<string, unknown>>;

  public constructor(options: {
    readonly executionId: ExecutionId;
    readonly correlationId: string;
    readonly metadata?: ExecutionMetadata;
    readonly properties?: Readonly<Record<string, unknown>>;
  }) {
    this.executionId = options.executionId;
    this.correlationId = options.correlationId;
    this.createdAt = new Date().toISOString();
    this.metadata = freezeMetadata(options.metadata ?? {});
    this.properties = Object.freeze({ ...(options.properties ?? {}) });
  }
}

export class RuntimeExecution implements IRuntimeExecution {
  public readonly id: ExecutionId;
  public readonly owner: ExecutionOwner;
  public readonly correlationId: string;
  public readonly priority: ExecutionPriority;
  public readonly mode: ExecutionMode;
  public readonly metadata: ExecutionMetadata;
  public readonly context: IRuntimeContext;
  public readonly cancellation?: IRuntimeCancellation;
  public readonly createdAt: string;

  private _status: ExecutionStatus = ExecutionStatus.Created;
  private readonly _history: ExecutionStatus[] = [ExecutionStatus.Created];
  private readonly _lifecycle: RuntimeLifecycle;
  private readonly _metrics?: IRuntimeMetrics;
  private _startedAt?: string;
  private _completedAt?: string;
  private _result?: ExecutionResult;
  private _error?: ExecutionError;

  public constructor(options: {
    readonly id: ExecutionId;
    readonly owner: ExecutionOwner;
    readonly correlationId: string;
    readonly priority?: ExecutionPriority;
    readonly mode?: ExecutionMode;
    readonly metadata?: ExecutionMetadata;
    readonly context?: IRuntimeContext;
    readonly cancellation?: IRuntimeCancellation;
    readonly lifecycle?: RuntimeLifecycle;
    readonly metrics?: IRuntimeMetrics;
  }) {
    this.id = options.id;
    this.owner = options.owner;
    this.correlationId = options.correlationId;
    this.priority = options.priority ?? ExecutionPriority.Normal;
    this.mode = options.mode ?? ExecutionMode.Async;
    this.metadata = freezeMetadata(options.metadata ?? {});
    this.context =
      options.context ??
      new RuntimeContext({
        executionId: this.id,
        correlationId: this.correlationId,
        metadata: this.metadata,
      });
    this.cancellation = options.cancellation;
    this.createdAt = new Date().toISOString();
    this._lifecycle = options.lifecycle ?? new RuntimeLifecycle();
    this._metrics = options.metrics;
  }

  public get status(): ExecutionStatus {
    return this._status;
  }

  public get history(): readonly ExecutionStatus[] {
    return [...this._history];
  }

  public get result(): ExecutionResult | undefined {
    return this._result;
  }

  public get error(): ExecutionError | undefined {
    return this._error;
  }

  public async queue(): Promise<void> {
    this.ensureNotCancelled();
    this.transitionTo(ExecutionStatus.Queued, 'queue');
  }

  public async start(): Promise<void> {
    this.ensureNotCancelled();
    if (this._status === ExecutionStatus.Created) {
      this.transitionTo(ExecutionStatus.Queued, 'start');
    }

    if (this._status === ExecutionStatus.Queued) {
      this.transitionTo(ExecutionStatus.Starting, 'start');
    }

    if (this._status === ExecutionStatus.Starting) {
      this.transitionTo(ExecutionStatus.Running, 'start');
    }

    if (this._status === ExecutionStatus.Running) {
      return;
    }

    this.throwInvalidTransition(ExecutionStatus.Running);
  }

  public async complete(result: ExecutionResult | ExecutionMetadata): Promise<void> {
    this.ensureNotCancelled();
    if (this._status !== ExecutionStatus.Running && this._status !== ExecutionStatus.Starting) {
      this.throwInvalidTransition(ExecutionStatus.Completed);
    }

    this.transitionTo(ExecutionStatus.Completing, 'complete');
    this._result = normalizeResult(result);
    this._completedAt = new Date().toISOString();
    this.transitionTo(ExecutionStatus.Completed, 'complete');
  }

  public async fail(error: ExecutionError | string): Promise<void> {
    this.ensureNotCancelled();
    if (
      this._status === ExecutionStatus.Completed ||
      this._status === ExecutionStatus.Failed ||
      this._status === ExecutionStatus.Cancelled ||
      this._status === ExecutionStatus.TimedOut
    ) {
      this.throwInvalidTransition(ExecutionStatus.Failed);
    }

    this._error = normalizeError(error);
    this.transitionTo(ExecutionStatus.Failed, 'fail');
  }

  public async cancel(reason?: string): Promise<void> {
    if (
      this._status === ExecutionStatus.Completed ||
      this._status === ExecutionStatus.Failed ||
      this._status === ExecutionStatus.Cancelled ||
      this._status === ExecutionStatus.TimedOut
    ) {
      this.throwInvalidTransition(ExecutionStatus.Cancelled);
    }

    this._error = {
      code: 'runtime.cancelled',
      message: reason ?? 'Execution cancelled',
      timestamp: new Date().toISOString(),
    };
    this.transitionTo(ExecutionStatus.Cancelled, 'cancel');
  }

  public async timeout(reason?: string): Promise<void> {
    if (
      this._status === ExecutionStatus.Completed ||
      this._status === ExecutionStatus.Failed ||
      this._status === ExecutionStatus.Cancelled ||
      this._status === ExecutionStatus.TimedOut
    ) {
      this.throwInvalidTransition(ExecutionStatus.TimedOut);
    }

    this._error = {
      code: 'runtime.timeout',
      message: reason ?? 'Execution timed out',
      timestamp: new Date().toISOString(),
    };
    this.transitionTo(ExecutionStatus.TimedOut, 'timeout');
  }

  public snapshot(): ExecutionSnapshot {
    return {
      snapshotId: `snapshot-${this.id}`,
      executionId: this.id,
      status: this._status,
      timestamp: new Date().toISOString(),
      metadata: this.metadata,
      duration: {
        startedAt: this._startedAt ?? this.createdAt,
        completedAt: this._completedAt,
        elapsedMs: this._completedAt
          ? Math.max(
              0,
              Date.parse(this._completedAt) - Date.parse(this._startedAt ?? this.createdAt),
            )
          : undefined,
      },
      result: this._result,
      error: this._error,
    };
  }

  private ensureNotCancelled(): void {
    if (this.cancellation?.isCancellationRequested) {
      throw new RuntimeValidationException(this.cancellation.reason ?? 'Execution cancelled');
    }
  }

  private transitionTo(nextStatus: ExecutionStatus, _reason: string): void {
    const from = this._status;
    if (!isValidTransition(from, nextStatus)) {
      this.throwInvalidTransition(nextStatus);
    }

    this._status = nextStatus;
    this._history.push(nextStatus);
    if (nextStatus === ExecutionStatus.Running) {
      this._startedAt = new Date().toISOString();
    }

    void this._lifecycle.notify(this, from, nextStatus);
    this.recordTerminalMetric(nextStatus);
  }

  private recordTerminalMetric(status: ExecutionStatus): void {
    if (!this._metrics) {
      return;
    }

    if (status === ExecutionStatus.Completed) {
      this._metrics.recordCompleted(this.durationMs());
      return;
    }

    if (status === ExecutionStatus.Failed) {
      this._metrics.recordFailed(this.durationMs());
      return;
    }

    if (status === ExecutionStatus.Cancelled) {
      this._metrics.recordCancelled(this.durationMs());
      return;
    }

    if (status === ExecutionStatus.TimedOut) {
      this._metrics.recordCancelled(this.durationMs());
    }
  }

  private durationMs(): number {
    const reference = this._startedAt ?? this.createdAt;
    const end = new Date().getTime();
    const start = new Date(reference).getTime();
    return Math.max(0, end - start);
  }

  private throwInvalidTransition(nextStatus: ExecutionStatus): never {
    throw new InvalidRuntimeStateException(
      `Cannot transition from ${this._status} to ${nextStatus}`,
    );
  }
}

export class RuntimeExecutor<
  TContext extends IRuntimeContext = IRuntimeContext,
> implements IRuntimeExecutor<TContext> {
  public constructor(
    private readonly handler: (
      execution: IRuntimeExecution,
      context: TContext,
    ) => Promise<ExecutionResult> | ExecutionResult,
  ) {}

  public async execute(execution: IRuntimeExecution, context: TContext): Promise<ExecutionResult> {
    return this.handler(execution, context);
  }
}

export class RuntimePipeline<
  TContext extends IRuntimeContext = IRuntimeContext,
> implements IRuntimePipeline<TContext> {
  public constructor(private readonly middlewares: readonly IRuntimeMiddleware<TContext>[] = []) {}

  public async execute(
    context: TContext,
    delegate: () => Promise<ExecutionResult>,
  ): Promise<ExecutionResult> {
    const chain = this.middlewares.reduceRight<() => Promise<ExecutionResult>>(
      (next, middleware) => async () => {
        try {
          return await middleware.execute(context, next);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Runtime pipeline failed';
          throw new RuntimePipelineException(message);
        }
      },
      delegate,
    );

    return chain();
  }
}

export class PipelineBuilder<TContext extends IRuntimeContext = IRuntimeContext> {
  private readonly middlewares: IRuntimeMiddleware<TContext>[] = [];

  public use(middleware: IRuntimeMiddleware<TContext>): this {
    this.middlewares.push(middleware);
    return this;
  }

  public build(): RuntimePipeline<TContext> {
    return new RuntimePipeline<TContext>([...this.middlewares]);
  }
}

export class RuntimeScope implements IRuntimeScope {
  public readonly id: string;
  public readonly parentId?: string;
  public readonly context: IRuntimeContext;

  public constructor(options: {
    readonly id: string;
    readonly context: IRuntimeContext;
    readonly parentId?: string;
  }) {
    this.id = options.id;
    this.parentId = options.parentId;
    this.context = options.context;
  }

  public child(context: IRuntimeContext): IRuntimeScope {
    return new RuntimeScope({ id: `${this.id}:child`, context, parentId: this.id });
  }
}

export class RuntimeCancellation implements IRuntimeCancellation {
  private readonly listeners = new Set<(reason?: string) => void>();
  private _reason?: string;
  private _cancelled = false;
  public readonly signal: AbortSignal;

  public constructor(signal?: AbortSignal) {
    if (signal) {
      this.signal = signal;
      if (signal.aborted) {
        this._cancelled = true;
        this._reason = resolveAbortReason(signal);
      } else {
        signal.addEventListener(
          'abort',
          () => {
            this._cancelled = true;
            this._reason = resolveAbortReason(signal);
            for (const listener of this.listeners) {
              listener(this._reason);
            }
          },
          { once: true },
        );
      }
    } else {
      const controller = new AbortController();
      this.signal = controller.signal;
      this.controller = controller;
    }
  }

  private readonly controller?: AbortController;

  public get isCancellationRequested(): boolean {
    return this._cancelled || this.signal.aborted;
  }

  public get reason(): string | undefined {
    return this._reason ?? resolveAbortReason(this.signal);
  }

  public cancel(reason?: string): void {
    if (this.isCancellationRequested) {
      return;
    }

    this._cancelled = true;
    this._reason = reason ?? 'cancelled';
    this.controller?.abort(this._reason);
    for (const listener of this.listeners) {
      listener(this._reason);
    }
  }

  public addObserver(observer: (reason?: string) => void): () => void {
    this.listeners.add(observer);
    return () => this.listeners.delete(observer);
  }

  public throwIfCancellationRequested(): void {
    if (this.isCancellationRequested) {
      throw new ExecutionCancelledException(this.reason ?? 'Execution cancelled');
    }
  }
}

export class RuntimeLifecycle implements IRuntimeLifecycle {
  private readonly observers = new Set<
    (
      execution: IRuntimeExecution,
      from: ExecutionStatus,
      to: ExecutionStatus,
    ) => void | Promise<void>
  >();

  public addObserver(
    observer: (
      execution: IRuntimeExecution,
      from: ExecutionStatus,
      to: ExecutionStatus,
    ) => void | Promise<void>,
  ): () => void {
    this.observers.add(observer);
    return () => this.observers.delete(observer);
  }

  public async notify(
    execution: IRuntimeExecution,
    from: ExecutionStatus,
    to: ExecutionStatus,
  ): Promise<void> {
    for (const observer of this.observers) {
      await observer(execution, from, to);
    }
  }
}

export class RuntimeMetrics implements IRuntimeMetrics {
  private completedCount = 0;
  private failedCount = 0;
  private cancelledCount = 0;
  private readonly durations: number[] = [];

  public recordCompleted(durationMs: number): void {
    this.completedCount += 1;
    this.durations.push(durationMs);
  }

  public recordFailed(durationMs: number): void {
    this.failedCount += 1;
    this.durations.push(durationMs);
  }

  public recordCancelled(durationMs: number): void {
    this.cancelledCount += 1;
    this.durations.push(durationMs);
  }

  public snapshot(): RuntimeMetricsSnapshot {
    return {
      executionCount: this.completedCount + this.failedCount + this.cancelledCount,
      completed: this.completedCount,
      failed: this.failedCount,
      cancelled: this.cancelledCount,
      averageDurationMs: average(this.durations),
      maximumDurationMs: max(this.durations),
      minimumDurationMs: min(this.durations),
      concurrentExecutions: 0,
    };
  }
}

export interface RuntimeMetricsSnapshot {
  readonly executionCount: number;
  readonly completed: number;
  readonly failed: number;
  readonly cancelled: number;
  readonly averageDurationMs: number;
  readonly maximumDurationMs: number;
  readonly minimumDurationMs: number;
  readonly concurrentExecutions: number;
}

export interface RuntimeExecutionDefinitionOptions {
  readonly id: ExecutionId;
  readonly owner: ExecutionOwner;
  readonly correlationId: string;
  readonly priority?: ExecutionPriority;
  readonly mode?: ExecutionMode;
  readonly metadata?: ExecutionMetadata;
  readonly context?: IRuntimeContext;
  readonly cancellation?: IRuntimeCancellation;
}

export class Runtime implements IRuntime {
  public readonly id: string;
  public readonly name: string;
  public readonly version: RuntimeVersion;
  public readonly metrics: IRuntimeMetrics;
  private readonly executions = new Map<string, IRuntimeExecution>();

  public constructor(options: IRuntimeOptions) {
    this.id = options.id;
    this.name = options.name;
    this.version = options.version ?? { major: 1, minor: 0, patch: 0 };
    this.metrics = options.metrics ?? new RuntimeMetrics();
  }

  public createExecution(options: RuntimeExecutionDefinitionOptions): IRuntimeExecution {
    const execution = new RuntimeExecution({ ...options, metrics: this.metrics });
    this.executions.set(execution.id, execution);
    return execution;
  }

  public async start(): Promise<void> {
    return undefined;
  }

  public async stop(): Promise<void> {
    return undefined;
  }
}

export class RuntimeHost implements IRuntimeHost {
  public constructor(public readonly runtime: IRuntime) {}

  public async start(): Promise<void> {
    return undefined;
  }

  public async stop(): Promise<void> {
    return undefined;
  }
}

function isValidTransition(from: ExecutionStatus, to: ExecutionStatus): boolean {
  const validTransitions: Record<ExecutionStatus, readonly ExecutionStatus[]> = {
    [ExecutionStatus.Created]: [
      ExecutionStatus.Queued,
      ExecutionStatus.Starting,
      ExecutionStatus.Running,
    ],
    [ExecutionStatus.Queued]: [
      ExecutionStatus.Starting,
      ExecutionStatus.Running,
      ExecutionStatus.Cancelled,
      ExecutionStatus.Failed,
    ],
    [ExecutionStatus.Starting]: [
      ExecutionStatus.Running,
      ExecutionStatus.Cancelled,
      ExecutionStatus.Failed,
      ExecutionStatus.TimedOut,
    ],
    [ExecutionStatus.Running]: [
      ExecutionStatus.Completing,
      ExecutionStatus.Cancelled,
      ExecutionStatus.Failed,
      ExecutionStatus.TimedOut,
    ],
    [ExecutionStatus.Completing]: [
      ExecutionStatus.Completed,
      ExecutionStatus.Failed,
      ExecutionStatus.Cancelled,
      ExecutionStatus.TimedOut,
    ],
    [ExecutionStatus.Completed]: [],
    [ExecutionStatus.Cancelled]: [],
    [ExecutionStatus.Failed]: [],
    [ExecutionStatus.TimedOut]: [],
  };

  return validTransitions[from]?.includes(to) ?? false;
}

function normalizeResult(result: ExecutionResult | ExecutionMetadata): ExecutionResult {
  if (isExecutionResult(result)) {
    return {
      status: ExecutionStatus.Completed,
      output: result.output,
      error: result.error,
      metadata: result.metadata,
    };
  }

  return {
    status: ExecutionStatus.Completed,
    output: result,
  };
}

function normalizeError(error: ExecutionError | string): ExecutionError {
  if (typeof error === 'string') {
    return {
      code: 'runtime.failed',
      message: error,
      timestamp: new Date().toISOString(),
    };
  }

  return error;
}

function isExecutionResult(value: unknown): value is ExecutionResult {
  return typeof value === 'object' && value !== null && 'status' in value;
}

function freezeMetadata(metadata: ExecutionMetadata): ExecutionMetadata {
  return Object.freeze({ ...metadata }) as ExecutionMetadata;
}

function resolveAbortReason(signal: AbortSignal): string | undefined {
  if (typeof signal.reason === 'string') {
    return signal.reason;
  }

  if (signal.reason instanceof Error) {
    return signal.reason.message;
  }

  return undefined;
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function min(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return Math.min(...values);
}

function max(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return Math.max(...values);
}
