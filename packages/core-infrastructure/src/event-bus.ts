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

export interface EventDispatchOptions {
  readonly signal?: AbortSignal;
  readonly context?: EventContext;
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

export class EventDispatcher {
  public constructor(
    private readonly provider: IServiceProvider,
    private readonly handlerResolver: HandlerResolver,
  ) {}

  public async dispatch<TEvent extends IEvent>(
    event: TEvent,
    options: EventDispatchOptions = {},
  ): Promise<DispatchResult<TEvent>> {
    this.validateEvent(event);

    const startedAt = new Date().toISOString();
    const statistics = new DispatchStatistics(startedAt);
    const dispatchContext = new EventDispatchContext(
      event,
      options.signal,
      event.correlationId,
      event.source,
      options.context?.properties ?? {},
      startedAt,
    );

    if (dispatchContext.signal?.aborted) {
      statistics.cancelled = true;
      statistics.completedAt = new Date().toISOString();
      statistics.durationMs = 0;
      return new DispatchResult(event, dispatchContext, statistics, [], [], statistics.completedAt);
    }

    const executionContexts: EventExecutionContext<TEvent>[] = [];
    const errors: Error[] = [];

    try {
      const handlers = this.handlerResolver.resolve(event);
      statistics.resolvedHandlers = handlers.length;

      if (handlers.length === 0) {
        statistics.missingHandlers = 1;
        statistics.completedAt = new Date().toISOString();
        statistics.durationMs = 0;
        return new DispatchResult(
          event,
          dispatchContext,
          statistics,
          errors,
          executionContexts,
          statistics.completedAt,
        );
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
          await handler.handle(event);
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
    } catch (error) {
      const wrapped =
        error instanceof Error ? error : new EventBusError('Handler resolution failed.');
      errors.push(wrapped);
      statistics.failedHandlers += 1;
    }

    statistics.completedAt = new Date().toISOString();
    statistics.durationMs = Date.now() - new Date(startedAt).getTime();

    return new DispatchResult(
      event,
      dispatchContext,
      statistics,
      errors,
      executionContexts,
      statistics.completedAt,
    );
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
