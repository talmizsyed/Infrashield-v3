import { describe, expect, it } from 'vitest';

import {
  EventBase,
  type EventCategory,
  EventContext,
  EventEnvelope,
  EventMetadata,
  EventPriority,
  type IEvent,
  type IEventHandler,
  EventPublisher,
  SubscriptionBuilder,
  SubscriptionRegistry,
} from './event-bus';

class UserCreatedEvent extends EventBase<{ userId: string }> {
  public constructor(
    payload: { userId: string },
    options?: { correlationId?: string; tags?: readonly string[] },
  ) {
    super(payload, {
      source: 'users',
      category: 'domain' as EventCategory,
      priority: 'normal' as EventPriority,
      version: 1,
      correlationId: options?.correlationId,
      tags: options?.tags,
    });
  }
}

class RecordingHandler implements IEventHandler<UserCreatedEvent> {
  public readonly handledEvents: UserCreatedEvent[] = [];

  public async handle(event: UserCreatedEvent): Promise<void> {
    this.handledEvents.push(event);
  }
}

describe('event bus', () => {
  it('creates strongly typed events with generated metadata', () => {
    const event = new UserCreatedEvent(
      { userId: '42' },
      { correlationId: 'corr-1', tags: ['alpha'] },
    );

    expect(event.payload.userId).toBe('42');
    expect(event.metadata.eventId).toBeDefined();
    expect(event.metadata.correlationId).toBe('corr-1');
    expect(event.metadata.source).toBe('users');
    expect(event.metadata.category).toBe('domain');
    expect(event.metadata.priority).toBe('normal');
    expect(event.metadata.version).toBe(1);
    expect(event.metadata.tags).toEqual(['alpha']);
  });

  it('creates envelopes and preserves serialization compatibility', () => {
    const event = new UserCreatedEvent({ userId: '42' });
    const envelope = event.toEnvelope();

    expect(envelope).toBeInstanceOf(EventEnvelope);
    expect(envelope.event).toBe(event);
    expect(envelope.metadata).toBe(event.metadata);

    const serialized = JSON.parse(JSON.stringify(envelope));
    expect(serialized.event).toBeDefined();
    expect(serialized.metadata).toBeDefined();
  });

  it('supports inheritance and immutable payloads', () => {
    const event = new UserCreatedEvent({ userId: '42' });

    expect(event).toBeInstanceOf(EventBase);
    expect(event).toBeInstanceOf(UserCreatedEvent);
    expect(event.eventType).toBe('UserCreatedEvent');

    const payload = event.payload as Record<string, string>;
    expect(() => {
      payload.userId = '43';
    }).toThrow(TypeError);
  });

  it('creates metadata and contexts with explicit values', () => {
    const metadata = EventMetadata.create({
      correlationId: 'corr-2',
      source: 'checkout',
      category: 'integration',
      priority: 'high',
      version: 2,
      tags: ['checkout'],
    });
    const context = new EventContext('corr-2', 'checkout', 'root-1', { queue: 'payments' });

    expect(metadata.correlationId).toBe('corr-2');
    expect(metadata.version).toBe(2);
    expect(context.correlationId).toBe('corr-2');
    expect(context.properties.queue).toBe('payments');
  });

  it('exposes the public event contract', () => {
    const event = new UserCreatedEvent({ userId: '42' });

    expect(event).toMatchObject<IEvent>({
      eventType: 'UserCreatedEvent',
      payload: { userId: '42' },
      metadata: expect.any(EventMetadata),
    });
  });

  it('registers and unregisters handlers', () => {
    const registry = new SubscriptionRegistry();
    const handler = new RecordingHandler();

    registry.register(handler, UserCreatedEvent);

    expect(registry.getSubscriptions(UserCreatedEvent.name)).toHaveLength(1);

    expect(registry.unregister(handler, UserCreatedEvent)).toBe(true);
    expect(registry.getSubscriptions(UserCreatedEvent.name)).toHaveLength(0);
  });

  it('supports multiple handlers and throws on duplicate registrations', () => {
    const registry = new SubscriptionRegistry();
    const first = new RecordingHandler();
    const second = new RecordingHandler();

    registry.register(first, UserCreatedEvent);
    registry.register(second, UserCreatedEvent);

    expect(registry.getSubscriptions(UserCreatedEvent.name)).toHaveLength(2);
    expect(() => registry.register(first, UserCreatedEvent)).toThrow('Duplicate');
  });

  it('supports builder-based subscriptions and generic lookups', () => {
    const registry = new SubscriptionRegistry();
    const handler = new RecordingHandler();
    const subscription = new SubscriptionBuilder<UserCreatedEvent>()
      .eventType(UserCreatedEvent.name)
      .handler(handler)
      .build();

    registry.registerSubscription(subscription);

    const resolved = registry.lookup(new UserCreatedEvent({ userId: '42' }));
    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.descriptor.handler).toBe(handler);
    expect(registry.getEventTypes()).toContain(UserCreatedEvent.name);
  });

  it('prepares publishing without invoking handlers', async () => {
    const registry = new SubscriptionRegistry();
    const handler = new RecordingHandler();
    const publisher = new EventPublisher(registry);

    registry.register(handler, UserCreatedEvent);

    const event = new UserCreatedEvent({ userId: '42' });
    await publisher.publish(event);

    expect(handler.handledEvents).toHaveLength(0);
    expect(publisher.preparedEvents).toHaveLength(1);
    expect(publisher.preparedEvents[0]?.event).toBe(event);
  });

  it('supports concurrent registration and publication preparation', async () => {
    const registry = new SubscriptionRegistry();
    const publisher = new EventPublisher(registry);
    const handlers = Array.from({ length: 5 }, () => new RecordingHandler());

    await Promise.all(
      handlers.map((handler) => Promise.resolve(registry.register(handler, UserCreatedEvent))),
    );

    const event = new UserCreatedEvent({ userId: '42' });
    await Promise.all(Array.from({ length: 3 }, () => publisher.publish(event)));

    expect(registry.getSubscriptions(UserCreatedEvent.name)).toHaveLength(5);
    expect(publisher.preparedEvents).toHaveLength(3);
  });
});
