import { NextResponse } from 'next/server';
import { GET as getAiPlatform } from './ai-platform/route';
import { GET as getInfrastructureSummary } from './infrastructure-summary/route';
import { GET as getPlatformHealth } from './platform-health/route';
import { GET as getRuntime } from './runtime/route';
import { GET as getSecurity } from './security/route';

export async function GET(): Promise<NextResponse> {
  const [
    platformHealthResponse,
    infrastructureSummaryResponse,
    aiPlatformResponse,
    runtimeResponse,
    securityResponse,
  ] = await Promise.all([
    getPlatformHealth(),
    getInfrastructureSummary(),
    getAiPlatform(),
    getRuntime(),
    getSecurity(),
  ]);

  const [platformHealth, infrastructureSummary, aiPlatform, runtime, security] = await Promise.all([
    platformHealthResponse.json(),
    infrastructureSummaryResponse.json(),
    aiPlatformResponse.json(),
    runtimeResponse.json(),
    securityResponse.json(),
  ]);

  return NextResponse.json({
    platformHealth,
    runtime,
    security,
    infrastructureSummary,
    aiPlatform,
  });
}
