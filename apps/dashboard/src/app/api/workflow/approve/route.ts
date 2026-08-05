import { NextResponse } from 'next/server';
import { getAgentOrchestrator } from '../../../../lib/agent-orchestrator';

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as {
    workflowId?: unknown;
    actorId?: unknown;
    reason?: unknown;
  };
  if (typeof body.workflowId !== 'string') {
    return NextResponse.json({ error: 'workflowId is required.' }, { status: 400 });
  }

  try {
    const result = await getAgentOrchestrator().approve(
      body.workflowId,
      typeof body.actorId === 'string' ? body.actorId : 'system',
      typeof body.reason === 'string' ? body.reason : undefined,
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to approve workflow.' },
      { status: 400 },
    );
  }
}
