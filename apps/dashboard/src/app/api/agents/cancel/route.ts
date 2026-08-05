import { NextResponse } from 'next/server';
import { getAgentRuntime } from '../../../../lib/agent-runtime';

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as { sessionId?: unknown };
  if (typeof body.sessionId !== 'string') {
    return NextResponse.json({ error: 'Session id is required.' }, { status: 400 });
  }

  try {
    return NextResponse.json(getAgentRuntime().cancel(body.sessionId));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to cancel agent session.' },
      { status: 400 },
    );
  }
}
