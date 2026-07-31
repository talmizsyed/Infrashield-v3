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
