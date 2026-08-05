import { NextResponse } from 'next/server';
import { getPluginManager } from '../../../../lib/plugin-manager';

interface PluginRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_: Request, { params }: PluginRouteContext): Promise<NextResponse> {
  const { id } = await params;
  const plugin = getPluginManager().pluginRegistry.get(id);

  if (!plugin) return NextResponse.json({ error: 'Plugin not found.' }, { status: 404 });

  return NextResponse.json(plugin);
}

export async function DELETE(_: Request, { params }: PluginRouteContext): Promise<NextResponse> {
  const { id } = await params;
  const manager = getPluginManager();

  if (!manager.pluginRegistry.get(id)) {
    return NextResponse.json({ error: 'Plugin not found.' }, { status: 404 });
  }

  manager.remove(id);
  return new NextResponse(null, { status: 204 });
}
