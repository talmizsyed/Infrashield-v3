import { NextResponse } from 'next/server';

import { getRuntimeDashboardData } from '../../../../services/runtime-dashboard-service';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(getRuntimeDashboardData());
}
