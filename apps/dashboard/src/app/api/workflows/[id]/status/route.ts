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
    const result = orchestrator.getStateStore().getResult(id);

    return NextResponse.json({
      workflowId: id,
      status: workflow.status,
      workflow,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Workflow not found.' },
      { status: 404 },
    );
  }
}
