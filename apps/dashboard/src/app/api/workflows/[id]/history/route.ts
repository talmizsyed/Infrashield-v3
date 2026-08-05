import { NextResponse } from 'next/server';

import { getAgentOrchestrator } from '../../../../../lib/agent-orchestrator';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;

  try {
    const orchestrator = getAgentOrchestrator();
    const workflow = orchestrator.get(id);

    return NextResponse.json({
      workflowId: id,
      status: workflow.status,
      history: orchestrator.getHistory(id),
      audit: orchestrator.getAudit().getWorkflowEntries(id),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Workflow not found.' },
      { status: 404 },
    );
  }
}
