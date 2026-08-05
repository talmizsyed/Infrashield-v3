import { NextResponse } from 'next/server';
import { getPluginManager } from '../../../lib/plugin-manager';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ plugins: getPluginManager().pluginRegistry.list() });
}
