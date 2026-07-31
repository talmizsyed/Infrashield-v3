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
export declare class HandlerDescriptor<TEvent extends IEvent = IEvent> {
  readonly id: string;
  readonly eventType: string;
  readonly handler: IEventHandler<TEvent>;
  readonly createdAt: string;
  constructor(id: string, eventType: string, handler: IEventHandler<TEvent>, createdAt?: string);
}
export declare class EventSubscription<TEvent extends IEvent = IEvent> {
  readonly descriptor: HandlerDescriptor<TEvent>;
  readonly eventType: string;
  constructor(descriptor: HandlerDescriptor<TEvent>, eventType: string);
}
export declare class SubscriptionBuilder<TEvent extends IEvent = IEvent> {
  private eventTypeName;
  private registeredHandler;
  eventType(eventType: string): this;
  handler(handler: IEventHandler<TEvent>): this;
  build(): EventSubscription<TEvent>;
}
export declare class SubscriptionRegistry implements IEventSubscriber {
  private readonly subscriptions;
  private readonly eventTypes;
  register<TEvent extends IEvent>(
    handler: IEventHandler<TEvent>,
    eventType: string | (new (...args: readonly unknown[]) => TEvent),
  ): void;
  registerSubscription<TEvent extends IEvent>(subscription: EventSubscription<TEvent>): void;
  unregister<TEvent extends IEvent>(
    handler: IEventHandler<TEvent>,
    eventType: string | (new (...args: readonly unknown[]) => TEvent),
  ): boolean;
  lookup<TEvent extends IEvent>(event: TEvent): readonly EventSubscription<TEvent>[];
  getSubscriptions(eventType: string): readonly EventSubscription<IEvent>[];
  getEventTypes(): readonly string[];
  subscribe<TEvent extends IEvent>(handler: IEventHandler<TEvent>): void;
  private validateHandler;
  private validateSubscription;
  private validateEvent;
  private resolveEventTypeName;
}
export declare class EventPublisher implements IEventPublisher {
  private readonly registry;
  readonly preparedEvents: EventEnvelope[];
  constructor(registry: SubscriptionRegistry);
  publish<TEvent extends IEvent>(event: TEvent): Promise<void>;
  private validateEvent;
}
export declare abstract class EventBase<TPayload> implements IEvent<TPayload> {
  readonly eventId: string;
  readonly correlationId: string | undefined;
  readonly timestamp: string;
  readonly source: string;
  readonly category: EventCategory;
  readonly priority: EventPriority;
  readonly version: number;
  readonly tags: readonly string[];
  readonly eventType: string;
  readonly payload: TPayload;
  readonly metadata: EventMetadata;
  constructor(
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
  );
  toEnvelope(): EventEnvelope<this>;
}
//# sourceMappingURL=core.d.ts.map
