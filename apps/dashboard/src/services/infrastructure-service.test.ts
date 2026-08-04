import { afterEach, describe, expect, it, vi } from 'vitest';
import { getInfrastructureOverview, getInfrastructureServers } from './infrastructure-service';

describe('infrastructure service layer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads the overview payload from the infrastructure API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          totalAssets: 128,
          healthyAssets: 121,
          unhealthyAssets: 3,
          maintenanceAssets: 4,
          discoveryCoverage: 97,
          lastDiscovery: '10 min ago',
        }),
      }),
    );

    const result = await getInfrastructureOverview();

    expect(result.totalAssets).toBe(128);
    expect(result.healthyAssets).toBe(121);
  });

  it('loads server inventory rows from the infrastructure API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            hostname: 'infra-01',
            ip: '10.0.0.5',
            environment: 'Production',
            cpu: '78%',
            memory: '64GB',
            disk: '1.2TB',
            status: 'healthy',
            datacenter: 'DC-01',
            os: 'RHEL 9',
          },
        ],
      }),
    );

    const result = await getInfrastructureServers();

    expect(result).toHaveLength(1);
    expect(result[0]?.hostname).toBe('infra-01');
  });
});
