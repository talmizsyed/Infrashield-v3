# @infrashield/core-infrastructure

Generic infrastructure building blocks for Agentic OS.

## Purpose

This package provides reusable, provider-agnostic infrastructure contracts and implementations that every future package can consume.

It intentionally does not include:

- runtime orchestration
- AI providers or model adapters
- memory systems or persistence engines
- application-specific business logic

## Modules

- `primitives`: shared ID brands, serializable values, ID factory contracts
- `errors`: normalized error model and helpers
- `result`: result pattern helpers (`ok`, `fail`, mapping utilities)
- `logger`: generic logger contracts and sink-based implementation
- `configuration`: typed configuration provider contracts and implementation
- `clock`: system/fixed/offset clock contracts and implementations
- `serializer`: serializer contracts and JSON implementation with safe wrappers
- `di`: dependency injection contracts and container implementation
- `options`: options pattern contracts and generic options builder

## Architecture Overview

The dependency injection framework in `di.ts` follows a startup/build/resolve lifecycle:

1. `ServiceCollection` records registrations and supports mutation operations (`Add*`, `TryAdd`, `Replace`, `Remove`, `Clear`).
2. `buildServiceProvider()` freezes registration state and optionally validates constructor metadata, missing dependencies, duplicates, and circular graphs.
3. `ServiceProvider` resolves services with singleton/scoped/transient lifetime semantics.
4. `IServiceScopeFactory` creates child scopes for scoped service isolation.
5. Deterministic disposal cleans up scoped and singleton instances in reverse creation order and supports sync/async disposal.

The framework supports constructor injection via static metadata:

- Constructor-injected types declare `static inject = [TOKEN_A, TOKEN_B]`.
- The container resolves those dependencies recursively and detects circular graphs.

## Usage Examples

### Basic Registration and Resolution

```ts
import { createInjectionToken, ServiceCollection } from '@infrashield/core-infrastructure';

const MESSAGE_TOKEN = createInjectionToken<string>('message');

const services = new ServiceCollection();
services.AddSingleton(MESSAGE_TOKEN, () => 'hello');

const provider = services.buildServiceProvider();
const message = provider.ResolveRequired(MESSAGE_TOKEN);
```

### Constructor Injection

```ts
import {
  createInjectionToken,
  type InjectionToken,
  ServiceCollection,
} from '@infrashield/core-infrastructure';

interface ILogger {
  info(message: string): void;
}

const LOGGER_TOKEN = createInjectionToken<ILogger>('logger');
const HANDLER_TOKEN = createInjectionToken<RequestHandler>('handler');

class RequestHandler {
  static inject: readonly InjectionToken<unknown>[] = [LOGGER_TOKEN];

  constructor(private readonly logger: ILogger) {}

  handle(): void {
    this.logger.info('handled');
  }
}

const services = new ServiceCollection();
services.AddSingleton(LOGGER_TOKEN, () => ({ info: () => undefined }));
services.AddTransient(HANDLER_TOKEN, RequestHandler);

const provider = services.buildServiceProvider();
provider.ResolveRequired(HANDLER_TOKEN).handle();
```

### Scopes

```ts
import { createInjectionToken, ServiceCollection } from '@infrashield/core-infrastructure';

const CONTEXT_TOKEN = createInjectionToken<{ id: number }>('context');

const services = new ServiceCollection();
let seed = 0;
services.AddScoped(CONTEXT_TOKEN, () => ({ id: ++seed }));

const provider = services.buildServiceProvider();
const scopeA = provider.createScope();
const scopeB = provider.createScope();

const a1 = scopeA.provider.ResolveRequired(CONTEXT_TOKEN);
const a2 = scopeA.provider.ResolveRequired(CONTEXT_TOKEN);
const b1 = scopeB.provider.ResolveRequired(CONTEXT_TOKEN);

// a1 === a2, a1 !== b1
```

## Best Practices

- Register all services during startup, then build exactly one root provider.
- Use `AddScoped` for unit-of-work or request-local dependencies.
- Use `AddSingleton` only for stateless or thread-safe shared services.
- Use `AddTransient` for lightweight short-lived objects.
- Prefer constructor injection over service locator calls in domain code.
- Always call `dispose()` on scopes and the root provider.
- Keep `validateOnBuild` enabled in production startup.

## Extension Guide

You can extend the DI framework without changing existing interfaces:

- Compose helper registration functions per module boundary.
- Build profile-specific startup assemblies using `TryAdd` and `Replace`.
- Add diagnostics by wrapping service factories with timing/logging decorators.
- Add stricter startup policies by running `validate({ throwOnDuplicateRegistrations: true })` before build.

When extending, preserve provider-agnostic behavior and avoid embedding runtime, AI, memory, or plugin-specific logic into the container layer.
