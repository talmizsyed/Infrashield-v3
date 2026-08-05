import { NextResponse } from 'next/server';
import type { OrchestrationRunRequest } from '@infrashield/agent-orchestrator';
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

    const plan = getAgentOrchestrator().plan(body);
    return NextResponse.json(plan);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to plan workflow.' },
      { status: 400 },
    );
  }
}
