import { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    totalAssets: 248,
    healthyAssets: 214,
    unhealthyAssets: 19,
    maintenanceAssets: 15,
    discoveryCoverage: 97,
    lastDiscovery: '2 minutes ago',
  });
}
