import { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    clusters: 3,
    namespaces: 42,
    projects: 14,
    pods: 184,
    nodes: 28,
    operators: 27,
    alerts: 2,
  });
}
