import { OrchestrationStatus } from '@infrashield/agent-orchestrator';

import { getAgentOrchestrator } from '../lib/agent-orchestrator';

type SchedulerHealthStatus = 'healthy' | 'warning' | 'degraded';

function formatStatusName(status: string): string {
  return status
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getSchedulerHealth(options: {
  readonly activeExecutions: number;
  readonly queueDepth: number;
  readonly failedExecutions: number;
}): { readonly status: SchedulerHealthStatus; readonly detail: string } {
  if (options.failedExecutions > 0) {
    return {
      status: 'degraded',
      detail: `${options.failedExecutions} failed execution${options.failedExecutions === 1 ? '' : 's'} detected.`,
    };
  }

  if (options.queueDepth > 0) {
    return {
      status: 'warning',
      detail: `${options.queueDepth} execution${options.queueDepth === 1 ? '' : 's'} waiting in queue.`,
    };
  }

  if (options.activeExecutions > 0) {
    return {
      status: 'healthy',
      detail: `${options.activeExecutions} active execution${options.activeExecutions === 1 ? '' : 's'} currently progressing.`,
    };
  }

  return {
    status: 'healthy',
    detail: 'Scheduler is idle and ready for new work.',
  };
}

export interface RuntimeDashboardData {
  readonly activeExecutions: number;
  readonly runningExecutions: number;
  readonly runningAgents: number;
  readonly queueDepth: number;
  readonly failedExecutions: number;
  readonly averageExecutionDuration: number;
  readonly schedulerHealth: {
    readonly status: SchedulerHealthStatus;
    readonly detail: string;
  };
  readonly workflowStatus: readonly { readonly name: string; readonly value: number }[];
  readonly recentExecutions: readonly {
    readonly workflowId: string;
    readonly status: string;
    readonly updatedAt: string;
    readonly durationMs: number | null;
    readonly completedNodes: number;
    readonly failedNodes: number;
    readonly pendingNodes: number;
  }[];
}

export function getRuntimeDashboardData(): RuntimeDashboardData {
  const orchestrator = getAgentOrchestrator();
  const workflows = orchestrator.list();
  const stats = orchestrator.getStatistics();
  const stateStore = orchestrator.getStateStore();

  const activeStatuses = new Set<string>([
    OrchestrationStatus.Pending,
    OrchestrationStatus.Planned,
    OrchestrationStatus.AwaitingApproval,
    OrchestrationStatus.Queued,
    OrchestrationStatus.Scheduled,
    OrchestrationStatus.Running,
    OrchestrationStatus.Paused,
    OrchestrationStatus.Retrying,
  ]);

  const activeWorkflows = workflows.filter((workflow) => activeStatuses.has(workflow.status));
  const runningAgents = new Set<string>();

  for (const workflow of activeWorkflows) {
    const request = stateStore.getRequest(workflow.workflowId);
    for (const node of request?.graph.nodes ?? []) {
      runningAgents.add(node.agentId);
    }
  }

  const recentExecutions = [...workflows]
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, 5)
    .map((workflow) => {
      const result = stateStore.getResult(workflow.workflowId);
      const durationMs =
        result?.completedAt !== undefined
          ? Date.parse(result.completedAt) - Date.parse(result.startedAt)
          : workflow.status === OrchestrationStatus.Running
            ? Date.parse(workflow.updatedAt) - Date.parse(workflow.createdAt)
            : null;

      return {
        workflowId: workflow.workflowId,
        status: workflow.status,
        updatedAt: workflow.updatedAt,
        durationMs,
        completedNodes: workflow.completedNodeIds.length,
        failedNodes: workflow.failedNodeIds.length,
        pendingNodes: workflow.pendingNodeIds.length,
      };
    });

  return {
    activeExecutions: activeWorkflows.length,
    runningExecutions: stats.runningExecutions,
    runningAgents: runningAgents.size,
    queueDepth: stats.queuedExecutions,
    failedExecutions: stats.failedExecutions,
    averageExecutionDuration: stats.averageLatencyMs,
    schedulerHealth: getSchedulerHealth({
      activeExecutions: activeWorkflows.length,
      queueDepth: stats.queuedExecutions,
      failedExecutions: stats.failedExecutions,
    }),
    workflowStatus: stats.workflowStatus.map((entry) => ({
      name: formatStatusName(entry.name.toLowerCase().replace(/\s+/g, '-')),
      value: entry.value,
    })),
    recentExecutions,
  };
}
