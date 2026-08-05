import { NextResponse } from 'next/server';

import { getAgentOrchestrator } from '../../../../lib/agent-orchestrator';

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as { workflowId?: unknown; reason?: unknown };
  if (typeof body.workflowId !== 'string') {
    return NextResponse.json({ error: 'workflowId is required.' }, { status: 400 });
  }

  try {
    const workflow = getAgentOrchestrator().cancel(
      body.workflowId,
      typeof body.reason === 'string' ? body.reason : undefined,
    );
    return NextResponse.json({ workflow });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to cancel workflow.' },
      { status: 400 },
    );
  }
}
