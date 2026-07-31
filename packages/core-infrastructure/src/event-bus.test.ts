import { describe, expect, it } from 'vitest';

import {
  EventBase,
  type EventCategory,
  EventContext,
  EventEnvelope,
  EventMetadata,
  EventPriority,
  type IEvent,
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
});
