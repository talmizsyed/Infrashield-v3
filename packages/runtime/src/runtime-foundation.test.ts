import { describe, expect, it } from 'vitest';

import {
  ExecutionMode,
  ExecutionPriority,
  ExecutionStatus,
  InvalidRuntimeStateException,
  PipelineBuilder,
  Runtime,
  RuntimeCancellation,
  RuntimeContext,
  RuntimeExecution,
  RuntimeMetrics,
  RuntimeValidationException,
  type IRuntimeMiddleware,
} from './index.js';

describe('runtime foundation', () => {
  it('creates executions with a deterministic lifecycle and immutable snapshot', async () => {
    const execution = new RuntimeExecution({
      id: 'exec-1',
      owner: { id: 'owner-1', type: 'agent' },
      correlationId: 'corr-1',
      priority: ExecutionPriority.High,
      mode: ExecutionMode.Async,
      metadata: { source: 'test' },
    });

    expect(execution.status).toBe(ExecutionStatus.Created);
    expect(execution.snapshot().status).toBe(ExecutionStatus.Created);

    await execution.queue();
    await execution.start();
    await execution.complete({ output: { ok: true } });

    const snapshot = execution.snapshot();
    expect(snapshot.status).toBe(ExecutionStatus.Completed);
    expect(snapshot.metadata).toEqual({ source: 'test' });
    expect(Object.isFrozen(snapshot.metadata)).toBe(true);
  });

  it('rejects invalid lifecycle transitions with strongly typed exceptions', async () => {
    const execution = new RuntimeExecution({
      id: 'exec-2',
      owner: { id: 'owner-2', type: 'agent' },
      correlationId: 'corr-2',
      priority: ExecutionPriority.Normal,
      mode: ExecutionMode.Sync,
    });

    await expect(execution.complete({ output: { ok: true } })).rejects.toBeInstanceOf(
      InvalidRuntimeStateException,
    );

    await execution.queue();
    await expect(execution.queue()).rejects.toBeInstanceOf(InvalidRuntimeStateException);
  });

  it('propagates context through middleware and preserves metadata immutability', async () => {
    const context = new RuntimeContext({
      executionId: 'ctx-1',
      correlationId: 'corr-ctx',
      metadata: { trace: 'demo' },
    });

    const events: string[] = [];
    const middleware: IRuntimeMiddleware[] = [
      {
        id: 'mw-1',
        async execute(current, next) {
          events.push(`before:${current.executionId}`);
          const result = await next();
          events.push(`after:${current.executionId}`);
          return result;
        },
      },
      {
        id: 'mw-2',
        async execute(current, next) {
          events.push(`before2:${current.executionId}`);
          return next();
        },
      },
    ];

    const pipeline = new PipelineBuilder().use(middleware[0]).use(middleware[1]).build();
    const result = await pipeline.execute(context, async () => {
      return { status: ExecutionStatus.Completed, output: { ok: true } };
    });

    expect(events).toEqual(['before:ctx-1', 'before2:ctx-1', 'after:ctx-1']);
    expect(result.status).toBe(ExecutionStatus.Completed);
    expect(Object.isFrozen(context.metadata)).toBe(true);
  });

  it('cancels execution deterministically through abort propagation', async () => {
    const controller = new AbortController();
    const cancellation = new RuntimeCancellation(controller.signal);
    const execution = new RuntimeExecution({
      id: 'exec-3',
      owner: { id: 'owner-3', type: 'agent' },
      correlationId: 'corr-3',
      priority: ExecutionPriority.Critical,
      mode: ExecutionMode.Async,
      cancellation,
    });

    const observed: string[] = [];
    cancellation.addObserver((reason) => observed.push(reason));

    cancellation.cancel('user-abort');

    await expect(execution.start()).rejects.toBeInstanceOf(RuntimeValidationException);
    expect(observed).toContain('user-abort');
  });

  it('captures metrics for completed, failed, and cancelled executions', async () => {
    const metrics = new RuntimeMetrics();
    metrics.recordCompleted(25);
    metrics.recordFailed(10);
    metrics.recordCancelled(2);
    metrics.recordCompleted(40);

    const snapshot = metrics.snapshot();
    expect(snapshot.executionCount).toBe(4);
    expect(snapshot.completed).toBe(2);
    expect(snapshot.failed).toBe(1);
    expect(snapshot.cancelled).toBe(1);
    expect(snapshot.averageDurationMs).toBe(19.25);
    expect(snapshot.maximumDurationMs).toBe(40);
    expect(snapshot.minimumDurationMs).toBe(2);
  });

  it('runs concurrent executions with isolated state and shared host metrics', async () => {
    const runtime = new Runtime({
      id: 'runtime-1',
      name: 'foundation-runtime',
      metrics: new RuntimeMetrics(),
    });

    const first = runtime.createExecution({
      id: 'exec-4',
      owner: { id: 'owner-4', type: 'agent' },
      correlationId: 'corr-4',
      priority: ExecutionPriority.High,
      mode: ExecutionMode.Async,
    });
    const second = runtime.createExecution({
      id: 'exec-5',
      owner: { id: 'owner-5', type: 'agent' },
      correlationId: 'corr-5',
      priority: ExecutionPriority.Low,
      mode: ExecutionMode.Async,
    });

    await Promise.all([
      first
        .queue()
        .then(() => first.start())
        .then(() => first.complete({ output: { one: true } })),
      second
        .queue()
        .then(() => second.start())
        .then(() => second.fail({ message: 'boom' })),
    ]);

    const snapshot = runtime.metrics.snapshot();
    expect(snapshot.executionCount).toBe(2);
    expect(snapshot.completed).toBe(1);
    expect(snapshot.failed).toBe(1);
    expect(first.status).toBe(ExecutionStatus.Completed);
    expect(second.status).toBe(ExecutionStatus.Failed);
  });

  it('uses a runtime pipeline builder to compose middleware in order', async () => {
    const builder = new PipelineBuilder();
    const calls: string[] = [];

    builder.use({
      id: 'mw-1',
      async execute(context, next) {
        calls.push(`one:${context.executionId}`);
        return next();
      },
    });
    builder.use({
      id: 'mw-2',
      async execute(context, next) {
        calls.push(`two:${context.executionId}`);
        return next();
      },
    });

    const pipeline = builder.build();
    const result = await pipeline.execute(
      new RuntimeContext({ executionId: 'ctx-2', correlationId: 'corr-2' }),
      async () => {
        calls.push('terminal');
        return { status: ExecutionStatus.Completed, output: { done: true } };
      },
    );

    expect(calls).toEqual(['one:ctx-2', 'two:ctx-2', 'terminal']);
    expect(result.output).toEqual({ done: true });
  });
});
