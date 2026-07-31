export enum ExecutionBehavior {
  Default = 'default',
  ShortCircuit = 'short-circuit',
}

export enum ExecutionStage {
  Pre = 'pre',
  Post = 'post',
}

export type ExecutionPipelineState =
  'created' | 'running' | 'completed' | 'cancelled' | 'failed' | 'short-circuited';

export interface IExecutionBehavior {
  readonly behavior?: ExecutionBehavior;
}

export interface IExecutionStage {
  readonly stage?: ExecutionStage;
}

export interface IExecutionPipeline {
  readonly descriptors: readonly ExecutionMiddlewareDescriptor[];
  readonly metrics: ExecutionPipelineMetrics;
  execute<TValue = unknown, TMetadata extends Record<string, unknown> = Record<string, unknown>>(
    context: ExecutionPipelineContext<Record<string, unknown>, unknown>,
    delegate: IExecutionDelegate<TValue, TMetadata>,
  ): Promise<ExecutionPipelineResult<TValue, TMetadata>>;
}

export interface IExecutionPipelineBuilder {
  use(middleware: IExecutionMiddleware): this;
  useMiddleware(middleware: IExecutionMiddleware): this;
  useFactory(factory: () => IExecutionMiddleware): this;
  insertBefore(id: string, middleware: IExecutionMiddleware): this;
  insertAfter(id: string, middleware: IExecutionMiddleware): this;
  replace(id: string, middleware: IExecutionMiddleware): this;
  remove(id: string): this;
  validate(): void;
  build(): IExecutionPipeline;
}

export interface IExecutionMiddleware extends IExecutionBehavior, IExecutionStage {
  readonly id: string;
  execute<TValue = unknown, TMetadata extends Record<string, unknown> = Record<string, unknown>>(
    context: ExecutionPipelineContext<Record<string, unknown>, unknown>,
    next: IExecutionDelegate<TValue, TMetadata>,
  ):
    | Promise<ExecutionPipelineResult<TValue, TMetadata>>
    | ExecutionPipelineResult<TValue, TMetadata>;
}

export interface IExecutionDelegate<
  TValue = unknown,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> {
  (
    context: ExecutionPipelineContext<Record<string, unknown>, unknown>,
  ):
    | Promise<ExecutionPipelineResult<TValue, TMetadata>>
    | ExecutionPipelineResult<TValue, TMetadata>;
}

export interface ExecutionPipelineError {
  readonly code: string;
  readonly message: string;
  readonly cause?: unknown;
}

export interface ExecutionPipelineMetricsSnapshot {
  readonly executionCount: number;
  readonly completed: number;
  readonly failed: number;
  readonly cancelled: number;
  readonly shortCircuited: number;
  readonly averageDurationMs: number;
  readonly maximumDurationMs: number;
  readonly minimumDurationMs: number;
}

export class ExecutionPipelineMetrics {
  private completedCount = 0;
  private failedCount = 0;
  private cancelledCount = 0;
  private shortCircuitedCount = 0;
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

  public recordShortCircuited(durationMs: number): void {
    this.shortCircuitedCount += 1;
    this.durations.push(durationMs);
  }

  public get completed(): number {
    return this.completedCount;
  }

  public get failed(): number {
    return this.failedCount;
  }

  public get cancelled(): number {
    return this.cancelledCount;
  }

  public get shortCircuited(): number {
    return this.shortCircuitedCount;
  }

  public get averageDurationMs(): number {
    return this.durations.length === 0
      ? 0
      : this.durations.reduce((sum, value) => sum + value, 0) / this.durations.length;
  }

  public get maximumDurationMs(): number {
    return this.durations.length === 0 ? 0 : Math.max(...this.durations);
  }

  public get minimumDurationMs(): number {
    return this.durations.length === 0 ? 0 : Math.min(...this.durations);
  }

  public snapshot(): ExecutionPipelineMetricsSnapshot {
    return {
      executionCount:
        this.completedCount + this.failedCount + this.cancelledCount + this.shortCircuitedCount,
      completed: this.completedCount,
      failed: this.failedCount,
      cancelled: this.cancelledCount,
      shortCircuited: this.shortCircuitedCount,
      averageDurationMs: this.averageDurationMs,
      maximumDurationMs: this.maximumDurationMs,
      minimumDurationMs: this.minimumDurationMs,
    };
  }
}

export class ExecutionMiddlewareDescriptor {
  public constructor(
    public readonly middleware: IExecutionMiddleware,
    public readonly stage: ExecutionStage = ExecutionStage.Pre,
    public readonly behavior: ExecutionBehavior = ExecutionBehavior.Default,
  ) {}
}

export class ExecutionMiddlewareCollection {
  private readonly descriptors: ExecutionMiddlewareDescriptor[] = [];

  public add(middleware: IExecutionMiddleware): void {
    this.descriptors.push(
      new ExecutionMiddlewareDescriptor(
        middleware,
        middleware.stage ?? ExecutionStage.Pre,
        middleware.behavior ?? ExecutionBehavior.Default,
      ),
    );
  }

  public insertBefore(id: string, middleware: IExecutionMiddleware): void {
    const index = this.descriptors.findIndex((descriptor) => descriptor.middleware.id === id);
    if (index === -1) {
      throw new InvalidPipelineException(`Middleware '${id}' was not found`);
    }

    this.descriptors.splice(
      index,
      0,
      new ExecutionMiddlewareDescriptor(
        middleware,
        middleware.stage ?? ExecutionStage.Pre,
        middleware.behavior ?? ExecutionBehavior.Default,
      ),
    );
  }

  public insertAfter(id: string, middleware: IExecutionMiddleware): void {
    const index = this.descriptors.findIndex((descriptor) => descriptor.middleware.id === id);
    if (index === -1) {
      throw new InvalidPipelineException(`Middleware '${id}' was not found`);
    }

    this.descriptors.splice(
      index + 1,
      0,
      new ExecutionMiddlewareDescriptor(
        middleware,
        middleware.stage ?? ExecutionStage.Pre,
        middleware.behavior ?? ExecutionBehavior.Default,
      ),
    );
  }

  public replace(id: string, middleware: IExecutionMiddleware): void {
    const index = this.descriptors.findIndex((descriptor) => descriptor.middleware.id === id);
    if (index === -1) {
      throw new InvalidPipelineException(`Middleware '${id}' was not found`);
    }

    this.descriptors[index] = new ExecutionMiddlewareDescriptor(
      middleware,
      middleware.stage ?? ExecutionStage.Pre,
      middleware.behavior ?? ExecutionBehavior.Default,
    );
  }

  public remove(id: string): void {
    const index = this.descriptors.findIndex((descriptor) => descriptor.middleware.id === id);
    if (index === -1) {
      return;
    }

    this.descriptors.splice(index, 1);
  }

  public toArray(): readonly ExecutionMiddlewareDescriptor[] {
    return [...this.descriptors];
  }
}

export interface ExecutionPipelineContextOptions<
  TContextData = Record<string, unknown>,
  TRuntimeContext = unknown,
> {
  readonly execution?: unknown;
  readonly runtimeContext?: TRuntimeContext;
  readonly cancellation?: AbortSignal;
  readonly services?: Readonly<Record<string, unknown>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly correlationId: string;
  readonly executionScope?: string;
  readonly data?: Readonly<TContextData>;
}

export interface ExecutionPipelineSnapshot {
  readonly state: ExecutionPipelineState;
  readonly correlationId: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly executionScope?: string;
  readonly data: ReadonlyMap<string, unknown>;
}

export class ExecutionPipelineContext<
  TContextData = Record<string, unknown>,
  TRuntimeContext = unknown,
> {
  public readonly execution?: unknown;
  public readonly runtimeContext?: TRuntimeContext;
  public readonly correlationId: string;
  public readonly cancellation?: AbortSignal;
  public readonly services: Readonly<Record<string, unknown>>;
  public readonly metadata: Readonly<Record<string, unknown>>;
  public readonly executionScope?: string;
  private readonly dataBag = new Map<string, unknown>();
  private _state: ExecutionPipelineState = 'created';

  public constructor(options: ExecutionPipelineContextOptions<TContextData, TRuntimeContext>) {
    this.execution = options.execution;
    this.runtimeContext = options.runtimeContext;
    this.correlationId = options.correlationId;
    this.cancellation = options.cancellation;
    this.services = options.services ?? {};
    this.metadata = Object.freeze({ ...(options.metadata ?? {}) });
    this.executionScope = options.executionScope;

    if (options.data) {
      for (const [key, value] of Object.entries(options.data as Record<string, unknown>)) {
        this.dataBag.set(key, value);
      }
    }
  }

  public get state(): ExecutionPipelineState {
    return this._state;
  }

  public get data(): ReadonlyMap<string, unknown> {
    return this.dataBag;
  }

  public setData<TValue>(key: string, value: TValue): void {
    this.dataBag.set(key, value);
  }

  public getData<TValue>(key: string): TValue | undefined {
    return this.dataBag.get(key) as TValue | undefined;
  }

  public markRunning(): void {
    this._state = 'running';
  }

  public markCompleted(): void {
    this._state = 'completed';
  }

  public markCancelled(): void {
    this._state = 'cancelled';
  }

  public markFailed(): void {
    this._state = 'failed';
  }

  public markShortCircuited(): void {
    this._state = 'short-circuited';
  }

  public isCancelled(): boolean {
    return this.cancellation?.aborted ?? false;
  }

  public throwIfCancelled(): void {
    if (this.isCancelled()) {
      throw new Error('Execution cancelled');
    }
  }

  public snapshot(): ExecutionPipelineSnapshot {
    return Object.freeze({
      state: this._state,
      correlationId: this.correlationId,
      metadata: this.metadata,
      executionScope: this.executionScope,
      data: new Map(this.dataBag),
    });
  }
}

export class PipelineExecutionException extends Error {
  public constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'PipelineExecutionException';
  }
}

export class PipelineValidationException extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'PipelineValidationException';
  }
}

export class MiddlewareExecutionException extends Error {
  public constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'MiddlewareExecutionException';
  }
}

export class InvalidPipelineException extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'InvalidPipelineException';
  }
}

export interface ExecutionPipelineResult<
  TValue = unknown,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly status: ExecutionPipelineState;
  readonly value?: TValue;
  readonly metadata: Readonly<TMetadata>;
  readonly error?: ExecutionPipelineError;
  readonly durationMs: number;
  readonly middlewareCount: number;
}

export class ExecutionPipelineExecutor {
  public constructor(private readonly descriptors: readonly ExecutionMiddlewareDescriptor[] = []) {}

  public async execute<
    TValue = unknown,
    TMetadata extends Record<string, unknown> = Record<string, unknown>,
  >(
    context: ExecutionPipelineContext<Record<string, unknown>, unknown>,
    delegate: IExecutionDelegate<TValue, TMetadata>,
  ): Promise<ExecutionPipelineResult<TValue, TMetadata>> {
    const startedAt = Date.now();
    context.markRunning();

    const chain = this.descriptors.reduceRight<IExecutionDelegate<TValue, TMetadata>>(
      (next, descriptor) =>
        async (currentContext: ExecutionPipelineContext<Record<string, unknown>, unknown>) => {
          if (currentContext.isCancelled()) {
            currentContext.markCancelled();
            return this.createCancelledResult<TValue, TMetadata>(startedAt);
          }

          currentContext.throwIfCancelled();
          try {
            const result = await descriptor.middleware.execute(
              currentContext,
              async (nextContext) => next(nextContext),
            );
            if (result.status === 'short-circuited' || result.status === 'cancelled') {
              return result;
            }
            return result;
          } catch (error) {
            currentContext.markFailed();
            const message = error instanceof Error ? error.message : 'Middleware execution failed';
            const wrapped =
              error instanceof MiddlewareExecutionException ||
              error instanceof PipelineExecutionException
                ? error
                : new MiddlewareExecutionException(message, error);
            throw new PipelineExecutionException(`Pipeline execution failed: ${message}`, wrapped);
          }
        },
      async (currentContext: ExecutionPipelineContext<Record<string, unknown>, unknown>) => {
        if (currentContext.isCancelled()) {
          currentContext.markCancelled();
          return this.createCancelledResult<TValue, TMetadata>(startedAt);
        }

        currentContext.throwIfCancelled();
        const result = await delegate(currentContext);
        currentContext.markCompleted();
        return {
          ...result,
          durationMs: Date.now() - startedAt,
          middlewareCount: this.descriptors.length,
          status: result.status ?? 'completed',
        } satisfies ExecutionPipelineResult<TValue, TMetadata>;
      },
    );

    try {
      const result = await chain(context);
      return result;
    } catch (error) {
      context.markFailed();
      if (
        error instanceof PipelineExecutionException ||
        error instanceof MiddlewareExecutionException
      ) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Pipeline execution failed';
      throw new PipelineExecutionException(message, error);
    }
  }

  private createCancelledResult<TValue, TMetadata extends Record<string, unknown>>(
    startedAt: number,
  ): ExecutionPipelineResult<TValue, TMetadata> {
    return {
      status: 'cancelled',
      metadata: {} as Readonly<TMetadata>,
      durationMs: Date.now() - startedAt,
      middlewareCount: this.descriptors.length,
      error: {
        code: 'pipeline.cancelled',
        message: 'Execution cancelled',
      },
    };
  }
}

export class ExecutionPipeline implements IExecutionPipeline {
  public constructor(
    public readonly descriptors: readonly ExecutionMiddlewareDescriptor[] = [],
    public readonly metrics: ExecutionPipelineMetrics = new ExecutionPipelineMetrics(),
  ) {}

  public async execute<
    TValue = unknown,
    TMetadata extends Record<string, unknown> = Record<string, unknown>,
  >(
    context: ExecutionPipelineContext<Record<string, unknown>, unknown>,
    delegate: IExecutionDelegate<TValue, TMetadata>,
  ): Promise<ExecutionPipelineResult<TValue, TMetadata>> {
    const executor = new ExecutionPipelineExecutor(this.descriptors);
    const startedAt = Date.now();
    try {
      const result = await executor.execute(context, delegate);
      if (result.status === 'cancelled') {
        this.metrics.recordCancelled(Date.now() - startedAt);
      } else if (result.status === 'short-circuited') {
        this.metrics.recordShortCircuited(Date.now() - startedAt);
      } else if (result.status === 'failed') {
        this.metrics.recordFailed(Date.now() - startedAt);
      } else {
        this.metrics.recordCompleted(Date.now() - startedAt);
      }
      return result;
    } catch (error) {
      this.metrics.recordFailed(Date.now() - startedAt);
      throw error;
    }
  }
}

export class ExecutionPipelineBuilder implements IExecutionPipelineBuilder {
  public readonly descriptors: ExecutionMiddlewareDescriptor[] = [];

  public use(middleware: IExecutionMiddleware): this {
    return this.useMiddleware(middleware);
  }

  public useMiddleware(middleware: IExecutionMiddleware): this {
    this.descriptors.push(
      new ExecutionMiddlewareDescriptor(
        middleware,
        middleware.stage ?? ExecutionStage.Pre,
        middleware.behavior ?? ExecutionBehavior.Default,
      ),
    );
    return this;
  }

  public useFactory(factory: () => IExecutionMiddleware): this {
    return this.useMiddleware(factory());
  }

  public insertBefore(id: string, middleware: IExecutionMiddleware): this {
    const index = this.descriptors.findIndex((descriptor) => descriptor.middleware.id === id);
    if (index === -1) {
      throw new InvalidPipelineException(`Middleware '${id}' was not found`);
    }

    this.descriptors.splice(
      index,
      0,
      new ExecutionMiddlewareDescriptor(
        middleware,
        middleware.stage ?? ExecutionStage.Pre,
        middleware.behavior ?? ExecutionBehavior.Default,
      ),
    );
    return this;
  }

  public insertAfter(id: string, middleware: IExecutionMiddleware): this {
    const index = this.descriptors.findIndex((descriptor) => descriptor.middleware.id === id);
    if (index === -1) {
      throw new InvalidPipelineException(`Middleware '${id}' was not found`);
    }

    this.descriptors.splice(
      index + 1,
      0,
      new ExecutionMiddlewareDescriptor(
        middleware,
        middleware.stage ?? ExecutionStage.Pre,
        middleware.behavior ?? ExecutionBehavior.Default,
      ),
    );
    return this;
  }

  public replace(id: string, middleware: IExecutionMiddleware): this {
    const index = this.descriptors.findIndex((descriptor) => descriptor.middleware.id === id);
    if (index === -1) {
      throw new InvalidPipelineException(`Middleware '${id}' was not found`);
    }

    this.descriptors[index] = new ExecutionMiddlewareDescriptor(
      middleware,
      middleware.stage ?? ExecutionStage.Pre,
      middleware.behavior ?? ExecutionBehavior.Default,
    );
    return this;
  }

  public remove(id: string): this {
    this.descriptors.splice(
      this.descriptors.findIndex((descriptor) => descriptor.middleware.id === id),
      1,
    );
    return this;
  }

  public validate(): void {
    const seen = new Set<string>();
    for (const descriptor of this.descriptors) {
      if (!descriptor.middleware.id) {
        throw new PipelineValidationException('Middleware ids must be defined');
      }

      if (seen.has(descriptor.middleware.id)) {
        throw new PipelineValidationException(
          `Duplicate middleware id '${descriptor.middleware.id}'`,
        );
      }

      seen.add(descriptor.middleware.id);
    }
  }

  public build(): ExecutionPipeline {
    this.validate();
    return new ExecutionPipeline([...this.descriptors]);
  }
}
