import type {
  IAgent,
  IAgentExecutor,
  IExecutionContext,
  IRetryPolicy,
  SerializableValueObject,
} from '@agentic/sdk';
import { ExecutionStatus } from '@agentic/sdk';

import { CancellationError, CancellationManager } from './cancellation.js';
import { RuntimeEventType } from './common.js';
import { createRuntimeEvent } from './events.js';
import { ExecutionContext } from './execution-context.js';
import { ExecutionResult, RuntimeConfiguration, RuntimeHealth, RuntimeStatus } from './common.js';
import { LifecycleManager } from './lifecycle.js';
import { ExecutionPipeline } from './pipeline.js';
import { RetryManager } from './retry.js';
import { ServiceRegistry } from './registry.js';

/**
 * Runtime engine configuration.
 */
export interface RuntimeEngineOptions {
  readonly configuration: RuntimeConfiguration;
  readonly services: ServiceRegistry;
  readonly executor: IAgentExecutor;
  readonly pipeline: ExecutionPipeline;
  readonly lifecycleManager?: LifecycleManager;
  readonly cancellationManager?: CancellationManager;
  readonly retryManager?: RetryManager;
  readonly retryPolicy?: IRetryPolicy;
}

/**
 * Runtime execution options.
 */
export interface RuntimeExecutionOptions {
  readonly timeoutMs?: number;
  readonly retryPolicy?: IRetryPolicy;
}

/**
 * First working runtime engine for Agentic OS.
 */
export class RuntimeEngine {
  private readonly services: ServiceRegistry;
  private readonly executor: IAgentExecutor;
  private readonly pipeline: ExecutionPipeline;
  private readonly lifecycleManager: LifecycleManager;
  private readonly cancellationManager: CancellationManager;
  private readonly retryManager: RetryManager;
  private readonly retryPolicy?: IRetryPolicy;
  private status: RuntimeStatus = RuntimeStatus.Created;
  private readonly configuration: RuntimeConfiguration;

  public constructor(options: RuntimeEngineOptions) {
    this.configuration = options.configuration;
    this.services = options.services;
    this.executor = options.executor;
    this.pipeline = options.pipeline;
    this.lifecycleManager = options.lifecycleManager ?? new LifecycleManager(this.services.hooks);
    this.cancellationManager = options.cancellationManager ?? this.services.cancellationManager;
    this.retryManager = options.retryManager ?? this.services.retryManager;
    this.retryPolicy = options.retryPolicy;
  }

  public get runtimeId(): string {
    return this.configuration.runtimeId;
  }

  public get health(): RuntimeHealth {
    return {
      runtimeId: this.configuration.runtimeId,
      status: this.status,
      checkedAt: new Date().toISOString(),
    };
  }

  public async initialize(): Promise<void> {
    await this.lifecycleManager.initialize(this.configuration);
    this.status = RuntimeStatus.Initialized;
    await this.services.eventDispatcher.publish(
      createRuntimeEvent({ eventType: RuntimeEventType.RuntimeInitialized }),
    );
  }

  public async start(): Promise<void> {
    await this.lifecycleManager.start();
    this.status = RuntimeStatus.Running;
    await this.services.eventDispatcher.publish(
      createRuntimeEvent({ eventType: RuntimeEventType.RuntimeStarted }),
    );
  }

  public createExecutionContext(input: {
    readonly executionId: string;
    readonly correlationId: string;
    readonly traceId: string;
    readonly variables: SerializableValueObject;
    readonly metadata?: SerializableValueObject;
    readonly timeoutMs?: number;
  }): ExecutionContext {
    const cancellation = this.cancellationManager.create({ timeoutMs: input.timeoutMs });

    return new ExecutionContext({
      executionId: input.executionId,
      correlationId: input.correlationId,
      traceId: input.traceId,
      variables: input.variables,
      metadata: input.metadata,
      cancellationToken: cancellation.token,
      logger: this.services.logger,
      configuration:
        this.services.configuration ??
        ({
          providerId: this.configuration.runtimeId,
          name: 'runtime-configuration',
          version: '1.0.0',
          load: async () => this.configuration as never,
          snapshot: async () => this.configuration as never,
          get: async () => undefined,
          set: async () => undefined,
          delete: async () => undefined,
        } as never),
      runtime: {
        logger: this.services.logger,
        tracer: this.services.tracer,
        eventBus: this.services.eventDispatcher as never,
      },
    });
  }

  public async execute(
    agent: IAgent,
    context: IExecutionContext,
    options?: RuntimeExecutionOptions,
  ): Promise<ExecutionResult> {
    const effectiveContext =
      context instanceof ExecutionContext
        ? context
        : new ExecutionContext({
            executionId: context.executionId,
            correlationId: context.correlationId,
            traceId: context.traceId,
            variables: context.variables,
            metadata: context.metadata,
            conversationId: context.conversationId,
            cancellationToken: context.cancellationToken,
            logger: context.logger,
            configuration: context.configuration,
            runtime: context.runtime,
          });

    const executionCancellation = this.createExecutionCancellationToken(
      effectiveContext.cancellationToken,
      options?.timeoutMs,
    );

    const cancellationPromise = new Promise<never>((_, reject) => {
      const unsubscribe = executionCancellation.onCancellationRequested((reason) => {
        unsubscribe();
        reject(new CancellationError(reason ?? 'Operation cancelled'));
      });

      if (executionCancellation.isCancellationRequested) {
        unsubscribe();
        reject(new CancellationError(executionCancellation.reason ?? 'Operation cancelled'));
      }
    });

    await this.ensureStarted();
    await this.lifecycleManager.execute(effectiveContext);
    await this.services.eventDispatcher.publish(
      createRuntimeEvent({
        eventType: RuntimeEventType.ExecutionStarted,
        executionId: effectiveContext.executionId,
        payload: { agentId: agent.id },
      }),
    );

    try {
      const result = await Promise.race([
        this.retryManager.execute(
          () =>
            this.pipeline.run(effectiveContext, async () => {
              const agentResult = await this.executor.execute(agent, effectiveContext);
              return new ExecutionResult({
                executionId: agentResult.executionId,
                status: agentResult.status,
                succeeded: agentResult.succeeded,
                startedAt: agentResult.startedAt,
                completedAt: agentResult.completedAt,
                output: agentResult.output,
                error: agentResult.error,
              });
            }),
          options?.retryPolicy ?? this.retryPolicy,
          executionCancellation,
        ),
        cancellationPromise,
      ]);

      const completed = new ExecutionResult({
        executionId: result.executionId,
        status: ExecutionStatus.Completed,
        succeeded: true,
        startedAt: result.startedAt,
        completedAt: result.completedAt ?? new Date().toISOString(),
        output: result.output,
      });

      await this.services.eventDispatcher.publish(
        createRuntimeEvent({
          eventType: RuntimeEventType.ExecutionCompleted,
          executionId: completed.executionId,
          payload: { succeeded: true },
        }),
      );
      await this.lifecycleManager.complete(completed);
      this.status = RuntimeStatus.Completed;
      return completed;
    } catch (error) {
      if (
        error instanceof CancellationError ||
        effectiveContext.cancellationToken.isCancellationRequested
      ) {
        const cancelled = new ExecutionResult({
          executionId: effectiveContext.executionId,
          status: ExecutionStatus.Cancelled,
          succeeded: false,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          error: {
            code: 'runtime.cancelled',
            message: error instanceof Error ? error.message : 'Runtime execution cancelled',
            timestamp: new Date().toISOString(),
          },
        });

        await this.services.eventDispatcher.publish(
          createRuntimeEvent({
            eventType: RuntimeEventType.ExecutionCancelled,
            executionId: cancelled.executionId,
          }),
        );
        await this.lifecycleManager.cancel(effectiveContext, cancelled.error?.message);
        this.status = RuntimeStatus.Cancelled;
        return cancelled;
      }

      const failed = new ExecutionResult({
        executionId: effectiveContext.executionId,
        status: ExecutionStatus.Failed,
        succeeded: false,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        error: {
          code: 'runtime.failed',
          message: error instanceof Error ? error.message : 'Runtime execution failed',
          timestamp: new Date().toISOString(),
        },
      });

      await this.services.eventDispatcher.publish(
        createRuntimeEvent({
          eventType: RuntimeEventType.ExecutionFailed,
          executionId: failed.executionId,
          payload: { message: failed.error?.message ?? 'Runtime execution failed' },
        }),
      );
      await this.lifecycleManager.fail(failed);
      this.status = RuntimeStatus.Failed;
      return failed;
    } finally {
      executionCancellation.dispose();
    }
  }

  public async dispose(): Promise<void> {
    await this.lifecycleManager.dispose(this.configuration.runtimeId);
    this.status = RuntimeStatus.Disposed;
    await this.services.eventDispatcher.publish(
      createRuntimeEvent({ eventType: RuntimeEventType.RuntimeDisposed }),
    );
  }

  private async ensureStarted(): Promise<void> {
    if (this.status === RuntimeStatus.Created) {
      await this.initialize();
      await this.start();
      return;
    }

    if (this.status === RuntimeStatus.Initialized) {
      await this.start();
    }
  }

  private createExecutionCancellationToken(
    cancellationToken: IExecutionContext['cancellationToken'],
    timeoutMs?: number,
  ): import('./cancellation.js').CancellationToken & { dispose(): void } {
    const controller = new AbortController();
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const sourceToken = cancellationToken as IExecutionContext['cancellationToken'] &
      Partial<import('./cancellation.js').CancellationToken>;

    const triggerAbort = (reason?: string): void => {
      if (!controller.signal.aborted) {
        controller.abort(reason ?? 'Operation cancelled');
      }
    };

    const detachOriginal = sourceToken.onCancellationRequested((reason) => {
      triggerAbort(reason);
    });

    if (sourceToken.signal?.aborted) {
      triggerAbort(sourceToken.reason);
    }

    if (typeof timeoutMs === 'number' && timeoutMs > 0) {
      timeoutHandle = setTimeout(() => {
        triggerAbort('timeout');
      }, timeoutMs);
    }

    return {
      get isCancellationRequested(): boolean {
        return sourceToken.isCancellationRequested || controller.signal.aborted;
      },
      get reason(): string | undefined {
        return sourceToken.reason ?? (controller.signal.aborted ? 'timeout' : undefined);
      },
      get signal(): AbortSignal {
        return controller.signal;
      },
      throwIfCancellationRequested(): void {
        sourceToken.throwIfCancellationRequested();
        if (controller.signal.aborted) {
          throw new CancellationError(this.reason ?? 'Operation cancelled');
        }
      },
      onCancellationRequested(listener: (reason?: string) => void | Promise<void>): () => void {
        if (controller.signal.aborted) {
          void listener(this.reason);
          return () => undefined;
        }

        const onAbort = (): void => {
          void listener(this.reason);
        };

        controller.signal.addEventListener('abort', onAbort, { once: true });

        return () => {
          controller.signal.removeEventListener('abort', onAbort);
          detachOriginal();
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
          }
        };
      },
      dispose(): void {
        detachOriginal();
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
      },
    };
  }
}
