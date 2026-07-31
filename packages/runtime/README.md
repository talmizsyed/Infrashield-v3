# @infrashield/runtime

The runtime package provides the foundational execution model for Agentic OS. It is intentionally generic, deterministic, and independent from application logic, AI orchestration, persistence, or workflow concerns.

## Architecture Overview

The package now exposes a compact runtime foundation composed of:

- deterministic execution lifecycles for created, queued, starting, running, completing, completed, cancelled, failed, and timed out states
- immutable execution context and metadata propagation
- ordered middleware pipelines with pre/post hooks and error propagation
- deterministic cancellation using AbortSignal-compatible tokens
- passive metrics for completion, failure, cancellation, and duration summaries
- runtime host and execution abstractions that can be composed by higher layers

## Execution Lifecycle

Executions transition through a validated state machine. Invalid transitions throw strongly typed exceptions such as InvalidRuntimeStateException or RuntimeValidationException.

```ts
import { RuntimeExecution, ExecutionPriority, ExecutionMode } from '@infrashield/runtime';

const execution = new RuntimeExecution({
  id: 'exec-1',
  owner: { id: 'agent-1', type: 'agent' },
  correlationId: 'corr-1',
  priority: ExecutionPriority.High,
  mode: ExecutionMode.Async,
});

await execution.queue();
await execution.start();
await execution.complete({ output: { ok: true } });
```

## Pipeline Model

A runtime pipeline composes middleware in order and propagates the execution context to each step.

```ts
import { PipelineBuilder, RuntimeContext } from '@infrashield/runtime';

const builder = new PipelineBuilder();
builder.use({
  id: 'mw-1',
  async execute(context, next) {
    return next();
  },
});

const pipeline = builder.build();
const result = await pipeline.execute(
  new RuntimeContext({ executionId: 'ctx-1', correlationId: 'corr-1' }),
  async () => ({ status: 'completed', output: { ok: true } }),
);
```

## Cancellation Model

Runtime cancellation is deterministic and uses AbortSignal-based observers. Cancellation can be triggered programmatically or via an upstream signal.

```ts
import { RuntimeCancellation } from '@infrashield/runtime';

const cancellation = new RuntimeCancellation();
cancellation.addObserver((reason) => console.log(reason));
cancellation.cancel('user-abort');
```

## Metadata and Metrics

Execution metadata is frozen after creation, and the runtime metrics API exposes passive counters plus average, minimum, and maximum duration summaries.

```ts
import { RuntimeMetrics } from '@infrashield/runtime';

const metrics = new RuntimeMetrics();
metrics.recordCompleted(25);
metrics.recordFailed(10);
metrics.recordCancelled(2);

console.log(metrics.snapshot());
```

## Runtime Host Architecture

The runtime host is the bootstrapper for the execution engine. It owns the runtime lifecycle, validates immutable configuration, manages a service scope, publishes lifecycle events through the public event bus contract, and notifies observers about state transitions.

### RuntimeHostBuilder

Use the builder for fluent setup:

```ts
import { RuntimeHostBuilder } from '@infrashield/runtime';

const host = new RuntimeHostBuilder()
  .withConfiguration({
    id: 'host-1',
    name: 'demo-host',
    execution: { timeoutMs: 5000, concurrency: 4 },
    pipeline: { middleware: [] },
    requiredServices: ['logger'],
  })
  .withService('logger', { info: () => undefined })
  .build();
```

### Lifecycle

The host supports the lifecycle:

- Created
- Configuring
- Configured
- Starting
- Running
- Stopping
- Stopped
- Failed

Transitions are validated and throw strongly typed exceptions for invalid state changes.

### Configuration

Runtime host configuration is immutable and validated. It covers execution options, timeout defaults, concurrency defaults, observer settings, metrics settings, and required services.

### Dependency Injection Integration

The host creates a root service scope and supports execution scopes for child dependencies. Services are registered by key and resolved through the scoped container.

### Event Integration

Events are published through the public event bus contract only. The host does not depend on event-bus internals.

### Diagnostics

The host tracks startup and shutdown durations, the current state, initialization failures, configuration validation errors, and service resolution issues.

## Public API

The package exports the core foundation types and implementations through the package entrypoint, including Runtime, RuntimeHost, RuntimeHostBuilder, RuntimeHostConfiguration, RuntimeHostContext, RuntimeHostDiagnostics, RuntimeHostServiceScope, RuntimeExecution, RuntimeContext, RuntimePipeline, RuntimeCancellation, RuntimeMetrics, and the lifecycle and exception types.
