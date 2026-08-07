import { describe, expect, it } from 'vitest';
import { CapabilityVersion } from '@infrashield/providers';
import {
  createMockProviderRuntime,
  MockAuthentication,
  MockCommandExecutor,
  MockConfigurationService,
  MockEventService,
  MockHealthService,
  MockInventoryService,
  MockMetricsService,
  MockProvider,
  MockProviderFactory,
} from './mock-provider';

describe('reference mock provider', () => {
  it('provides deterministic inventory, metrics, events, health, and command execution', async () => {
    const inventory = await new MockInventoryService().discover();
    const metrics = await new MockMetricsService().list();
    const events = await new MockEventService().list();
    const health = await new MockHealthService().getHealth();
    const command = await new MockCommandExecutor().execute('restart', 'pod-payments-api-7f9f');

    expect(inventory).toHaveLength(6);
    expect(inventory[0]?.id).toBe('cluster-1');
    expect(metrics).toHaveLength(2);
    expect(metrics[0]?.cpuPercent).toBe(63);
    expect(events).toHaveLength(2);
    expect(events[1]?.type).toBe('warning');
    expect(health.healthy).toBe(true);
    expect(command.accepted).toBe(true);
    expect(command.output).toBe('mock:restart:ok');
  });

  it('merges configuration deterministically and supports connectivity tests', async () => {
    const configuration = new MockConfigurationService();
    const merged = configuration.merge({ tenantId: 'tenant-x', latencyMs: 20 });
    const provider = new MockProvider();
    const connectivity = await provider.testConnectivity({
      endpoint: 'https://mock-provider.infrashield.local',
      latencyMs: 20,
    });

    expect(merged.tenantId).toBe('tenant-x');
    expect(merged.readOnly).toBe(true);
    expect(connectivity.connected).toBe(true);
    expect(connectivity.latencyMs).toBe(20);
  });

  it('factory creates canonical provider instances', async () => {
    const provider = new MockProviderFactory().create();
    const inventory = await provider.discoverInventory();

    expect(provider.manifest.id).toBe('provider-mock');
    expect(inventory.some((resource) => resource.kind === 'deployment')).toBe(true);
  });

  it('supports runtime integration with registry, capabilities, lifecycle, auth, and connections', async () => {
    const runtime = createMockProviderRuntime();

    const discovered = runtime.registryService.discover({
      capability: 'inventory',
      tags: ['reference'],
    });
    expect(discovered).toHaveLength(1);

    const resolvedCapability = runtime.capabilityResolver.resolve(runtime.provider, {
      name: 'inventory',
      version: new CapabilityVersion('1.0.0'),
      requiredFeatureFlags: ['deterministic'],
    });
    expect(resolvedCapability.id).toBe('inventory-list');

    expect(runtime.lifecycleManager.initialize(runtime.provider)).toBe('initialized');
    await runtime.lifecycleManager.start(runtime.provider);
    const monitored = await runtime.lifecycleManager.monitorHealth(runtime.provider);
    expect(monitored.status).toBe('healthy');

    const context = await runtime.provider.createContext({ apiKey: 'mock-valid-key' });
    const authResult = await runtime.authentication.authenticate({
      provider: runtime.provider,
      context,
      method: 'api-key',
      actorId: 'operator-1',
      credential: {
        method: 'api-key',
        apiKey: 'mock-valid-key',
      },
    });
    expect(authResult.success).toBe(true);

    const connection = await runtime.connectionManager.connect(runtime.provider, context);
    const health = await runtime.connectionManager.checkHealth(connection.id);
    expect(connection.status).toBe('connected');
    expect(health?.status).toBe('connected');

    const disconnected = await runtime.connectionManager.disconnect(connection.id);
    expect(disconnected).toBe(true);

    await runtime.lifecycleManager.stop(runtime.provider);
    expect(runtime.lifecycleManager.getState(runtime.provider.manifest.id)).toBe('stopped');
  });

  it('rejects invalid api keys in authentication provider', async () => {
    const provider = new MockProvider();
    const authentication = new MockAuthentication();
    const result = await authentication.authenticate(
      { provider },
      { method: 'api-key', apiKey: 'invalid-key' },
    );

    expect(result.success).toBe(false);
  });
});
