import type {
  Identifier,
  SerializableValueObject,
  TimestampString,
  VersionString,
} from '@infrashield/contracts';

import type { ToolExecutionContext } from './tool-sdk.js';
import { ToolRegistry, ToolRegistryException, ToolResultStatus } from './tool-registry.js';

export type ToolExecutionStatus = ToolResultStatus | 'cancelled';

export class ToolExecutionException extends ToolRegistryException {
  public readonly kind: 'timeout' | 'cancelled' | 'resource-limit' | 'execution';

  public constructor(
    message: string,
    kind: 'timeout' | 'cancelled' | 'resource-limit' | 'execution' = 'execution',
  ) {
    super(message);
    this.name = 'ToolExecutionException';
    this.kind = kind;
  }
}

export interface ToolExecutionMetrics {
  readonly startedAt: TimestampString;
  readonly completedAt: TimestampString;
  readonly durationMs: number;
  readonly waitTimeMs: number;
  readonly timedOut: boolean;
  readonly cancelled: boolean;
  readonly activeExecutions: number;
  readonly queuedExecutions: number;
}

export interface ToolExecutionResult<
  TOutput extends SerializableValueObject = SerializableValueObject,
> {
  readonly executionId: Identifier;
  readonly toolId: Identifier;
  readonly version: VersionString;
  readonly status: ToolExecutionStatus;
  readonly output?: Readonly<TOutput>;
  readonly error?: string;
  readonly metadata?: Readonly<SerializableValueObject>;
  readonly metrics: ToolExecutionMetrics;
}

export interface ToolExecutionLifecycleEvent {
  readonly executionId: Identifier;
  readonly toolId: Identifier;
  readonly status: 'queued' | 'started' | ToolExecutionStatus;
  readonly timestamp: TimestampString;
  readonly metadata?: Readonly<SerializableValueObject>;
}

export class ToolCancellation {
  private cancelled = false;
  private cancelReason?: string;
  private readonly listeners = new Set<(reason: string) => void>();

  public cancel(reason = 'Tool execution cancelled.'): void {
    if (this.cancelled) {
      return;
    }

    this.cancelled = true;
    this.cancelReason = reason;
    for (const listener of this.listeners) {
      listener(reason);
    }
    this.listeners.clear();
  }

  public get isCancelled(): boolean {
    return this.cancelled;
  }

  public get reason(): string | undefined {
    return this.cancelReason;
  }

  public onCancel(listener: (reason: string) => void): () => void {
    if (this.cancelled) {
      listener(this.cancelReason ?? 'Tool execution cancelled.');
      return () => undefined;
    }

    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public throwIfCancelled(): void {
    if (this.cancelled) {
      throw new ToolExecutionException(
        this.cancelReason ?? 'Tool execution cancelled.',
        'cancelled',
      );
    }
  }
}

export class ToolTimeoutManager {
  public async run<T>(options: {
    readonly operation: () => Promise<T> | T;
    readonly timeoutMs?: number;
    readonly cancellation?: ToolCancellation;
    readonly timeoutMessage?: string;
  }): Promise<T> {
    const { cancellation, operation, timeoutMs } = options;
    cancellation?.throwIfCancelled();

    if (timeoutMs === undefined) {
      return operation();
    }

    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const finish = (resolver: (value: T) => void, rejecter: (error: unknown) => void) => {
        return (value: T | unknown) => {
          if (settled) {
            return;
          }

          settled = true;
          clearTimeout(timer);
          unsubscribe?.();

          if (value instanceof Error) {
            rejecter(value);
            return;
          }

          resolver(value as T);
        };
      };

      const resolveOnce = finish(resolve, reject);
      const rejectOnce = finish(resolve, reject);
      const timer = setTimeout(() => {
        rejectOnce(
          new ToolExecutionException(
            options.timeoutMessage ?? `Tool execution timed out after ${timeoutMs}ms.`,
            'timeout',
          ),
        );
      }, timeoutMs);
      const unsubscribe = cancellation?.onCancel((reason) => {
        rejectOnce(new ToolExecutionException(reason, 'cancelled'));
      });

      Promise.resolve(operation()).then(resolveOnce).catch(rejectOnce);
    });
  }
}

export interface ToolResourceLimitSnapshot {
  readonly maxConcurrentExecutions: number;
  readonly maxQueueDepth: number;
  readonly activeExecutions: number;
  readonly queuedExecutions: number;
  readonly peakConcurrentExecutions: number;
}

export class ToolResourceLimiter {
  private activeExecutions = 0;
  private peakConcurrentExecutions = 0;
  private readonly queue: Array<() => void> = [];

  public constructor(
    private readonly options: {
      readonly maxConcurrentExecutions?: number;
      readonly maxQueueDepth?: number;
    } = {},
  ) {}

  public async acquire(): Promise<() => void> {
    const maxConcurrentExecutions =
      this.options.maxConcurrentExecutions ?? Number.POSITIVE_INFINITY;
    const maxQueueDepth = this.options.maxQueueDepth ?? Number.POSITIVE_INFINITY;

    if (this.activeExecutions < maxConcurrentExecutions) {
      this.activeExecutions += 1;
      this.peakConcurrentExecutions = Math.max(
        this.peakConcurrentExecutions,
        this.activeExecutions,
      );
      return () => {
        this.release();
      };
    }

    if (this.queue.length >= maxQueueDepth) {
      throw new ToolExecutionException('Tool execution queue limit exceeded.', 'resource-limit');
    }

    return new Promise<() => void>((resolve) => {
      this.queue.push(() => {
        this.activeExecutions += 1;
        this.peakConcurrentExecutions = Math.max(
          this.peakConcurrentExecutions,
          this.activeExecutions,
        );
        resolve(() => {
          this.release();
        });
      });
    });
  }

  public snapshot(): ToolResourceLimitSnapshot {
    return Object.freeze({
      maxConcurrentExecutions: this.options.maxConcurrentExecutions ?? Number.POSITIVE_INFINITY,
      maxQueueDepth: this.options.maxQueueDepth ?? Number.POSITIVE_INFINITY,
      activeExecutions: this.activeExecutions,
      queuedExecutions: this.queue.length,
      peakConcurrentExecutions: this.peakConcurrentExecutions,
    });
  }

  private release(): void {
    this.activeExecutions = Math.max(0, this.activeExecutions - 1);
    const next = this.queue.shift();
    next?.();
  }
}

export class ToolSandbox {
  public constructor(
    private readonly timeoutManager: ToolTimeoutManager = new ToolTimeoutManager(),
  ) {}

  public async execute<TOutput extends SerializableValueObject>(options: {
    readonly executionId: Identifier;
    readonly toolId: Identifier;
    readonly version: VersionString;
    readonly operation: () => Promise<TOutput> | TOutput;
    readonly timeoutMs?: number;
    readonly cancellation?: ToolCancellation;
    readonly metadata?: Readonly<SerializableValueObject>;
    readonly waitTimeMs?: number;
    readonly resourceSnapshot: ToolResourceLimitSnapshot;
  }): Promise<ToolExecutionResult<TOutput>> {
    const startedAtMs = Date.now();
    const startedAt = new Date(startedAtMs).toISOString();

    try {
      const output = await this.timeoutManager.run({
        operation: options.operation,
        timeoutMs: options.timeoutMs,
        cancellation: options.cancellation,
        timeoutMessage: `Tool ${options.toolId} timed out after ${options.timeoutMs}ms.`,
      });

      return this.buildResult(options, {
        status: 'completed',
        output,
        startedAt,
        startedAtMs,
      });
    } catch (error) {
      const exception =
        error instanceof ToolExecutionException
          ? error
          : new ToolExecutionException(
              error instanceof Error ? error.message : 'Tool execution failed.',
              'execution',
            );

      return this.buildResult(options, {
        status:
          exception.kind === 'cancelled'
            ? 'cancelled'
            : exception.kind === 'timeout'
              ? 'timed-out'
              : 'failed',
        error: exception.message,
        startedAt,
        startedAtMs,
      });
    }
  }

  private buildResult<TOutput extends SerializableValueObject>(
    options: {
      readonly executionId: Identifier;
      readonly toolId: Identifier;
      readonly version: VersionString;
      readonly metadata?: Readonly<SerializableValueObject>;
      readonly waitTimeMs?: number;
      readonly resourceSnapshot: ToolResourceLimitSnapshot;
    },
    result: {
      readonly status: ToolExecutionStatus;
      readonly output?: TOutput;
      readonly error?: string;
      readonly startedAt: TimestampString;
      readonly startedAtMs: number;
    },
  ): ToolExecutionResult<TOutput> {
    const completedAtMs = Date.now();
    return Object.freeze({
      executionId: options.executionId,
      toolId: options.toolId,
      version: options.version,
      status: result.status,
      output: result.output ? Object.freeze({ ...result.output }) : undefined,
      error: result.error,
      metadata: options.metadata ? Object.freeze({ ...options.metadata }) : undefined,
      metrics: Object.freeze({
        startedAt: result.startedAt,
        completedAt: new Date(completedAtMs).toISOString(),
        durationMs: completedAtMs - result.startedAtMs,
        waitTimeMs: options.waitTimeMs ?? 0,
        timedOut: result.status === 'timed-out',
        cancelled: result.status === 'cancelled',
        activeExecutions: options.resourceSnapshot.activeExecutions,
        queuedExecutions: options.resourceSnapshot.queuedExecutions,
      }),
    });
  }
}

export class ToolExecutionManager {
  private readonly events: ToolExecutionLifecycleEvent[] = [];
  private readonly sandbox: ToolSandbox;

  public constructor(
    private readonly options: {
      readonly registry?: ToolRegistry;
      readonly resourceLimiter?: ToolResourceLimiter;
      readonly timeoutManager?: ToolTimeoutManager;
      readonly sandbox?: ToolSandbox;
    } = {},
  ) {
    const timeoutManager = options.timeoutManager ?? new ToolTimeoutManager();
    this.sandbox = options.sandbox ?? new ToolSandbox(timeoutManager);
  }

  public async execute<
    TInput extends SerializableValueObject = SerializableValueObject,
    TOutput extends SerializableValueObject = SerializableValueObject,
  >(
    toolId: Identifier,
    input: Readonly<TInput>,
    context: ToolExecutionContext = {},
  ): Promise<ToolExecutionResult<TOutput>> {
    const registry = this.options.registry ?? new ToolRegistry();
    const tool = registry.get<TInput, TOutput>(toolId);
    if (!tool) {
      throw new ToolExecutionException(`Tool ${toolId} is not registered.`, 'execution');
    }

    const limiter = this.options.resourceLimiter ?? new ToolResourceLimiter();
    const queuedAtMs = Date.now();
    const executionId = context.executionId ?? context.requestId ?? this.createExecutionId(toolId);
    this.recordEvent({
      executionId,
      toolId,
      status: 'queued',
      timestamp: new Date(queuedAtMs).toISOString(),
      metadata: context.metadata,
    });

    const release = await limiter.acquire();
    const startedAtMs = Date.now();
    const executionContext = {
      ...context,
      executionId,
      requestId: executionId,
    } as ToolExecutionContext;

    this.recordEvent({
      executionId,
      toolId,
      status: 'started',
      timestamp: new Date(startedAtMs).toISOString(),
      metadata: executionContext.metadata,
    });

    try {
      const result = await this.sandbox.execute<TOutput>({
        executionId,
        toolId,
        version: tool.metadata.version,
        timeoutMs: executionContext.timeoutMs ?? tool.metadata.timeoutMs,
        cancellation: executionContext.cancellation,
        metadata: executionContext.metadata,
        waitTimeMs: startedAtMs - queuedAtMs,
        resourceSnapshot: limiter.snapshot(),
        operation: async () => {
          executionContext.cancellation?.throwIfCancelled();
          await tool.validator.validateInput(input, executionContext);
          const output = await tool.executor.execute(input, executionContext);
          executionContext.cancellation?.throwIfCancelled();
          await tool.validator.validateOutput(output, executionContext);
          return output;
        },
      });

      this.recordEvent({
        executionId,
        toolId,
        status: result.status,
        timestamp: result.metrics.completedAt,
        metadata: result.metadata,
      });

      return result;
    } finally {
      release();
    }
  }

  public listEvents(): readonly ToolExecutionLifecycleEvent[] {
    return Object.freeze([...this.events]);
  }

  public getResourceSnapshot(): ToolResourceLimitSnapshot {
    return (this.options.resourceLimiter ?? new ToolResourceLimiter()).snapshot();
  }

  private createExecutionId(toolId: Identifier): Identifier {
    return `${toolId}-execution-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private recordEvent(event: ToolExecutionLifecycleEvent): void {
    this.events.push(Object.freeze({ ...event }));
  }
}
