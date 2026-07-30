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
- `di`: dependency injection contracts and service collection metadata implementation
- `options`: options pattern contracts and generic options builder

## Architecture Overview

Story 5.2 implements the Dependency Injection Service Collection layer only.

`ServiceCollection` is a strongly typed registration list that stores metadata and performs registration validation.

It intentionally does not:

- resolve services
- instantiate services
- inspect constructor parameters
- build object graphs

Responsibilities implemented in this story:

1. Collect registration metadata by lifetime (`Singleton`, `Scoped`, `Transient`).
2. Support registration mutation operations (`Add*`, `TryAdd`, `Replace`, `Remove`, `Clear`).
3. Track collection metadata (`Count`, `Contains`, `Enumerate`).
4. Validate duplicates and invalid registration inputs.

## Usage Examples

### Basic Registration

```ts
import { createInjectionToken, ServiceCollection } from '@infrashield/core-infrastructure';

const MESSAGE_TOKEN = createInjectionToken<string>('message');

const services = new ServiceCollection();
services.AddSingleton(MESSAGE_TOKEN, () => 'hello');

const descriptors = services.Enumerate();
const count = services.Count;
```

### Typed Registration Metadata

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
  constructor(private readonly logger: ILogger) {}

  handle(): void {
    this.logger.info('handled');
  }
}

const services = new ServiceCollection();
services.AddSingleton(LOGGER_TOKEN, () => ({ info: () => undefined }));
services.AddTransient(HANDLER_TOKEN, RequestHandler);

const report = services.Validate();
if (report.valid) {
  const registrations = services.Enumerate();
  void registrations;
}
```

### TryAdd and Replace

```ts
import {
  createInjectionToken,
  ServiceCollection,
  ServiceDescriptor,
  ServiceLifetime,
} from '@infrashield/core-infrastructure';

const CONTEXT_TOKEN = createInjectionToken<{ id: number }>('context');

const services = new ServiceCollection();
services.TryAdd(ServiceDescriptor.self(CONTEXT_TOKEN, ServiceLifetime.Scoped));
services.Replace(ServiceDescriptor.self(CONTEXT_TOKEN, ServiceLifetime.Singleton));
```

## Best Practices

- Register all services during startup in a single composition root.
- Use explicit lifetimes (`AddSingleton`, `AddScoped`, `AddTransient`) to communicate intent.
- Use `TryAdd` for optional defaults and `Replace` for environment-specific overrides.
- Validate and inspect registrations before handing metadata to provider construction logic.
- Avoid duplicate equivalent registrations.

## Extension Guide

You can extend the DI framework without changing existing interfaces:

- Compose helper registration functions per module boundary.
- Build profile-specific assemblies using `TryAdd`, `Replace`, and `Remove`.
- Add diagnostics by inspecting `Enumerate()` and `Validate()` results.
- Keep this layer metadata-only; provider resolution and instantiation belong to provider implementations.

When extending, preserve provider-agnostic behavior and avoid embedding runtime, AI, memory, or plugin-specific logic in the registration layer.
