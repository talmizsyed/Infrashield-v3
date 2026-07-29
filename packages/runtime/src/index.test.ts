import { describe, expect, it, vi } from 'vitest';
import type {
  IAgent,
  IAgentExecutor,
  IExecutionResult,
  IMiddleware,
  IRetryPolicy,
} from '@agentic/sdk';
import { ExecutionStatus } from '@agentic/sdk';

import { CancellationError } from './cancellation.js';
import { ExecutionResult, RuntimeEventType, RuntimeStatus } from './common.js';
import { ExecutionContext } from './execution-context.js';
import { LifecycleManager } from './lifecycle.js';
import { MiddlewareExecutor } from './middleware.js';
import { ExecutionPipeline } from './pipeline.js';
import { RetryManager } from './retry.js';
import { RuntimeEngine } from './runtime-engine.js';
import { ServiceRegistry } from './registry.js';

const runtimeConfiguration = {
  runtimeId: 'runtime-1',
  environment: 'test',
  maxConcurrency: 1,
};

const agent: IAgent = {
  id: 'agent-1',
  name: 'Mock Agent',
  version: '1.0.0',
  capabilities: [],
  plugins: [],
  tools: [],
};

function createExecutionContext(
  registry: ServiceRegistry,
  cancellationMs?: number,
): ExecutionContext {
  const cancellation = registry.cancellationManager.create({ timeoutMs: cancellationMs });

  return new ExecutionContext({
    executionId: 'execution-1',
    correlationId: 'correlation-1',
    traceId: 'trace-1',
    variables: { value: 'ok' },
    cancellationToken: cancellation.token,
    logger: registry.logger,
    configuration: {
      providerId: 'configuration-1',
      name: 'configuration',
      version: '1.0.0',
      load: async () => runtimeConfiguration as never,
      snapshot: async () => runtimeConfiguration as never,
      get: async () => undefined,
      set: async () => undefined,
      delete: async () => undefined,
    },
    runtime: {
      logger: registry.logger,
      tracer: registry.tracer,
      eventBus: registry.eventDispatcher as never,
    },
  });
}

function createRuntime(
  middleware: readonly IMiddleware[] = [],
  executor?: IAgentExecutor,
  retryPolicy?: IRetryPolicy,
): {
  registry: ServiceRegistry;
  runtime: RuntimeEngine;
} {
  const registry = new ServiceRegistry({ runtimeId: runtimeConfiguration.runtimeId, middleware });
  const middlewareExecutor = new MiddlewareExecutor({
    middleware,
    eventDispatcher: registry.eventDispatcher,
  });
  const pipeline = new ExecutionPipeline('pipeline-1', middlewareExecutor);
  const lifecycleManager = new LifecycleManager();
  const terminalExecutor: IAgentExecutor = executor ?? {
    async execute(currentAgent, context): Promise<IExecutionResult> {
      return new ExecutionResult({
        executionId: context.executionId,
        status: ExecutionStatus.Completed,
        succeeded: true,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        output: { agentId: currentAgent.id, agentName: currentAgent.name },
      });
    },
  };

  return {
    registry,
    runtime: new RuntimeEngine({
      configuration: runtimeConfiguration,
      services: registry,
      executor: terminalExecutor,
      pipeline,
      lifecycleManager,
      cancellationManager: registry.cancellationManager,
      retryManager: new RetryManager(),
      retryPolicy,
    }),
  };
}

describe('runtime core', () => {
  it('runs middleware in order before the terminal executor', async () => {
    const order: string[] = [];
    const middleware: readonly IMiddleware[] = [
      {
        middlewareId: 'mw-1',
        name: 'authentication',
        async execute(context, next) {
          order.push(`before:${context.executionId}:authentication`);
          const result = await next();
          order.push(`after:${context.executionId}:authentication`);
          return result;
        },
      },
      {
        middlewareId: 'mw-2',
        name: 'logging',
        async execute(context, next) {
          order.push(`before:${context.executionId}:logging`);
          const result = await next();
          order.push(`after:${context.executionId}:logging`);
          return result;
        },
      },
    ];

    const { registry, runtime } = createRuntime(middleware);
    const context = createExecutionContext(registry);

    const result = await runtime.execute(agent, context);

    expect(order).toEqual([
      'before:execution-1:authentication',
      'before:execution-1:logging',
      'after:execution-1:logging',
      'after:execution-1:authentication',
    ]);
    expect(result.status).toBe(ExecutionStatus.Completed);
  });

  it('retries a failing executor according to the policy', async () => {
    const calls: number[] = [];
    const executor: IAgentExecutor = {
      async execute(currentAgent, context): Promise<IExecutionResult> {
        calls.push(calls.length + 1);
        if (calls.length < 3) {
          throw new Error('transient failure');
        }

        return {
          executionId: context.executionId,
          status: ExecutionStatus.Completed,
          succeeded: true,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          output: { agentId: currentAgent.id },
        };
      },
    };

    const policy: IRetryPolicy = {
      policyId: 'retry-1',
      name: 'fixed',
      kind: 'fixed',
      maxAttempts: 3,
      delayMs: 0,
      evaluate: async () => true,
    };

    const { registry, runtime } = createRuntime([], executor, policy);
    const context = createExecutionContext(registry);

    const result = await runtime.execute(agent, context, { retryPolicy: policy });

    expect(calls).toHaveLength(3);
    expect(result.status).toBe(ExecutionStatus.Completed);
  });

  it('cancels execution when the cancellation token is aborted before run', async () => {
    const { registry, runtime } = createRuntime();
    const context = createExecutionContext(registry);
    vi.spyOn(context.cancellationToken, 'throwIfCancellationRequested').mockImplementation(() => {
      throw new CancellationError('Operation cancelled');
    });

    const result = await runtime.execute(agent, context);

    expect(result.status).toBe(ExecutionStatus.Cancelled);
    expect(runtime.health.status).not.toBe(RuntimeStatus.Created);
  });

  it('emits execution and middleware events', async () => {
    const middleware: readonly IMiddleware[] = [
      {
        middlewareId: 'mw-1',
        name: 'tracing',
        async execute(_context, next) {
          return next();
        },
      },
    ];
    const { registry, runtime } = createRuntime(middleware);
    const events: RuntimeEventType[] = [];
    registry.eventDispatcher.subscribe(RuntimeEventType.ExecutionStarted, (event) => {
      events.push(event.eventType);
    });
    registry.eventDispatcher.subscribe(RuntimeEventType.ExecutionCompleted, (event) => {
      events.push(event.eventType);
    });
    registry.eventDispatcher.subscribe(RuntimeEventType.MiddlewareStarted, (event) => {
      events.push(event.eventType);
    });
    registry.eventDispatcher.subscribe(RuntimeEventType.MiddlewareCompleted, (event) => {
      events.push(event.eventType);
    });

    await runtime.execute(agent, createExecutionContext(registry));

    expect(events).toEqual([
      RuntimeEventType.ExecutionStarted,
      RuntimeEventType.MiddlewareStarted,
      RuntimeEventType.MiddlewareCompleted,
      RuntimeEventType.ExecutionCompleted,
    ]);
  });

  it('times out execution via the cancellation manager', async () => {
    const executor: IAgentExecutor = {
      async execute(): Promise<IExecutionResult> {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          executionId: 'execution-1',
          status: ExecutionStatus.Completed,
          succeeded: true,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        };
      },
    };

    const { registry, runtime } = createRuntime([], executor);
    const context = createExecutionContext(registry, 5);

    const result = await runtime.execute(agent, context, { timeoutMs: 5 });

    expect(result.status).toBe(ExecutionStatus.Cancelled);
  });
});
