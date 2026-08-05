import { NextResponse } from 'next/server';
import { getAgentRuntime } from '../../../../../lib/agent-runtime';

interface AgentStatusRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_: Request, { params }: AgentStatusRouteContext): Promise<NextResponse> {
  const { id } = await params;
  try {
    return NextResponse.json(getAgentRuntime().observe(id));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Agent session not found.' },
      { status: 404 },
    );
  }
}
