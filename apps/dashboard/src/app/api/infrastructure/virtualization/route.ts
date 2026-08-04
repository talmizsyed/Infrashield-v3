import { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    vmware: 'vSphere 8.0 U2',
    vCenter: 'vc-01.prod.internal',
    esxiHosts: 24,
    clusters: 6,
    datastores: 18,
    vmCount: 382,
  });
}
