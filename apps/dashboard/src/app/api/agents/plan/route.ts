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
    const runtime = getAgentRuntime();
    const session = runtime.initialize(
      body.id,
      body.goal,
      isExecutionMode(body.mode) ? body.mode : 'interactive',
    );
    const validated = runtime.validate(session.id);
    if (validated.state !== 'validated') {
      return NextResponse.json(
        { session: validated, error: 'Agent requires approval.' },
        { status: 202 },
      );
    }
    return NextResponse.json({
      session: runtime.observe(session.id),
      plan: runtime.plan(session.id),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to plan agent execution.' },
      { status: 400 },
    );
  }
}
