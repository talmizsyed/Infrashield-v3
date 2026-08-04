import {
  ExecutionMode,
  ExecutionPriority,
  ExecutionStatus,
  type ExecutionError,
  type ExecutionId,
  type ExecutionMetadata,
  type ExecutionOwner,
  type ExecutionResult,
  type ExecutionSnapshot,
  type IRuntime,
  type IRuntimeCancellation,
  type IRuntimeContext,
  type IRuntimeExecution,
  type IRuntimeExecutor,
  type IRuntimeLifecycle,
  type IRuntimeMetrics,
  type IRuntimeMiddleware,
  type IRuntimeOptions,
  type IRuntimePipeline,
  type IRuntimeScope,
  type RuntimeExecutionDefinitionOptions,
  type RuntimeMetricsSnapshot,
  type RuntimeHostConfiguration,
  type RuntimeHostEvent,
  type RuntimeHostEventBus,
  type RuntimeHostMiddleware,
  type RuntimeHostObserver,
  type RuntimeHostOptions,
  type RuntimeHostServices,
  type RuntimeHostSnapshot,
  type RuntimeVersion,
  type IRuntimeHost,
  RuntimeHostState,
} from '@infrashield/contracts';

export {
  ExecutionMode,
  ExecutionPriority,
  ExecutionStatus,
  RuntimeHostState,
} from '@infrashield/contracts';

export type {
  ExecutionDuration,
  ExecutionError,
  ExecutionId,
  ExecutionMetadata,
  ExecutionOwner,
  ExecutionResult,
  IRuntime,
  IRuntimeCancellation,
  IRuntimeContext,
  IRuntimeExecution,
  IRuntimeExecutor,
  IRuntimeLifecycle,
  IRuntimeMetrics,
  IRuntimeMiddleware,
  IRuntimeOptions,
  IRuntimePipeline,
  IRuntimeScope,
  RuntimeExecutionDefinitionOptions,
  RuntimeMetricsSnapshot,
  RuntimeHostConfiguration,
  RuntimeHostEvent,
  RuntimeHostEventBus,
  RuntimeHostMiddleware,
  RuntimeHostObserver,
  RuntimeHostOptions,
  RuntimeHostServices,
  RuntimeHostSnapshot,
  RuntimeVersion,
  IRuntimeHost,
} from '@infrashield/contracts';

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

export class RuntimeHostConfigurationException extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'RuntimeHostConfigurationException';
  }
}

export class RuntimeHostStateException extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'RuntimeHostStateException';
  }
}

export class RuntimeHostInitializationException extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'RuntimeHostInitializationException';
  }
}

export class RuntimeHostAlreadyStartedException extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'RuntimeHostAlreadyStartedException';
  }
}

export class RuntimeHostNotStartedException extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'RuntimeHostNotStartedException';
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

    if (nextStatus === ExecutionStatus.Queued && this._metrics) {
      this._metrics.recordQueued();
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
      this._metrics.recordTimedOut(this.durationMs());
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
  private timedOutCount = 0;
  private queuedCount = 0;
  private checkpointCount = 0;
  private timeoutCount = 0;
  private cancellationCount = 0;
  private throughputCount = 0;
  private concurrentExecutionCount = 0;
  private readonly durations: number[] = [];
  private readonly pipelineDurations: number[] = [];
  private readonly middlewareDurations: number[] = [];
  private readonly schedulerLatencies: number[] = [];
  private readonly workerUtilizations: number[] = [];

  public recordQueued(): void {
    this.queuedCount += 1;
    this.concurrentExecutionCount += 1;
  }

  public recordCompleted(durationMs: number): void {
    this.completedCount += 1;
    this.durations.push(durationMs);
    this.concurrentExecutionCount = Math.max(0, this.concurrentExecutionCount - 1);
  }

  public recordFailed(durationMs: number): void {
    this.failedCount += 1;
    this.durations.push(durationMs);
    this.concurrentExecutionCount = Math.max(0, this.concurrentExecutionCount - 1);
  }

  public recordCancelled(durationMs: number): void {
    this.cancelledCount += 1;
    this.durations.push(durationMs);
    this.concurrentExecutionCount = Math.max(0, this.concurrentExecutionCount - 1);
  }

  public recordTimedOut(durationMs: number): void {
    this.timedOutCount += 1;
    this.durations.push(durationMs);
    this.concurrentExecutionCount = Math.max(0, this.concurrentExecutionCount - 1);
  }

  public recordCheckpoint(): void {
    this.checkpointCount += 1;
  }

  public recordTimeout(): void {
    this.timeoutCount += 1;
  }

  public recordCancellation(): void {
    this.cancellationCount += 1;
  }

  public recordPipelineDuration(durationMs: number): void {
    this.pipelineDurations.push(durationMs);
  }

  public recordMiddlewareDuration(durationMs: number): void {
    this.middlewareDurations.push(durationMs);
  }

  public recordSchedulerLatency(durationMs: number): void {
    this.schedulerLatencies.push(durationMs);
  }

  public recordWorkerUtilization(utilization: number): void {
    this.workerUtilizations.push(utilization);
  }

  public recordConcurrentExecution(): void {
    this.concurrentExecutionCount += 1;
  }

  public recordThroughput(): void {
    this.throughputCount += 1;
  }

  public snapshot(): RuntimeMetricsSnapshot {
    return {
      executionCount:
        this.completedCount + this.failedCount + this.cancelledCount + this.timedOutCount,
      completed: this.completedCount,
      failed: this.failedCount,
      cancelled: this.cancelledCount,
      averageDurationMs: average(this.durations),
      maximumDurationMs: max(this.durations),
      minimumDurationMs: min(this.durations),
      concurrentExecutions: this.concurrentExecutionCount,
      totalExecutions:
        this.completedCount +
        this.failedCount +
        this.cancelledCount +
        this.timedOutCount +
        this.queuedCount,
      successfulExecutions: this.completedCount,
      failedExecutions: this.failedCount,
      cancelledExecutions: this.cancelledCount,
      timedOutExecutions: this.timedOutCount,
      queuedExecutions: this.queuedCount,
      averageExecutionDurationMs: average(this.durations),
      maximumExecutionDurationMs: max(this.durations),
      minimumExecutionDurationMs: min(this.durations),
      pipelineDurationMs: average(this.pipelineDurations),
      middlewareDurationMs: average(this.middlewareDurations),
      schedulerLatencyMs: average(this.schedulerLatencies),
      workerUtilization: average(this.workerUtilizations),
      checkpointCount: this.checkpointCount,
      timeoutCount: this.timeoutCount,
      cancellationCount: this.cancellationCount,
      throughput: this.throughputCount,
    };
  }
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
    const execution = new RuntimeExecution({
      id: options.id ?? this.id,
      owner: options.owner ?? { id: this.id, type: 'runtime', name: this.name },
      correlationId: options.correlationId ?? this.id,
      priority: options.priority,
      mode: options.mode,
      metadata: options.metadata,
      metrics: this.metrics,
    });
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

export class RuntimeHostDiagnostics {
  public message?: string;
  public details?: ExecutionMetadata;
  public startupDurationMs?: number;
  public shutdownDurationMs?: number;
  public hostState: RuntimeHostState = RuntimeHostState.Created;
  public initializationFailures: string[] = [];
  public configurationValidationErrors: string[] = [];
  public serviceResolutionFailures: string[] = [];
  public lastError?: string;
}

export class RuntimeHostContext {
  public executionId: ExecutionId;
  public correlationId: string;
  public metadata: ExecutionMetadata;
  public configuration: RuntimeHostConfiguration;
  public runtime: IRuntime;
  public scope: RuntimeHostServiceScope;
  public services: RuntimeHostServices;
  public startedAt?: string;
  public stoppedAt?: string;
  public state: RuntimeHostState;

  public constructor(options: {
    readonly configuration: RuntimeHostConfiguration;
    readonly runtime: IRuntime;
    readonly scope: RuntimeHostServiceScope;
    readonly services: RuntimeHostServices;
    readonly executionId?: ExecutionId;
    readonly correlationId?: string;
    readonly metadata?: ExecutionMetadata;
    readonly startedAt?: string;
    readonly stoppedAt?: string;
    readonly state: RuntimeHostState;
  }) {
    this.executionId = options.executionId ?? options.configuration.id;
    this.correlationId = options.correlationId ?? options.configuration.id;
    this.metadata = freezeMetadata(options.metadata ?? {});
    this.configuration = freezeRuntimeHostConfiguration(options.configuration);
    this.runtime = options.runtime;
    this.scope = options.scope;
    this.services = options.services;
    this.startedAt = options.startedAt;
    this.stoppedAt = options.stoppedAt;
    this.state = options.state;
  }
}

export class RuntimeHostServiceScope {
  private readonly values = new Map<string, unknown>();

  public constructor(
    public readonly id: string,
    private readonly parent?: RuntimeHostServiceScope,
  ) {}

  public register<T>(key: string, value: T): void {
    if (this.hasInScopeOrParents(key)) {
      throw new RuntimeHostConfigurationException(`Service '${key}' is already registered`);
    }

    this.values.set(key, value);
  }

  public resolve<T>(key: string): T {
    if (this.values.has(key)) {
      return this.values.get(key) as T;
    }

    if (this.parent) {
      return this.parent.resolve<T>(key);
    }

    throw new RuntimeHostInitializationException(`Unable to resolve required service '${key}'`);
  }

  public has(key: string): boolean {
    return this.values.has(key) || this.parent?.has(key) === true;
  }

  public createChild(id: string): RuntimeHostServiceScope {
    return new RuntimeHostServiceScope(id, this);
  }

  public dispose(): void {
    this.values.clear();
  }

  private hasInScopeOrParents(key: string): boolean {
    if (this.values.has(key)) {
      return true;
    }

    return this.parent?.hasInScopeOrParents(key) === true;
  }
}

export class RuntimeHost implements IRuntimeHost {
  public readonly runtime: IRuntime;
  public readonly diagnostics: RuntimeHostDiagnostics;
  public readonly configuration: RuntimeHostConfiguration;
  public context: RuntimeHostContext;
  public readonly services: RuntimeHostServices;
  private readonly observers: readonly RuntimeHostObserver[];
  private readonly rootScope: RuntimeHostServiceScope;
  private _state: RuntimeHostState = RuntimeHostState.Created;
  private _startPromise?: Promise<void>;
  private _stopPromise?: Promise<void>;

  public constructor(options: RuntimeHostOptions) {
    this.configuration = freezeRuntimeHostConfiguration(options.configuration);
    this.runtime =
      options.runtime ?? new Runtime({ id: this.configuration.id, name: this.configuration.name });
    this.diagnostics = new RuntimeHostDiagnostics();
    this.rootScope = new RuntimeHostServiceScope('root');
    this.rootScope.register('runtime', this.runtime);
    this.rootScope.register('configuration', this.configuration);
    this.rootScope.register('diagnostics', this.diagnostics);
    this.rootScope.register('host', this);

    const services = options.services ?? new Map<string, unknown>();
    for (const [key, value] of services.entries()) {
      this.rootScope.register(key, value);
    }

    this.services = { rootScope: this.rootScope };
    this.observers = Object.freeze([...(options.observers ?? [])]);
    this.context = new RuntimeHostContext({
      configuration: this.configuration,
      runtime: this.runtime,
      scope: this.rootScope,
      services: this.services,
      state: this._state,
    });
  }

  public get state(): RuntimeHostState {
    return this._state;
  }

  public async start(): Promise<void> {
    if (this._startPromise) {
      await this._startPromise;
      return;
    }

    this._startPromise = this.startInternal();
    try {
      await this._startPromise;
    } finally {
      this._startPromise = undefined;
    }
  }

  public async stop(): Promise<void> {
    if (this._stopPromise) {
      await this._stopPromise;
      return;
    }

    this._stopPromise = this.stopInternal();
    try {
      await this._stopPromise;
    } finally {
      this._stopPromise = undefined;
    }
  }

  public createExecutionScope(id: string): RuntimeHostServiceScope {
    return this.rootScope.createChild(id);
  }

  public initialize(nextState: RuntimeHostState, reason: string): void {
    this.transitionTo(nextState, reason);
  }

  private async startInternal(): Promise<void> {
    if (this._state === RuntimeHostState.Running || this._state === RuntimeHostState.Starting) {
      return;
    }

    if (this._state === RuntimeHostState.Stopped) {
      throw new RuntimeHostAlreadyStartedException('Runtime host has already been stopped');
    }

    if (this._state === RuntimeHostState.Failed) {
      throw new RuntimeHostInitializationException('Runtime host is in a failed state');
    }

    this.transitionTo(RuntimeHostState.Starting, 'starting');

    try {
      this.validateRequiredServices();
      await this.publishEvent({ type: 'RuntimeStarting', timestamp: new Date().toISOString() });
      await this.notifyObservers();
      await this.runtime.start();
      this.transitionTo(RuntimeHostState.Running, 'started');
      await this.publishEvent({ type: 'RuntimeStarted', timestamp: new Date().toISOString() });
      this.diagnostics.startupDurationMs = this.measureDuration();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Runtime host initialization failed';
      this.recordInitializationFailure(message);
      this.transitionTo(RuntimeHostState.Failed, 'failed');
      throw new RuntimeHostInitializationException(message);
    }
  }

  private async stopInternal(): Promise<void> {
    if (this._state === RuntimeHostState.Stopped) {
      return;
    }

    if (this._state === RuntimeHostState.Configured || this._state === RuntimeHostState.Created) {
      this.transitionTo(RuntimeHostState.Stopped, 'stopped');
      return;
    }

    if (this._state === RuntimeHostState.Stopping) {
      return;
    }

    this.transitionTo(RuntimeHostState.Stopping, 'stopping');

    try {
      await this.publishEvent({ type: 'RuntimeStopping', timestamp: new Date().toISOString() });
      await this.runtime.stop();
      this.transitionTo(RuntimeHostState.Stopped, 'stopped');
      await this.publishEvent({ type: 'RuntimeStopped', timestamp: new Date().toISOString() });
      this.diagnostics.shutdownDurationMs = this.measureDuration();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Runtime host shutdown failed';
      this.diagnostics.initializationFailures.push(message);
      this.diagnostics.lastError = message;
      this.transitionTo(RuntimeHostState.Failed, 'failed');
      throw new RuntimeHostStateException(message);
    }
  }

  private transitionTo(nextState: RuntimeHostState, reason: string): void {
    const from = this._state;
    if (!isValidRuntimeHostTransition(from, nextState)) {
      throw new RuntimeHostStateException(
        `Cannot transition runtime host from ${from} to ${nextState} (${reason})`,
      );
    }

    this._state = nextState;
    this.diagnostics.hostState = nextState;
    this.syncContext();
    void this.notifyObservers();
  }

  private async notifyObservers(): Promise<void> {
    const snapshot = this.snapshot();
    for (const observer of this.observers) {
      try {
        await observer.onStateChange(snapshot);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Runtime host observer failed';
        this.recordInitializationFailure(message);
      }
    }
  }

  private recordInitializationFailure(message: string): void {
    if (!this.diagnostics.initializationFailures.includes(message)) {
      this.diagnostics.initializationFailures.push(message);
    }
    this.diagnostics.lastError = message;
  }

  private async publishEvent(event: RuntimeHostEvent): Promise<void> {
    if (!this.rootScope.has('eventBus')) {
      return;
    }

    const eventBus = this.rootScope.resolve<RuntimeHostEventBus>('eventBus');
    await eventBus.publish(event);
  }

  private validateRequiredServices(): void {
    for (const serviceName of this.configuration.requiredServices ?? []) {
      if (!this.rootScope.has(serviceName)) {
        const message = `Unable to resolve required service '${serviceName}'`;
        this.diagnostics.serviceResolutionFailures.push(message);
        this.diagnostics.lastError = message;
        throw new RuntimeHostInitializationException(message);
      }
    }
  }

  private measureDuration(): number {
    return 0;
  }

  private snapshot(): RuntimeHostSnapshot {
    return {
      state: this._state,
      timestamp: new Date().toISOString(),
      configuration: this.configuration,
      diagnostics: this.diagnostics,
      context: this.context,
    };
  }

  private syncContext(): void {
    this.context = new RuntimeHostContext({
      configuration: this.configuration,
      runtime: this.runtime,
      scope: this.rootScope,
      services: this.services,
      state: this._state,
    });
  }
}

export class RuntimeHostBuilder {
  private configuration?: RuntimeHostConfiguration;
  private readonly services = new Map<string, unknown>();
  private readonly observers: RuntimeHostObserver[] = [];
  private readonly middleware: RuntimeHostMiddleware[] = [];

  public withConfiguration(configuration: RuntimeHostConfiguration): this {
    this.configuration = configuration;
    return this;
  }

  public withService<T>(key: string, value: T): this {
    if (this.services.has(key)) {
      throw new RuntimeHostConfigurationException(`Service '${key}' is already registered`);
    }

    this.services.set(key, value);
    return this;
  }

  public withObserver(observer: RuntimeHostObserver): this {
    this.observers.push(observer);
    return this;
  }

  public withMiddleware(middleware: RuntimeHostMiddleware): this {
    this.middleware.push(middleware);
    return this;
  }

  public withOptions(options: RuntimeHostOptions): this {
    this.configuration = options.configuration;
    if (options.runtime) {
      this.services.set('runtime', options.runtime);
    }
    if (options.services) {
      for (const [key, value] of options.services.entries()) {
        this.services.set(key, value);
      }
    }
    if (options.observers) {
      this.observers.push(...options.observers);
    }
    return this;
  }

  public build(): RuntimeHost {
    if (!this.configuration) {
      throw new RuntimeHostConfigurationException('Runtime host configuration is required');
    }

    const normalized = normalizeRuntimeHostConfiguration(this.configuration);
    validateRuntimeHostConfiguration(normalized);

    const runtime = new Runtime({ id: normalized.id, name: normalized.name });
    const host = new RuntimeHost({
      configuration: normalized,
      runtime,
      services: this.services,
      observers: this.observers,
    });

    host.initialize(RuntimeHostState.Configured, 'built');
    return host;
  }
}

function isValidTransition(from: ExecutionStatus, to: ExecutionStatus): boolean {
  const validTransitions: Record<ExecutionStatus, readonly ExecutionStatus[]> = {
    [ExecutionStatus.Created]: [
      ExecutionStatus.Queued,
      ExecutionStatus.Starting,
      ExecutionStatus.Running,
      ExecutionStatus.TimedOut,
    ],
    [ExecutionStatus.Queued]: [
      ExecutionStatus.Starting,
      ExecutionStatus.Running,
      ExecutionStatus.Cancelled,
      ExecutionStatus.Failed,
      ExecutionStatus.TimedOut,
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

function isValidRuntimeHostTransition(from: RuntimeHostState, to: RuntimeHostState): boolean {
  const transitions: Record<RuntimeHostState, readonly RuntimeHostState[]> = {
    [RuntimeHostState.Created]: [RuntimeHostState.Configuring, RuntimeHostState.Configured],
    [RuntimeHostState.Configuring]: [RuntimeHostState.Configured, RuntimeHostState.Failed],
    [RuntimeHostState.Configured]: [
      RuntimeHostState.Starting,
      RuntimeHostState.Stopping,
      RuntimeHostState.Stopped,
    ],
    [RuntimeHostState.Starting]: [RuntimeHostState.Running, RuntimeHostState.Failed],
    [RuntimeHostState.Running]: [RuntimeHostState.Stopping, RuntimeHostState.Failed],
    [RuntimeHostState.Stopping]: [RuntimeHostState.Stopped, RuntimeHostState.Failed],
    [RuntimeHostState.Stopped]: [],
    [RuntimeHostState.Failed]: [],
  };

  return transitions[from]?.includes(to) ?? false;
}

function normalizeRuntimeHostConfiguration(
  configuration: RuntimeHostConfiguration,
): RuntimeHostConfiguration {
  return {
    id: configuration.id,
    name: configuration.name,
    execution: {
      timeoutMs: configuration.execution.timeoutMs ?? 30000,
      concurrency: configuration.execution.concurrency ?? 1,
    },
    pipeline: {
      middleware: [...configuration.pipeline.middleware],
    },
    observer: {
      enabled: configuration.observer?.enabled ?? true,
    },
    metrics: {
      enabled: configuration.metrics?.enabled ?? true,
    },
    requiredServices: [...(configuration.requiredServices ?? [])],
  };
}

function freezeRuntimeHostConfiguration(
  configuration: RuntimeHostConfiguration,
): RuntimeHostConfiguration {
  return deepFreeze(normalizeRuntimeHostConfiguration(configuration)) as RuntimeHostConfiguration;
}

function validateRuntimeHostConfiguration(configuration: RuntimeHostConfiguration): void {
  const errors: string[] = [];
  if (!configuration.id.trim()) {
    errors.push('Runtime host id is required');
  }

  if (!configuration.name.trim()) {
    errors.push('Runtime host name is required');
  }

  if (configuration.execution.timeoutMs <= 0) {
    errors.push('Execution timeout must be greater than zero');
  }

  if (configuration.execution.concurrency <= 0) {
    errors.push('Execution concurrency must be greater than zero');
  }

  if (errors.length > 0) {
    throw new RuntimeHostConfigurationException(errors.join('; '));
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const nestedValue of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nestedValue);
    }
  }

  return value;
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
