import { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    clusters: 3,
    namespaces: 42,
    projects: 14,
    pods: 184,
    deployments: 91,
    operators: 27,
    nodeHealth: 98,
  });
}
