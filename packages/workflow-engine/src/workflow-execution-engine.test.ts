import { describe, expect, it } from 'vitest';

import type { IEvent, IEventBus } from '@infrashield/core-infrastructure';
import {
  ExecutionMode,
  ExecutionPriority,
  ExecutionStatus,
  type IRuntime,
  type IRuntimeContext,
  type IRuntimeExecution,
  type RuntimeExecutionDefinitionOptions,
} from '@infrashield/runtime';

import {
  WorkflowEdge,
  WorkflowExecutionCoordinator,
  WorkflowExecutionEngine,
  WorkflowExecutionPlanner,
  WorkflowExecutionState,
  WorkflowGraphValidationException,
  WorkflowStepBuilder,
  WorkflowGraph,
} from './workflow-execution-engine.js';
import { WorkflowBuilder } from './workflow-foundation.js';

class TestRuntimeExecution implements IRuntimeExecution {
  public readonly id: string;
  public readonly owner: { id: string; type: string; name?: string };
  public readonly correlationId: string;
  public readonly priority: ExecutionPriority;
  public readonly mode: ExecutionMode;
  public readonly metadata: Readonly<Record<string, unknown>>;
  public readonly context: IRuntimeContext;
  public readonly createdAt: string;
  public status: ExecutionStatus = ExecutionStatus.Created;
  public history: ExecutionStatus[] = [ExecutionStatus.Created];
  public result?: IRuntimeExecution['result'];
  public error?: Exclude<Parameters<IRuntimeExecution['fail']>[0], string>;

  public constructor(options: RuntimeExecutionDefinitionOptions) {
    this.id = options.id;
    this.owner = options.owner;
    this.correlationId = options.correlationId;
    this.priority = options.priority ?? ExecutionPriority.Normal;
    this.mode = options.mode ?? ExecutionMode.Async;
    this.metadata = Object.freeze({ ...(options.metadata ?? {}) });
    this.context = {
      executionId: options.id,
      correlationId: options.correlationId,
      metadata: this.metadata,
      createdAt: new Date().toISOString(),
    };
    this.createdAt = this.context.createdAt;
  }

  public async queue(): Promise<void> {
    this.status = ExecutionStatus.Queued;
    this.history = [...this.history, ExecutionStatus.Queued];
  }

  public async start(): Promise<void> {
    this.status = ExecutionStatus.Running;
    this.history = [...this.history, ExecutionStatus.Running];
  }

  public async complete(result: Parameters<IRuntimeExecution['complete']>[0]): Promise<void> {
    this.result =
      typeof result === 'object' && 'status' in result
        ? (result as NonNullable<IRuntimeExecution['result']>)
        : ({
            status: ExecutionStatus.Completed,
            metadata: result,
          } as NonNullable<IRuntimeExecution['result']>);
    this.status = ExecutionStatus.Completed;
    this.history = [...this.history, ExecutionStatus.Completed];
  }

  public async fail(error: Parameters<IRuntimeExecution['fail']>[0]): Promise<void> {
    this.error =
      typeof error === 'string'
        ? { code: 'runtime.failed', message: error, timestamp: new Date().toISOString() }
        : error;
    this.status = ExecutionStatus.Failed;
    this.history = [...this.history, ExecutionStatus.Failed];
  }

  public async cancel(reason?: string): Promise<void> {
    this.status = ExecutionStatus.Cancelled;
    this.history = [...this.history, ExecutionStatus.Cancelled];
    this.error = {
      code: 'runtime.cancelled',
      message: reason ?? 'cancelled',
      timestamp: new Date().toISOString(),
    };
  }

  public async timeout(reason?: string): Promise<void> {
    this.status = ExecutionStatus.TimedOut;
    this.history = [...this.history, ExecutionStatus.TimedOut];
    this.error = {
      code: 'runtime.timedOut',
      message: reason ?? 'timed out',
      timestamp: new Date().toISOString(),
    };
  }

  public snapshot(): ReturnType<IRuntimeExecution['snapshot']> {
    return {
      snapshotId: `snapshot-${this.id}`,
      executionId: this.id,
      status: this.status,
      timestamp: new Date().toISOString(),
      metadata: this.metadata,
      duration: { startedAt: this.createdAt },
      result: this.result,
      error: this.error,
    };
  }
}

class TestRuntime implements IRuntime {
  public readonly id = 'runtime-1';
  public readonly name = 'test-runtime';
  public readonly version = { major: 1, minor: 0, patch: 0 };
  public readonly metrics = {
    recordQueued: () => undefined,
    recordCompleted: () => undefined,
    recordFailed: () => undefined,
    recordCancelled: () => undefined,
    recordTimedOut: () => undefined,
    recordCheckpoint: () => undefined,
    recordTimeout: () => undefined,
    recordCancellation: () => undefined,
    recordPipelineDuration: () => undefined,
    recordMiddlewareDuration: () => undefined,
    recordSchedulerLatency: () => undefined,
    recordWorkerUtilization: () => undefined,
    recordConcurrentExecution: () => undefined,
    recordThroughput: () => undefined,
    snapshot: () => ({}) as never,
  };
  public readonly executions: TestRuntimeExecution[] = [];

  public createExecution(options: RuntimeExecutionDefinitionOptions): IRuntimeExecution {
    const execution = new TestRuntimeExecution(options);
    this.executions.push(execution);
    return execution;
  }

  public async start(): Promise<void> {
    return undefined;
  }

  public async stop(): Promise<void> {
    return undefined;
  }
}

class TestEventBus implements IEventBus {
  public readonly events: IEvent[] = [];

  public async publish(event: IEvent): Promise<void> {
    this.events.push(event);
  }

  public subscribe(): void {
    return undefined;
  }
}

describe('workflow execution engine', () => {
  it('plans workflow steps deterministically and exposes ready nodes', () => {
    const definition = new WorkflowBuilder()
      .withId('workflow-plan')
      .withName('Planner workflow')
      .withOwner('ops')
      .withCorrelationId('corr-plan')
      .withVersion('1.0.0')
      .withMetadata({ source: 'tests' })
      .withTags(['test'])
      .build();

    const start = new WorkflowStepBuilder()
      .withId('start')
      .withName('Start')
      .withVersion('1.0.0')
      .build();
    const validate = new WorkflowStepBuilder()
      .withId('validate')
      .withName('Validate')
      .withVersion('1.0.0')
      .withDependencies(['start'])
      .build();
    const end = new WorkflowStepBuilder()
      .withId('end')
      .withName('End')
      .withVersion('1.0.0')
      .withDependencies(['validate'])
      .build();

    const graph = new WorkflowGraph({
      id: 'graph-1',
      name: 'Execution graph',
      version: '1.0.0',
      steps: [start, validate, end],
      entryNodeId: start.id.toString(),
      exitNodeId: end.id.toString(),
      edges: [
        new WorkflowEdge({
          id: 'edge-start-validate',
          sourceId: start.id.toString(),
          targetId: validate.id.toString(),
        }),
        new WorkflowEdge({
          id: 'edge-validate-end',
          sourceId: validate.id.toString(),
          targetId: end.id.toString(),
        }),
      ],
    });

    const planner = new WorkflowExecutionPlanner();
    const plan = planner.plan({ definition, graph });

    expect(plan.topologicalOrder).toEqual(['start', 'validate', 'end']);
    expect(plan.entryNodeId).toBe('start');
    expect(plan.exitNodeId).toBe('end');
    expect(plan.readyNodeIds).toEqual(['start']);
    expect(plan.metadata.workflowId).toBe('workflow-plan');
  });

  it('rejects cyclic graphs during planning', () => {
    const definition = new WorkflowBuilder()
      .withId('workflow-cycle')
      .withName('Cycle workflow')
      .withOwner('ops')
      .withCorrelationId('corr-cycle')
      .withVersion('1.0.0')
      .withMetadata({ source: 'tests' })
      .withTags(['test'])
      .build();

    const start = new WorkflowStepBuilder().withId('a').withName('A').withVersion('1.0.0').build();
    const end = new WorkflowStepBuilder().withId('b').withName('B').withVersion('1.0.0').build();

    const graph = new WorkflowGraph({
      id: 'graph-cycle',
      name: 'Cycle graph',
      version: '1.0.0',
      steps: [start, end],
      entryNodeId: start.id.toString(),
      exitNodeId: end.id.toString(),
      edges: [
        new WorkflowEdge({ id: 'edge-a-b', sourceId: 'a', targetId: 'b' }),
        new WorkflowEdge({ id: 'edge-b-a', sourceId: 'b', targetId: 'a' }),
      ],
    });

    const planner = new WorkflowExecutionPlanner();
    expect(() => planner.plan({ definition, graph })).toThrow(WorkflowGraphValidationException);
  });

  it('delegates execution to the runtime and advances the cursor deterministically', async () => {
    const runtime = new TestRuntime();
    const eventBus = new TestEventBus();
    const definition = new WorkflowBuilder()
      .withId('workflow-run')
      .withName('Execution workflow')
      .withOwner('ops')
      .withCorrelationId('corr-run')
      .withVersion('1.0.0')
      .withMetadata({ source: 'tests' })
      .withTags(['test'])
      .build();

    const start = new WorkflowStepBuilder()
      .withId('start')
      .withName('Start')
      .withVersion('1.0.0')
      .build();
    const middle = new WorkflowStepBuilder()
      .withId('middle')
      .withName('Middle')
      .withVersion('1.0.0')
      .withDependencies(['start'])
      .build();
    const end = new WorkflowStepBuilder()
      .withId('end')
      .withName('End')
      .withVersion('1.0.0')
      .withDependencies(['middle'])
      .build();

    const graph = new WorkflowGraph({
      id: 'graph-run',
      name: 'Run graph',
      version: '1.0.0',
      steps: [start, middle, end],
      entryNodeId: start.id.toString(),
      exitNodeId: end.id.toString(),
      edges: [
        new WorkflowEdge({
          id: 'edge-start-middle',
          sourceId: start.id.toString(),
          targetId: middle.id.toString(),
        }),
        new WorkflowEdge({
          id: 'edge-middle-end',
          sourceId: middle.id.toString(),
          targetId: end.id.toString(),
        }),
      ],
    });

    const planner = new WorkflowExecutionPlanner();
    planner.plan({ definition, graph });
    const coordinator = new WorkflowExecutionCoordinator({ runtime, eventBus });
    const engine = new WorkflowExecutionEngine({ planner, coordinator });

    const result = await engine.execute({ definition, graph });

    expect(result.status).toBe(WorkflowExecutionState.Completed);
    expect(result.snapshot.state).toBe(WorkflowExecutionState.Completed);
    expect(result.snapshot.cursor.completedNodeIds).toEqual(['start', 'middle', 'end']);
    expect(runtime.executions).toHaveLength(3);
    expect(eventBus.events.some((event) => event.eventType === 'workflow.completed')).toBe(true);
  });
});
