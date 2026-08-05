import { describe, expect, it } from 'vitest';

import {
  AgentOrchestrator,
  ApprovalMode,
  ApprovalRequiredException,
  createDefaultAgentExecutor,
  CycleDetector,
  ExecutionGraph,
  DependencyResolver,
  ExecutionPlanner,
  ExecutionState,
  GraphValidator,
  GraphValidationException,
  NodeExecutionMode,
  OrchestrationStatus,
  ScheduleTrigger,
} from './index.js';

describe('ExecutionGraph', () => {
  it('validates DAG dependencies and detects cycles', () => {
    const validGraph = new ExecutionGraph({
      id: 'graph-1',
      name: 'Sequential chain',
      nodes: [
        { id: 'agent-a', agentId: 'infra-agent' },
        { id: 'agent-b', agentId: 'security-agent', dependsOn: ['agent-a'] },
        { id: 'agent-c', agentId: 'ops-agent', dependsOn: ['agent-b'] },
      ],
    });
    expect(() => validGraph.validate()).not.toThrow();

    expect(
      () =>
        new ExecutionGraph({
          id: 'graph-cycle',
          name: 'Cycle',
          nodes: [
            { id: 'a', agentId: 'agent-1', dependsOn: ['c'] },
            { id: 'b', agentId: 'agent-2', dependsOn: ['a'] },
            { id: 'c', agentId: 'agent-3', dependsOn: ['b'] },
          ],
        }),
    ).toThrow(GraphValidationException);
  });

  it('resolves dependency order and parallel groups for fan-out and fan-in', () => {
    const graph = new ExecutionGraph({
      id: 'graph-3',
      name: 'Fan out and join',
      nodes: [
        { id: 'root', agentId: 'planner-agent' },
        {
          id: 'branch-a',
          agentId: 'agent-a',
          dependsOn: ['root'],
          mode: NodeExecutionMode.Parallel,
        },
        {
          id: 'branch-b',
          agentId: 'agent-b',
          dependsOn: ['root'],
          mode: NodeExecutionMode.FanOut,
        },
        {
          id: 'join',
          agentId: 'join-agent',
          dependsOn: ['branch-a', 'branch-b'],
          mode: NodeExecutionMode.FanIn,
        },
      ],
    });

    expect(graph.getTopologicalOrder()).toEqual(['root', 'branch-a', 'branch-b', 'join']);
    expect(graph.getParallelGroups()).toContainEqual(['branch-a', 'branch-b']);
  });
});

describe('Execution graph engine helpers', () => {
  it('detects cycles and validates graph structure', () => {
    const cycleDetector = new CycleDetector();
    expect(
      cycleDetector.detect([
        { id: 'a', dependsOn: ['c'] },
        { id: 'b', dependsOn: ['a'] },
        { id: 'c', dependsOn: ['b'] },
      ]),
    ).toBeDefined();

    const resolver = new DependencyResolver();
    const resolution = resolver.resolve([
      { id: 'root', dependsOn: [], mode: NodeExecutionMode.Sequential },
      { id: 'branch', dependsOn: ['root'], mode: NodeExecutionMode.Parallel },
      { id: 'join', dependsOn: ['branch'], mode: NodeExecutionMode.FanIn },
    ]);

    expect(resolution.topologicalOrder).toEqual(['root', 'branch', 'join']);
    expect(resolution.dependencyMap.branch).toEqual(['root']);
    expect(resolution.parallelGroups).toContainEqual(['branch']);

    const validator = new GraphValidator();
    expect(() =>
      validator.validateDefinition({
        id: 'graph-4',
        name: 'Validated graph',
        nodes: [{ id: 'single', agentId: 'agent-1' }],
      }),
    ).not.toThrow();
  });
});

describe('ExecutionPlanner', () => {
  it('produces topological order for dependency chain', () => {
    const graph = new ExecutionGraph({
      id: 'graph-2',
      name: 'Chain',
      nodes: [
        { id: 'agent-a', agentId: 'infra-agent' },
        { id: 'agent-b', agentId: 'security-agent', dependsOn: ['agent-a'] },
        { id: 'agent-c', agentId: 'ops-agent', dependsOn: ['agent-b'] },
      ],
    });
    const planner = new ExecutionPlanner();
    const plan = planner.plan({ workflowId: 'wf-1', graph });

    expect(plan.topologicalOrder).toEqual(['agent-a', 'agent-b', 'agent-c']);
    expect(plan.entryNodeId).toBe('agent-a');
    expect(plan.exitNodeId).toBe('agent-c');
  });
});

describe('ExecutionState', () => {
  it('tracks status history across transitions', () => {
    const state = new ExecutionState({ status: OrchestrationStatus.Pending });

    expect(state.status).toBe(OrchestrationStatus.Pending);
    expect(state.history).toEqual([OrchestrationStatus.Pending]);

    const nextState = state.transition(OrchestrationStatus.Running);

    expect(nextState.status).toBe(OrchestrationStatus.Running);
    expect(nextState.history).toEqual([OrchestrationStatus.Pending, OrchestrationStatus.Running]);
  });
});

describe('AgentOrchestrator', () => {
  const baseGraph = {
    id: 'orchestration-1',
    name: 'Infrastructure pipeline',
    nodes: [
      { id: 'agent-a', agentId: 'infra-agent' },
      { id: 'agent-b', agentId: 'security-agent', dependsOn: ['agent-a'] },
      { id: 'agent-c', agentId: 'ops-agent', dependsOn: ['agent-b'] },
    ],
  };

  it('plans workflow execution graphs', () => {
    const orchestrator = new AgentOrchestrator(createDefaultAgentExecutor());
    const plan = orchestrator.plan({ graph: baseGraph });

    expect(plan.validated).toBe(true);
    expect(plan.topologicalOrder).toEqual(['agent-a', 'agent-b', 'agent-c']);
  });

  it('runs sequential agent dependencies', async () => {
    const executionOrder: string[] = [];
    const orchestrator = new AgentOrchestrator(async (agentId) => {
      executionOrder.push(agentId);
      return { agentId, ok: true };
    });

    const result = await orchestrator.run({
      graph: baseGraph,
      approval: { mode: ApprovalMode.Auto, approvers: ['admin'] },
    });

    expect(result.status).toBe(OrchestrationStatus.Completed);
    expect(result.nodeResults).toHaveLength(3);
    expect(executionOrder).toEqual(['infra-agent', 'security-agent', 'ops-agent']);
  });

  it('supports parallel fan-out execution', async () => {
    const orchestrator = new AgentOrchestrator(createDefaultAgentExecutor());
    const result = await orchestrator.run({
      graph: {
        id: 'parallel-graph',
        name: 'Parallel',
        nodes: [
          { id: 'root', agentId: 'planner-agent' },
          {
            id: 'branch-a',
            agentId: 'agent-a',
            dependsOn: ['root'],
            mode: NodeExecutionMode.Parallel,
          },
          {
            id: 'branch-b',
            agentId: 'agent-b',
            dependsOn: ['root'],
            mode: NodeExecutionMode.Parallel,
          },
        ],
      },
      approval: { mode: ApprovalMode.Auto },
    });

    expect(result.status).toBe(OrchestrationStatus.Completed);
    expect(result.nodeResults).toHaveLength(3);
  });

  it('requires manual approval when configured', async () => {
    const orchestrator = new AgentOrchestrator(createDefaultAgentExecutor());

    await expect(
      orchestrator.run({
        graph: baseGraph,
        approval: {
          mode: ApprovalMode.Manual,
          approvers: ['reviewer'],
          requestorId: 'operator',
        },
      }),
    ).rejects.toThrow(ApprovalRequiredException);
  });

  it('approves and resumes queued workflows', async () => {
    const orchestrator = new AgentOrchestrator(createDefaultAgentExecutor());

    let workflowId: string | undefined;
    try {
      await orchestrator.run({
        graph: baseGraph,
        approval: {
          mode: ApprovalMode.Manual,
          approvers: ['reviewer'],
          requestorId: 'operator',
        },
      });
    } catch (error) {
      if (error instanceof ApprovalRequiredException) {
        workflowId = error.workflowId;
      }
    }

    expect(workflowId).toBeDefined();
    const result = await orchestrator.approve(workflowId!, 'reviewer');
    expect(result.status).toBe(OrchestrationStatus.Completed);
  });

  it('queues scheduled workflows without immediate execution', async () => {
    const orchestrator = new AgentOrchestrator(createDefaultAgentExecutor());
    const result = await orchestrator.run({
      graph: baseGraph,
      schedule: {
        trigger: ScheduleTrigger.Scheduled,
        scheduledAt: new Date(Date.now() + 60_000).toISOString(),
      },
      approval: { mode: ApprovalMode.Auto },
    });

    expect(result.status).toBe(OrchestrationStatus.Queued);
    expect(orchestrator.getStatistics().queuedExecutions).toBeGreaterThan(0);
  });

  it('retries failed workflows', async () => {
    let attempts = 0;
    const orchestrator = new AgentOrchestrator(async (agentId) => {
      attempts += 1;
      if (agentId === 'security-agent' && attempts === 1) {
        throw new Error('Transient failure');
      }
      return { agentId, ok: true };
    });

    const firstRun = await orchestrator.run({
      graph: {
        ...baseGraph,
        nodes: baseGraph.nodes.map((node) => ({
          ...node,
          retry: { maxAttempts: 1 },
        })),
      },
      approval: { mode: ApprovalMode.Auto },
    });

    if (firstRun.status === OrchestrationStatus.Failed) {
      const retryResult = await orchestrator.retry(firstRun.workflowId);
      expect(retryResult.status).toBe(OrchestrationStatus.Completed);
    } else {
      expect(firstRun.status).toBe(OrchestrationStatus.Completed);
    }
  });

  it('exposes workflow list, detail, history, and statistics', async () => {
    const orchestrator = new AgentOrchestrator(createDefaultAgentExecutor());
    const result = await orchestrator.run({
      graph: baseGraph,
      approval: { mode: ApprovalMode.Auto },
    });

    expect(orchestrator.list().length).toBeGreaterThan(0);
    expect(orchestrator.get(result.workflowId).status).toBe(OrchestrationStatus.Completed);
    expect(orchestrator.getHistory(result.workflowId).length).toBeGreaterThan(0);

    const stats = orchestrator.getStatistics();
    expect(stats.completedExecutions).toBeGreaterThan(0);
    expect(stats.workflowStatus.length).toBeGreaterThan(0);
  });
});
