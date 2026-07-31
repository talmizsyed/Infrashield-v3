import { describe, expect, it } from 'vitest';

import {
  ExecutionPriority,
  ExecutionStatus,
  RuntimeDiagnostics,
  RuntimeExecution,
  RuntimeExecutionHistory,
  RuntimeExecutionTimeline,
  RuntimeHealth,
  RuntimeHealthCheck,
  RuntimeMetrics,
  RuntimeObserver,
  RuntimeObserverCollection,
  RuntimeTracer,
} from './index.js';

describe('runtime observability', () => {
  it('collects metrics, counters, and statistics for execution outcomes', () => {
    const metrics = new RuntimeMetrics();

    metrics.recordQueued();
    metrics.recordCompleted(25);
    metrics.recordFailed(12);
    metrics.recordCancelled(8);
    metrics.recordTimedOut(9);
    metrics.recordCheckpoint();
    metrics.recordTimeout();
    metrics.recordCancellation();
    metrics.recordPipelineDuration(15);
    metrics.recordMiddlewareDuration(5);
    metrics.recordSchedulerLatency(3);
    metrics.recordWorkerUtilization(0.75);
    metrics.recordConcurrentExecution();
    metrics.recordConcurrentExecution();
    metrics.recordThroughput();

    const snapshot = metrics.snapshot();
    expect(snapshot.totalExecutions).toBe(5);
    expect(snapshot.successfulExecutions).toBe(1);
    expect(snapshot.failedExecutions).toBe(1);
    expect(snapshot.cancelledExecutions).toBe(1);
    expect(snapshot.timedOutExecutions).toBe(1);
    expect(snapshot.queuedExecutions).toBe(1);
    expect(snapshot.checkpointCount).toBe(1);
    expect(snapshot.timeoutCount).toBe(1);
    expect(snapshot.cancellationCount).toBe(1);
    expect(snapshot.averageExecutionDurationMs).toBe(13.5);
    expect(snapshot.maximumExecutionDurationMs).toBe(25);
    expect(snapshot.minimumExecutionDurationMs).toBe(8);
    expect(snapshot.workerUtilization).toBe(0.75);
    expect(snapshot.concurrentExecutions).toBe(2);
    expect(snapshot.throughput).toBe(1);
  });

  it('creates immutable traces with nested activities and trace context', () => {
    const tracer = new RuntimeTracer();
    const execution = new RuntimeExecution({
      id: 'exec-trace',
      owner: { id: 'owner', type: 'agent' },
      correlationId: 'corr-trace',
      priority: ExecutionPriority.High,
    });

    const trace = tracer.startTrace({
      executionId: execution.id,
      correlationId: execution.correlationId,
      parentExecutionId: undefined,
      name: 'root-trace',
    });
    const activity = trace.startActivity('process');
    trace.completeActivity(activity.id, { result: 'ok' });
    const snapshot = trace.snapshot();

    expect(snapshot.activities).toHaveLength(1);
    expect(Object.isFrozen(snapshot.activities)).toBe(true);
    expect(snapshot.traceContext.executionId).toBe(execution.id);
    expect(snapshot.traceContext.correlationId).toBe(execution.correlationId);
    expect(snapshot.traceContext.parentExecutionId).toBeUndefined();
  });

  it('records execution history and timeline entries immutably', () => {
    const history = new RuntimeExecutionHistory();
    const timeline = new RuntimeExecutionTimeline();
    const execution = new RuntimeExecution({
      id: 'exec-history',
      owner: { id: 'owner', type: 'agent' },
      correlationId: 'corr-history',
      priority: ExecutionPriority.Normal,
    });

    history.record({ executionId: execution.id, status: ExecutionStatus.Created, timestamp: 't0' });
    history.record({ executionId: execution.id, status: ExecutionStatus.Running, timestamp: 't1' });
    timeline.record('created', { stage: 'init' });
    timeline.record('running', { stage: 'process' });

    const historySnapshot = history.snapshot();
    const timelineSnapshot = timeline.snapshot();

    expect(historySnapshot).toHaveLength(2);
    expect(timelineSnapshot.events.map((event) => event.type)).toEqual(['created', 'running']);
    expect(Object.isFrozen(historySnapshot)).toBe(true);
    expect(Object.isFrozen(timelineSnapshot.events)).toBe(true);
  });

  it('calculates runtime health from checks and snapshots', () => {
    const health = new RuntimeHealth({
      checks: [
        new RuntimeHealthCheck({ name: 'runtime', status: 'healthy', message: 'ok' }),
        new RuntimeHealthCheck({ name: 'queue', status: 'degraded', message: 'backlog' }),
      ],
    });

    const snapshot = health.snapshot();
    expect(snapshot.status).toBe('degraded');
    expect(snapshot.checks).toHaveLength(2);
  });

  it('notifies observers and isolates observer failures', async () => {
    const collection = new RuntimeObserverCollection();
    const seen: string[] = [];

    collection.add(new RuntimeObserver({ id: 'ok', onEvent: (event) => seen.push(event.type) }));
    collection.add(
      new RuntimeObserver({
        id: 'bad',
        onEvent: () => {
          throw new Error('boom');
        },
      }),
    );

    await collection.notify({ type: 'ExecutionObserved', timestamp: 'now' });

    expect(seen).toEqual(['ExecutionObserved']);
  });

  it('produces diagnostics snapshots and supports concurrent metrics updates', async () => {
    const metrics = new RuntimeMetrics();
    const tracer = new RuntimeTracer();
    const history = new RuntimeExecutionHistory();
    const timeline = new RuntimeExecutionTimeline();
    const diagnostics = new RuntimeDiagnostics({ metrics, tracer, history, timeline });

    await Promise.all(
      Array.from({ length: 10 }, (_, index) => {
        return Promise.resolve().then(() => {
          metrics.recordCompleted(10 + index);
          const trace = tracer.startTrace({
            executionId: `exec-${index}`,
            correlationId: `corr-${index}`,
            name: `trace-${index}`,
          });
          trace.complete();
          history.record({
            executionId: `exec-${index}`,
            status: ExecutionStatus.Completed,
            timestamp: `t-${index}`,
          });
          timeline.record(`event-${index}`);
        });
      }),
    );

    const snapshot = diagnostics.snapshot();
    expect(snapshot.metrics.totalExecutions).toBe(10);
    expect(snapshot.metrics.successfulExecutions).toBe(10);
    expect(snapshot.traces).toHaveLength(10);
    expect(snapshot.history).toHaveLength(10);
    expect(snapshot.timeline.events).toHaveLength(10);
  });
});
