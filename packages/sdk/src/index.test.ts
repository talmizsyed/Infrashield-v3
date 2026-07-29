import { describe, expect, expectTypeOf, it } from 'vitest';

import type { IConfigurationProvider } from './config.js';
import type { IExecutionContext } from './execution.js';
import type { ILogger, ITracer } from './logging.js';
import { ExecutionStatus, type IAgent, type IAgentManifest, type IPlugin } from './index.js';

const loggerStub: ILogger = {
  loggerId: 'logger-1',
  name: 'test-logger',
  level: 'info',
  child(): ILogger {
    return loggerStub;
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
};

const tracerStub: ITracer = {
  tracerId: 'tracer-1',
  startSpan(): never {
    throw new Error('not implemented');
  },
  currentSpan(): undefined {
    return undefined;
  },
};

const configurationStub: IConfigurationProvider = {
  providerId: 'configuration-1',
  name: 'config',
  version: '1.0.0',
  load(): Promise<string> {
    return Promise.resolve('ok');
  },
  snapshot(): Promise<string> {
    return Promise.resolve('ok');
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
};

const samplePlugin = {
  id: 'plugin-1',
  name: 'Sample Plugin',
  version: '1.0.0',
  capabilities: [],
  dependencies: [],
  permissions: [],
} satisfies IPlugin;

const sampleAgent = {
  id: 'agent-1',
  name: 'Sample Agent',
  version: '1.0.0',
  capabilities: ['coordination'],
  plugins: [samplePlugin],
  tools: [],
  configuration: configurationStub,
} satisfies IAgent;

const sampleManifest = {
  kind: 'agent-manifest',
  apiVersion: 'v1',
  format: 'yaml',
  agent: {
    id: 'agent-1',
    name: 'Sample Agent',
    version: '1.0.0',
    capabilities: ['coordination'],
  },
  runtime: {
    runtimeId: 'runtime-1',
    environment: 'test',
    concurrency: 1,
  },
  providers: {
    ai: [],
    memory: [],
    knowledge: [],
  },
  configuration: {
    featureFlag: true,
  },
} satisfies IAgentManifest;

const sampleContext = {
  executionId: 'execution-1',
  correlationId: 'correlation-1',
  traceId: 'trace-1',
  variables: {
    env: 'test',
  },
  cancellationToken: {
    isCancellationRequested: false,
    throwIfCancellationRequested(): void {
      return;
    },
    onCancellationRequested(): () => void {
      return () => undefined;
    },
  },
  logger: loggerStub,
  runtime: {
    logger: loggerStub,
    tracer: tracerStub,
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
  configuration: configurationStub,
} satisfies IExecutionContext;

describe('SDK contract surface', () => {
  it('exposes a manifest, agent, and execution context contract', () => {
    expectTypeOf(sampleManifest).toMatchTypeOf<IAgentManifest>();
    expectTypeOf(sampleAgent).toMatchTypeOf<IAgent>();
    expectTypeOf(sampleContext).toMatchTypeOf<IExecutionContext>();
  });

  it('re-exports execution status constants for consumers', () => {
    expect(ExecutionStatus.Completed).toBe('completed');
  });
});
