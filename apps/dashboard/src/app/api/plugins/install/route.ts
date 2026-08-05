import { NextResponse } from 'next/server';
import { getPluginManager } from '../../../../lib/plugin-manager';

type PluginConfiguration = Record<string, string | number | boolean>;

function isPluginConfiguration(value: unknown): value is PluginConfiguration {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as { id?: unknown; configuration?: unknown };
  if (typeof body.id !== 'string') {
    return NextResponse.json({ error: 'Plugin id is required.' }, { status: 400 });
  }

  try {
    const plugin = getPluginManager().install(
      body.id,
      isPluginConfiguration(body.configuration) ? body.configuration : {},
    );
    return NextResponse.json(plugin, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to install plugin.' },
      { status: 400 },
    );
  }
}
