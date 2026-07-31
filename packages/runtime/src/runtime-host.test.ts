import { describe, expect, it } from 'vitest';

import {
  RuntimeHostAlreadyStartedException,
  RuntimeHostBuilder,
  RuntimeHostConfigurationException,
  RuntimeHostInitializationException,
  RuntimeHostState,
  type RuntimeHostObserver,
  type RuntimeHostEventBus,
} from './index.js';

describe('runtime host', () => {
  it('creates a configured host and runs through the expected lifecycle', async () => {
    const events: RuntimeHostState[] = [];
    const observer: RuntimeHostObserver = {
      id: 'observer-1',
      onStateChange: (snapshot) => {
        events.push(snapshot.state);
      },
    };

    const host = new RuntimeHostBuilder()
      .withConfiguration({
        id: 'host-1',
        name: 'demo-host',
        execution: {
          timeoutMs: 1000,
          concurrency: 2,
        },
        pipeline: {
          middleware: [],
        },
      })
      .withService('logger', { info: () => undefined })
      .withObserver(observer)
      .build();

    expect(host.state).toBe(RuntimeHostState.Configured);
    expect(Object.isFrozen(host.context.configuration)).toBe(true);

    await host.start();
    expect(host.state).toBe(RuntimeHostState.Running);

    await host.stop();
    expect(host.state).toBe(RuntimeHostState.Stopped);
    expect(events).toContain(RuntimeHostState.Running);
  });

  it('rejects invalid configuration values', () => {
    expect(() =>
      new RuntimeHostBuilder()
        .withConfiguration({
          id: 'host-2',
          name: 'invalid-host',
          execution: {
            timeoutMs: 0,
            concurrency: 0,
          },
          pipeline: {
            middleware: [],
          },
        })
        .build(),
    ).toThrow(RuntimeHostConfigurationException);
  });

  it('prevents duplicate start requests and reports observer failures without stopping the host', async () => {
    const observer: RuntimeHostObserver = {
      id: 'observer-2',
      onStateChange: () => {
        throw new Error('observer failed');
      },
    };

    const host = new RuntimeHostBuilder()
      .withConfiguration({
        id: 'host-3',
        name: 'observer-host',
        execution: {
          timeoutMs: 500,
          concurrency: 1,
        },
        pipeline: {
          middleware: [],
        },
      })
      .withObserver(observer)
      .build();

    await expect(Promise.all([host.start(), host.start()])).resolves.toEqual([
      undefined,
      undefined,
    ]);
    expect(host.state).toBe(RuntimeHostState.Running);
    expect(host.diagnostics.initializationFailures).toHaveLength(1);

    await host.stop();
  });

  it('publishes lifecycle events through the public event bus contract', async () => {
    const published: string[] = [];
    const eventBus: RuntimeHostEventBus = {
      async publish(event) {
        published.push(event.type);
      },
    };

    const host = new RuntimeHostBuilder()
      .withConfiguration({
        id: 'host-4',
        name: 'event-host',
        execution: {
          timeoutMs: 500,
          concurrency: 1,
        },
        pipeline: {
          middleware: [],
        },
      })
      .withService('eventBus', eventBus)
      .build();

    await host.start();
    await host.stop();

    expect(published).toEqual([
      'RuntimeStarting',
      'RuntimeStarted',
      'RuntimeStopping',
      'RuntimeStopped',
    ]);
  });

  it('creates scoped services and rejects duplicate registrations', () => {
    const host = new RuntimeHostBuilder()
      .withConfiguration({
        id: 'host-5',
        name: 'scope-host',
        execution: {
          timeoutMs: 500,
          concurrency: 1,
        },
        pipeline: {
          middleware: [],
        },
      })
      .withService('logger', { info: () => undefined })
      .build();

    const scope = host.createExecutionScope('scope-a');
    expect(scope.resolve<{ info: () => void }>('logger').info).toBeTypeOf('function');

    expect(() => scope.register('logger', { info: () => undefined })).toThrow();
  });

  it('throws a typed exception when startup dependencies are missing', async () => {
    const host = new RuntimeHostBuilder()
      .withConfiguration({
        id: 'host-6',
        name: 'missing-host',
        execution: {
          timeoutMs: 500,
          concurrency: 1,
        },
        pipeline: {
          middleware: [],
        },
        requiredServices: ['logger'],
      })
      .build();

    await expect(host.start()).rejects.toBeInstanceOf(RuntimeHostInitializationException);
  });

  it('prevents duplicate stop requests and allows a later restart after stop', async () => {
    const host = new RuntimeHostBuilder()
      .withConfiguration({
        id: 'host-7',
        name: 'stop-host',
        execution: {
          timeoutMs: 500,
          concurrency: 1,
        },
        pipeline: {
          middleware: [],
        },
      })
      .build();

    await host.start();
    await expect(Promise.all([host.stop(), host.stop()])).resolves.toEqual([undefined, undefined]);
    expect(host.state).toBe(RuntimeHostState.Stopped);

    await expect(host.start()).rejects.toBeInstanceOf(RuntimeHostAlreadyStartedException);
  });
});
