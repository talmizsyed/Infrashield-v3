import { NextResponse } from 'next/server';
import { getAgentRuntime } from '../../../../lib/agent-runtime';

interface AgentRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_: Request, { params }: AgentRouteContext): Promise<NextResponse> {
  const { id } = await params;
  const agent = getAgentRuntime().registry.get(id);
  if (!agent) return NextResponse.json({ error: 'Agent not found.' }, { status: 404 });
  return NextResponse.json(agent);
}
