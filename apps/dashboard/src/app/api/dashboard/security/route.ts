import { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    openVulnerabilities: 27,
    criticalCVEs: 3,
    patchCompliance: 98,
    zeroTrustScore: 94,
    riskTrend: [
      { label: 'Mon', value: 42 },
      { label: 'Tue', value: 38 },
      { label: 'Wed', value: 36 },
      { label: 'Thu', value: 34 },
      { label: 'Fri', value: 31 },
      { label: 'Sat', value: 29 },
      { label: 'Sun', value: 27 },
    ],
  });
}
