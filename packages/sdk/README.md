# @agentic/sdk

Public SDK entry point for Agentic OS consumers.

## Architecture Overview

`@agentic/sdk` is the only developer-facing package intended for application code. It exposes contracts, interfaces, and manifest specifications without implementing runtime behavior, business logic, or provider-specific adapters.

The package is designed to sit above the kernel contract layer and below application code. Applications import the SDK facade rather than referencing runtime internals directly.

## Public API

The SDK re-exports the core contract types needed by consumers and exposes the following public modules:

- `IAgent`, `IAgentRuntime`, `IAgentExecutor`, `IAgentBuilder`
- `IExecutionContext`, `IExecutionResult`, `IExecutionError`, `IRuntimeServices`
- `IMiddleware`, `IPlugin`, `ITool`
- `IMemoryProvider`, `IKnowledgeProvider`, `IAIProvider`, `IWorkflow`
- `ILogger`, `ITracer`, `IEventBus`, `ICheckpointer`, `IConfigurationProvider`
- `IRetryPolicy` and concrete retry policy contracts
- `IAgentManifest` and its manifest sections
- architecture validation rules and reports
- platform event contracts

The primary entry point is [src/index.ts](src/index.ts).

## Usage Example

```ts
import type { IAgentManifest, IExecutionContext } from '@agentic/sdk';
import { ExecutionStatus } from '@agentic/sdk';

const manifest: IAgentManifest = {
  kind: 'agent-manifest',
  apiVersion: 'v1',
  format: 'yaml',
  agent: {
    id: 'agent-1',
    name: 'Example Agent',
    version: '1.0.0',
  },
  runtime: {
    environment: 'production',
  },
  providers: {},
};

const context: IExecutionContext = {
  executionId: 'execution-1',
  correlationId: 'correlation-1',
  traceId: 'trace-1',
  variables: {},
  cancellationToken: {
    isCancellationRequested: false,
    throwIfCancellationRequested(): void {
      return;
    },
    onCancellationRequested(): () => void {
      return () => undefined;
    },
  },
  logger: {
    loggerId: 'logger-1',
    name: 'example',
    level: 'info',
    child(): never {
      throw new Error('not implemented');
    },
    isEnabled(): boolean {
      return true;
    },
    log(): void {
      return;
    },
    trace(): void {
      return;
    },
    debug(): void {
      return;
    },
    info(): void {
      return;
    },
    warn(): void {
      return;
    },
    error(): void {
      return;
    },
    fatal(): void {
      return;
    },
  },
  runtime: {
    logger: {
      loggerId: 'logger-1',
      name: 'example',
      level: 'info',
      child(): never {
        throw new Error('not implemented');
      },
      isEnabled(): boolean {
        return true;
      },
      log(): void {
        return;
      },
      trace(): void {
        return;
      },
      debug(): void {
        return;
      },
      info(): void {
        return;
      },
      warn(): void {
        return;
      },
      error(): void {
        return;
      },
      fatal(): void {
        return;
      },
    },
    tracer: {
      tracerId: 'tracer-1',
      startSpan(): never {
        throw new Error('not implemented');
      },
      currentSpan(): undefined {
        return undefined;
      },
    },
    eventBus: {
      publish(): Promise<void> {
        return Promise.resolve();
      },
      subscribe(): Promise<{
        subscriptionId: string;
        eventType: string;
        active: boolean;
        dispose(): void;
      }> {
        return Promise.resolve({
          subscriptionId: 'subscription-1',
          eventType: 'execution.started',
          active: true,
          dispose(): void {
            return;
          },
        });
      },
      unsubscribe(): Promise<void> {
        return Promise.resolve();
      },
    },
  },
  configuration: {
    providerId: 'configuration-1',
    name: 'configuration',
    version: '1.0.0',
    load(): Promise<string> {
      return Promise.resolve('{}');
    },
    snapshot(): Promise<string> {
      return Promise.resolve('{}');
    },
    get(): Promise<string | undefined> {
      return Promise.resolve(undefined);
    },
    set(): Promise<void> {
      return Promise.resolve();
    },
    delete(): Promise<void> {
      return Promise.resolve();
    },
  },
};

const status = ExecutionStatus.Completed;
```

## Extension Guide

The SDK is intended to be extended through implementations that satisfy its contracts, not by modifying the public API shape for application-specific needs.

Recommended extension points:

- implement `IAgentRuntime` in a runtime package
- implement `IAgentExecutor` for execution orchestration
- implement `ILogger`, `ITracer`, and `IEventBus` in infrastructure adapters
- implement `IMemoryProvider`, `IKnowledgeProvider`, `IAIProvider`, and `ITool` in dedicated provider or adapter packages
- implement `ICheckpointer` for durable execution state
- implement `IPlugin` and `IAgentBuilder` for plugin and agent composition

## Development Notes

- The package is contract-only.
- No runtime behavior should be introduced here.
- Keep the public entry point stable and documented.
