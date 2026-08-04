import { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    activeAgents: 18,
    runningWorkflows: 42,
    llmProviders: 6,
    promptExecutions: 18426,
    aiResponseTime: 196,
    agentActivity: [
      { label: '08:00', active: 11 },
      { label: '10:00', active: 14 },
      { label: '12:00', active: 18 },
      { label: '14:00', active: 16 },
      { label: '16:00', active: 20 },
      { label: '18:00', active: 18 },
    ],
  });
}
