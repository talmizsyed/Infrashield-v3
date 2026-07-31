import { type IEvent, type IEventBus } from '@infrashield/core-infrastructure';
import { describe, expect, it } from 'vitest';

import {
  WorkflowCheckpointException,
  WorkflowPauseException,
  WorkflowResumeException,
  WorkflowState,
  WorkflowStateMachine,
  WorkflowStateMachineException,
  WorkflowSuspensionContext,
  WorkflowTransitionException,
  WorkflowTransitionValidator,
} from './workflow-state-machine.js';

class TestEventBus implements IEventBus {
  public readonly events: IEvent[] = [];

  public async publish(event: IEvent): Promise<void> {
    this.events.push(event);
  }

  public subscribe(): void {
    return undefined;
  }
}

describe('workflow state machine', () => {
  it('supports deterministic lifecycle transitions and immutable journal entries', () => {
    const eventBus = new TestEventBus();
    const machine = new WorkflowStateMachine({
      workflowId: 'wf-state-test',
      correlationId: 'corr-state-test',
      eventBus,
      metadata: { owner: 'ops' },
    });

    machine.create();
    machine.validate();
    machine.start();
    machine.complete({ executed: true });

    expect(machine.state).toBe(WorkflowState.Completed);
    expect(machine.history.values).toEqual([
      WorkflowState.Created,
      WorkflowState.Validated,
      WorkflowState.Running,
      WorkflowState.Completed,
    ]);

    const journal = machine.journal.snapshot();
    const firstTransition = journal.transitions[0];
    const lastTransition = journal.transitions[3];

    expect(journal.transitions).toHaveLength(4);
    expect(firstTransition?.to).toBe(WorkflowState.Created);
    expect(lastTransition?.to).toBe(WorkflowState.Completed);
    expect(firstTransition?.timestamp).toBeDefined();

    const snapshot = machine.snapshot();
    expect(snapshot.state).toBe(WorkflowState.Completed);
    expect(snapshot.history.values).toEqual(machine.history.values);
    expect(snapshot.journal.transitions).toHaveLength(4);
    expect(snapshot.checkpoint).toBeUndefined();
  });

  it('supports pause, resume, suspend, retry, and compensation flows', () => {
    const machine = new WorkflowStateMachine({
      workflowId: 'wf-pause',
      correlationId: 'corr-pause',
      metadata: { owner: 'ops' },
    });

    machine.create();
    machine.validate();
    machine.start();
    machine.pause('waiting on dependency');
    machine.resume('dependency available');
    machine.wait('waiting for external signal');
    machine.suspend('tenant maintenance');
    machine.retry('retry after maintenance');
    machine.compensate('rolling back');

    expect(machine.state).toBe(WorkflowState.Compensating);
    expect(machine.metrics.transitionCount).toBe(9);
    expect(machine.metrics.pauseDurationMs).toBeGreaterThanOrEqual(0);
    expect(machine.metrics.waitDurationMs).toBeGreaterThanOrEqual(0);
    expect(machine.metrics.retryDurationMs).toBeGreaterThanOrEqual(0);
    expect(machine.metrics.compensationDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('rejects invalid transitions and invalid checkpoints', () => {
    const machine = new WorkflowStateMachine({
      workflowId: 'wf-invalid',
      correlationId: 'corr-invalid',
      metadata: { owner: 'ops' },
    });

    expect(() => machine.pause('too early')).toThrow(WorkflowPauseException);
    expect(() => machine.resume('too early')).toThrow(WorkflowResumeException);
    expect(() => machine.retry('too early')).toThrow(WorkflowTransitionException);
    expect(() => machine.validate()).not.toThrow();

    expect(() =>
      machine.checkpoint({
        executionProgress: 0,
        completedSteps: [],
        pendingSteps: [],
        workflowMetadata: {},
        recoveryMetadata: {},
        checkpointVersion: 0,
      }),
    ).toThrow(WorkflowCheckpointException);

    machine.start();

    expect(() =>
      machine.checkpoint({
        executionProgress: 0.5,
        completedSteps: ['step-a'],
        pendingSteps: ['step-b'],
        workflowMetadata: { stage: 'running' },
        recoveryMetadata: { attempt: 1 },
        checkpointVersion: 1,
      }),
    ).not.toThrow();
  });

  it('publishes lifecycle events and supports transition validation', () => {
    const eventBus = new TestEventBus();
    const machine = new WorkflowStateMachine({
      workflowId: 'wf-events',
      correlationId: 'corr-events',
      eventBus,
      metadata: { owner: 'ops' },
    });

    machine.create();
    machine.validate();
    machine.start();
    machine.waitForApproval('awaiting approval');

    expect(eventBus.events.some((event) => event.eventType === 'WorkflowStateChangedEvent')).toBe(
      true,
    );
    expect(eventBus.events.some((event) => event.eventType === 'WorkflowWaitingEvent')).toBe(true);
    expect(machine.snapshot().metrics.transitionCount).toBe(4);

    const validator = new WorkflowTransitionValidator();
    const firstTransition = machine.snapshot().journal.transitions[0];
    const thirdTransition = machine.snapshot().journal.transitions[2];

    expect(() => validator.validate(firstTransition as never, machine)).not.toThrow();
    expect(() => validator.validate(thirdTransition as never, machine)).not.toThrow();
  });

  it('creates suspension contexts and immutable checkpoints', () => {
    const machine = new WorkflowStateMachine({
      workflowId: 'wf-suspend',
      correlationId: 'corr-suspend',
      metadata: { owner: 'ops' },
    });

    machine.create();
    machine.validate();
    machine.start();

    const context = machine.createSuspensionContext({ reason: 'manual' });
    expect(context).toBeInstanceOf(WorkflowSuspensionContext);
    expect(context.reason).toBe('manual');

    const checkpoint = machine.checkpoint({
      executionProgress: 0.75,
      completedSteps: ['a', 'b'],
      pendingSteps: ['c'],
      workflowMetadata: { phase: 'midstream' },
      recoveryMetadata: { suspended: true },
      checkpointVersion: 1,
    });

    expect(checkpoint).toBeDefined();
    expect(checkpoint?.completedSteps).toEqual(['a', 'b']);
    expect(checkpoint?.pendingSteps).toEqual(['c']);
    expect(() => {
      (checkpoint as unknown as { completedSteps: string[] }).completedSteps.push('x');
    }).toThrow();
  });

  it('throws a machine exception for invalid machine creation', () => {
    expect(
      () => new WorkflowStateMachine({ workflowId: '', correlationId: '', metadata: {} }),
    ).toThrow(WorkflowStateMachineException);
  });
});
