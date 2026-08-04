import type {
  AiPlatformData,
  ExecutiveDashboardData,
  InfrastructureSummaryData,
  PlatformHealthData,
  RuntimeData,
  SecurityData,
} from '../types/executive-dashboard';

async function getDashboardResource<T>(resource: string): Promise<T> {
  const response = await fetch(`/api/dashboard/${resource}`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Unable to load ${resource.replaceAll('-', ' ')}.`);
  }

  return (await response.json()) as T;
}

export async function getExecutiveDashboardData(): Promise<ExecutiveDashboardData> {
  const [platformHealth, infrastructure, aiPlatform, runtime, security] = await Promise.all([
    getDashboardResource<PlatformHealthData>('platform-health'),
    getDashboardResource<InfrastructureSummaryData>('infrastructure-summary'),
    getDashboardResource<AiPlatformData>('ai-platform'),
    getDashboardResource<RuntimeData>('runtime'),
    getDashboardResource<SecurityData>('security'),
  ]);

  return { platformHealth, infrastructure, aiPlatform, runtime, security };
}
