import { describe, expect, it } from 'vitest';

import {
  WorkflowEdge,
  WorkflowGraph,
  WorkflowStepBuilder,
  WorkflowStepMetadata,
  WorkflowStepSnapshot,
  WorkflowStepStatistics,
  WorkflowStepVersion,
  WorkflowValidationException,
  WorkflowVersionException,
} from './index.js';

describe('workflow step model', () => {
  it('builds immutable steps with metadata, labels, annotations, and options', () => {
    const step = new WorkflowStepBuilder()
      .withId('step-1')
      .withName('Validate request')
      .withDescription('Validates the request payload')
      .withVersion('1.2.3')
      .withType('task')
      .withMetadata(new WorkflowStepMetadata({ owner: 'ops' }))
      .withTags(['validation'])
      .withLabels(['critical'])
      .withAnnotations([{ key: 'source', value: 'internal' }])
      .withRetryPolicyRef('policy:retry')
      .withTimeoutRef('timeout:5m')
      .withConditionRef('condition:ready')
      .withOptions({ timeoutMs: 5000, retryCount: 2 })
      .withDependencies(['step-0'])
      .withInputs(['request'])
      .withOutputs(['validated'])
      .withOwner('ops')
      .withCorrelationId('corr-1')
      .build();

    expect(step.id.toString()).toBe('step-1');
    expect(step.version.toString()).toBe('1.2.3');
    expect(step.metadata.get('owner')).toBe('ops');
    expect(step.dependencies).toEqual(['step-0']);
    expect(Object.isFrozen(step.tags)).toBe(true);
    expect(Object.isFrozen(step.annotations)).toBe(true);
  });

  it('validates step versions and throws for invalid names', () => {
    expect(() => new WorkflowStepVersion('1.2')).toThrow(WorkflowVersionException);
    expect(() =>
      new WorkflowStepBuilder().withId('invalid').withName('DROP TABLE').build(),
    ).toThrow(WorkflowValidationException);
  });

  it('creates immutable snapshots and statistics', () => {
    const step = new WorkflowStepBuilder()
      .withId('step-2')
      .withName('Notify user')
      .withVersion('2.0.0')
      .withType('approval')
      .withMetadata(new WorkflowStepMetadata({ source: 'ops' }))
      .withTags(['notify'])
      .build();

    const snapshot = step.snapshot();
    expect(snapshot).toBeInstanceOf(WorkflowStepSnapshot);
    expect(snapshot.hash).toBe(step.definitionHash);
    expect(step.statistics).toBeInstanceOf(WorkflowStepStatistics);
    expect(step.statistics.tagCount).toBe(1);
  });

  it('creates immutable graphs and validates structure', () => {
    const start = new WorkflowStepBuilder()
      .withId('start')
      .withName('Start')
      .withVersion('1.0.0')
      .withType('start')
      .build();
    const task = new WorkflowStepBuilder()
      .withId('task')
      .withName('Task')
      .withVersion('1.0.0')
      .withType('task')
      .build();
    const end = new WorkflowStepBuilder()
      .withId('end')
      .withName('End')
      .withVersion('1.0.0')
      .withType('end')
      .build();

    const graph = new WorkflowGraph({
      id: 'graph-1',
      name: 'Graph',
      version: '1.0.0',
      steps: [start, task, end],
      entryNodeId: 'start',
      exitNodeId: 'end',
      edges: [
        new WorkflowEdge({ id: 'edge-1', sourceId: 'start', targetId: 'task' }),
        new WorkflowEdge({ id: 'edge-2', sourceId: 'task', targetId: 'end' }),
      ],
    });

    expect(graph.definitionHash).toBeDefined();
    expect(
      () =>
        new WorkflowGraph({
          id: 'bad',
          name: 'bad',
          version: '1.0.0',
          steps: [start],
          entryNodeId: 'missing',
          exitNodeId: 'missing',
        }),
    ).toThrow(WorkflowValidationException);
  });

  it('rejects invalid graph structure and duplicate edges', () => {
    const start = new WorkflowStepBuilder()
      .withId('start-2')
      .withName('Start')
      .withVersion('1.0.0')
      .withType('start')
      .build();
    const end = new WorkflowStepBuilder()
      .withId('end-2')
      .withName('End')
      .withVersion('1.0.0')
      .withType('end')
      .build();
    const edge = new WorkflowEdge({ id: 'edge-1', sourceId: 'start-2', targetId: 'start-2' });

    expect(
      () =>
        new WorkflowGraph({
          id: 'graph-2',
          name: 'Graph',
          version: '1.0.0',
          steps: [start, end],
          entryNodeId: 'start-2',
          exitNodeId: 'end-2',
          edges: [edge],
        }),
    ).toThrow(WorkflowValidationException);
  });

  it('supports cloning and builder validation hooks', () => {
    const builder = new WorkflowStepBuilder()
      .withId('step-3')
      .withName('Clone step')
      .withVersion('1.0.0')
      .withType('task');
    const clone = builder.clone();
    expect(clone).not.toBe(builder);
    expect(clone.build().id.toString()).toBe('step-3');
    expect(() => builder.validate()).not.toThrow();
  });

  it('captures structure exceptions for invalid graph references', () => {
    const start = new WorkflowStepBuilder()
      .withId('start-3')
      .withName('Start')
      .withVersion('1.0.0')
      .withType('start')
      .build();
    const end = new WorkflowStepBuilder()
      .withId('end-3')
      .withName('End')
      .withVersion('1.0.0')
      .withType('end')
      .build();
    const badEdge = new WorkflowEdge({
      id: 'edge-3',
      sourceId: 'missing',
      targetId: end.id.toString(),
    });

    expect(
      () =>
        new WorkflowGraph({
          id: 'graph-3',
          name: 'Graph',
          version: '1.0.0',
          steps: [start, end],
          entryNodeId: start.id.toString(),
          exitNodeId: end.id.toString(),
          edges: [badEdge],
        }),
    ).toThrow(WorkflowValidationException);
  });
});
