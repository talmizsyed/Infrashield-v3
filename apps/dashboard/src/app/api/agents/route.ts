import { NextResponse } from 'next/server';
import { getAgentRuntime } from '../../../lib/agent-runtime';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ agents: getAgentRuntime().registry.list() });
}
