import type { OrchestrationRunRequest } from '@infrashield/agent-orchestrator';
import { NextResponse } from 'next/server';

import { getAgentOrchestrator } from '../../../../lib/agent-orchestrator';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as OrchestrationRunRequest;
    if (!body.graph?.id || !body.graph?.nodes?.length) {
      return NextResponse.json(
        { error: 'Workflow graph id and nodes are required.' },
        { status: 400 },
      );
    }

    const result = await getAgentOrchestrator().run(body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.name === 'ApprovalRequiredException') {
      const workflowId = (error as Error & { workflowId?: string }).workflowId;
      return NextResponse.json(
        { error: error.message, workflowId, status: 'awaiting-approval' },
        { status: 202 },
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to run workflow.' },
      { status: 400 },
    );
  }
}
