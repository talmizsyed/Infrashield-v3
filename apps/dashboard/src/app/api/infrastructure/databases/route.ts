import { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    Oracle: {
      version: '19c',
      health: 'healthy',
      backupStatus: 'Succeeded',
    },
    'SQL Server': {
      version: '2022',
      health: 'warning',
      backupStatus: 'Partial',
    },
    PostgreSQL: {
      version: '15.6',
      health: 'healthy',
      backupStatus: 'Succeeded',
    },
    MongoDB: {
      version: '7.0',
      health: 'healthy',
      backupStatus: 'Succeeded',
    },
    Redis: {
      version: '7.2',
      health: 'maintenance',
      backupStatus: 'Pending',
    },
  });
}
