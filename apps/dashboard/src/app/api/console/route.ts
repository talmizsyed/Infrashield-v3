import { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    summary: {
      status: 'healthy',
      uptime: '99.98%',
      activeAgents: 18,
      workflowRuns: 42,
      approvalsPending: 6,
      providersHealthy: 6,
    },
    alerts: [
      {
        id: 'alert-1',
        severity: 'high',
        title: 'Approval queue backlog',
        message: '3 approvals are pending review above the target threshold.',
      },
      {
        id: 'alert-2',
        severity: 'medium',
        title: 'Provider latency spike',
        message: 'Gemini response latency climbed 18% over the last 15 minutes.',
      },
    ],
    providers: [
      { name: 'OpenAI', health: 'healthy', latency: '132ms', tokens: '12.4M' },
      { name: 'Anthropic', health: 'healthy', latency: '118ms', tokens: '9.6M' },
      { name: 'Gemini', health: 'degraded', latency: '196ms', tokens: '7.1M' },
      { name: 'Groq', health: 'healthy', latency: '94ms', tokens: '11.2M' },
      { name: 'Kimi', health: 'healthy', latency: '108ms', tokens: '8.5M' },
      { name: 'Ollama', health: 'healthy', latency: '87ms', tokens: '2.3M' },
    ],
  });
}
