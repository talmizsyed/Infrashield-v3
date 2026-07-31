import type { InjectionToken as DiInjectionToken } from '../di';
import type { EventPerformanceSnapshot } from './metrics';

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
      options.eventId ?? '',
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

export interface IEventObserver {
  onEventObserved(snapshot: EventPerformanceSnapshot): Promise<void> | void;
}

export type InjectionToken<TService> = DiInjectionToken<TService>;
