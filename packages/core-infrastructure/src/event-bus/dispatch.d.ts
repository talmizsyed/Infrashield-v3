import type { IEvent, IEventHandler } from './contracts';
import { EventHealthCheck, EventMetrics, EventTracer } from './metrics';
import type { IEventObserver } from './observer';
import { EventDispatchContext, EventPipeline } from './middleware';
import { RetryExecutor } from './retry';
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
export declare class EventExecutionContext<TEvent extends IEvent = IEvent> {
  readonly event: TEvent;
  readonly dispatchContext: EventDispatchContext;
  readonly handler: IEventHandler<TEvent>;
  readonly index: number;
  readonly startedAt: string;
  readonly completedAt: string | undefined;
  readonly status: 'pending' | 'succeeded' | 'failed' | 'cancelled';
  readonly error: Error | undefined;
  constructor(
    event: TEvent,
    dispatchContext: EventDispatchContext,
    handler: IEventHandler<TEvent>,
    index: number,
    startedAt?: string,
    completedAt?: string | undefined,
    status?: 'pending' | 'succeeded' | 'failed' | 'cancelled',
    error?: Error | undefined,
  );
}
export declare class DispatchStatistics {
  executedHandlers: number;
  resolvedHandlers: number;
  failedHandlers: number;
  missingHandlers: number;
  cancelled: boolean;
  retryAttempts: number;
  deadLetteredEvents: number;
  startedAt: string;
  completedAt: string | undefined;
  durationMs: number;
  constructor(startedAt?: string);
}
export declare class DispatchResult<TEvent extends IEvent = IEvent> {
  readonly event: TEvent;
  readonly dispatchContext: EventDispatchContext;
  readonly statistics: DispatchStatistics;
  readonly errors: readonly Error[];
  readonly executionContexts: readonly EventExecutionContext<TEvent>[];
  readonly completedAt: string;
  constructor(
    event: TEvent,
    dispatchContext: EventDispatchContext,
    statistics: DispatchStatistics,
    errors?: readonly Error[],
    executionContexts?: readonly EventExecutionContext<TEvent>[],
    completedAt?: string,
  );
  get succeeded(): boolean;
}
export declare class HandlerResolver {
  private readonly provider;
  private readonly tokenFactory;
  constructor(
    provider: IServiceProviderLike,
    tokenFactory: <TEvent extends IEvent>(event: TEvent) => unknown,
  );
  resolve<TEvent extends IEvent>(event: TEvent): readonly IEventHandler<TEvent>[];
  private validateHandler;
}
interface IServiceProviderLike {
  ResolveAll<T>(token: unknown): readonly T[];
}
export declare class EventDispatcher {
  private readonly provider;
  private readonly handlerResolver;
  private readonly pipeline;
  private readonly retryExecutor;
  private readonly metrics;
  private readonly observers;
  private readonly tracer;
  private readonly healthCheck;
  constructor(
    provider: IServiceProviderLike,
    handlerResolver: HandlerResolver,
    pipeline?: EventPipeline<IEvent>,
    retryExecutor?: RetryExecutor | undefined,
    metrics?: EventMetrics | undefined,
    observers?: readonly IEventObserver[],
    tracer?: EventTracer | undefined,
    healthCheck?: EventHealthCheck | undefined,
  );
  dispatch<TEvent extends IEvent>(
    event: TEvent,
    options?: EventDispatchOptions,
  ): Promise<DispatchResult<TEvent>>;
  private createSnapshot;
  private executeOnce;
  private validateEvent;
}
export {};
//# sourceMappingURL=dispatch.d.ts.map
