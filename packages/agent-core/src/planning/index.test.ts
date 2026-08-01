import { describe, expect, it } from 'vitest';
import {
  Goal,
  GoalContext,
  GoalDefinition,
  GoalDependency,
  GoalEvaluator,
  GoalLifecycle,
  GoalPolicy,
  GoalPriority,
  GoalRegistry,
  GoalScheduler,
  GoalTracker,
  Plan,
  PlanBuilder,
  PlanCheckpoint,
  PlanExecution,
  PlanOptimizer,
  PlanRecovery,
  PlanValidator,
  TaskGraph,
  TaskNode,
  ExecutionGraph,
  DependencyGraph,
  ExecutionCheckpoint,
  ExecutionTimeline,
} from './index';

describe('planning framework', () => {
  it('manages goal lifecycle and progress', async () => {
    const goal = new Goal({
      id: 'goal-1',
      definition: new GoalDefinition({
        id: 'goal-1',
        title: 'Deliver the platform',
        description: 'Complete core planning abstractions',
        priority: GoalPriority.High,
      }),
      context: new GoalContext({
        tenant: 'acme',
        policy: new GoalPolicy({ executionPolicy: 'safe' }),
      }),
    });

    expect(goal.getState().status).toBe(GoalLifecycle.Created);
    expect(goal.accept()).toBe(true);
    expect(goal.getState().status).toBe(GoalLifecycle.Accepted);

    goal.start();
    expect(goal.getState().status).toBe(GoalLifecycle.Executing);

    const tracker = new GoalTracker();
    tracker.updateProgress(0.25, 'Planning the work');
    tracker.addMilestone('design');
    goal.attachTracker(tracker);
    goal.updateProgress(0.25, 'Planning the work');

    const snapshot = goal.createSnapshot();
    expect(snapshot.progress).toBe(0.25);
    expect(snapshot.currentTask).toBe('Planning the work');
  });

  it('builds, validates, and optimizes hierarchical plans', () => {
    const builder = new PlanBuilder('plan-1');
    builder.addTask('root', 'Create plan', { kind: 'root' });
    builder.addTask('analysis', 'Analyze requirements', { kind: 'task' });
    builder.addTask('implementation', 'Implement work', { kind: 'task' });
    builder.addDependency('analysis', 'root');
    builder.addDependency('implementation', 'analysis');
    builder.setMetadata({ owner: 'platform' });

    const plan = builder.publish();
    const validator = new PlanValidator();
    const optimizer = new PlanOptimizer();

    expect(validator.validate(plan)).toEqual({ valid: true, issues: [] });
    const optimized = optimizer.optimize(plan);
    expect(optimized).toBeInstanceOf(Plan);
    expect(optimized.getDescriptor().id).toBe('plan-1');
    expect(optimized.getGraph().getTasks()).toHaveLength(3);
  });

  it('handles task graphs, dependency resolution, and checkpoints', () => {
    const graph = new TaskGraph();
    const root = new TaskNode({ id: 'root', name: 'Root' });
    const childA = new TaskNode({ id: 'child-a', name: 'Child A' });
    const childB = new TaskNode({ id: 'child-b', name: 'Child B' });
    graph.addNode(root);
    graph.addNode(childA);
    graph.addNode(childB);
    graph.addEdge('root', 'child-a');
    graph.addEdge('root', 'child-b');

    const dependencyGraph = new DependencyGraph();
    dependencyGraph.addDependency(new GoalDependency({ id: 'dep-1', dependsOn: 'goal-1' }));

    const executionGraph = new ExecutionGraph();
    executionGraph.addNode(root);
    executionGraph.addNode(childA);

    const checkpoint = new PlanCheckpoint({
      id: 'cp-1',
      planId: 'plan-1',
      checkpointType: 'manual',
    });
    const recovery = new PlanRecovery();
    recovery.addCheckpoint(checkpoint);
    expect(recovery.getCheckpoint('cp-1')).toBeDefined();

    const execution = new PlanExecution({
      plan: new Plan({ id: 'plan-1', descriptor: { id: 'plan-1', title: 'Execution' } as never }),
    });
    execution.addCheckpoint(checkpoint);
    expect(execution.getCheckpoints()).toHaveLength(1);

    const timeline = new ExecutionTimeline();
    timeline.record('checkpoint', 'cp-1');
    expect(timeline.getEvents()).toHaveLength(1);
  });

  it('supports recovery, replay, and replanning', () => {
    const plan = new PlanBuilder('plan-replan').addTask('task-1', 'Initial task').publish();
    const recovery = new PlanRecovery();
    recovery.addCheckpoint(
      new PlanCheckpoint({
        id: 'cp-1',
        planId: plan.getDescriptor().id,
        checkpointType: 'automatic',
      }),
    );

    const result = recovery.restore('cp-1');
    expect(result).toBeDefined();

    const execution = new PlanExecution({ plan });
    execution.replan({ reason: 'dependency changed' });
    expect(execution.getState().replanCount).toBe(1);

    const evaluator = new GoalEvaluator();
    const evaluation = evaluator.evaluate({
      success: true,
      progress: 1,
      blockedTasks: [],
      milestones: [],
      completion: 1,
    });
    expect(evaluation).toBeGreaterThan(0);
  });

  it('tracks registry and scheduler state safely', async () => {
    const registry = new GoalRegistry();
    const scheduler = new GoalScheduler();
    const goal = new Goal({
      id: 'goal-2',
      definition: new GoalDefinition({
        id: 'goal-2',
        title: 'Coordinate work',
        priority: GoalPriority.Medium,
      }),
      context: new GoalContext({ tenant: 'acme' }),
    });

    registry.register(goal);
    scheduler.schedule(goal);

    await Promise.all([
      Promise.resolve(registry.get('goal-2')),
      Promise.resolve(scheduler.getPending().length),
    ]);

    expect(registry.get('goal-2')).toBeDefined();
    expect(scheduler.getPending()).toHaveLength(1);
  });

  it('creates immutable snapshots and preserves checkpoint history', () => {
    const plan = new PlanBuilder('plan-snapshot').addTask('task-1', 'Snapshot task').publish();
    const snapshot = plan.createSnapshot();

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(snapshot.graph.getTasks()).toHaveLength(1);

    const checkpoint = new ExecutionCheckpoint({ id: 'exec-cp', label: 'baseline' });
    expect(checkpoint.label).toBe('baseline');
  });
});
