import { describe, expect, it } from 'vitest';

import {
  createInjectionToken,
  DependencyRegistrationError,
  DependencyResolutionError,
  type InjectionToken,
  ServiceCollection,
  ServiceDescriptor,
  ServiceLifetime,
} from './di';

class DisposableTracker {
  public readonly id: string;

  public constructor(
    id: string,
    private readonly target: string[],
  ) {
    this.id = id;
  }

  public dispose(): void {
    this.target.push(this.id);
  }
}

class AsyncDisposableTracker {
  public readonly id: string;

  public constructor(
    id: string,
    private readonly target: string[],
  ) {
    this.id = id;
  }

  public async asyncDispose(): Promise<void> {
    this.target.push(this.id);
  }
}

const CLOCK_TOKEN = createInjectionToken<{ now(): number }>('clock');
const REPOSITORY_TOKEN = createInjectionToken<{ clock: { now(): number } }>('repository');
const SERVICE_TOKEN = createInjectionToken<{ repository: { clock: { now(): number } } }>('service');
const STRING_TOKEN = createInjectionToken<string>('string');

class ClockService {
  public now(): number {
    return Date.now();
  }
}

class RepositoryService {
  public static readonly inject: readonly InjectionToken<unknown>[] = [CLOCK_TOKEN];

  public constructor(public readonly clock: { now(): number }) {}
}

class AgentService {
  public static readonly inject: readonly InjectionToken<unknown>[] = [REPOSITORY_TOKEN];

  public constructor(public readonly repository: { clock: { now(): number } }) {}
}

class CircularA {
  public static inject: readonly InjectionToken<unknown>[] = [];
}

class CircularB {
  public static inject: readonly InjectionToken<unknown>[] = [];
}

class MissingInjectParameter {
  public constructor(public readonly value: string) {}
}

describe('dependency injection framework', () => {
  it('resolves singletons as one instance across root and child scopes', () => {
    const collection = new ServiceCollection();
    const token = createInjectionToken<{ id: string }>('singleton');
    let counter = 0;

    collection.AddSingleton(token, () => {
      counter += 1;
      return { id: `singleton-${counter}` };
    });

    const provider = collection.buildServiceProvider();
    const scope = provider.createScope();

    const first = provider.ResolveRequired(token);
    const second = provider.ResolveRequired(token);
    const third = scope.provider.ResolveRequired(token);

    expect(first).toBe(second);
    expect(second).toBe(third);
  });

  it('resolves scoped services per-scope and isolates child scopes', () => {
    const collection = new ServiceCollection();
    const token = createInjectionToken<{ id: string }>('scoped');
    let counter = 0;

    collection.AddScoped(token, () => {
      counter += 1;
      return { id: `scoped-${counter}` };
    });

    const provider = collection.buildServiceProvider();
    const scopeOne = provider.createScope();
    const scopeTwo = provider.createScope();

    const rootA = provider.ResolveRequired(token);
    const rootB = provider.ResolveRequired(token);
    const oneA = scopeOne.provider.ResolveRequired(token);
    const oneB = scopeOne.provider.ResolveRequired(token);
    const twoA = scopeTwo.provider.ResolveRequired(token);

    expect(rootA).toBe(rootB);
    expect(oneA).toBe(oneB);
    expect(oneA).not.toBe(twoA);
    expect(rootA).not.toBe(oneA);
  });

  it('resolves transients as new instances each time', () => {
    const collection = new ServiceCollection();
    const token = createInjectionToken<{ id: number }>('transient');
    let counter = 0;

    collection.AddTransient(token, () => ({ id: ++counter }));
    const provider = collection.buildServiceProvider();

    const first = provider.ResolveRequired(token);
    const second = provider.ResolveRequired(token);

    expect(first).not.toBe(second);
    expect(first.id).toBe(1);
    expect(second.id).toBe(2);
  });

  it('supports constructor injection with nested dependencies', () => {
    const collection = new ServiceCollection();
    collection.AddSingleton(CLOCK_TOKEN, ClockService);
    collection.AddTransient(REPOSITORY_TOKEN, RepositoryService);
    collection.AddTransient(SERVICE_TOKEN, AgentService);

    const provider = collection.buildServiceProvider();
    const resolved = provider.ResolveRequired(SERVICE_TOKEN);

    expect(resolved.repository.clock).toBeInstanceOf(ClockService);
  });

  it('supports Resolve, ResolveRequired, tryResolve and ResolveAll', () => {
    const collection = new ServiceCollection();
    collection.AddTransient(STRING_TOKEN, () => 'first');
    collection.AddTransient(STRING_TOKEN, () => 'second');

    const provider = collection.buildServiceProvider({ validateOnBuild: true });
    expect(provider.Resolve(STRING_TOKEN)).toBe('second');
    expect(provider.tryResolve(STRING_TOKEN)).toBe('second');
    expect(provider.ResolveRequired(STRING_TOKEN)).toBe('second');
    expect(provider.ResolveAll(STRING_TOKEN)).toEqual(['first', 'second']);
  });

  it('supports AddInstance, TryAdd, Replace, Remove and Clear registration operations', () => {
    const token = createInjectionToken<{ value: string }>('mutable');
    const collection = new ServiceCollection();

    collection.AddInstance(token, { value: 'instance' });
    const tryAddResult = collection.TryAdd(
      ServiceDescriptor.fromFactory(token, ServiceLifetime.Transient, () => ({ value: 'ignored' })),
    );
    expect(tryAddResult).toBe(false);

    collection.Replace(
      ServiceDescriptor.fromFactory(token, ServiceLifetime.Transient, () => ({
        value: 'replacement',
      })),
    );

    let provider = collection.buildServiceProvider();
    expect(provider.ResolveRequired(token).value).toBe('replacement');

    expect(collection.Remove(token)).toBe(true);
    collection.Clear();

    provider = collection.buildServiceProvider({ validateOnBuild: false });
    expect(provider.tryResolve(token)).toBeUndefined();
  });

  it('detects missing dependencies and constructor parameter metadata mismatches', () => {
    const token = createInjectionToken<MissingInjectParameter>('missing-inject');
    const collection = new ServiceCollection();
    collection.AddTransient(token, MissingInjectParameter);

    const report = collection.validate();
    expect(report.valid).toBe(false);
    expect(report.issues.some((issue) => issue.code === 'di.constructor_injection_missing')).toBe(
      true,
    );
  });

  it('detects circular graphs at validation time and fails build', () => {
    const tokenA = createInjectionToken<CircularA>('circular-a');
    const tokenB = createInjectionToken<CircularB>('circular-b');
    CircularA.inject = [tokenB];
    CircularB.inject = [tokenA];

    const collection = new ServiceCollection();
    collection.AddTransient(tokenA, CircularA);
    collection.AddTransient(tokenB, CircularB);

    const report = collection.validate();
    expect(report.issues.some((issue) => issue.code === 'di.circular_dependency')).toBe(true);
    expect(() => collection.buildServiceProvider()).toThrow(DependencyRegistrationError);
  });

  it('throws meaningful exceptions for required unresolved services', () => {
    const provider = new ServiceCollection().buildServiceProvider({ validateOnBuild: false });
    const token = createInjectionToken<{ value: string }>('missing');

    expect(() => provider.ResolveRequired(token)).toThrow(DependencyResolutionError);
  });

  it('disposes scoped and singleton instances with deterministic reverse-order cleanup', async () => {
    const disposalOrder: string[] = [];
    const scopedTokenA = createInjectionToken<DisposableTracker>('scoped-a');
    const scopedTokenB = createInjectionToken<DisposableTracker>('scoped-b');
    const singletonTokenA = createInjectionToken<DisposableTracker>('singleton-a');
    const singletonTokenB = createInjectionToken<AsyncDisposableTracker>('singleton-b');

    const collection = new ServiceCollection();
    collection.AddScoped(scopedTokenA, () => new DisposableTracker('scoped-a', disposalOrder));
    collection.AddScoped(scopedTokenB, () => new DisposableTracker('scoped-b', disposalOrder));
    collection.AddSingleton(
      singletonTokenA,
      () => new DisposableTracker('singleton-a', disposalOrder),
    );
    collection.AddSingleton(
      singletonTokenB,
      () => new AsyncDisposableTracker('singleton-b', disposalOrder),
    );

    const provider = collection.buildServiceProvider();
    const scope = provider.createScope();

    scope.provider.ResolveRequired(scopedTokenA);
    scope.provider.ResolveRequired(scopedTokenB);
    provider.ResolveRequired(singletonTokenA);
    provider.ResolveRequired(singletonTokenB);

    await scope.dispose();
    await provider.dispose();

    expect(disposalOrder).toEqual(['scoped-b', 'scoped-a', 'singleton-b', 'singleton-a']);
  });

  it('supports concurrent singleton resolution safely', async () => {
    const token = createInjectionToken<{ id: string }>('concurrent-singleton');
    const collection = new ServiceCollection();
    let counter = 0;

    collection.AddSingleton(token, () => {
      counter += 1;
      return { id: `service-${counter}` };
    });

    const provider = collection.buildServiceProvider();
    const results = await Promise.all(
      Array.from({ length: 50 }, async () => provider.ResolveRequired(token)),
    );

    const baseline = results[0];
    expect(results.every((item) => item === baseline)).toBe(true);
    expect(counter).toBe(1);
  });

  it('reports duplicate registrations when requested', () => {
    const token = createInjectionToken<string>('duplicate');
    const collection = new ServiceCollection();
    collection.AddTransient(token, () => 'a');
    collection.AddTransient(token, () => 'b');

    expect(collection.getDuplicateRegistrations()).toEqual([token]);
    const report = collection.validate({ throwOnDuplicateRegistrations: true });
    expect(report.issues.some((issue) => issue.code === 'di.duplicate_registration')).toBe(true);
  });
});
