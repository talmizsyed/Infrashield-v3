import { describe, expect, it } from 'vitest';

import {
  createInjectionToken,
  DependencyRegistrationError,
  ResolutionException,
  ServiceCollection,
  ServiceDescriptor,
  ServiceLifetime,
  ServiceProvider,
  type ServiceFactory,
} from './di';

class TestService {
  public readonly id = 'service';
}

class TestImplementation extends TestService {
  public readonly implementationId = 'impl';
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
});
