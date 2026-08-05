import { NextResponse } from 'next/server';
import type { ExecutionMode } from '@infrashield/agent-runtime';
import { getAgentRuntime } from '../../../../lib/agent-runtime';

function isExecutionMode(value: unknown): value is ExecutionMode {
  return (
    value === 'interactive' ||
    value === 'background' ||
    value === 'scheduled' ||
    value === 'event-driven'
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as { id?: unknown; goal?: unknown; mode?: unknown };
  if (typeof body.id !== 'string' || typeof body.goal !== 'string') {
    return NextResponse.json({ error: 'Agent id and goal are required.' }, { status: 400 });
  }

  try {
    return NextResponse.json(
      getAgentRuntime().run(
        body.id,
        body.goal,
        isExecutionMode(body.mode) ? body.mode : 'interactive',
      ),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to run agent.' },
      { status: 400 },
    );
  }
}
