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

## Public API

The package exports the core foundation types and implementations through the package entrypoint, including Runtime, RuntimeHost, RuntimeExecution, RuntimeContext, RuntimePipeline, RuntimeCancellation, RuntimeMetrics, and the lifecycle and exception types.
