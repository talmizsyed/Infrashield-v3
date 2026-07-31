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
- `event-bus`: in-process event domain model, metadata, envelopes, and contracts
- `options`: options pattern contracts and generic options builder

## Architecture Overview

The dependency injection package provides a metadata-driven composition layer for Agentic OS.

`ServiceCollection` stores registrations and validates their shape, while `ServiceProvider` and `ServiceScope` resolve services, honor lifetimes, support constructor injection, and manage disposal ownership.

The package is intentionally focused on the core contracts:

- registration metadata and mutation (`AddSingleton`, `AddScoped`, `AddTransient`, `TryAdd`, `Replace`, `Remove`, `Clear`)
- lifetime-aware resolution (`Singleton`, `Scoped`, `Transient`)
- constructor-based dependency resolution for type registrations
- disposal lifecycle ownership for `IDisposable` and `IAsyncDisposable`
- validation for duplicate, invalid, and missing dependency registrations

## Public API

The package root exports the consumer-facing DI contracts and implementations only:

- `IServiceCollection`
- `IServiceProvider`
- `IServiceScope`
- `IServiceScopeFactory`
- `ServiceCollection`
- `ServiceProvider`
- `ServiceScope`
- `ServiceLifetime`
- `ServiceDescriptor`
- dependency injection exceptions

Internal helper types such as validation and scope internals remain implementation details and are not surfaced through the package root.

## Resolution Lifecycle

The provider resolves services from the registration collection while preserving lifetime semantics and constructor dependencies.

Resolution flow:

1. The provider checks the service collection for matching descriptors for a token.
2. For single-registration tokens, it resolves the descriptor directly.
3. For multi-registration tokens, `ResolveAll` returns each matching instance in registration order.
4. Singleton registrations are cached per provider instance.
5. Scoped registrations are cached per scope instance and are isolated from sibling scopes.
6. Transient registrations always create a new instance.
7. Factory registrations receive the provider instance and may throw to signal resolution failure.
8. Type registrations resolve constructor dependencies recursively using the same lifetime-aware rules.

The provider emits `ResolutionException` for missing registrations, factory failures, invalid lifetime metadata, duplicate registration conflicts, and post-disposal usage during resolution. Validation failures for malformed constructor metadata or dependency graph problems are surfaced as `ValidationException`.

## Disposal Lifecycle

Story 5.6 adds deterministic lifecycle ownership and disposal management to the provider and scope model.

### Ownership Rules

- Singleton services are owned by the root provider and are disposed once when the provider is disposed.
- Scoped services are owned by their creating scope and are disposed when that scope is disposed.
- Transient services are tracked by the owning container when they implement a disposable interface and are released during teardown.
- Disposable services are disposed in reverse creation order for deterministic teardown.
- Disposal is idempotent; repeated disposal calls are safe and do not corrupt lifecycle state.

### Supported Disposal Contracts

The container recognizes both synchronous and asynchronous contracts:

- `IDisposable.dispose()`
- `IAsyncDisposable.disposeAsync()`

### Disposal Flow

1. The provider or scope creates a `LifecycleManager` to track disposable instances.
2. Each resolved service that implements a disposal contract is registered with the owning manager.
3. Disposing the provider tears down singleton services and all child scopes.
4. Disposing a scope tears down its scoped services and releases them in reverse order.
5. Disposal failures are surfaced as `DependencyInjectionError` through the lifecycle pipeline.

### Usage Example

```ts
import {
  createInjectionToken,
  ServiceCollection,
  ServiceProvider,
  type IDisposable,
} from '@infrashield/core-infrastructure';

class Resource implements IDisposable {
  public dispose(): void {
    // release native resources
  }
}

const RESOURCE_TOKEN = createInjectionToken<Resource>('resource');
const services = new ServiceCollection();
services.AddSingleton(RESOURCE_TOKEN, () => new Resource());

const provider = new ServiceProvider(services);
const resource = provider.Resolve(RESOURCE_TOKEN);

await provider.dispose();
```

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

### Resolve Services with the Provider

```ts
import {
  createInjectionToken,
  ServiceCollection,
  ServiceProvider,
} from '@infrashield/core-infrastructure';

interface ILogger {
  log(message: string): void;
}

const LOGGER_TOKEN = createInjectionToken<ILogger>('logger');

const services = new ServiceCollection();
services.AddSingleton(LOGGER_TOKEN, () => ({ log: () => undefined }));

const provider = new ServiceProvider(services);
const logger = provider.Resolve(LOGGER_TOKEN);
const maybeLogger = provider.TryResolve(createInjectionToken<ILogger>('missing'));
const allLoggers = provider.ResolveAll(LOGGER_TOKEN);
```

## Event Bus Foundation

Story 6.1 introduces the in-process event bus domain model and public contracts without implementing publishing, subscriptions, or dispatching.

### Core Concepts

- `IEvent` defines the immutable event contract shared by all domain events.
- `EventBase` provides a reusable base class for strongly typed event payloads.
- `EventMetadata` carries identity, correlation, timestamp, source, category, priority, version, and tags.
- `EventEnvelope` wraps an event with metadata for transport-safe handling.
- `EventContext` carries contextual metadata for future middleware and dispatch flows.

### Usage Example

```ts
import {
  EventBase,
  type EventCategory,
  type EventPriority,
} from '@infrashield/core-infrastructure';

class UserCreatedEvent extends EventBase<{ userId: string }> {
  public constructor(userId: string) {
    super(
      { userId },
      {
        source: 'users',
        category: 'domain' as EventCategory,
        priority: 'normal' as EventPriority,
        version: 1,
      },
    );
  }
}

const event = new UserCreatedEvent('42');
const envelope = event.toEnvelope();
```

## Event Bus Observability and Diagnostics

Story 6 introduces a passive observability layer for the in-process event bus. The design keeps execution semantics untouched while exposing immutable snapshots for metrics, tracing, health evaluation, and observer notifications.

### Metrics model

- `EventMetrics` records published events, successful and failed dispatches, retry attempts, dead-lettered events, observer failures, middleware and handler execution counts, and latency samples.
- `EventCounters` captures the current counts, while `EventStatistics` exposes aggregate latency and throughput values.
- `EventPerformanceSnapshot` packages the counters and statistics into an immutable snapshot for downstream consumers.

### Tracing and health

- `EventTracer` records correlation-aware activity phases for each event and preserves them in an immutable trace snapshot.
- `EventHealthCheck` evaluates a snapshot and returns a health classification such as healthy, degraded, or unhealthy.
- `EventDiagnostics` composes metrics, tracing, health checks, and observers into a single extension-friendly entry point without imposing a logging implementation.

### Observer model

- `IEventObserver` defines the passive contract for receiving execution snapshots.
- `EventObserver` adapts an observer implementation into the dispatcher pipeline.
- Observer failures are isolated and counted so execution continues without interruption.

### Usage example

```ts
import {
  EventDiagnostics,
  EventHealth,
  EventHealthCheck,
  EventMetrics,
  EventTracer,
  EventObserver,
  type IEventObserver,
  EventPerformanceSnapshot,
} from '@infrashield/core-infrastructure';

class RecordingObserver implements IEventObserver {
  public async onEventObserved(snapshot: EventPerformanceSnapshot): Promise<void> {
    void snapshot;
  }
}

const diagnostics = new EventDiagnostics(
  new EventMetrics(),
  new EventTracer(),
  new EventHealthCheck(() => new EventHealth('healthy', 'ok')),
  [new EventObserver(new RecordingObserver())],
);

diagnostics.recordPublishedEvent();
diagnostics.recordDispatchResult(true);
diagnostics.recordLatency(12);
```

### Extension points

The observability model is intentionally extension-ready for future integrations such as OpenTelemetry, Prometheus, Grafana, or Application Insights without introducing any runtime or exporter dependency in the core package.

## Event Dispatcher

Story 6.3 adds an in-process event dispatcher that resolves handlers through the DI container and executes strongly typed events without introducing runtime, AI, plugin, or distributed transport integration.

### Dispatch Lifecycle

1. The dispatcher validates the incoming event and creates an isolated dispatch context.
2. The handler resolver asks the DI provider for all registered handlers for the event token.
3. Each resolved handler is executed sequentially in registration order.
4. Handler failures are captured as execution errors without corrupting the dispatcher state.
5. The dispatcher returns a `DispatchResult` containing statistics, execution contexts, and any accumulated errors.

### Handler Resolution

Handlers are resolved from the container through `HandlerResolver`, which uses an event-to-token mapping strategy and never instantiates handlers directly. This keeps handler construction aligned with the provider’s lifetime and dependency resolution rules.

### Execution Flow

```ts
import {
  EventBase,
  EventDispatcher,
  HandlerResolver,
  type EventCategory,
  type EventPriority,
} from '@infrashield/core-infrastructure';

class UserCreatedEvent extends EventBase<{ userId: string }> {
  public constructor(userId: string) {
    super(
      { userId },
      {
        source: 'users',
        category: 'domain' as EventCategory,
        priority: 'normal' as EventPriority,
        version: 1,
      },
    );
  }
}

const provider = new ServiceProvider(services);
const resolver = new HandlerResolver(provider, () => handlerToken);
const dispatcher = new EventDispatcher(provider, resolver);

await dispatcher.dispatch(new UserCreatedEvent('42'));
```

### Best Practices

- Register all services during startup in a single composition root.
- Use explicit lifetimes (`AddSingleton`, `AddScoped`, `AddTransient`) to communicate intent.
- Use `TryAdd` for optional defaults and `Replace` for environment-specific overrides.
- Validate and inspect registrations before handing metadata to provider construction logic.
- Avoid duplicate equivalent registrations.
- Prefer `ResolveRequired` for mandatory services and `TryResolve` for optional ones.
- Keep the provider focused on deterministic object resolution and lifecycle ownership.
- Implement disposal-aware services when the container should release external resources or subscriptions.
- Favor constructor injection for type-based services so dependency graphs remain explicit and inspectable.
- Keep dispatch handlers focused and side-effect-free where possible; failures should be handled by the dispatcher result contract rather than by mutating shared state.

## Event Bus Resilience

Story 6.5 adds in-process retry, failure classification, and dead-letter handling for resilient event execution. The implementation stays entirely in-memory and does not introduce runtime, persistence, or distributed transport behavior.

### Retry Lifecycle

1. The dispatcher delegates handler execution to a `RetryExecutor` when a retry policy is supplied.
2. The executor evaluates each failure through a `FailureClassifier` and decides whether to retry the handler.
3. Retry delays are derived from a `RetryPolicy` using either a fixed delay or exponential backoff.
4. Repeated failures eventually exhaust the configured attempts and become dead-letter candidates.

### Failure Handling

Retries are isolated per handler invocation and preserve the event metadata, correlation ID, and retry history. Permanent failures are not retried, transient failures are retried according to the configured policy, and unexpected failures are surfaced as execution errors.

### Dead-Letter Processing

When a handler exhausts retries or hits a permanent failure, the dispatcher records a `DeadLetterEntry` in an in-memory `DeadLetterQueue`. The queue remains thread-safe for concurrent publishing and exposes simple inspection helpers such as `size()`, `peek()`, and `drain()`.

### Configuration Example

```ts
import {
  DeadLetterQueue,
  RetryExecutor,
  RetryPolicy,
  RetryStrategy,
} from '@infrashield/core-infrastructure';

const policy = new RetryPolicy({
  maxAttempts: 3,
  strategy: new RetryStrategy('exponential', 25, 200, 2),
});

const queue = new DeadLetterQueue();
const retryExecutor = new RetryExecutor();
```

### Best Practices

- Use retries only for transient failures such as timeouts or temporary resource contention.
- Keep retry counts modest and prefer bounded backoff to avoid overwhelming downstream systems.
- Preserve correlation IDs so retry and dead-letter analysis remains traceable.
- Treat dead-letter entries as operational evidence and inspect them before reprocessing.

## Extension Guide

You can extend the DI framework without changing existing interfaces:

- Compose helper registration functions per module boundary.
- Build profile-specific assemblies using `TryAdd`, `Replace`, and `Remove`.
- Add diagnostics by inspecting `Enumerate()` and `Validate()` results.
- Keep this layer metadata-only; provider resolution and instantiation belong to provider implementations.

When extending, preserve provider-agnostic behavior and avoid embedding runtime, AI, memory, or plugin-specific logic in the registration layer.
