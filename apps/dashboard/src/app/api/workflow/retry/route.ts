import { NextResponse } from 'next/server';
import { getAgentOrchestrator } from '../../../../lib/agent-orchestrator';

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as { workflowId?: unknown };
  if (typeof body.workflowId !== 'string') {
    return NextResponse.json({ error: 'workflowId is required.' }, { status: 400 });
  }

  try {
    const result = await getAgentOrchestrator().retry(body.workflowId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to retry workflow.' },
      { status: 400 },
    );
  }
}
