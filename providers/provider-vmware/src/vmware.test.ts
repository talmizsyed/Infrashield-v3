import { describe, expect, it } from 'vitest';
import { CapabilityVersion } from '@infrashield/providers';
import {
  createVmwareProviderRuntime,
  MockVmwareAdapter,
  VmwareAuthentication,
  VmwareConfiguration,
  VmwareInventoryCache,
  VmwareProvider,
  VmwareProviderFactory,
} from './vmware';

describe('vmware enterprise provider', () => {
  it('discovers all required inventory domains', async () => {
    const provider = new VmwareProvider();
    const inventory = await provider.discoverInventory();

    expect(inventory).toHaveLength(10);
    expect(inventory.some((resource) => resource.kind === 'datacenter')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'cluster')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'esxiHost')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'virtualMachine')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'resourcePool')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'folder')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'datastore')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'network')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'template')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'snapshot')).toBe(true);
  });

  it('supports monitoring and telemetry services', async () => {
    const provider = new VmwareProvider({ adapter: new MockVmwareAdapter() });
    const [health, performance, capacity, events, alarms, tasks] = await Promise.all([
      provider.getHealth(),
      provider.getPerformanceMetrics(),
      provider.getCapacity(),
      provider.getEvents(),
      provider.getAlarms(),
      provider.getTasks(),
    ]);

    expect(health.healthy).toBe(true);
    expect(performance.length).toBeGreaterThan(0);
    expect(capacity.totalCpuCores).toBeGreaterThan(capacity.usedCpuCores);
    expect(events[0]?.severity).toBe('info');
    expect(alarms[0]?.severity).toBe('warning');
    expect(tasks[0]?.state).toBe('success');
  });

  it('refreshes inventory, stores cache, and supports vm search', async () => {
    const cache = new VmwareInventoryCache();
    const provider = new VmwareProvider({ inventoryCache: cache });

    const snapshot = await provider.refreshInventory();
    const search = await provider.searchVirtualMachines({ text: 'payments' });

    expect(snapshot.resources.length).toBe(10);
    expect(snapshot.refreshedAt).toBeDefined();
    expect(provider.getInventoryCache().resources.length).toBe(10);
    expect(search[0]?.kind).toBe('virtualMachine');
  });

  it('keeps vm power and snapshot operations interface-only', async () => {
    const provider = new VmwareProvider();

    const powerResult = await provider.vmPowerOperations.powerOn('vm-1');
    const snapshotResult = await provider.snapshotOperations.create('vm-1', 'before-upgrade');

    expect(powerResult.supported).toBe(false);
    expect(snapshotResult.supported).toBe(false);
  });

  it('supports runtime integration with registry, lifecycle, auth, capabilities and connections', async () => {
    const runtime = createVmwareProviderRuntime();

    const discovered = runtime.registryService.discover({
      capability: 'operations',
      tags: ['vmware'],
    });
    expect(discovered).toHaveLength(1);

    const resolvedCapability = runtime.capabilityResolver.resolve(runtime.provider, {
      name: 'inventory',
      version: new CapabilityVersion('1.0.0'),
      requiredFeatureFlags: ['configurationDriven'],
    });
    expect(resolvedCapability.id).toBe('vmware-inventory-discovery');

    expect(runtime.lifecycleManager.initialize(runtime.provider)).toBe('initialized');
    await runtime.lifecycleManager.start(runtime.provider);

    const context = await runtime.provider.createContext({
      username: 'automation-operator',
      credentialRef: 'VMWARE_CREDENTIAL_REF',
    });

    const authResult = await runtime.authentication.authenticate({
      provider: runtime.provider,
      context,
      method: 'username-password',
      actorId: 'vmware-admin',
      credential: {
        method: 'username-password',
        username: 'automation-operator',
        password: 'masked-secret',
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

  it('factory auto-registers providers and supports configuration-driven connection tests', async () => {
    const factory = new VmwareProviderFactory();
    const provider = factory.create({
      configurationOverride: {
        endpoint: 'https://vcenter.enterprise.local',
        username: 'svc-vmware',
      },
    });

    const discovered = factory
      .getRegistryService()
      .discover({ capability: 'operations', tags: ['vmware'] });
    const testResult = await provider.testConnection({
      endpoint: 'https://vcenter.enterprise.local',
    });
    const resolved = new VmwareConfiguration().merge({
      endpoint: 'https://vcenter.enterprise.local',
    });

    expect(discovered).toHaveLength(1);
    expect(testResult.connected).toBe(true);
    expect(resolved.endpoint).toBe('https://vcenter.enterprise.local');
  });

  it('authentication provider rejects missing credential content', async () => {
    const auth = new VmwareAuthentication();
    const provider = new VmwareProvider();
    const result = await auth.authenticate(
      { provider },
      { method: 'username-password', username: '', password: '' },
    );

    expect(result.success).toBe(false);
  });
});
