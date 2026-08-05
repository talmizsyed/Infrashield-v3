import { NextResponse } from 'next/server';

import { getRuntimeDashboardData } from '../../../../services/runtime-dashboard-service';

export async function GET(): Promise<NextResponse> {
  const runtime = getRuntimeDashboardData();

  return NextResponse.json({
    activeAgents: runtime.runningAgents,
    runningWorkflows: runtime.activeExecutions,
    llmProviders: 6,
    promptExecutions: 18426,
    aiResponseTime: 196,
    agentActivity: runtime.recentExecutions
      .slice()
      .reverse()
      .map((execution) => ({
        label: new Date(execution.updatedAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        active: execution.completedNodes + execution.pendingNodes,
      })),
  });
}
