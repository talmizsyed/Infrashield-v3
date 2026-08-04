import { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    overallHealth: 97.8,
    uptime: '99.98%',
    activeAlerts: 5,
    criticalAlerts: 1,
    warningAlerts: 4,
    healthTrend: [
      { label: 'Mon', value: 96.2 },
      { label: 'Tue', value: 97.1 },
      { label: 'Wed', value: 97.6 },
      { label: 'Thu', value: 96.9 },
      { label: 'Fri', value: 97.4 },
      { label: 'Sat', value: 97.8 },
      { label: 'Sun', value: 97.8 },
    ],
  });
}
