import { describe, expect, it } from 'vitest';

import {
  ExecutionPriority,
  RuntimeExecution,
  RuntimeSchedulerBuilder,
  QueueFullException,
  RuntimeQueueHealthStatus,
} from './index.js';

describe('runtime scheduler', () => {
  it('prioritises queued executions while preserving fifo order within the same priority', async () => {
    const order: string[] = [];
    const scheduler = new RuntimeSchedulerBuilder()
      .withWorkers(1)
      .withQueueCapacity(10)
      .withHandler(async (execution) => {
        order.push(execution.id);
      })
      .build();

    await scheduler.start();

    const low = new RuntimeExecution({
      id: 'low',
      owner: { id: 'owner-1', type: 'agent' },
      correlationId: 'corr-low',
      priority: ExecutionPriority.Low,
    });
    const high = new RuntimeExecution({
      id: 'high',
      owner: { id: 'owner-2', type: 'agent' },
      correlationId: 'corr-high',
      priority: ExecutionPriority.High,
    });
    const normalA = new RuntimeExecution({
      id: 'normal-a',
      owner: { id: 'owner-3', type: 'agent' },
      correlationId: 'corr-normal-a',
      priority: ExecutionPriority.Normal,
    });
    const normalB = new RuntimeExecution({
      id: 'normal-b',
      owner: { id: 'owner-4', type: 'agent' },
      correlationId: 'corr-normal-b',
      priority: ExecutionPriority.Normal,
    });

    await Promise.all([
      scheduler.enqueue(low),
      scheduler.enqueue(high),
      scheduler.enqueue(normalA),
      scheduler.enqueue(normalB),
    ]);

    await scheduler.drain();
    await scheduler.shutdown();

    expect(order).toEqual(['high', 'normal-a', 'normal-b', 'low']);
  });

  it('rejects new work when the queue is full and the backpressure policy is reject', async () => {
    const scheduler = new RuntimeSchedulerBuilder()
      .withQueueCapacity(1)
      .withBackpressurePolicy('reject')
      .withHandler(async () => undefined)
      .build();

    await scheduler.start();
    await scheduler.enqueue(
      new RuntimeExecution({
        id: 'first',
        owner: { id: 'owner-1', type: 'agent' },
        correlationId: 'corr-1',
      }),
    );

    await expect(
      scheduler.enqueue(
        new RuntimeExecution({
          id: 'second',
          owner: { id: 'owner-2', type: 'agent' },
          correlationId: 'corr-2',
        }),
      ),
    ).rejects.toBeInstanceOf(QueueFullException);

    await scheduler.shutdown();
  });

  it('drains queued work during graceful shutdown', async () => {
    const processed: string[] = [];
    const scheduler = new RuntimeSchedulerBuilder()
      .withWorkers(1)
      .withQueueCapacity(4)
      .withHandler(async (execution) => {
        processed.push(execution.id);
      })
      .build();

    await scheduler.start();
    await Promise.all([
      scheduler.enqueue(
        new RuntimeExecution({ id: 'a', owner: { id: 'o', type: 'agent' }, correlationId: 'c-a' }),
      ),
      scheduler.enqueue(
        new RuntimeExecution({ id: 'b', owner: { id: 'o', type: 'agent' }, correlationId: 'c-b' }),
      ),
    ]);

    await scheduler.shutdown({ drain: true });

    expect(processed.sort()).toEqual(['a', 'b']);
  });

  it('expires leases and records lease failures', async () => {
    const scheduler = new RuntimeSchedulerBuilder()
      .withWorkers(1)
      .withQueueCapacity(4)
      .withLeaseDurationMs(20)
      .withHandler(async () => {
        await new Promise((resolve) => setTimeout(resolve, 60));
      })
      .build();

    await scheduler.start();
    await scheduler.enqueue(
      new RuntimeExecution({
        id: 'lease',
        owner: { id: 'o', type: 'agent' },
        correlationId: 'c-lease',
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 120));
    const statistics = scheduler.getStatistics();
    expect(statistics.leaseExpirations).toBeGreaterThan(0);

    await scheduler.shutdown();
  });

  it('tracks health and statistics for the queue and workers', async () => {
    const scheduler = new RuntimeSchedulerBuilder()
      .withWorkers(2)
      .withQueueCapacity(4)
      .withHandler(async () => undefined)
      .build();

    await scheduler.start();
    await scheduler.enqueue(
      new RuntimeExecution({
        id: 'health-1',
        owner: { id: 'o', type: 'agent' },
        correlationId: 'c-1',
      }),
    );

    const health = scheduler.getHealth();
    const statistics = scheduler.getStatistics();
    expect(health.status).toBe(RuntimeQueueHealthStatus.Healthy);
    expect(statistics.enqueued).toBe(1);

    await scheduler.shutdown();
  });

  it('supports concurrent producers without losing work', async () => {
    const processed: string[] = [];
    const scheduler = new RuntimeSchedulerBuilder()
      .withWorkers(4)
      .withQueueCapacity(50)
      .withHandler(async (execution) => {
        processed.push(execution.id);
      })
      .build();

    await scheduler.start();

    const executions = Array.from(
      { length: 20 },
      (_, index) =>
        new RuntimeExecution({
          id: `exec-${index}`,
          owner: { id: `owner-${index}`, type: 'agent' },
          correlationId: `corr-${index}`,
        }),
    );

    await Promise.all(executions.map((execution) => scheduler.enqueue(execution)));
    await scheduler.drain();
    await scheduler.shutdown();

    expect(processed).toHaveLength(20);
  });
});
