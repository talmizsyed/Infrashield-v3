import type {
  AiPlatformData,
  ExecutiveDashboardData,
  InfrastructureSummaryData,
  PlatformHealthData,
  RuntimeData,
  SecurityData,
} from '../types/executive-dashboard';

interface AggregatedDashboardResponse {
  platformHealth: PlatformHealthData;
  infrastructureSummary: InfrastructureSummaryData;
  aiPlatform: AiPlatformData;
  runtime: RuntimeData;
  security: SecurityData;
}

export async function getExecutiveDashboardData(): Promise<ExecutiveDashboardData> {
  const response = await fetch('/api/dashboard', {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error('Unable to load executive dashboard data.');
  }

  const data = (await response.json()) as AggregatedDashboardResponse;

  return {
    platformHealth: data.platformHealth,
    infrastructure: data.infrastructureSummary,
    aiPlatform: data.aiPlatform,
    runtime: data.runtime,
    security: data.security,
  };
}
