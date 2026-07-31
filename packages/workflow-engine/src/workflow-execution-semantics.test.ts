import { describe, expect, it } from 'vitest';

import { WorkflowStepBuilder, WorkflowGraph } from './workflow-step-model.js';
import {
  WorkflowBranch,
  WorkflowBranchEvaluator,
  WorkflowCondition,
  WorkflowConditionEvaluator,
  WorkflowExecutionSemantics,
  WorkflowLoopDefinition,
  WorkflowMergeGroup,
  WorkflowParallelGroup,
  WorkflowTraversalEngine,
  WorkflowMergeException,
  WorkflowParallelException,
  WorkflowLoopException,
  WorkflowTraversalException,
} from './workflow-execution-semantics.js';

describe('workflow execution semantics', () => {
  const createGraph = (): WorkflowGraph => {
    const start = new WorkflowStepBuilder()
      .withId('start')
      .withName('Start')
      .withVersion('1.0.0')
      .withType('start')
      .build();
    const branchA = new WorkflowStepBuilder()
      .withId('branch-a')
      .withName('Branch A')
      .withVersion('1.0.0')
      .withType('task')
      .build();
    const branchB = new WorkflowStepBuilder()
      .withId('branch-b')
      .withName('Branch B')
      .withVersion('1.0.0')
      .withType('task')
      .build();
    const merge = new WorkflowStepBuilder()
      .withId('merge')
      .withName('Merge')
      .withVersion('1.0.0')
      .withType('merge')
      .build();
    const end = new WorkflowStepBuilder()
      .withId('end')
      .withName('End')
      .withVersion('1.0.0')
      .withType('end')
      .build();

    return new WorkflowGraph({
      id: 'graph-1',
      name: 'Test Graph',
      version: '1.0.0',
      steps: [start, branchA, branchB, merge, end],
      entryNodeId: 'start',
      exitNodeId: 'end',
      edges: [
        { id: 'e1', sourceId: 'start', targetId: 'branch-a' },
        { id: 'e2', sourceId: 'start', targetId: 'branch-b' },
        { id: 'e3', sourceId: 'branch-a', targetId: 'merge' },
        { id: 'e4', sourceId: 'branch-b', targetId: 'merge' },
        { id: 'e5', sourceId: 'merge', targetId: 'end' },
      ],
    });
  };

  it('supports deterministic sequential traversal', () => {
    const graph = createGraph();
    const engine = new WorkflowTraversalEngine();
    const snapshot = engine.traverse({
      graph,
      semantics: new WorkflowExecutionSemantics({
        branches: [
          new WorkflowBranch({ id: 'seq-1', sourceNodeId: 'start', targetNodeId: 'branch-a' }),
        ],
      }),
      currentNodeId: 'start',
      completedNodeIds: [],
      executionHistory: [],
    });

    expect(snapshot.nextNodeIds).toEqual(['branch-a']);
    expect(snapshot.blockedNodeIds).toEqual([]);
    expect(snapshot.executionPath).toEqual(['start']);
  });

  it('evaluates conditional branches with an evaluator', () => {
    const evaluator = new WorkflowBranchEvaluator();
    const condition = new WorkflowCondition({
      id: 'cond-1',
      kind: 'if',
      expression: 'flag',
      targetNodeId: 'branch-b',
    });
    const branch = new WorkflowBranch({
      id: 'branch-1',
      sourceNodeId: 'start',
      targetNodeId: 'branch-b',
      condition,
    });

    expect(evaluator.evaluate(branch, { values: new Map([['flag', true]]) })).toBe(true);
    expect(evaluator.evaluate(branch, { values: new Map([['flag', false]]) })).toBe(false);
    expect(
      new WorkflowConditionEvaluator().evaluate(condition, { values: new Map([['flag', true]]) }),
    ).toBe(true);
  });

  it('supports parallel groups and merge resolution', () => {
    const graph = createGraph();
    const engine = new WorkflowTraversalEngine();
    const semantics = new WorkflowExecutionSemantics({
      parallelGroups: [
        new WorkflowParallelGroup({
          id: 'parallel-1',
          branchIds: ['branch-a', 'branch-b'],
          maxConcurrency: 2,
          completionStrategy: 'join',
        }),
      ],
      mergeGroups: [
        new WorkflowMergeGroup({
          id: 'merge-1',
          sourceBranchIds: ['branch-a', 'branch-b'],
          targetNodeId: 'merge',
        }),
      ],
    });

    const snapshot = engine.traverse({
      graph,
      semantics,
      currentNodeId: 'branch-a',
      completedNodeIds: ['branch-a', 'branch-b'],
      executionHistory: ['start', 'branch-a'],
    });

    expect(snapshot.nextNodeIds).toEqual(['merge']);
    expect(snapshot.parallelBranches).toEqual(['branch-a', 'branch-b']);
    expect(snapshot.mergeResolutions).toEqual(['merge']);
  });

  it('models loops and snapshots their state', () => {
    const semantics = new WorkflowExecutionSemantics({
      loops: [
        new WorkflowLoopDefinition({
          id: 'loop-1',
          kind: 'for',
          targetNodeId: 'branch-a',
          maxIterations: 3,
          metadata: { strategy: 'bounded' },
        }),
      ],
    });

    const snapshot = semantics.snapshot();

    expect(snapshot.loopCount).toBe(1);
    expect(snapshot.executionPath).toEqual([]);
  });

  it('validates invalid branch and merge references', () => {
    const engine = new WorkflowTraversalEngine();

    expect(() =>
      engine.traverse({
        graph: createGraph(),
        semantics: new WorkflowExecutionSemantics({
          branches: [
            new WorkflowBranch({ id: 'invalid', sourceNodeId: 'start', targetNodeId: 'missing' }),
          ],
        }),
        currentNodeId: 'start',
        completedNodeIds: [],
        executionHistory: [],
      }),
    ).toThrow(WorkflowTraversalException);

    expect(
      () =>
        new WorkflowMergeGroup({
          id: 'merge-bad',
          sourceBranchIds: ['missing'],
          targetNodeId: 'end',
        }),
    ).toThrow(WorkflowMergeException);

    expect(
      () =>
        new WorkflowParallelGroup({
          id: 'parallel-bad',
          branchIds: ['only-one'],
          maxConcurrency: 2,
        }),
    ).toThrow(WorkflowParallelException);

    expect(
      () =>
        new WorkflowLoopDefinition({
          id: 'loop-bad',
          kind: 'while',
          targetNodeId: '',
          maxIterations: 0,
        }),
    ).toThrow(WorkflowLoopException);
  });

  it('throws when traversal is inconsistent', () => {
    const engine = new WorkflowTraversalEngine();
    expect(() =>
      engine.traverse({
        graph: createGraph(),
        semantics: new WorkflowExecutionSemantics(),
        currentNodeId: 'missing',
        completedNodeIds: [],
        executionHistory: [],
      }),
    ).toThrow(WorkflowTraversalException);
  });
});
