# @infrashield/runtime

Runtime core for Agentic OS.

## Architecture Overview

This package implements the first working runtime pipeline for the platform. It is intentionally contract-driven, provider-agnostic, and limited to runtime concerns:

- execution context creation
- middleware composition
- lifecycle coordination
- cancellation handling
- retry orchestration
- runtime event dispatching
- service aggregation

The runtime consumes the public SDK contracts and does not reference application packages or provider implementations.

## Public API

Primary exports include:

- `RuntimeEngine`
- `ExecutionPipeline`
- `ExecutionContext`
- `LifecycleManager`
- `MiddlewareExecutor`
- `CancellationManager`
- `RetryManager`
- `EventDispatcher`
- `ServiceRegistry`
- `ExecutionResult`

See [src/index.ts](src/index.ts) for the full export surface.

## Usage Example

```ts
import { ExecutionStatus } from '@agentic/sdk';
import {
  ExecutionPipeline,
  MiddlewareExecutor,
  RuntimeEngine,
  ServiceRegistry,
} from '@infrashield/runtime';

const registry = new ServiceRegistry({ runtimeId: 'runtime-1' });
const pipeline = new ExecutionPipeline(
  'pipeline-1',
  new MiddlewareExecutor({ middleware: [], eventDispatcher: registry.eventDispatcher }),
);

const runtime = new RuntimeEngine({
  configuration: {
    runtimeId: 'runtime-1',
    environment: 'test',
  },
  services: registry,
  executor: {
    async execute(_agent, context) {
      return {
        executionId: context.executionId,
        status: ExecutionStatus.Completed,
        succeeded: true,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };
    },
  },
  pipeline,
});
```

## Extension Guide

Extend the runtime by supplying implementations through constructor injection:

- add middleware implementations that satisfy the SDK middleware contract
- provide a custom agent executor
- replace the retry manager strategy input with your policy shape
- subscribe to runtime events through the dispatcher

Keep runtime extensions generic and avoid application-specific behavior inside the platform layer.
