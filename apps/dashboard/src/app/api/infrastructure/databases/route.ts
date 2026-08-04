import { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json([
    {
      name: 'ORCL-PRD-01',
      environment: 'Production',
      status: 'healthy',
      version: '19c',
      backupStatus: 'Succeeded',
    },
    {
      name: 'PG-OPS-03',
      environment: 'Operations',
      status: 'healthy',
      version: '15.6',
      backupStatus: 'Succeeded',
    },
    {
      name: 'MSSQL-CORE-01',
      environment: 'Production',
      status: 'warning',
      version: '2022',
      backupStatus: 'Partial',
    },
    {
      name: 'MONGO-WARE-01',
      environment: 'Warehouse',
      status: 'healthy',
      version: '7.0',
      backupStatus: 'Succeeded',
    },
    {
      name: 'REDIS-CACHE-01',
      environment: 'Cache',
      status: 'maintenance',
      version: '7.2',
      backupStatus: 'Pending',
    },
  ]);
}
