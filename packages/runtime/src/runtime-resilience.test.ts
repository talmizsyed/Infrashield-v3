import { describe, expect, it } from 'vitest';

import {
  ExecutionPriority,
  ExecutionStatus,
  RuntimeCancellationManager,
  RuntimeCheckpointBuilder,
  RuntimeCheckpointManager,
  RuntimeExecution,
  RuntimeExecutionTimeline,
  RuntimeTimeoutManager,
  RuntimeRecoveryHint,
} from './index.js';

describe('runtime resilience', () => {
  it('propagates timeout notifications and records timeout diagnostics', async () => {
    const events: string[] = [];
    const manager = new RuntimeTimeoutManager({
      defaultTimeoutMs: 20,
      eventBus: {
        publish: (event) => {
          events.push(event.type);
        },
      },
    });

    const execution = new RuntimeExecution({
      id: 'exec-timeout',
      owner: { id: 'owner', type: 'agent' },
      correlationId: 'corr-timeout',
      priority: ExecutionPriority.High,
    });

    manager.start(execution, { timeoutMs: 25 });

    await new Promise((resolve) => setTimeout(resolve, 50));

    const diagnostics = manager.getDiagnostics();
    expect(diagnostics.timeoutCount).toBe(1);
    expect(events).toContain('ExecutionTimedOut');
    expect(diagnostics.history).toHaveLength(1);
  });

  it('propagates cancellation from parent to linked executions', async () => {
    const parent = new RuntimeCancellationManager();
    const child = new RuntimeCancellationManager();

    child.link(parent);
    parent.cancel('parent-shutdown');

    expect(child.isCancellationRequested).toBe(true);
    expect(child.reason).toBe('parent-shutdown');
  });

  it('creates checkpoints with increasing versions and immutable snapshots', async () => {
    const manager = new RuntimeCheckpointManager();
    const execution = new RuntimeExecution({
      id: 'exec-checkpoint',
      owner: { id: 'owner', type: 'agent' },
      correlationId: 'corr-checkpoint',
      priority: ExecutionPriority.Normal,
      metadata: { attempt: 1 },
    });

    const first = manager.createCheckpoint(execution, {
      version: 1,
      metadata: { step: 'started' },
    });
    const second = manager.createCheckpoint(execution, {
      version: 2,
      metadata: { step: 'running' },
    });

    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
    expect(manager.getCheckpointCount()).toBe(2);
    expect(Object.isFrozen(second.snapshot().metadata)).toBe(true);
  });

  it('orders timeline events deterministically and captures immutable snapshots', async () => {
    const timeline = new RuntimeExecutionTimeline();
    timeline.record('created', { stage: 'init' });
    timeline.record('queued', { stage: 'enqueue' });
    timeline.record('started', { stage: 'run' });

    const snapshot = timeline.snapshot();
    expect(snapshot.events.map((event) => event.type)).toEqual(['created', 'queued', 'started']);
    expect(Object.isFrozen(snapshot.events)).toBe(true);
  });

  it('builds recovery hints from checkpoints without persistence', async () => {
    const manager = new RuntimeCheckpointManager();
    const execution = new RuntimeExecution({
      id: 'exec-recovery',
      owner: { id: 'owner', type: 'agent' },
      correlationId: 'corr-recovery',
      priority: ExecutionPriority.Critical,
    });

    const checkpoint = manager.createCheckpoint(execution, { version: 1 });
    const hint = RuntimeRecoveryHint.fromCheckpoint(checkpoint, 'resume-from-checkpoint');

    expect(hint.code).toBe('recovery.resume-from-checkpoint');
    expect(hint.checkpointId).toBe(checkpoint.id);
    expect(hint.metadata).toEqual({ executionId: execution.id, status: ExecutionStatus.Created });
  });

  it('supports fluent checkpoint construction from execution state', async () => {
    const execution = new RuntimeExecution({
      id: 'exec-builder',
      owner: { id: 'owner', type: 'agent' },
      correlationId: 'corr-builder',
      priority: ExecutionPriority.High,
      metadata: { attempt: 3 },
    });

    const checkpoint = new RuntimeCheckpointBuilder()
      .withExecution(execution)
      .withVersion(7)
      .withMetadata({ step: 'builder' })
      .withProgress(0.75)
      .build();

    expect(checkpoint.version).toBe(7);
    expect(checkpoint.executionId).toBe(execution.id);
    expect(checkpoint.progress).toBe(0.75);
  });
});
