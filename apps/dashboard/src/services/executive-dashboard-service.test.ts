import { afterEach, describe, expect, it, vi } from 'vitest';
import { getExecutiveDashboardData } from './executive-dashboard-service';

describe('executive dashboard service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches the dashboard from the aggregated API route', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          platformHealth: { overallHealth: 97.8 },
          infrastructureSummary: { vmwareClusters: 6 },
          aiPlatform: { activeAgents: 18 },
          runtime: { runningExecutions: 42, activeExecutions: 42 },
          security: { openVulnerabilities: 27 },
        }),
      }),
    );

    const result = await getExecutiveDashboardData();

    expect(fetch).toHaveBeenCalledWith('/api/dashboard', expect.any(Object));
    expect(result.platformHealth.overallHealth).toBe(97.8);
    expect(result.infrastructure.vmwareClusters).toBe(6);
    expect(result.aiPlatform.activeAgents).toBe(18);
    expect(result.runtime.runningExecutions).toBe(42);
    expect(result.security.openVulnerabilities).toBe(27);
  });
});
