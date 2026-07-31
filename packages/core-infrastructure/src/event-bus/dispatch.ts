import type { IEvent, IEventHandler } from './contracts';
import { EventBusError } from './exceptions';
import {
  EventCounters,
  EventHealth,
  EventHealthCheck,
  EventMetrics,
  EventPerformanceSnapshot,
  EventStatistics,
  EventTracer,
} from './metrics';
import type { IEventObserver } from './observer';
import { EventDispatchContext, EventMiddlewareContext, EventPipeline } from './middleware';
import { EventExecutionResult, RetryExecutor } from './retry';

export interface EventDispatchOptions {
  readonly signal?: AbortSignal;
  readonly context?: EventContextLike;
  readonly retryPolicy?: RetryPolicyLike;
  readonly deadLetterQueue?: DeadLetterQueueLike;
}

interface EventContextLike {
  readonly properties: Record<string, unknown>;
}

interface RetryPolicyLike {
  readonly maxAttempts?: number;
  readonly strategy?: unknown;
}

interface DeadLetterQueueLike {
  enqueue(entry: unknown): void;
}

export class EventExecutionContext<TEvent extends IEvent = IEvent> {
  public constructor(
    public readonly event: TEvent,
    public readonly dispatchContext: EventDispatchContext,
    public readonly handler: IEventHandler<TEvent>,
    public readonly index: number,
    public readonly startedAt: string = new Date().toISOString(),
    public readonly completedAt: string | undefined = undefined,
    public readonly status: 'pending' | 'succeeded' | 'failed' | 'cancelled' = 'pending',
    public readonly error: Error | undefined = undefined,
  ) {}
}

export class DispatchStatistics {
  public executedHandlers = 0;
  public resolvedHandlers = 0;
  public failedHandlers = 0;
  public missingHandlers = 0;
  public cancelled = false;
  public retryAttempts = 0;
  public deadLetteredEvents = 0;
  public startedAt: string;
  public completedAt: string | undefined;
  public durationMs = 0;

  public constructor(startedAt: string = new Date().toISOString()) {
    this.startedAt = startedAt;
  }
}

export class DispatchResult<TEvent extends IEvent = IEvent> {
  public constructor(
    public readonly event: TEvent,
    public readonly dispatchContext: EventDispatchContext,
    public readonly statistics: DispatchStatistics,
    public readonly errors: readonly Error[] = [],
    public readonly executionContexts: readonly EventExecutionContext<TEvent>[] = [],
    public readonly completedAt: string = new Date().toISOString(),
  ) {}

  public get succeeded(): boolean {
    return (
      this.errors.length === 0 &&
      this.statistics.missingHandlers === 0 &&
      !this.statistics.cancelled
    );
  }
}

export class HandlerResolver {
  public constructor(
    private readonly provider: IServiceProviderLike,
    private readonly tokenFactory: <TEvent extends IEvent>(event: TEvent) => unknown,
  ) {}

  public resolve<TEvent extends IEvent>(event: TEvent): readonly IEventHandler<TEvent>[] {
    if (!event || typeof event !== 'object') {
      throw new EventBusError('Event must be a non-null object.');
    }

    const token = this.tokenFactory(event);
    const candidates = this.provider.ResolveAll(token) as readonly unknown[];
    return candidates.map((candidate) => this.validateHandler<TEvent>(candidate));
  }

  private validateHandler<TEvent extends IEvent>(handler: unknown): IEventHandler<TEvent> {
    if (!handler || (typeof handler !== 'object' && typeof handler !== 'function')) {
      throw new EventBusError('Invalid handler registration.');
    }

    const candidate = handler as Partial<IEventHandler<TEvent>>;
    if (typeof candidate.handle !== 'function') {
      throw new EventBusError('Invalid handler registration.');
    }

    return handler as IEventHandler<TEvent>;
  }
}

interface IServiceProviderLike {
  ResolveAll<T>(token: unknown): readonly T[];
}

export class EventDispatcher {
  public constructor(
    private readonly provider: IServiceProviderLike,
    private readonly handlerResolver: HandlerResolver,
    private readonly pipeline: EventPipeline<IEvent> = new EventPipeline([]),
    private readonly retryExecutor: RetryExecutor | undefined = undefined,
    private readonly metrics: EventMetrics | undefined = undefined,
    private readonly observers: readonly IEventObserver[] = [],
    private readonly tracer: EventTracer | undefined = undefined,
    private readonly healthCheck: EventHealthCheck | undefined = undefined,
  ) {}

  public async dispatch<TEvent extends IEvent>(
    event: TEvent,
    options: EventDispatchOptions = {},
  ): Promise<DispatchResult<TEvent>> {
    this.validateEvent(event);

    const startedAt = new Date().toISOString();
    const statistics = new DispatchStatistics(startedAt);
    this.metrics?.recordConcurrentExecution();

    try {
      this.tracer?.record(event, event.correlationId, 'dispatch-started');
      const dispatchContext = new EventDispatchContext(
        event,
        options.signal,
        event.correlationId,
        event.source,
        options.context?.properties ?? {},
        startedAt,
      );

      if (dispatchContext.signal?.aborted) {
        this.metrics?.recordDispatchResult(false);
        this.metrics?.recordLatency(0);
        this.tracer?.record(event, event.correlationId, 'dispatch-cancelled');
        statistics.cancelled = true;
        statistics.completedAt = new Date().toISOString();
        statistics.durationMs = 0;
        return new DispatchResult(
          event,
          dispatchContext,
          statistics,
          [],
          [],
          statistics.completedAt,
        );
      }

      const executionContexts: EventExecutionContext<TEvent>[] = [];
      const errors: Error[] = [];
      const middlewareContext = new EventMiddlewareContext<TEvent>(event, dispatchContext);

      try {
        await this.pipeline.execute(middlewareContext, async () => {
          const handlers = this.handlerResolver.resolve(event);
          statistics.resolvedHandlers = handlers.length;

          if (handlers.length === 0) {
            statistics.missingHandlers = 1;
            statistics.completedAt = new Date().toISOString();
            statistics.durationMs = 0;
            return;
          }

          for (const [index, handler] of handlers.entries()) {
            dispatchContext.ensureNotCancelled();

            const executionContext = new EventExecutionContext<TEvent>(
              event,
              dispatchContext,
              handler,
              index,
            );

            try {
              const handlerStartedAt = Date.now();
              const executionResult = this.retryExecutor
                ? await this.retryExecutor.execute({
                    event,
                    handler,
                    policy: options.retryPolicy as never,
                    dispatchContext,
                    deadLetterQueue: options.deadLetterQueue as never,
                  })
                : await this.executeOnce(event, handler);
              const handlerDurationMs = Date.now() - handlerStartedAt;
              this.metrics?.recordHandlerExecution(handlerDurationMs);
              this.tracer?.record(event, event.correlationId, 'handler-executed');

              if (executionResult.attempts > 1) {
                statistics.retryAttempts += executionResult.attempts - 1;
                this.metrics?.recordRetryAttempt();
              }

              if (executionResult.succeeded) {
                statistics.executedHandlers += 1;
                executionContexts.push(
                  new EventExecutionContext<TEvent>(
                    event,
                    dispatchContext,
                    handler,
                    index,
                    executionContext.startedAt,
                    new Date().toISOString(),
                    'succeeded',
                  ),
                );
              } else {
                statistics.failedHandlers += 1;
                if (executionResult.outcome === 'dead-lettered') {
                  statistics.deadLetteredEvents += 1;
                  this.metrics?.recordDeadLetter();
                }
                errors.push(
                  executionResult.error ?? new EventBusError('Handler execution failed.'),
                );
                executionContexts.push(
                  new EventExecutionContext<TEvent>(
                    event,
                    dispatchContext,
                    handler,
                    index,
                    executionContext.startedAt,
                    new Date().toISOString(),
                    'failed',
                    executionResult.error,
                  ),
                );
              }
            } catch (error) {
              statistics.failedHandlers += 1;
              const wrapped =
                error instanceof Error ? error : new EventBusError('Handler execution failed.');
              errors.push(wrapped);
              executionContexts.push(
                new EventExecutionContext<TEvent>(
                  event,
                  dispatchContext,
                  handler,
                  index,
                  executionContext.startedAt,
                  new Date().toISOString(),
                  'failed',
                  wrapped,
                ),
              );
            }
          }
        });
      } catch (error) {
        const wrapped =
          error instanceof Error ? error : new EventBusError('Handler resolution failed.');
        errors.push(wrapped);
        statistics.failedHandlers += 1;
      }

      statistics.completedAt = new Date().toISOString();
      statistics.durationMs = Date.now() - new Date(startedAt).getTime();
      this.metrics?.recordLatency(statistics.durationMs);
      this.metrics?.recordDispatchResult(errors.length === 0 && statistics.missingHandlers === 0);
      this.tracer?.record(event, event.correlationId, 'dispatch-completed');
      if (this.tracer && this.healthCheck) {
        const metricsSnapshot = this.metrics?.snapshot();
        const baseSnapshot =
          metricsSnapshot ??
          new EventPerformanceSnapshot(
            new EventCounters(),
            new EventStatistics(0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
          );
        this.tracer.recordHealth(this.healthCheck.evaluate(baseSnapshot));
      }
      const snapshots = await Promise.allSettled(
        this.observers.map(async (observer) => {
          const snapshot = this.createSnapshot(event, statistics, errors, executionContexts);
          await observer.onEventObserved(snapshot);
        }),
      );

      snapshots.forEach((snapshot) => {
        if (snapshot.status === 'rejected') {
          this.metrics?.recordObserverFailure();
        }
      });

      return new DispatchResult(
        event,
        dispatchContext,
        statistics,
        errors,
        executionContexts,
        statistics.completedAt,
      );
    } finally {
      this.metrics?.completeConcurrentExecution();
    }
  }

  private createSnapshot<TEvent extends IEvent>(
    _event: TEvent,
    _statistics: DispatchStatistics,
    _errors: readonly Error[],
    _executionContexts: readonly EventExecutionContext<TEvent>[],
  ): EventPerformanceSnapshot {
    const metricsSnapshot = this.metrics?.snapshot();
    const activities = this.tracer?.snapshot().activities ?? [];
    const baseSnapshot =
      metricsSnapshot ??
      new EventPerformanceSnapshot(
        new EventCounters(),
        new EventStatistics(0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
      );
    const health = this.healthCheck?.evaluate(baseSnapshot) ?? new EventHealth('healthy', 'ok');

    this.tracer?.recordHealth(health);

    return new EventPerformanceSnapshot(
      metricsSnapshot?.counters ?? new EventCounters(),
      metricsSnapshot?.statistics ?? new EventStatistics(0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
      health,
      activities,
      new Date().toISOString(),
    );
  }

  private async executeOnce<TEvent extends IEvent>(
    event: TEvent,
    handler: IEventHandler<TEvent>,
  ): Promise<EventExecutionResult<TEvent>> {
    try {
      await handler.handle(event);
      return new EventExecutionResult<TEvent>(event, handler, 1, true, 'succeeded');
    } catch (error) {
      const wrapped =
        error instanceof Error ? error : new EventBusError('Handler execution failed.');
      return new EventExecutionResult<TEvent>(event, handler, 1, false, 'failed', wrapped);
    }
  }

  private validateEvent<TEvent extends IEvent>(event: TEvent): void {
    if (!event || typeof event !== 'object') {
      throw new EventBusError('Event must be a non-null object.');
    }

    if (!event.metadata || typeof event.metadata !== 'object') {
      throw new EventBusError('Event metadata is missing.');
    }

    if (
      !event.eventType ||
      typeof event.eventType !== 'string' ||
      event.eventType.trim().length === 0
    ) {
      throw new EventBusError('Invalid event type.');
    }
  }
}
