import { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    vmwareClusters: 6,
    openshiftClusters: 3,
    linuxServers: 184,
    windowsServers: 96,
    oracleDatabases: 12,
    kubernetesClusters: 8,
    inventory: [
      { name: 'VMware', value: 6 },
      { name: 'OpenShift', value: 3 },
      { name: 'Linux', value: 184 },
      { name: 'Windows', value: 96 },
      { name: 'Oracle', value: 12 },
      { name: 'Kubernetes', value: 8 },
    ],
  });
}
