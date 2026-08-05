import { NextResponse } from 'next/server';
import { getPluginManager } from '../../../../lib/plugin-manager';

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as { id?: unknown };
  if (typeof body.id !== 'string') {
    return NextResponse.json({ error: 'Plugin id is required.' }, { status: 400 });
  }

  try {
    return NextResponse.json(getPluginManager().disable(body.id));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to disable plugin.' },
      { status: 400 },
    );
  }
}
