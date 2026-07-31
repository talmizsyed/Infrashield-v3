import type { InjectionToken, IServiceProvider } from './di';

export type EventPriority = 'low' | 'normal' | 'high' | 'critical';
export type EventCategory = 'domain' | 'integration' | 'application' | 'system';

export interface IEvent<TPayload = unknown> {
  readonly eventId: string;
  readonly correlationId?: string;
  readonly timestamp: string;
  readonly source: string;
  readonly category: EventCategory;
  readonly priority: EventPriority;
  readonly version: number;
  readonly tags: readonly string[];
  readonly eventType: string;
  readonly payload: TPayload;
  readonly metadata: EventMetadata;
  toEnvelope(): EventEnvelope;
}

export class EventMetadata {
  public constructor(
    public readonly eventId: string,
    public readonly correlationId: string | undefined,
    public readonly timestamp: string,
    public readonly source: string,
    public readonly category: EventCategory,
    public readonly priority: EventPriority,
    public readonly version: number,
    public readonly tags: readonly string[],
  ) {}

  public static create(options: {
    eventId?: string;
    correlationId?: string;
    timestamp?: string;
    source: string;
    category: EventCategory;
    priority: EventPriority;
    version?: number;
    tags?: readonly string[];
  }): EventMetadata {
    return new EventMetadata(
      options.eventId ?? createEventId(),
      options.correlationId,
      options.timestamp ?? new Date().toISOString(),
      options.source,
      options.category,
      options.priority,
      options.version ?? 1,
      options.tags ?? [],
    );
  }
}

export class EventEnvelope<TEvent extends IEvent = IEvent> {
  public constructor(
    public readonly event: TEvent,
    public readonly metadata: EventMetadata,
  ) {}
}

export class EventContext {
  public constructor(
    public readonly correlationId: string | undefined,
    public readonly source: string,
    public readonly causationId?: string,
    public readonly properties: Record<string, unknown> = {},
  ) {}
}

export interface IEventHandler<TEvent extends IEvent = IEvent> {
  handle(event: TEvent): Promise<void> | void;
}

export interface IEventPublisher {
  publish<TEvent extends IEvent>(event: TEvent): Promise<void>;
}

export interface IEventSubscriber {
  subscribe<TEvent extends IEvent>(handler: IEventHandler<TEvent>): void;
}

export interface IEventBus extends IEventPublisher, IEventSubscriber {}

export class EventBusError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'EventBusError';
  }
}

export class HandlerDescriptor<TEvent extends IEvent = IEvent> {
  public constructor(
    public readonly id: string,
    public readonly eventType: string,
    public readonly handler: IEventHandler<TEvent>,
    public readonly createdAt: string = new Date().toISOString(),
  ) {}
}

export class EventSubscription<TEvent extends IEvent = IEvent> {
  public constructor(
    public readonly descriptor: HandlerDescriptor<TEvent>,
    public readonly eventType: string,
  ) {}
}

export class SubscriptionBuilder<TEvent extends IEvent = IEvent> {
  private eventTypeName: string | undefined;
  private registeredHandler: IEventHandler<TEvent> | undefined;

  public eventType(eventType: string): this {
    this.eventTypeName = eventType;
    return this;
  }

  public handler(handler: IEventHandler<TEvent>): this {
    this.registeredHandler = handler;
    return this;
  }

  public build(): EventSubscription<TEvent> {
    if (!this.eventTypeName || this.eventTypeName.trim().length === 0) {
      throw new EventBusError('Subscription requires an event type.');
    }

    if (!this.registeredHandler) {
      throw new EventBusError('Subscription requires a handler.');
    }

    const descriptor = new HandlerDescriptor(
      createEventId(),
      this.eventTypeName,
      this.registeredHandler,
    );
    return new EventSubscription(descriptor, this.eventTypeName);
  }
}

export class SubscriptionRegistry implements IEventSubscriber {
  private readonly subscriptions = new Map<string, EventSubscription<IEvent>[]>();
  private readonly eventTypes = new Set<string>();

  public register<TEvent extends IEvent>(
    handler: IEventHandler<TEvent>,
    eventType: string | (new (...args: readonly unknown[]) => TEvent),
  ): void {
    const eventTypeName = this.resolveEventTypeName(eventType);
    this.validateHandler(handler);

    const existing = this.getSubscriptions(eventTypeName);
    if (existing.some((subscription) => subscription.descriptor.handler === handler)) {
      throw new EventBusError(`Duplicate subscription for ${eventTypeName}.`);
    }

    const descriptor = new HandlerDescriptor(
      createEventId(),
      eventTypeName,
      handler as IEventHandler<IEvent>,
    );
    const subscription = new EventSubscription(descriptor, eventTypeName);
    const next = [...existing, subscription];
    this.subscriptions.set(eventTypeName, next);
    this.eventTypes.add(eventTypeName);
  }

  public registerSubscription<TEvent extends IEvent>(
    subscription: EventSubscription<TEvent>,
  ): void {
    this.validateSubscription(subscription);

    const eventTypeName = subscription.descriptor.eventType;
    const existing = this.getSubscriptions(eventTypeName);
    if (
      existing.some((candidate) => candidate.descriptor.handler === subscription.descriptor.handler)
    ) {
      throw new EventBusError(`Duplicate subscription for ${eventTypeName}.`);
    }

    const next = [...existing, subscription as EventSubscription<IEvent>];
    this.subscriptions.set(eventTypeName, next);
    this.eventTypes.add(eventTypeName);
  }

  public unregister<TEvent extends IEvent>(
    handler: IEventHandler<TEvent>,
    eventType: string | (new (...args: readonly unknown[]) => TEvent),
  ): boolean {
    const eventTypeName = this.resolveEventTypeName(eventType);
    const existing = this.getSubscriptions(eventTypeName);
    const next = existing.filter((subscription) => subscription.descriptor.handler !== handler);

    if (next.length === existing.length) {
      return false;
    }

    if (next.length === 0) {
      this.subscriptions.delete(eventTypeName);
    } else {
      this.subscriptions.set(eventTypeName, next);
    }

    if (this.subscriptions.size === 0) {
      this.eventTypes.clear();
    } else {
      const remaining = [...this.subscriptions.values()].flat();
      this.eventTypes.clear();
      for (const subscription of remaining) {
        this.eventTypes.add(subscription.eventType);
      }
    }

    return true;
  }

  public lookup<TEvent extends IEvent>(event: TEvent): readonly EventSubscription<TEvent>[] {
    this.validateEvent(event);
    const eventTypeName = this.resolveEventTypeName(event.eventType);
    return this.getSubscriptions(eventTypeName) as readonly EventSubscription<TEvent>[];
  }

  public getSubscriptions(eventType: string): readonly EventSubscription<IEvent>[] {
    return [...(this.subscriptions.get(eventType) ?? [])];
  }

  public getEventTypes(): readonly string[] {
    return [...this.eventTypes];
  }

  public subscribe<TEvent extends IEvent>(handler: IEventHandler<TEvent>): void {
    this.validateHandler(handler);
    throw new EventBusError('Subscription registration requires an event type.');
  }

  private validateHandler(handler: unknown): void {
    if (!handler || (typeof handler !== 'object' && typeof handler !== 'function')) {
      throw new EventBusError('Invalid handler registration.');
    }

    const candidate = handler as Partial<IEventHandler<IEvent>>;
    if (typeof candidate.handle !== 'function') {
      throw new EventBusError('Invalid handler registration.');
    }
  }

  private validateSubscription<TEvent extends IEvent>(
    subscription: EventSubscription<TEvent>,
  ): void {
    if (!subscription || typeof subscription !== 'object') {
      throw new EventBusError('Invalid subscription registration.');
    }

    const descriptor = subscription.descriptor;
    if (!descriptor || typeof descriptor !== 'object') {
      throw new EventBusError('Invalid subscription registration.');
    }

    if (!descriptor.eventType || descriptor.eventType.trim().length === 0) {
      throw new EventBusError('Subscription requires an event type.');
    }

    this.validateHandler(descriptor.handler);
  }

  private validateEvent<TEvent extends IEvent>(event: TEvent): void {
    if (!event || typeof event !== 'object') {
      throw new EventBusError('Event must be a non-null object.');
    }

    if (!event.metadata || typeof event.metadata !== 'object') {
      throw new EventBusError('Event metadata is missing.');
    }

    const eventType = event.eventType ?? event.constructor?.name;
    if (typeof eventType !== 'string' || eventType.trim().length === 0) {
      throw new EventBusError('Invalid event type.');
    }
  }

  private resolveEventTypeName(
    eventType: string | (new (...args: readonly unknown[]) => IEvent) | undefined,
  ): string {
    if (typeof eventType === 'string') {
      if (eventType.trim().length === 0) {
        throw new EventBusError('Invalid event type.');
      }

      return eventType;
    }

    if (typeof eventType === 'function') {
      return eventType.name;
    }

    throw new EventBusError('Invalid event type.');
  }
}

export class EventPublisher implements IEventPublisher {
  public readonly preparedEvents: EventEnvelope[] = [];

  public constructor(private readonly registry: SubscriptionRegistry) {}

  public async publish<TEvent extends IEvent>(event: TEvent): Promise<void> {
    this.validateEvent(event);
    this.registry.lookup(event);
    this.preparedEvents.push(event.toEnvelope());
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

export type FailureClassification = 'transient' | 'permanent' | 'unexpected' | 'cancelled';

export class RetryStrategy {
  public constructor(
    public readonly type: 'none' | 'fixed' | 'exponential' = 'none',
    public readonly initialDelayMs = 0,
    public readonly maxDelayMs = 0,
    public readonly backoffMultiplier = 2,
  ) {}

  public getDelayMs(attempt: number): number {
    if (this.type === 'none' || attempt <= 1) {
      return 0;
    }

    if (this.type === 'fixed') {
      return this.initialDelayMs;
    }

    const computed = this.initialDelayMs * Math.pow(this.backoffMultiplier, attempt - 1);
    return this.maxDelayMs > 0 ? Math.min(this.maxDelayMs, computed) : computed;
  }
}

export class RetryPolicy {
  public constructor(
    options: {
      readonly maxAttempts?: number;
      readonly strategy?: RetryStrategy;
      readonly retryPredicate?: (error: Error, context: RetryContext) => boolean;
    } = {},
  ) {
    this.maxAttempts = Math.max(1, options.maxAttempts ?? 1);
    this.strategy = options.strategy ?? new RetryStrategy('none');
    this.retryPredicate = options.retryPredicate;
  }

  public readonly maxAttempts: number;
  public readonly strategy: RetryStrategy;
  public readonly retryPredicate: ((error: Error, context: RetryContext) => boolean) | undefined;

  public static none(): RetryPolicy {
    return new RetryPolicy({ maxAttempts: 1, strategy: new RetryStrategy('none') });
  }

  public getDelayMs(attempt: number): number {
    return this.strategy.getDelayMs(attempt);
  }

  public shouldRetry(context: RetryContext): boolean {
    if (context.currentAttempt >= this.maxAttempts) {
      return false;
    }

    if (this.retryPredicate) {
      return this.retryPredicate(context.lastError ?? new Error('retry'), context);
    }

    return true;
  }
}

export class RetryContext {
  public constructor(
    public readonly event: IEvent,
    public readonly handler: IEventHandler,
    public readonly currentAttempt: number,
    public readonly maxAttempts: number,
    public readonly strategy: RetryStrategy,
    public readonly lastError: Error | undefined,
    public readonly shouldRetry: boolean,
    public readonly delayMs: number,
  ) {}
}

export class EventFailure {
  public constructor(
    public readonly event: IEvent,
    public readonly error: Error,
    public readonly classification: FailureClassification,
    public readonly attempts: number,
    public readonly retryHistory: readonly RetryContext[] = [],
    public readonly correlationId: string | undefined = event.correlationId,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export class FailureClassifier {
  public classify(error: unknown): FailureClassification {
    if (error instanceof Error) {
      const normalized = error.message.toLowerCase();
      if (
        normalized.includes('transient') ||
        normalized.includes('timeout') ||
        normalized.includes('temporar')
      ) {
        return 'transient';
      }

      if (
        normalized.includes('permanent') ||
        normalized.includes('validation') ||
        normalized.includes('invalid') ||
        normalized.includes('forbidden')
      ) {
        return 'permanent';
      }
    }

    return 'unexpected';
  }
}

export class DeadLetterEntry {
  public constructor(
    public readonly event: IEvent,
    public readonly error: Error,
    public readonly retryHistory: readonly RetryContext[] = [],
    public readonly correlationId: string | undefined = event.correlationId,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export class DeadLetterQueue {
  private readonly entries: DeadLetterEntry[] = [];

  public enqueue(entry: DeadLetterEntry): void {
    this.entries.push(entry);
  }

  public size(): number {
    return this.entries.length;
  }

  public peek(): DeadLetterEntry | undefined {
    return this.entries[this.entries.length - 1];
  }

  public drain(): readonly DeadLetterEntry[] {
    const snapshot = [...this.entries];
    this.entries.length = 0;
    return snapshot;
  }
}

export class DeadLetterProcessor {
  public async process(entry: DeadLetterEntry): Promise<void> {
    void entry;
  }
}

export class EventExecutionResult<TEvent extends IEvent = IEvent> {
  public constructor(
    public readonly event: TEvent,
    public readonly handler: IEventHandler<TEvent>,
    public readonly attempts: number,
    public readonly succeeded: boolean,
    public readonly outcome: 'succeeded' | 'failed' | 'dead-lettered' | 'cancelled',
    public readonly error: Error | undefined = undefined,
    public readonly retryHistory: readonly RetryContext[] = [],
    public readonly failure: EventFailure | undefined = undefined,
  ) {}
}

export class RetryExecutor {
  private readonly classifier = new FailureClassifier();

  public async execute<TEvent extends IEvent>(options: {
    readonly event: TEvent;
    readonly handler: IEventHandler<TEvent>;
    readonly policy?: RetryPolicy;
    readonly dispatchContext?: EventDispatchContext;
    readonly deadLetterQueue?: DeadLetterQueue;
  }): Promise<EventExecutionResult<TEvent>> {
    const policy = options.policy ?? RetryPolicy.none();
    const retryHistory: RetryContext[] = [];
    let attempt = 1;

    while (attempt <= policy.maxAttempts) {
      if (options.dispatchContext?.signal?.aborted) {
        return new EventExecutionResult<TEvent>(
          options.event,
          options.handler,
          attempt,
          false,
          'cancelled',
          new EventBusError('Dispatch cancelled.'),
          retryHistory,
          new EventFailure(
            options.event,
            new EventBusError('Dispatch cancelled.'),
            'cancelled',
            attempt,
            retryHistory,
          ),
        );
      }

      try {
        await options.handler.handle(options.event);
        return new EventExecutionResult<TEvent>(
          options.event,
          options.handler,
          attempt,
          true,
          'succeeded',
          undefined,
          retryHistory,
        );
      } catch (error) {
        const wrapped =
          error instanceof Error ? error : new EventBusError('Handler execution failed.');
        const classification = this.classifier.classify(wrapped);
        const retryContext = new RetryContext(
          options.event,
          options.handler,
          attempt,
          policy.maxAttempts,
          policy.strategy,
          wrapped,
          false,
          0,
        );
        retryHistory.push(retryContext);

        const shouldRetry = policy.shouldRetry(retryContext);
        const canRetry =
          shouldRetry && classification !== 'permanent' && attempt < policy.maxAttempts;

        if (!canRetry) {
          const failure = new EventFailure(
            options.event,
            wrapped,
            classification,
            attempt,
            retryHistory,
          );

          if (classification === 'permanent' || attempt >= policy.maxAttempts) {
            options.deadLetterQueue?.enqueue(
              new DeadLetterEntry(options.event, wrapped, retryHistory),
            );
            return new EventExecutionResult<TEvent>(
              options.event,
              options.handler,
              attempt,
              false,
              'dead-lettered',
              wrapped,
              retryHistory,
              failure,
            );
          }

          return new EventExecutionResult<TEvent>(
            options.event,
            options.handler,
            attempt,
            false,
            'failed',
            wrapped,
            retryHistory,
            failure,
          );
        }

        const delayMs = policy.getDelayMs(attempt + 1);
        if (delayMs > 0) {
          await this.wait(delayMs);
        }

        attempt += 1;
      }
    }

    const failure = new EventFailure(
      options.event,
      new EventBusError('Handler execution failed.'),
      'unexpected',
      attempt,
      retryHistory,
    );
    return new EventExecutionResult<TEvent>(
      options.event,
      options.handler,
      attempt,
      false,
      'failed',
      failure.error,
      retryHistory,
      failure,
    );
  }

  private async wait(delayMs: number): Promise<void> {
    if (delayMs <= 0) {
      return;
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, delayMs);
    });
  }
}

export interface EventDispatchOptions {
  readonly signal?: AbortSignal;
  readonly context?: EventContext;
  readonly retryPolicy?: RetryPolicy;
  readonly deadLetterQueue?: DeadLetterQueue;
}

export class EventDispatchContext {
  public constructor(
    public readonly event: IEvent,
    public readonly signal: AbortSignal | undefined,
    public readonly correlationId: string | undefined = event.correlationId,
    public readonly source: string = event.source,
    public readonly properties: Record<string, unknown> = {},
    public readonly startedAt: string = new Date().toISOString(),
  ) {}

  public ensureNotCancelled(): void {
    if (this.signal?.aborted) {
      throw new EventBusError('Dispatch cancelled.');
    }
  }
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
    private readonly provider: IServiceProvider,
    private readonly tokenFactory: <TEvent extends IEvent>(
      event: TEvent,
    ) => InjectionToken<IEventHandler<TEvent>>,
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

export interface IEventMiddleware<TEvent extends IEvent = IEvent> {
  execute(
    context: EventMiddlewareContext<TEvent>,
    next: EventDelegate<TEvent>,
  ): Promise<void> | void;
}

export class EventMiddlewareContext<TEvent extends IEvent = IEvent> {
  public constructor(
    public readonly event: TEvent,
    public readonly dispatchContext: EventDispatchContext | undefined,
    public readonly properties: Record<string, unknown> = {},
  ) {}
}

export type EventDelegate<TEvent extends IEvent = IEvent> = (
  context: EventMiddlewareContext<TEvent>,
) => Promise<void> | void;

export class MiddlewareDescriptor<TEvent extends IEvent = IEvent> {
  public constructor(
    public readonly id: string,
    public readonly middleware: IEventMiddleware<TEvent>,
    public readonly createdAt: string = new Date().toISOString(),
  ) {}
}

export class MiddlewareCollection<TEvent extends IEvent = IEvent> {
  private readonly items: MiddlewareDescriptor<TEvent>[] = [];

  public add(middleware: IEventMiddleware<TEvent>): MiddlewareCollection<TEvent> {
    this.validateMiddleware(middleware);
    this.items.push(new MiddlewareDescriptor(createEventId(), middleware));
    return this;
  }

  public toArray(): readonly MiddlewareDescriptor<TEvent>[] {
    return [...this.items];
  }

  public size(): number {
    return this.items.length;
  }

  private validateMiddleware(middleware: unknown): void {
    if (!middleware || (typeof middleware !== 'object' && typeof middleware !== 'function')) {
      throw new EventBusError('Invalid middleware registration.');
    }

    const candidate = middleware as Partial<IEventMiddleware<TEvent>>;
    if (typeof candidate.execute !== 'function') {
      throw new EventBusError('Invalid middleware registration.');
    }
  }
}

export class EventPipeline<TEvent extends IEvent = IEvent> {
  public constructor(private readonly middlewares: readonly MiddlewareDescriptor<TEvent>[]) {}

  public async execute(
    context: EventMiddlewareContext<TEvent>,
    delegate: EventDelegate<TEvent>,
  ): Promise<void> {
    const chain = this.buildChain(delegate, this.middlewares);
    await chain(context);
  }

  public compose(next: EventPipeline<TEvent>): EventPipeline<TEvent> {
    const merged = [...this.middlewares, ...next.middlewares];
    return new EventPipeline<TEvent>(merged);
  }

  private buildChain(
    next: EventDelegate<TEvent>,
    middlewares: readonly MiddlewareDescriptor<TEvent>[],
  ): EventDelegate<TEvent> {
    return middlewares.reduceRight<EventDelegate<TEvent>>(
      (current, descriptor) => async (context) => {
        await descriptor.middleware.execute(context, current);
      },
      next,
    );
  }
}

export class EventPipelineBuilder<TEvent extends IEvent = IEvent> {
  private readonly middlewares: MiddlewareDescriptor<TEvent>[] = [];

  public use(middleware: IEventMiddleware<TEvent>): this {
    this.validateMiddleware(middleware);
    this.middlewares.push(new MiddlewareDescriptor(createEventId(), middleware));
    return this;
  }

  public build(): EventPipeline<TEvent> {
    return new EventPipeline<TEvent>([...this.middlewares]);
  }

  private validateMiddleware(middleware: unknown): void {
    if (!middleware || (typeof middleware !== 'object' && typeof middleware !== 'function')) {
      throw new EventBusError('Invalid middleware registration.');
    }

    const candidate = middleware as Partial<IEventMiddleware<TEvent>>;
    if (typeof candidate.execute !== 'function') {
      throw new EventBusError('Invalid middleware registration.');
    }
  }
}

export interface IEventObserver {
  onEventObserved(snapshot: EventPerformanceSnapshot): Promise<void> | void;
}

export class EventCounters {
  public publishedEvents = 0;
  public successfulDispatches = 0;
  public failedDispatches = 0;
  public retryAttempts = 0;
  public deadLetteredEvents = 0;
  public failedObservers = 0;
  public middlewareExecutions = 0;
  public handlerExecutions = 0;
  public concurrentExecutions = 0;
  public activeExecutions = 0;
}

export class EventMetrics {
  private readonly counters = new EventCounters();
  private readonly latenciesMs: number[] = [];
  private readonly handlerLatenciesMs: number[] = [];
  private readonly middlewareLatenciesMs: number[] = [];
  private readonly throughputSamples: number[] = [];

  public recordPublishedEvent(): void {
    this.counters.publishedEvents += 1;
  }

  public recordDispatchResult(success: boolean): void {
    if (success) {
      this.counters.successfulDispatches += 1;
    } else {
      this.counters.failedDispatches += 1;
    }
  }

  public recordRetryAttempt(): void {
    this.counters.retryAttempts += 1;
  }

  public recordDeadLetter(): void {
    this.counters.deadLetteredEvents += 1;
  }

  public recordObserverFailure(): void {
    this.counters.failedObservers += 1;
  }

  public recordMiddlewareExecution(durationMs: number): void {
    this.counters.middlewareExecutions += 1;
    this.middlewareLatenciesMs.push(durationMs);
  }

  public recordHandlerExecution(durationMs: number): void {
    this.counters.handlerExecutions += 1;
    this.handlerLatenciesMs.push(durationMs);
  }

  public recordLatency(durationMs: number): void {
    this.latenciesMs.push(durationMs);
  }

  public recordConcurrentExecution(): void {
    this.counters.concurrentExecutions += 1;
    this.counters.activeExecutions += 1;
  }

  public completeConcurrentExecution(): void {
    if (this.counters.activeExecutions > 0) {
      this.counters.activeExecutions -= 1;
    }
  }

  public recordThroughput(): void {
    this.throughputSamples.push(Date.now());
  }

  public snapshot(): EventPerformanceSnapshot {
    return new EventPerformanceSnapshot(
      { ...this.counters },
      new EventStatistics(
        this.average(this.latenciesMs),
        this.minimum(this.latenciesMs),
        this.maximum(this.latenciesMs),
        this.average(this.handlerLatenciesMs),
        this.minimum(this.handlerLatenciesMs),
        this.maximum(this.handlerLatenciesMs),
        this.average(this.middlewareLatenciesMs),
        this.minimum(this.middlewareLatenciesMs),
        this.maximum(this.middlewareLatenciesMs),
        this.throughputSamples.length,
      ),
    );
  }

  private average(values: readonly number[]): number {
    if (values.length === 0) {
      return 0;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private minimum(values: readonly number[]): number {
    return values.length === 0 ? 0 : Math.min(...values);
  }

  private maximum(values: readonly number[]): number {
    return values.length === 0 ? 0 : Math.max(...values);
  }
}

export class EventStatistics {
  public constructor(
    public readonly averageLatencyMs: number,
    public readonly minimumLatencyMs: number,
    public readonly maximumLatencyMs: number,
    public readonly averageHandlerLatencyMs: number,
    public readonly minimumHandlerLatencyMs: number,
    public readonly maximumHandlerLatencyMs: number,
    public readonly averageMiddlewareLatencyMs: number,
    public readonly minimumMiddlewareLatencyMs: number,
    public readonly maximumMiddlewareLatencyMs: number,
    public readonly throughputPerSecond: number,
  ) {}
}

export class EventTracer {
  private readonly activities: EventActivity[] = [];
  private health: EventHealth | undefined;

  public record(event: IEvent, correlationId: string | undefined, phase: string): void {
    this.activities.push(
      new EventActivity(event.eventId, correlationId, phase, new Date().toISOString()),
    );
  }

  public recordHealth(health: EventHealth | undefined): void {
    this.health = health;
  }

  public getActivities(eventId: string): readonly EventActivity[] {
    return this.activities.filter((activity) => activity.eventId === eventId);
  }

  public snapshot(): EventTraceSnapshot {
    return new EventTraceSnapshot([...this.activities], this.health);
  }
}

export class EventActivity {
  public constructor(
    public readonly eventId: string,
    public readonly correlationId: string | undefined,
    public readonly phase: string,
    public readonly timestamp: string,
  ) {}
}

export class EventHealth {
  public constructor(
    public readonly status: 'healthy' | 'degraded' | 'unhealthy',
    public readonly message: string,
  ) {}
}

export class EventHealthCheck {
  public constructor(
    private readonly evaluator: (snapshot: EventPerformanceSnapshot) => EventHealth,
  ) {}

  public evaluate(snapshot: EventPerformanceSnapshot): EventHealth {
    return this.evaluator(snapshot);
  }
}

export class EventPerformanceSnapshot {
  public readonly metrics: EventPerformanceSnapshot;

  public constructor(
    public readonly counters: EventCounters,
    public readonly statistics: EventStatistics,
    public readonly health?: EventHealth,
    public readonly activities: readonly EventActivity[] = [],
    public readonly observedAt: string = new Date().toISOString(),
  ) {
    this.metrics = this;
  }
}

export class EventTraceSnapshot {
  public constructor(
    public readonly activities: readonly EventActivity[],
    public readonly health?: EventHealth,
  ) {}
}

export class EventObserver implements IEventObserver {
  public constructor(private readonly observer: IEventObserver) {}

  public async onEventObserved(snapshot: EventPerformanceSnapshot): Promise<void> {
    await this.observer.onEventObserved(snapshot);
  }
}

export class EventDispatcher {
  public constructor(
    private readonly provider: IServiceProvider,
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
      this.tracer?.record(event, event.correlationId, 'dispatch-cancelled');
      statistics.cancelled = true;
      statistics.completedAt = new Date().toISOString();
      statistics.durationMs = 0;
      return new DispatchResult(event, dispatchContext, statistics, [], [], statistics.completedAt);
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
                  policy: options.retryPolicy,
                  dispatchContext,
                  deadLetterQueue: options.deadLetterQueue,
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
              errors.push(executionResult.error ?? new EventBusError('Handler execution failed.'));
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
    this.metrics?.completeConcurrentExecution();
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

export abstract class EventBase<TPayload> implements IEvent<TPayload> {
  public readonly eventId: string;
  public readonly correlationId: string | undefined;
  public readonly timestamp: string;
  public readonly source: string;
  public readonly category: EventCategory;
  public readonly priority: EventPriority;
  public readonly version: number;
  public readonly tags: readonly string[];
  public readonly eventType: string;
  public readonly payload: TPayload;
  public readonly metadata: EventMetadata;

  public constructor(
    payload: TPayload,
    options: {
      eventId?: string;
      correlationId?: string;
      timestamp?: string;
      source: string;
      category: EventCategory;
      priority: EventPriority;
      version?: number;
      tags?: readonly string[];
    },
  ) {
    this.eventId = options.eventId ?? createEventId();
    this.correlationId = options.correlationId;
    this.timestamp = options.timestamp ?? new Date().toISOString();
    this.source = options.source;
    this.category = options.category;
    this.priority = options.priority;
    this.version = options.version ?? 1;
    this.tags = Object.freeze([...(options.tags ?? [])]);
    this.eventType = this.constructor.name;
    this.payload = Object.freeze({ ...(payload as Record<string, unknown>) }) as TPayload;
    this.metadata = EventMetadata.create({
      eventId: this.eventId,
      correlationId: this.correlationId,
      timestamp: this.timestamp,
      source: this.source,
      category: this.category,
      priority: this.priority,
      version: this.version,
      tags: this.tags,
    });
  }

  public toEnvelope(): EventEnvelope<this> {
    return new EventEnvelope(this, this.metadata);
  }
}

function createEventId(): string {
  return `evt-${Math.random().toString(36).slice(2, 10)}`;
}
