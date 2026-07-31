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
export declare class EventMetadata {
  readonly eventId: string;
  readonly correlationId: string | undefined;
  readonly timestamp: string;
  readonly source: string;
  readonly category: EventCategory;
  readonly priority: EventPriority;
  readonly version: number;
  readonly tags: readonly string[];
  constructor(
    eventId: string,
    correlationId: string | undefined,
    timestamp: string,
    source: string,
    category: EventCategory,
    priority: EventPriority,
    version: number,
    tags: readonly string[],
  );
  static create(options: {
    eventId?: string;
    correlationId?: string;
    timestamp?: string;
    source: string;
    category: EventCategory;
    priority: EventPriority;
    version?: number;
    tags?: readonly string[];
  }): EventMetadata;
}
export declare class EventEnvelope<TEvent extends IEvent = IEvent> {
  readonly event: TEvent;
  readonly metadata: EventMetadata;
  constructor(event: TEvent, metadata: EventMetadata);
}
export declare class EventContext {
  readonly correlationId: string | undefined;
  readonly source: string;
  readonly causationId?: string | undefined;
  readonly properties: Record<string, unknown>;
  constructor(
    correlationId: string | undefined,
    source: string,
    causationId?: string | undefined,
    properties?: Record<string, unknown>,
  );
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
//# sourceMappingURL=contracts.d.ts.map
