import { EventBusError } from './exceptions';
import { createEventId } from './internal/utils';
import {
  type EventCategory,
  type EventPriority,
  type IEvent,
  type IEventHandler,
  type IEventPublisher,
  type IEventSubscriber,
  EventEnvelope,
  EventMetadata,
} from './contracts';

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
