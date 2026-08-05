import { NextResponse } from 'next/server';
import { getAgentOrchestrator } from '../../../../lib/agent-orchestrator';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;

  try {
    const workflow = getAgentOrchestrator().get(id);
    const result = getAgentOrchestrator().getStateStore().getResult(id);
    const output = getAgentOrchestrator().getStateStore().getOutput(id);
    return NextResponse.json({ workflow, result, output });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Workflow not found.' },
      { status: 404 },
    );
  }
}
