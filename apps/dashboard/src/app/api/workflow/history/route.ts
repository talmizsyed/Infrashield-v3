import { NextResponse } from 'next/server';
import { getAgentOrchestrator } from '../../../../lib/agent-orchestrator';

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const workflowId = searchParams.get('workflowId') ?? undefined;
  const orchestrator = getAgentOrchestrator();

  return NextResponse.json({
    history: orchestrator.getHistory(workflowId),
    audit: workflowId
      ? orchestrator.getAudit().getWorkflowEntries(workflowId)
      : orchestrator.getAudit().getEntries(),
  });
}
