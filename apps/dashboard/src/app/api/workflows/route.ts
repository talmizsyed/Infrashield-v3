import { NextResponse } from 'next/server';

import { getAgentOrchestrator } from '../../../lib/agent-orchestrator';

export async function GET(): Promise<NextResponse> {
  const orchestrator = getAgentOrchestrator();

  return NextResponse.json({
    workflows: orchestrator.list(),
    statistics: orchestrator.getStatistics(),
  });
}
