import { describe, expect, it } from 'vitest';

import {
  WorkflowBuilder,
  WorkflowEngine,
  WorkflowExecution,
  WorkflowIdentifier,
  WorkflowState,
  WorkflowValidationException,
  WorkflowVersion,
  WorkflowVersionException,
} from './index.js';

describe('workflow engine foundation', () => {
  it('builds an immutable workflow definition with a validated version', () => {
    const definition = new WorkflowBuilder()
      .withId('workflow-1')
      .withName('Demo workflow')
      .withOwner('owner-1')
      .withCorrelationId('corr-1')
      .withVersion('1.2.3')
      .withMetadata({ source: 'unit-test' })
      .withTags(['core', 'foundation'])
      .withDescription('A foundational workflow')
      .build();

    expect(definition.id).toBeInstanceOf(WorkflowIdentifier);
    expect(definition.version).toBeInstanceOf(WorkflowVersion);
    expect(definition.version.toString()).toBe('1.2.3');
    expect(definition.metadata).toEqual({ source: 'unit-test' });
    expect(Object.isFrozen(definition.metadata)).toBe(true);
    expect(definition.tags).toEqual(['core', 'foundation']);
  });

  it('rejects invalid workflow definitions and versions', () => {
    expect(() => new WorkflowBuilder().withName('Missing id').build()).toThrow(
      WorkflowValidationException,
    );

    expect(() =>
      new WorkflowBuilder().withId('workflow-2').withVersion('not-a-version').build(),
    ).toThrow(WorkflowVersionException);
  });

  it('rejects invalid lifecycle transitions and preserves immutable context state', async () => {
    const definition = new WorkflowBuilder()
      .withId('workflow-4')
      .withName('Lifecycle guard')
      .withOwner('owner-4')
      .withCorrelationId('corr-4')
      .withVersion('4.0.0')
      .withMetadata({ guarded: true })
      .withTags(['guard'])
      .build();

    const execution = new WorkflowExecution({ definition });
    await expect(execution.complete({ output: { ok: true } })).rejects.toThrow();

    const context = execution.context;
    expect(() => {
      (context.metadata as Record<string, unknown>).guarded = false;
    }).toThrow(TypeError);
  });

  it('supports deterministic lifecycle transitions and snapshots', async () => {
    const definition = new WorkflowBuilder()
      .withId('workflow-2')
      .withName('Lifecycle workflow')
      .withOwner('owner-2')
      .withCorrelationId('corr-2')
      .withVersion('2.0.0')
      .withMetadata({ phase: 'lifecycle' })
      .withTags(['lifecycle'])
      .build();

    const execution = new WorkflowExecution({ definition });
    expect(execution.status).toBe(WorkflowState.Created);

    await execution.start();
    await execution.complete({ output: { ok: true } });

    const snapshot = execution.snapshot();
    expect(snapshot.status).toBe(WorkflowState.Completed);
    expect(snapshot.history).toContain(WorkflowState.Completed);
    expect(snapshot.metadata).toEqual({});
  });

  it('creates workflow executions through the engine and returns a completed result', async () => {
    const engine = new WorkflowEngine();
    const definition = new WorkflowBuilder()
      .withId('workflow-3')
      .withName('Engine workflow')
      .withOwner('owner-3')
      .withCorrelationId('corr-3')
      .withVersion('3.1.0')
      .withMetadata({ engine: true })
      .withTags(['engine'])
      .build();

    const result = await engine.execute(definition);

    expect(result.succeeded).toBe(true);
    expect(result.status).toBe(WorkflowState.Completed);
    expect(result.workflowId).toBe('workflow-3');
  });
});
