import { describe, expect, it } from 'vitest';

import {
  CircularDependencyException,
  createInjectionToken,
  DependencyRegistrationError,
  DependencyValidator,
  type IDisposable,
  type IAsyncDisposable,
  ResolutionException,
  ServiceCollection,
  ServiceDescriptor,
  ServiceLifetime,
  ServiceProvider,
  type ServiceFactory,
  type ServiceType,
  ValidationException,
} from './di';

class TestService {
  public readonly id = 'service';
}

class TestImplementation extends TestService {
  public readonly implementationId = 'impl';
}

class TestServiceWithId extends TestService {
  public constructor(public readonly id: string) {
    super();
  }
}

class DisposableService implements IDisposable {
  public constructor(public readonly name: string) {}

  public disposed = false;

  public dispose(): void {
    this.disposed = true;
  }
}

class AsyncDisposableService implements IAsyncDisposable {
  public asyncDisposed = false;

  public async disposeAsync(): Promise<void> {
    this.asyncDisposed = true;
  }
}

class TrackingDisposableService implements IDisposable {
  public static order: string[] = [];

  public constructor(public readonly name: string) {}

  public dispose(): void {
    TrackingDisposableService.order.push(this.name);
  }
}

class LeafDependency {
  public readonly id = 'leaf';
}

class MiddleDependency {
  public constructor(public readonly leaf: LeafDependency) {}
}

class RootDependency {
  public constructor(
    public readonly middle: MiddleDependency,
    public readonly leaf: LeafDependency,
  ) {}
}

class ConstructorConsumer {
  public constructor(public readonly dependency: RootDependency) {}
}

class CircularA {
  public constructor(public readonly dependency: CircularB) {}
}

class CircularB {
  public constructor(public readonly dependency: CircularA) {}
}

class DeepCircularA {
  public constructor(public readonly dependency: DeepCircularB) {}
}

class DeepCircularB {
  public constructor(public readonly dependency: DeepCircularC) {}
}

class DeepCircularC {
  public constructor(public readonly dependency: DeepCircularA) {}
}

class SelfCircularService {
  public constructor(public readonly dependency: SelfCircularService) {}
}

class MissingDependencyConsumer {
  public constructor(public readonly dependency: LeafDependency) {}
}

class MultiDependencyConsumer {
  public constructor(
    public readonly first: LeafDependency,
    public readonly second: MiddleDependency,
  ) {}
}

class InvalidConstructorConsumer {
  public constructor(
    public readonly first: LeafDependency,
    public readonly second: LeafDependency,
  ) {}
}

function annotateConstructorDependencies<TService>(
  implementationType: ServiceType<TService>,
  tokens: readonly unknown[],
): ServiceType<TService> {
  Object.assign(implementationType, { __injectionTokens: tokens });
  return implementationType;
}

describe('service collection', () => {
  it('registers singleton metadata using type, factory, self, and instance overloads', () => {
    const collection = new ServiceCollection();
    const typeToken = createInjectionToken<TestService>('singleton-type');
    const factoryToken = createInjectionToken<TestService>('singleton-factory');
    const selfToken = createInjectionToken<TestService>('singleton-self');
    const instanceToken = createInjectionToken<TestService>('singleton-instance');

    const factory: ServiceFactory<TestService> = () => new TestService();
    const instance = new TestService();

    collection.AddSingleton<TestService, TestImplementation>(typeToken, TestImplementation);
    collection.AddSingleton(factoryToken, factory);
    collection.AddSingleton(selfToken);
    collection.AddSingleton(instanceToken, instance);

    const descriptors = collection.Enumerate();

    expect(collection.Count).toBe(4);
    expect(descriptors[0]).toMatchObject({ token: typeToken, lifetime: ServiceLifetime.Singleton });
    expect(descriptors[1]).toMatchObject({
      token: factoryToken,
      lifetime: ServiceLifetime.Singleton,
    });
    expect(descriptors[2]).toMatchObject({ token: selfToken, lifetime: ServiceLifetime.Singleton });
    expect(descriptors[3]).toMatchObject({
      token: instanceToken,
      lifetime: ServiceLifetime.Singleton,
    });

    expect(descriptors[0]?.registration.kind).toBe('type');
    expect(descriptors[1]?.registration.kind).toBe('factory');
    expect(descriptors[2]?.registration.kind).toBe('self');
    expect(descriptors[3]?.registration.kind).toBe('instance');
  });

  it('registers scoped metadata using type, factory, and self overloads', () => {
    const collection = new ServiceCollection();
    const typeToken = createInjectionToken<TestService>('scoped-type');
    const factoryToken = createInjectionToken<TestService>('scoped-factory');
    const selfToken = createInjectionToken<TestService>('scoped-self');

    collection.AddScoped<TestService, TestImplementation>(typeToken, TestImplementation);
    collection.AddScoped(factoryToken, () => new TestService());
    collection.AddScoped(selfToken);

    const descriptors = collection.Enumerate();

    expect(descriptors).toHaveLength(3);
    expect(descriptors.every((descriptor) => descriptor.lifetime === ServiceLifetime.Scoped)).toBe(
      true,
    );
  });

  it('registers transient metadata using type, factory, and self overloads', () => {
    const collection = new ServiceCollection();
    const typeToken = createInjectionToken<TestService>('transient-type');
    const factoryToken = createInjectionToken<TestService>('transient-factory');
    const selfToken = createInjectionToken<TestService>('transient-self');

    collection.AddTransient<TestService, TestImplementation>(typeToken, TestImplementation);
    collection.AddTransient(factoryToken, () => new TestService());
    collection.AddTransient(selfToken);

    const descriptors = collection.Enumerate();

    expect(descriptors).toHaveLength(3);
    expect(
      descriptors.every((descriptor) => descriptor.lifetime === ServiceLifetime.Transient),
    ).toBe(true);
  });

  it('adds singleton instance metadata via AddInstance', () => {
    const collection = new ServiceCollection();
    const token = createInjectionToken<TestService>('instance');
    const instance = new TestService();

    collection.AddInstance(token, instance);

    const descriptor = collection.Enumerate()[0];
    expect(descriptor?.lifetime).toBe(ServiceLifetime.Singleton);
    expect(descriptor?.registration.kind).toBe('instance');
  });

  it('supports TryAdd semantics without replacing existing registrations', () => {
    const token = createInjectionToken<TestService>('try-add');
    const collection = new ServiceCollection();

    const first = ServiceDescriptor.self(token, ServiceLifetime.Singleton);
    const second = ServiceDescriptor.self(token, ServiceLifetime.Transient);

    expect(collection.TryAdd(first)).toBe(true);
    expect(collection.TryAdd(second)).toBe(false);
    expect(collection.Count).toBe(1);
    expect(collection.Enumerate()[0]?.lifetime).toBe(ServiceLifetime.Singleton);
  });

  it('replaces all registrations for a token', () => {
    const token = createInjectionToken<TestService>('replace');
    const collection = new ServiceCollection();

    collection.AddTransient(token, () => new TestService());
    collection.AddScoped(token, () => new TestService());

    collection.Replace(ServiceDescriptor.self(token, ServiceLifetime.Singleton));

    expect(collection.Count).toBe(1);
    expect(collection.Enumerate()[0]?.lifetime).toBe(ServiceLifetime.Singleton);
  });

  it('removes registrations by token', () => {
    const tokenA = createInjectionToken<TestService>('remove-a');
    const tokenB = createInjectionToken<TestService>('remove-b');
    const collection = new ServiceCollection();

    collection.AddTransient(tokenA, () => new TestService());
    collection.AddTransient(tokenA, () => new TestService());
    collection.AddTransient(tokenB, () => new TestService());

    expect(collection.Remove(tokenA)).toBe(true);
    expect(collection.Count).toBe(1);
    expect(collection.Contains(tokenA)).toBe(false);
    expect(collection.Contains(tokenB)).toBe(true);
  });

  it('clears all registrations', () => {
    const collection = new ServiceCollection();
    collection.AddTransient(createInjectionToken<TestService>('clear-a'), () => new TestService());
    collection.AddScoped(createInjectionToken<TestService>('clear-b'), () => new TestService());

    collection.Clear();

    expect(collection.Count).toBe(0);
    expect(collection.Enumerate()).toEqual([]);
  });

  it('enumerates registrations in insertion order', () => {
    const tokenA = createInjectionToken<TestService>('enumerate-a');
    const tokenB = createInjectionToken<TestService>('enumerate-b');
    const tokenC = createInjectionToken<TestService>('enumerate-c');

    const collection = new ServiceCollection();
    collection.AddTransient(tokenA, () => new TestService());
    collection.AddScoped(tokenB, () => new TestService());
    collection.AddSingleton(tokenC, () => new TestService());

    const tokens = collection.Enumerate().map((descriptor) => descriptor.token);
    expect(tokens).toEqual([tokenA, tokenB, tokenC]);
  });

  it('reports duplicate token registrations via validation', () => {
    const token = createInjectionToken<TestService>('duplicate-token');
    const collection = new ServiceCollection();

    collection.AddTransient(token, () => new TestService());
    collection.AddScoped(token, () => new TestService());

    const report = collection.Validate();
    expect(report.valid).toBe(false);
    expect(report.duplicates).toHaveLength(1);
    expect(report.duplicates[0]?.token).toBe(token);
    expect(report.duplicates[0]?.count).toBe(2);
  });

  it('throws meaningful exceptions for invalid registration arguments', () => {
    const collection = new ServiceCollection();
    const token = createInjectionToken<TestService>('invalid-input');

    expect(() => collection.AddInstance(token, undefined as unknown as TestService)).toThrow(
      DependencyRegistrationError,
    );

    expect(() => collection.register(null as unknown as ServiceDescriptor<TestService>)).toThrow(
      DependencyRegistrationError,
    );

    expect(() => collection.Contains(null as unknown as symbol)).toThrow(
      DependencyRegistrationError,
    );

    expect(() => collection.AddScoped(token, {} as unknown as ServiceFactory<TestService>)).toThrow(
      DependencyRegistrationError,
    );
  });

  it('throws duplicate detection exception for equivalent descriptor registration', () => {
    const token = createInjectionToken<TestService>('equivalent');
    const collection = new ServiceCollection();
    const factory = (): TestService => new TestService();

    collection.AddSingleton(token, factory);

    expect(() => collection.AddSingleton(token, factory)).toThrow(DependencyRegistrationError);
  });
});

describe('service provider', () => {
  it('resolves singleton registrations once per provider', () => {
    const token = createInjectionToken<TestService>('provider-singleton');
    const collection = new ServiceCollection();
    collection.AddSingleton(token, () => new TestService());

    const provider = new ServiceProvider(collection);
    const first = provider.Resolve(token);
    const second = provider.Resolve(token);

    expect(first).toBeInstanceOf(TestService);
    expect(first).toBe(second);
  });

  it('resolves transient registrations as new instances', () => {
    const token = createInjectionToken<TestService>('provider-transient');
    const collection = new ServiceCollection();
    collection.AddTransient(token, () => new TestService());

    const provider = new ServiceProvider(collection);
    const first = provider.Resolve(token);
    const second = provider.Resolve(token);

    expect(first).not.toBe(second);
  });

  it('resolves instance registrations directly', () => {
    const token = createInjectionToken<TestService>('provider-instance');
    const collection = new ServiceCollection();
    const instance = new TestService();
    collection.AddInstance(token, instance);

    const provider = new ServiceProvider(collection);

    expect(provider.Resolve(token)).toBe(instance);
  });

  it('invokes factory registrations with the provider', () => {
    const token = createInjectionToken<TestService>('provider-factory');
    const collection = new ServiceCollection();
    const provider = new ServiceProvider(collection);

    let factoryCalls = 0;
    collection.AddSingleton(token, (serviceProvider) => {
      factoryCalls += 1;
      expect(serviceProvider).toBe(provider);
      return new TestService();
    });

    const resolved = provider.Resolve(token);

    expect(resolved).toBeInstanceOf(TestService);
    expect(factoryCalls).toBe(1);
  });

  it('resolves all registrations for a token in registration order', () => {
    const token = createInjectionToken<TestService>('provider-all');
    const collection = new ServiceCollection();
    collection.AddSingleton(token, () => new TestService());
    collection.AddTransient(token, () => new TestService());

    const provider = new ServiceProvider(collection);
    const resolved = provider.ResolveAll(token);

    expect(resolved).toHaveLength(2);
    expect(resolved[0]).toBeInstanceOf(TestService);
    expect(resolved[1]).toBeInstanceOf(TestService);
  });

  it('supports required and optional resolve operations', () => {
    const token = createInjectionToken<TestService>('provider-required');
    const collection = new ServiceCollection();
    collection.AddSingleton(token, () => new TestService());

    const provider = new ServiceProvider(collection);

    expect(provider.ResolveRequired(token)).toBeInstanceOf(TestService);
    expect(provider.TryResolve(createInjectionToken<TestService>('missing'))).toBeUndefined();
  });

  it('throws meaningful errors for missing, duplicate, invalid lifetime, and factory failures', () => {
    const missingToken = createInjectionToken<TestService>('missing');
    const duplicateToken = createInjectionToken<TestService>('duplicate');
    const invalidToken = createInjectionToken<TestService>('invalid');
    const factoryToken = createInjectionToken<TestService>('factory-failure');
    const collection = new ServiceCollection();

    collection.AddSingleton(duplicateToken, () => new TestService());
    collection.AddTransient(duplicateToken, () => new TestService());
    collection.AddSingleton(factoryToken, () => {
      throw new Error('boom');
    });

    const provider = new ServiceProvider(collection);

    expect(() => provider.Resolve(missingToken)).toThrow(ResolutionException);
    expect(() => provider.Resolve(duplicateToken)).toThrow(ResolutionException);
    expect(() => provider.Resolve(invalidToken)).toThrow(ResolutionException);
    expect(() => provider.Resolve(factoryToken)).toThrow(ResolutionException);
  });

  it('caches singleton resolutions across repeated calls', () => {
    const token = createInjectionToken<TestService>('provider-thread-safe');
    const collection = new ServiceCollection();
    let factoryCalls = 0;

    collection.AddSingleton(token, () => {
      factoryCalls += 1;
      return new TestService();
    });

    const provider = new ServiceProvider(collection);
    const results = Array.from({ length: 25 }, () => provider.Resolve(token));

    expect(factoryCalls).toBe(1);
    expect(new Set(results).size).toBe(1);
  });

  it('resolves constructor dependencies recursively', () => {
    const leafToken = createInjectionToken<LeafDependency>('leaf');
    const middleToken = createInjectionToken<MiddleDependency>('middle');
    const rootToken = createInjectionToken<RootDependency>('root');
    const consumerToken = createInjectionToken<ConstructorConsumer>('consumer');

    const collection = new ServiceCollection();
    collection.AddSingleton(leafToken, LeafDependency);
    collection.AddTransient(
      middleToken,
      annotateConstructorDependencies(MiddleDependency, [leafToken]),
    );
    collection.AddTransient(
      rootToken,
      annotateConstructorDependencies(RootDependency, [middleToken, leafToken]),
    );
    collection.AddTransient(
      consumerToken,
      annotateConstructorDependencies(ConstructorConsumer, [rootToken]),
    );

    const provider = new ServiceProvider(collection);
    const consumer = provider.Resolve(consumerToken);

    expect(consumer).toBeInstanceOf(ConstructorConsumer);
    expect(consumer.dependency).toBeInstanceOf(RootDependency);
    expect(consumer.dependency.middle).toBeInstanceOf(MiddleDependency);
    expect(consumer.dependency.middle.leaf).toBeInstanceOf(LeafDependency);
    expect(consumer.dependency.leaf).toBeInstanceOf(LeafDependency);
  });

  it('resolves multiple constructor dependencies', () => {
    const leafToken = createInjectionToken<LeafDependency>('multi-leaf');
    const middleToken = createInjectionToken<MiddleDependency>('multi-middle');
    const consumerToken = createInjectionToken<MultiDependencyConsumer>('multi-consumer');

    const collection = new ServiceCollection();
    collection.AddSingleton(leafToken, LeafDependency);
    collection.AddTransient(
      middleToken,
      annotateConstructorDependencies(MiddleDependency, [leafToken]),
    );
    collection.AddTransient(
      consumerToken,
      annotateConstructorDependencies(MultiDependencyConsumer, [leafToken, middleToken]),
    );

    const provider = new ServiceProvider(collection);
    const consumer = provider.Resolve(consumerToken);

    expect(consumer.first).toBeInstanceOf(LeafDependency);
    expect(consumer.second).toBeInstanceOf(MiddleDependency);
    expect(consumer.second.leaf).toBeInstanceOf(LeafDependency);
  });

  it('validates constructor dependencies that are missing from the collection', () => {
    const consumerToken = createInjectionToken<ConstructorConsumer>('missing-constructor-consumer');
    const collection = new ServiceCollection();

    collection.AddTransient(
      consumerToken,
      annotateConstructorDependencies(ConstructorConsumer, [
        createInjectionToken<RootDependency>('missing-root'),
      ]),
    );

    const provider = new ServiceProvider(collection);

    expect(() => provider.Resolve(consumerToken)).toThrow(ValidationException);
  });

  it('validates constructor dependency metadata', () => {
    const consumerToken = createInjectionToken<InvalidConstructorConsumer>('invalid-constructor');
    const collection = new ServiceCollection();

    collection.AddTransient(
      consumerToken,
      annotateConstructorDependencies(InvalidConstructorConsumer, [
        createInjectionToken<LeafDependency>('token-1'),
      ]),
    );

    const provider = new ServiceProvider(collection);

    expect(() => provider.Resolve(consumerToken)).toThrow(ResolutionException);
  });

  it('supports factory integrations with constructor-resolved services', () => {
    const leafToken = createInjectionToken<LeafDependency>('factory-leaf');
    const middleToken = createInjectionToken<MiddleDependency>('factory-middle');
    const rootToken = createInjectionToken<RootDependency>('factory-root');
    const consumerToken = createInjectionToken<ConstructorConsumer>('factory-consumer');
    const collection = new ServiceCollection();

    collection.AddSingleton(leafToken, LeafDependency);
    collection.AddTransient(
      middleToken,
      annotateConstructorDependencies(MiddleDependency, [leafToken]),
    );
    collection.AddSingleton(
      rootToken,
      annotateConstructorDependencies(RootDependency, [middleToken, leafToken]),
    );
    collection.AddSingleton(
      consumerToken,
      annotateConstructorDependencies(ConstructorConsumer, [rootToken]),
    );

    const provider = new ServiceProvider(collection);
    const consumer = provider.Resolve(consumerToken);

    expect(consumer.dependency).toBeInstanceOf(RootDependency);
  });

  it('supports mixed singleton, scoped, transient, factory, and instance registrations end to end', async () => {
    const singletonToken = createInjectionToken<LeafDependency>('e2e-singleton');
    const scopedToken = createInjectionToken<MiddleDependency>('e2e-scoped');
    const transientToken = createInjectionToken<RootDependency>('e2e-transient');
    const factoryToken = createInjectionToken<DisposableService>('e2e-factory');
    const instanceToken = createInjectionToken<DisposableService>('e2e-instance');
    const collection = new ServiceCollection();

    collection.AddSingleton(singletonToken, LeafDependency);
    collection.AddScoped(
      scopedToken,
      annotateConstructorDependencies(MiddleDependency, [singletonToken]),
    );
    collection.AddTransient(
      transientToken,
      annotateConstructorDependencies(RootDependency, [scopedToken, singletonToken]),
    );
    collection.AddSingleton(factoryToken, () => new DisposableService('factory'));
    collection.AddInstance(instanceToken, new DisposableService('instance'));

    const provider = new ServiceProvider(collection);
    const scope = provider.createScope();

    const scopeMiddle = scope.resolve(scopedToken);
    const root = scope.resolve(transientToken);
    const singleton = scope.resolve(singletonToken);

    expect(scopeMiddle.leaf).toBe(singleton);
    expect(root.middle).toBe(scopeMiddle);
    expect(root.leaf).toBe(singleton);
    expect(provider.Resolve(factoryToken)).toBeInstanceOf(DisposableService);
    expect(provider.Resolve(instanceToken)).toBeInstanceOf(DisposableService);

    await scope.dispose();
    await provider.dispose();
  });

  it('creates scoped services that are isolated per scope', () => {
    const token = createInjectionToken<TestService>('scope-scoped');
    const collection = new ServiceCollection();
    collection.AddScoped(token, () => new TestService());

    const provider = new ServiceProvider(collection);
    const firstScope = provider.createScope();
    const secondScope = provider.createScope();

    const firstResolved = firstScope.resolve(token);
    const sameInFirstScope = firstScope.resolve(token);
    const secondResolved = secondScope.resolve(token);

    expect(firstResolved).toBe(sameInFirstScope);
    expect(firstResolved).not.toBe(secondResolved);
  });

  it('shares singleton services across scopes and resolves transient services anew', () => {
    const singletonToken = createInjectionToken<TestService>('scope-singleton');
    const transientToken = createInjectionToken<TestService>('scope-transient');
    const collection = new ServiceCollection();
    collection.AddSingleton(singletonToken, () => new TestService());
    collection.AddTransient(transientToken, () => new TestService());

    const provider = new ServiceProvider(collection);
    const firstScope = provider.createScope();
    const secondScope = provider.createScope();

    const sharedFirst = firstScope.resolve(singletonToken);
    const sharedSecond = secondScope.resolve(singletonToken);
    const transientFirst = firstScope.resolve(transientToken);
    const transientSecond = secondScope.resolve(transientToken);

    expect(sharedFirst).toBe(sharedSecond);
    expect(transientFirst).not.toBe(transientSecond);
  });

  it('supports nested scopes and disposal semantics', () => {
    const token = createInjectionToken<TestService>('nested-scope');
    const collection = new ServiceCollection();
    collection.AddScoped(token, () => new TestService());

    const provider = new ServiceProvider(collection);
    const parentScope = provider.createScope();
    const childScope = provider.createScope();

    const parentResolved = parentScope.resolve(token);
    const childResolved = childScope.resolve(token);

    expect(parentResolved).not.toBe(childResolved);

    void childScope.dispose();

    expect(() => childScope.resolve(token)).toThrow(ResolutionException);
  });

  it('prevents resolution after a scope is disposed', () => {
    const token = createInjectionToken<TestService>('disposed-scope');
    const collection = new ServiceCollection();
    collection.AddScoped(token, () => new TestService());

    const provider = new ServiceProvider(collection);
    const scope = provider.createScope();
    void scope.dispose();

    expect(() => scope.resolve(token)).toThrow(ResolutionException);
  });

  it('creates scopes concurrently without corrupting the cache', async () => {
    const token = createInjectionToken<TestService>('concurrent-scope');
    const collection = new ServiceCollection();
    let counter = 0;
    collection.AddScoped(token, () => new TestServiceWithId(++counter));

    const provider = new ServiceProvider(collection);
    const scopes = await Promise.all(
      Array.from({ length: 10 }, () => Promise.resolve(provider.createScope())),
    );

    const instances = scopes.map((scope) => scope.resolve(token));
    const unique = new Set(instances.map((instance) => instance.id));

    expect(unique.size).toBe(10);
  });

  it('disposes singleton services when the provider is disposed', async () => {
    const token = createInjectionToken<DisposableService>('singleton-disposal');
    const collection = new ServiceCollection();
    collection.AddSingleton(token, () => new DisposableService('singleton'));

    const provider = new ServiceProvider(collection);
    const service = provider.Resolve(token);

    await provider.dispose();

    expect(service.disposed).toBe(true);
  });

  it('disposes scoped services when their scope is disposed', async () => {
    const token = createInjectionToken<DisposableService>('scoped-disposal');
    const collection = new ServiceCollection();
    collection.AddScoped(token, () => new DisposableService('scoped'));

    const provider = new ServiceProvider(collection);
    const scope = provider.createScope();
    const service = scope.resolve(token);

    await scope.dispose();

    expect(service.disposed).toBe(true);
  });

  it('disposes transient services when they are owned by the container', async () => {
    const token = createInjectionToken<DisposableService>('transient-disposal');
    const collection = new ServiceCollection();
    collection.AddTransient(token, () => new DisposableService('transient'));

    const provider = new ServiceProvider(collection);
    const service = provider.Resolve(token);

    await provider.dispose();

    expect(service.disposed).toBe(true);
  });

  it('disposes disposable services in reverse-order', async () => {
    const firstToken = createInjectionToken<TrackingDisposableService>('reverse-first');
    const secondToken = createInjectionToken<TrackingDisposableService>('reverse-second');
    const collection = new ServiceCollection();
    collection.AddSingleton(firstToken, () => new TrackingDisposableService('first'));
    collection.AddSingleton(secondToken, () => new TrackingDisposableService('second'));

    TrackingDisposableService.order = [];
    const provider = new ServiceProvider(collection);
    provider.Resolve(firstToken);
    provider.Resolve(secondToken);

    await provider.dispose();

    expect(TrackingDisposableService.order).toEqual(['second', 'first']);
  });

  it('is safe to dispose the same scope or provider multiple times', async () => {
    const token = createInjectionToken<DisposableService>('double-disposal');
    const collection = new ServiceCollection();
    collection.AddSingleton(token, () => new DisposableService('double'));

    const provider = new ServiceProvider(collection);
    provider.Resolve(token);

    await expect(provider.dispose()).resolves.toBeUndefined();
    await expect(provider.dispose()).resolves.toBeUndefined();
  });

  it('supports async disposal for services that implement disposeAsync', async () => {
    const token = createInjectionToken<AsyncDisposableService>('async-disposal');
    const collection = new ServiceCollection();
    collection.AddSingleton(token, () => new AsyncDisposableService());

    const provider = new ServiceProvider(collection);
    const service = provider.Resolve(token);

    await provider.dispose();

    expect(service.asyncDisposed).toBe(true);
  });

  it('throws meaningful exceptions when resolving services after disposal', async () => {
    const token = createInjectionToken<DisposableService>('post-disposal');
    const collection = new ServiceCollection();
    collection.AddSingleton(token, () => new DisposableService('post'));

    const provider = new ServiceProvider(collection);
    await provider.dispose();

    expect(() => provider.Resolve(token)).toThrow(ResolutionException);
  });

  it('throws meaningful exceptions when resolving from a disposed scope', async () => {
    const token = createInjectionToken<DisposableService>('disposed-scope');
    const collection = new ServiceCollection();
    collection.AddScoped(token, () => new DisposableService('scope'));

    const provider = new ServiceProvider(collection);
    const scope = provider.createScope();
    await scope.dispose();

    expect(() => scope.resolve(token)).toThrow(ResolutionException);
  });

  it('allows concurrent disposal without corrupting lifecycle state', async () => {
    const token = createInjectionToken<DisposableService>('concurrent-disposal');
    const collection = new ServiceCollection();
    collection.AddSingleton(token, () => new DisposableService('concurrent'));

    const provider = new ServiceProvider(collection);
    provider.Resolve(token);

    await expect(
      Promise.all([provider.dispose(), provider.dispose(), provider.dispose()]),
    ).resolves.toEqual([undefined, undefined, undefined]);
  });

  it('detects simple circular dependencies during resolution', () => {
    const tokenA = createInjectionToken<CircularA>('circular-a');
    const tokenB = createInjectionToken<CircularB>('circular-b');
    const collection = new ServiceCollection();
    collection.AddSingleton(tokenA, annotateConstructorDependencies(CircularA, [tokenB]));
    collection.AddSingleton(tokenB, annotateConstructorDependencies(CircularB, [tokenA]));

    const provider = new ServiceProvider(collection);

    expect(() => provider.Resolve(tokenA)).toThrow(CircularDependencyException);
  });

  it('detects deep circular dependencies and reports their path', () => {
    const tokenA = createInjectionToken<DeepCircularA>('deep-circular-a');
    const tokenB = createInjectionToken<DeepCircularB>('deep-circular-b');
    const tokenC = createInjectionToken<DeepCircularC>('deep-circular-c');
    const collection = new ServiceCollection();
    collection.AddSingleton(tokenA, annotateConstructorDependencies(DeepCircularA, [tokenB]));
    collection.AddSingleton(tokenB, annotateConstructorDependencies(DeepCircularB, [tokenC]));
    collection.AddSingleton(tokenC, annotateConstructorDependencies(DeepCircularC, [tokenA]));

    const provider = new ServiceProvider(collection);

    try {
      provider.Resolve(tokenA);
      throw new Error('Expected circular dependency exception');
    } catch (error) {
      expect(error).toBeInstanceOf(CircularDependencyException);
      if (error instanceof CircularDependencyException) {
        expect(error.path.steps).toEqual([tokenA, tokenB, tokenC, tokenA]);
      }
    }
  });

  it('detects self dependencies as circular dependencies', () => {
    const token = createInjectionToken<SelfCircularService>('self-circular');
    const collection = new ServiceCollection();
    collection.AddSingleton(token, annotateConstructorDependencies(SelfCircularService, [token]));

    const provider = new ServiceProvider(collection);

    expect(() => provider.Resolve(token)).toThrow(CircularDependencyException);
  });

  it('throws validation exceptions for missing dependencies', () => {
    const token = createInjectionToken<MissingDependencyConsumer>('missing-dependency');
    const missingDependencyToken = createInjectionToken<LeafDependency>(
      'missing-dependency-target',
    );
    const collection = new ServiceCollection();
    collection.AddSingleton(
      token,
      annotateConstructorDependencies(MissingDependencyConsumer, [missingDependencyToken]),
    );

    const provider = new ServiceProvider(collection);

    expect(() => provider.Resolve(token)).toThrow(ValidationException);
  });

  it('throws validation exceptions for invalid constructor metadata', () => {
    const token = createInjectionToken<TestService>('invalid-constructor');
    const collection = new ServiceCollection();
    collection.AddSingleton(token, annotateConstructorDependencies(TestService, [token]));

    const provider = new ServiceProvider(collection);

    expect(() => provider.Resolve(token)).toThrow(ValidationException);
  });

  it('throws validation exceptions for invalid factory registrations', () => {
    const token = createInjectionToken<TestService>('invalid-factory');
    const collection = new ServiceCollection();
    collection.register(
      ServiceDescriptor.fromFactory(
        token,
        ServiceLifetime.Singleton,
        undefined as unknown as ServiceFactory<TestService>,
      ),
    );

    expect(() => new DependencyValidator(collection).validateCollection()).toThrow(
      ValidationException,
    );
  });

  it('reports duplicate registrations through validation', () => {
    const token = createInjectionToken<TestService>('duplicate-validation');
    const collection = new ServiceCollection();
    collection.AddSingleton(token, () => new TestService());
    collection.AddSingleton(token, () => new TestService());

    expect(() => new DependencyValidator(collection).validateCollection()).toThrow(
      ValidationException,
    );
  });

  it('supports concurrent validation without sharing state', async () => {
    const token = createInjectionToken<TestService>('concurrent-validation');
    const collection = new ServiceCollection();
    collection.AddSingleton(token, () => new TestService());

    const validator = new DependencyValidator(collection);
    await expect(
      Promise.all([validator.validateCollection(), validator.validateCollection()]),
    ).resolves.toEqual([undefined, undefined]);
  });
});
