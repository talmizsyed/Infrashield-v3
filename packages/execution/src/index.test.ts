import { describe, expect, it } from 'vitest';
import type { ExecutionContext, ExecutionResult, ExecutionStep } from './index.js';
import {
  ExecutionCheckpoint,
  ExecutionEngine,
  ExecutionManager,
  ExecutionQueue,
  ExecutionRecoveryPolicy,
  ExecutionRetryPolicy,
  ExecutionScheduler,
  ExecutionStatus,
  ExecutionTask,
  ExecutionTimeoutPolicy,
} from './index.js';

const dummyContext: ExecutionContext = {
  executionId: 'exec-1',
  correlationId: 'corr-1',
  status: ExecutionStatus.Created,
  requestContext: {
    request: {
      requestId: 'req-1',
      correlationId: 'corr-1',
    },
    execution: {
      executionId: 'exec-1',
      timestamp: new Date().toISOString(),
    },
  },
  options: {},
  timestamp: new Date().toISOString(),
};

const dummyStep: ExecutionStep = {
  stepId: 'step-1',
  name: 'dummy',
  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    return {
      executionId: context.executionId,
      status: ExecutionStatus.Completed,
      succeeded: true,
      startedAt: context.timestamp,
      completedAt: new Date().toISOString(),
    };
  },
};

describe('Execution package contracts', () => {
  it('supports serializable execution context and step contracts', async () => {
    const result = await dummyStep.execute(dummyContext);

    expect(result).toEqual({
      executionId: 'exec-1',
      status: ExecutionStatus.Completed,
      succeeded: true,
      startedAt: dummyContext.timestamp,
      completedAt: result.completedAt,
    });
  });

  it('exposes execution status lifecycle values', () => {
    expect(ExecutionStatus.Queued).toBe('queued');
    expect(ExecutionStatus.TimedOut).toBe('timedOut');
  });

  it('schedules queued work and preserves execution order', async () => {
    const queue = new ExecutionQueue();
    const first = new ExecutionTask({ id: 'task-1', name: 'first' });
    const second = new ExecutionTask({ id: 'task-2', name: 'second' });

    queue.enqueue(first);
    queue.enqueue(second);

    expect(queue.size()).toBe(2);
    expect(queue.dequeue()?.id).toBe('task-1');
    expect(queue.dequeue()?.id).toBe('task-2');
  });

  it('runs sequential and parallel execution plans with retries and checkpoints', async () => {
    const scheduler = new ExecutionScheduler();
    const tasks = [
      new ExecutionTask({ id: 'task-1', name: 'analysis', mode: 'sequential' }),
      new ExecutionTask({ id: 'task-2', name: 'execution', mode: 'parallel' }),
    ];

    const plan = scheduler.schedule(tasks);
    expect(plan).toHaveLength(2);

    const retryPolicy = new ExecutionRetryPolicy({ maxAttempts: 2 });
    const timeoutPolicy = new ExecutionTimeoutPolicy({ timeoutMs: 1000 });
    const recoveryPolicy = new ExecutionRecoveryPolicy({ enabled: true });
    const manager = new ExecutionManager({ retryPolicy, timeoutPolicy, recoveryPolicy });

    const context = new ExecutionEngine().createExecutionContext(dummyContext.requestContext, {
      metadata: { tasks },
    });

    const result = await manager.enqueue(context, { retryCount: 1, enableCheckpointing: true });
    expect(result.succeeded).toBe(true);
    expect(result.status).toBe(ExecutionStatus.Completed);
    expect(manager.getStatistics().completedExecutions).toBeGreaterThanOrEqual(1);

    const checkpoint = new ExecutionCheckpoint({
      checkpointId: 'cp-1',
      executionId: context.executionId,
      state: {
        snapshotId: 'snap-1',
        executionId: context.executionId,
        status: ExecutionStatus.Completed,
        timestamp: new Date().toISOString(),
      },
    });
    expect(checkpoint.checkpointId).toBe('cp-1');
  });

  it('supports cancellation and timeout handling', async () => {
    const retryPolicy = new ExecutionRetryPolicy({ maxAttempts: 1 });
    const timeoutPolicy = new ExecutionTimeoutPolicy({ timeoutMs: 1 });
    const recoveryPolicy = new ExecutionRecoveryPolicy({ enabled: true });
    const manager = new ExecutionManager({ retryPolicy, timeoutPolicy, recoveryPolicy });

    const context = new ExecutionEngine().createExecutionContext(dummyContext.requestContext, {
      metadata: { tasks: [new ExecutionTask({ id: 'slow-task', name: 'slow' })] },
    });

    const result = await manager.enqueue(context, { timeoutMs: 1, retryCount: 0 });
    expect(result.status).toBe(ExecutionStatus.TimedOut);

    const cancelled = await manager.cancel(context.executionId);
    expect(cancelled.status).toBe(ExecutionStatus.Cancelled);
  });
});
