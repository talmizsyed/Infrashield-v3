import { describe, expect, it } from 'vitest';
import { CapabilityVersion } from '@infrashield/providers';
import {
  createVmwareProviderRuntime,
  VmwareAuthenticationProvider,
  VmwareCapabilityRegistry,
  VmwareConfiguration,
  VmwareConnectionManager,
  VmwareInventoryCache,
  VmwareMockAdapter,
  VmwareProvider,
  VmwareProviderFactory,
} from './vmware';

describe('vmware enterprise provider framework', () => {
  it('implements deterministic inventory services across all required domains', async () => {
    const provider = new VmwareProvider({ adapter: new VmwareMockAdapter() });
    const inventory = await provider.discoverInventory();

    expect(inventory).toHaveLength(10);
    expect(inventory.some((resource) => resource.kind === 'datacenter')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'cluster')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'esxiHost')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'virtualMachine')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'datastore')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'network')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'resourcePool')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'folder')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'template')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'snapshot')).toBe(true);
  });

  it('implements monitoring services with deterministic responses', async () => {
    const provider = new VmwareProvider({ adapter: new VmwareMockAdapter() });

    const [health, metrics, events, alarms, tasks, capacity] = await Promise.all([
      provider.getProviderHealth(),
      provider.getMetrics(),
      provider.getEvents(),
      provider.getAlarms(),
      provider.getTasks(),
      provider.getCapacity(),
    ]);

    expect(health.healthy).toBe(true);
    expect(metrics.length).toBeGreaterThan(0);
    expect(events[0]?.severity).toBe('info');
    expect(alarms[0]?.severity).toBe('warning');
    expect(tasks[0]?.state).toBe('success');
    expect(capacity.totalCpuCores).toBeGreaterThan(capacity.usedCpuCores);
  });

  it('supports inventory refresh, search, and cache synchronization operations', async () => {
    const cache = new VmwareInventoryCache();
    const provider = new VmwareProvider({ inventoryCache: cache });

    const refreshed = await provider.refreshInventory();
    const searchFromCache = await provider.searchInventory({ text: 'payments' });

    provider.synchronizeCache({
      resources: refreshed.resources,
      refreshedAt: refreshed.refreshedAt,
    });

    expect(refreshed.resources.length).toBe(10);
    expect(refreshed.refreshedAt).toBeDefined();
    expect(searchFromCache[0]?.kind).toBe('virtualMachine');
    expect(provider.getInventoryCache().resources.length).toBe(10);
  });

  it('supports capability discovery and connection tests', async () => {
    const provider = new VmwareProvider();
    const capabilities = await provider.discoverCapabilities();
    const connectionResult = await provider.testConnection({
      endpoint: 'https://vcenter.enterprise.local',
    });

    expect(capabilities.some((capability) => capability.name === 'inventory')).toBe(true);
    expect(capabilities.some((capability) => capability.name === 'monitoring')).toBe(true);
    expect(capabilities.some((capability) => capability.name === 'operations')).toBe(true);
    expect(connectionResult.connected).toBe(true);
  });

  it('auto-registers provider manifests in provider registry through the factory', () => {
    const factory = new VmwareProviderFactory();
    factory.create({
      configurationOverride: {
        endpoint: 'https://vcenter.enterprise.local',
      },
    });

    const discovered = factory.getRegistry().discover({
      capability: 'operations',
      tags: ['vmware'],
    });

    expect(discovered).toHaveLength(1);
  });

  it('reuses authentication and connection frameworks through dedicated wrappers', async () => {
    const runtime = createVmwareProviderRuntime();

    const context = await runtime.provider.createContext({
      username: 'automation-operator',
      credentialRef: 'VMWARE_CREDENTIAL_REF',
    });

    const authResult = await runtime.authenticationProvider
      .getProviderAuthentication()
      .authenticate({
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

    const connection = await runtime.connectionManager
      .getSdkConnectionManager()
      .connect(runtime.provider, context);
    const health = await runtime.connectionManager
      .getSdkConnectionManager()
      .checkHealth(connection.id);

    expect(authResult.success).toBe(true);
    expect(connection.status).toBe('connected');
    expect(health?.status).toBe('connected');
  });

  it('supports lifecycle and capability resolution in runtime wiring', async () => {
    const runtime = createVmwareProviderRuntime();

    expect(runtime.lifecycleManager.initialize(runtime.provider)).toBe('initialized');
    await runtime.lifecycleManager.start(runtime.provider);

    const resolved = runtime.capabilityResolver.resolve(runtime.provider, {
      name: 'inventory',
      version: new CapabilityVersion('1.0.0'),
      requiredFeatureFlags: ['configurationDriven'],
    });

    expect(resolved.id).toBe('vmware-inventory-discovery');

    await runtime.lifecycleManager.stop(runtime.provider);
    expect(runtime.lifecycleManager.getState(runtime.provider.manifest.id)).toBe('stopped');
  });

  it('exposes strongly typed framework components', async () => {
    const configuration = new VmwareConfiguration();
    const authProvider = new VmwareAuthenticationProvider();
    const capabilityRegistry = new VmwareCapabilityRegistry('provider-vmware');
    const connectionManager = new VmwareConnectionManager('provider-vmware');

    const merged = configuration.merge({ requestTimeoutMs: 20000 });
    const capabilities = await capabilityRegistry.list();

    expect(merged.requestTimeoutMs).toBe(20000);
    expect(authProvider.getProviderAuthentication()).toBeDefined();
    expect(connectionManager.getSdkConnectionManager()).toBeDefined();
    expect(capabilities.length).toBe(3);
  });
});
