import { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    runningExecutions: 42,
    queueDepth: 17,
    failedExecutions: 2,
    averageLatency: 148,
    workflowStatus: [
      { name: 'Running', value: 42 },
      { name: 'Queued', value: 17 },
      { name: 'Completed', value: 1284 },
      { name: 'Failed', value: 2 },
    ],
  });
}
