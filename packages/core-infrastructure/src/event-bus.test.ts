import { describe, expect, it } from 'vitest';

import { createInjectionToken, ServiceCollection, ServiceProvider } from './di';
import {
  EventBase,
  type EventCategory,
  EventContext,
  EventEnvelope,
  EventMetadata,
  EventPriority,
  type IEvent,
  type IEventHandler,
  EventDelegate,
  EventDispatcher,
  EventMiddlewareContext,
  EventPipelineBuilder,
  HandlerResolver,
  EventPublisher,
  IEventMiddleware,
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

class CounterService {
  public readonly calls: string[] = [];
}

class InjectedHandler implements IEventHandler<UserCreatedEvent> {
  public constructor(private readonly counter: CounterService) {}

  public async handle(event: UserCreatedEvent): Promise<void> {
    this.counter.calls.push(event.payload.userId);
  }
}

class OrderedHandler implements IEventHandler<UserCreatedEvent> {
  public constructor(
    private readonly counter: CounterService,
    private readonly label: string,
  ) {}

  public async handle(event: UserCreatedEvent): Promise<void> {
    this.counter.calls.push(`${this.label}:${event.payload.userId}`);
  }
}

class ThrowingHandler implements IEventHandler<UserCreatedEvent> {
  public constructor(private readonly counter: CounterService) {}

  public async handle(event: UserCreatedEvent): Promise<void> {
    this.counter.calls.push(`throw:${event.payload.userId}`);
    throw new Error(`boom:${event.payload.userId}`);
  }
}

class TrackingMiddleware implements IEventMiddleware<UserCreatedEvent> {
  public constructor(
    public readonly name: string,
    private readonly entries: string[],
  ) {}

  public async execute(
    context: EventMiddlewareContext<UserCreatedEvent>,
    next: EventDelegate<UserCreatedEvent>,
  ): Promise<void> {
    this.entries.push(`${this.name}:before`);
    context.properties[`${this.name}:visited`] = true;
    await next(context);
    this.entries.push(`${this.name}:after`);
  }
}

class ShortCircuitMiddleware implements IEventMiddleware<UserCreatedEvent> {
  public constructor(private readonly entries: string[]) {}

  public async execute(
    context: EventMiddlewareContext<UserCreatedEvent>,
    _next: EventDelegate<UserCreatedEvent>,
  ): Promise<void> {
    this.entries.push('short-circuit');
    context.properties.shortCircuit = true;
  }
}

class ThrowingMiddleware implements IEventMiddleware<UserCreatedEvent> {
  public constructor(private readonly entries: string[]) {}

  public async execute(
    context: EventMiddlewareContext<UserCreatedEvent>,
    next: EventDelegate<UserCreatedEvent>,
  ): Promise<void> {
    this.entries.push('throwing:before');
    try {
      await next(context);
    } catch (error) {
      this.entries.push('throwing:after');
      throw error;
    }
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

  it('supports a single middleware around dispatch', async () => {
    const services = new ServiceCollection();
    const counterToken = createInjectionToken<CounterService>('counter');
    const handlerToken = createInjectionToken<IEventHandler<UserCreatedEvent>>('middleware-single');
    const entries: string[] = [];

    services.AddSingleton(counterToken, CounterService);
    services.AddTransient(
      handlerToken,
      (provider) => new InjectedHandler(provider.Resolve(counterToken)),
    );

    const provider = new ServiceProvider(services);
    const builder = new EventPipelineBuilder<UserCreatedEvent>();
    builder.use(new TrackingMiddleware('alpha', entries));
    const pipeline = builder.build();

    const dispatcher = new EventDispatcher(
      provider,
      new HandlerResolver(provider, () => handlerToken),
      pipeline,
    );

    await dispatcher.dispatch(new UserCreatedEvent({ userId: '42' }));

    expect(entries).toEqual(['alpha:before', 'alpha:after']);
    expect(provider.Resolve(counterToken).calls).toEqual(['42']);
  });

  it('executes multiple middleware in registration order', async () => {
    const entries: string[] = [];
    const builder = new EventPipelineBuilder<UserCreatedEvent>();
    builder.use(new TrackingMiddleware('first', entries));
    builder.use(new TrackingMiddleware('second', entries));
    const pipeline = builder.build();

    const delegate: EventDelegate<UserCreatedEvent> = async (context) => {
      entries.push(`core:${context.event.payload.userId}`);
    };

    await pipeline.execute(
      new EventMiddlewareContext(new UserCreatedEvent({ userId: '42' }), undefined),
      delegate,
    );

    expect(entries).toEqual([
      'first:before',
      'second:before',
      'core:42',
      'second:after',
      'first:after',
    ]);
  });

  it('supports short-circuiting and context propagation', async () => {
    const entries: string[] = [];
    const builder = new EventPipelineBuilder<UserCreatedEvent>();
    builder.use(new ShortCircuitMiddleware(entries));
    builder.use(new TrackingMiddleware('tail', entries));
    const pipeline = builder.build();
    const context = new EventMiddlewareContext(new UserCreatedEvent({ userId: '42' }), undefined);

    await pipeline.execute(context, async () => {
      entries.push('core');
    });

    expect(entries).toEqual(['short-circuit']);
    expect(context.properties.shortCircuit).toBe(true);
  });

  it('intercepts middleware exceptions and preserves propagation', async () => {
    const entries: string[] = [];
    const builder = new EventPipelineBuilder<UserCreatedEvent>();
    builder.use(new ThrowingMiddleware(entries));
    const pipeline = builder.build();

    await expect(
      pipeline.execute(
        new EventMiddlewareContext(new UserCreatedEvent({ userId: '42' }), undefined),
        async () => {
          entries.push('core');
          throw new Error('boom');
        },
      ),
    ).rejects.toThrow('boom');

    expect(entries).toEqual(['throwing:before', 'core', 'throwing:after']);
  });

  it('composes pipelines immutably', async () => {
    const firstEntries: string[] = [];
    const secondEntries: string[] = [];
    const first = new EventPipelineBuilder<UserCreatedEvent>()
      .use(new TrackingMiddleware('first', firstEntries))
      .build();
    const second = new EventPipelineBuilder<UserCreatedEvent>()
      .use(new TrackingMiddleware('second', secondEntries))
      .build();

    const composed = first.compose(second);
    await composed.execute(
      new EventMiddlewareContext(new UserCreatedEvent({ userId: '42' }), undefined),
      async () => {
        firstEntries.push('core');
        secondEntries.push('core');
      },
    );

    expect(firstEntries).toEqual(['first:before', 'core', 'first:after']);
    expect(secondEntries).toEqual(['second:before', 'core', 'second:after']);
  });

  it('supports concurrent execution with isolated contexts', async () => {
    const entries: string[] = [];
    const pipeline = new EventPipelineBuilder<UserCreatedEvent>()
      .use(new TrackingMiddleware('shared', entries))
      .build();

    await Promise.all(
      Array.from({ length: 3 }, (_, index) =>
        pipeline.execute(
          new EventMiddlewareContext(new UserCreatedEvent({ userId: String(index) }), undefined),
          async (context) => {
            entries.push(`core:${context.event.payload.userId}`);
          },
        ),
      ),
    );

    expect(entries.filter((value) => value.startsWith('shared:before'))).toHaveLength(3);
    expect(entries.filter((value) => value.startsWith('core:'))).toHaveLength(3);
  });

  it('dispatches a single handler through the dependency injection container', async () => {
    const services = new ServiceCollection();
    const counterToken = createInjectionToken<CounterService>('counter');
    const handlerToken = createInjectionToken<IEventHandler<UserCreatedEvent>>('user-created');

    services.AddSingleton(counterToken, CounterService);
    services.AddTransient(
      handlerToken,
      (provider) => new InjectedHandler(provider.Resolve(counterToken)),
    );

    const provider = new ServiceProvider(services);
    const dispatcher = new EventDispatcher(
      provider,
      new HandlerResolver(provider, () => handlerToken),
    );
    const event = new UserCreatedEvent({ userId: '42' });

    const result = await dispatcher.dispatch(event);
    console.log('single-result', result.succeeded, result.errors, result.statistics);

    expect(result.succeeded).toBe(true);
    expect(result.statistics.executedHandlers).toBe(1);
    expect(result.statistics.resolvedHandlers).toBe(1);
    expect(provider.Resolve(counterToken).calls).toEqual(['42']);
  });

  it('dispatches multiple handlers in registration order', async () => {
    const services = new ServiceCollection();
    const counterToken = createInjectionToken<CounterService>('counter');
    const handlerToken = createInjectionToken<IEventHandler<UserCreatedEvent>>('ordered');

    services.AddSingleton(counterToken, CounterService);
    services.AddTransient(
      handlerToken,
      (provider) => new OrderedHandler(provider.Resolve(counterToken), 'first'),
    );
    services.AddTransient(
      handlerToken,
      (provider) => new OrderedHandler(provider.Resolve(counterToken), 'second'),
    );

    const provider = new ServiceProvider(services);
    const dispatcher = new EventDispatcher(
      provider,
      new HandlerResolver(provider, () => handlerToken),
    );
    const event = new UserCreatedEvent({ userId: '42' });

    const result = await dispatcher.dispatch(event);

    expect(result.statistics.executedHandlers).toBe(2);
    expect(provider.Resolve(counterToken).calls).toEqual(['first:42', 'second:42']);
  });

  it('aggregates handler failures without corrupting dispatcher state', async () => {
    const services = new ServiceCollection();
    const counterToken = createInjectionToken<CounterService>('counter');
    const handlerToken = createInjectionToken<IEventHandler<UserCreatedEvent>>('failing');

    services.AddSingleton(counterToken, CounterService);
    services.AddTransient(
      handlerToken,
      (provider) => new ThrowingHandler(provider.Resolve(counterToken)),
    );
    services.AddTransient(
      handlerToken,
      (provider) => new InjectedHandler(provider.Resolve(counterToken)),
    );

    const provider = new ServiceProvider(services);
    const dispatcher = new EventDispatcher(
      provider,
      new HandlerResolver(provider, () => handlerToken),
    );
    const event = new UserCreatedEvent({ userId: '42' });

    const result = await dispatcher.dispatch(event);

    expect(result.succeeded).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.statistics.failedHandlers).toBe(1);
    expect(result.statistics.executedHandlers).toBe(1);
    expect(provider.Resolve(counterToken).calls).toEqual(['throw:42', '42']);
  });

  it('supports cancellation and reports cancelled dispatches', async () => {
    const services = new ServiceCollection();
    const counterToken = createInjectionToken<CounterService>('counter');
    const handlerToken = createInjectionToken<IEventHandler<UserCreatedEvent>>('cancelled');

    services.AddSingleton(counterToken, CounterService);
    services.AddTransient(
      handlerToken,
      (provider) => new InjectedHandler(provider.Resolve(counterToken)),
    );

    const provider = new ServiceProvider(services);
    const dispatcher = new EventDispatcher(
      provider,
      new HandlerResolver(provider, () => handlerToken),
    );
    const controller = new AbortController();
    controller.abort();

    const result = await dispatcher.dispatch(new UserCreatedEvent({ userId: '42' }), {
      signal: controller.signal,
    });

    expect(result.statistics.cancelled).toBe(true);
    expect(result.statistics.executedHandlers).toBe(0);
    expect(result.succeeded).toBe(false);
  });

  it('supports concurrent dispatches', async () => {
    const services = new ServiceCollection();
    const counterToken = createInjectionToken<CounterService>('counter');
    const handlerToken = createInjectionToken<IEventHandler<UserCreatedEvent>>('concurrent');

    services.AddSingleton(counterToken, CounterService);
    services.AddTransient(
      handlerToken,
      (provider) => new InjectedHandler(provider.Resolve(counterToken)),
    );

    const provider = new ServiceProvider(services);
    const dispatcher = new EventDispatcher(
      provider,
      new HandlerResolver(provider, () => handlerToken),
    );

    const results = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        dispatcher.dispatch(new UserCreatedEvent({ userId: String(index) })),
      ),
    );

    expect(results).toHaveLength(5);
    expect(results.every((result) => result.succeeded)).toBe(true);
    expect(provider.Resolve(counterToken).calls).toHaveLength(5);
  });
});
