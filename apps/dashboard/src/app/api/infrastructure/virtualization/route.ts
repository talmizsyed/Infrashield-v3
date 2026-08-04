import { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    vCenters: 2,
    clusters: 6,
    hosts: 24,
    virtualMachines: 382,
    datastores: 18,
    clusterHealth: 97,
  });
}
