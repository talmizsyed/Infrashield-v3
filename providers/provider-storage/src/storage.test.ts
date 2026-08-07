import { describe, expect, it } from 'vitest';
import { CapabilityVersion } from '@infrashield/providers';
import {
  createStorageProviderRuntime,
  StorageAuthenticationProvider,
  StorageCapabilityRegistry,
  StorageConfiguration,
  StorageConnectionManager,
  StorageInventoryCache,
  StorageMockAdapter,
  StorageProvider,
  StorageProviderFactory,
} from './storage';

describe('enterprise storage provider framework', () => {
  it('discovers required storage resources and vendor abstractions', async () => {
    const provider = new StorageProvider({ adapter: new StorageMockAdapter() });
    const vendors = await provider.discoverVendorAbstractions();
    const inventory = await provider.discoverInventory();

    expect(vendors).toHaveLength(7);
    expect(vendors.some((vendor) => vendor.vendor === 'netApp')).toBe(true);
    expect(vendors.some((vendor) => vendor.vendor === 'dellEmcPowerStore')).toBe(true);
    expect(vendors.some((vendor) => vendor.vendor === 'dellEmcUnity')).toBe(true);
    expect(vendors.some((vendor) => vendor.vendor === 'dellPowerMax')).toBe(true);
    expect(vendors.some((vendor) => vendor.vendor === 'pureStorage')).toBe(true);
    expect(vendors.some((vendor) => vendor.vendor === 'hpeAlletra')).toBe(true);
    expect(vendors.some((vendor) => vendor.vendor === 'ibmFlashSystem')).toBe(true);

    expect(inventory).toHaveLength(14);
    expect(inventory.some((resource) => resource.kind === 'storageArray')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'controller')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'pool')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'volume')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'lun')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'fileSystem')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'nasShare')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'snapshot')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'replicationGroup')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'storagePort')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'fcEndpoint')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'iscsiEndpoint')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'nfsEndpoint')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'smbEndpoint')).toBe(true);
  });

  it('supports monitoring metadata and telemetry', async () => {
    const provider = new StorageProvider({ adapter: new StorageMockAdapter() });
    const [
      arrayHealth,
      capacity,
      performance,
      iops,
      throughput,
      latency,
      replHealth,
      snapHealth,
      events,
      alerts,
    ] = await Promise.all([
      provider.getArrayHealth(),
      provider.getCapacity(),
      provider.getPerformance(),
      provider.getIops(),
      provider.getThroughput(),
      provider.getLatency(),
      provider.getReplicationHealth(),
      provider.getSnapshotHealth(),
      provider.getEvents(),
      provider.getAlerts(),
    ]);

    expect(arrayHealth[0]?.healthy).toBe(true);
    expect(capacity[0]?.usedTb).toBe(62);
    expect(performance[0]?.profile).toBe('overall-performance');
    expect(iops[0]?.readIops).toBe(24000);
    expect(throughput[0]?.readMbps).toBe(680);
    expect(latency[0]?.readMs).toBe(1.4);
    expect(replHealth[0]?.status).toBe('synchronized');
    expect(snapHealth[0]?.status).toBe('healthy');
    expect(events[0]?.severity).toBe('warning');
    expect(alerts[0]?.severity).toBe('warning');
  });

  it('supports refresh, connection test, capability discovery, search, and cache synchronization', async () => {
    const cache = new StorageInventoryCache();
    const provider = new StorageProvider({ inventoryCache: cache });

    const refreshed = await provider.refreshInventory();
    provider.synchronizeCache(refreshed);
    const search = await provider.searchStorageResources({ text: 'payments', kind: 'volume' });
    const capabilities = await provider.discoverCapabilities();
    const connection = await provider.testConnection({
      endpoint: 'storage://enterprise.fabric.example.local',
    });

    expect(refreshed.resources.length).toBe(14);
    expect(provider.getInventoryCache().resources.length).toBe(14);
    expect(search.length).toBeGreaterThan(0);
    expect(capabilities.some((capability) => capability.category === 'operations')).toBe(true);
    expect(connection.connected).toBe(true);
  });

  it('registers provider manifest through factory', () => {
    const factory = new StorageProviderFactory();
    factory.create();

    const discovered = factory
      .getRegistryService()
      .discover({ capability: 'operations', tags: ['storage'] });
    expect(discovered).toHaveLength(1);
  });

  it('runtime reuses lifecycle, authentication, connection, and capability frameworks', async () => {
    const runtime = createStorageProviderRuntime();
    expect(runtime.lifecycleManager.initialize(runtime.provider)).toBe('initialized');
    await runtime.lifecycleManager.start(runtime.provider);

    const context = await runtime.provider.createContext({
      domainName: 'enterprise.fabric.example.local',
      credentialRef: 'STORAGE_CREDENTIAL_REF',
    });

    const auth = await runtime.authenticationProvider.getProviderAuthentication().authenticate({
      provider: runtime.provider,
      context,
      method: 'username-password',
      actorId: 'storage-admin',
      credential: {
        method: 'username-password',
        username: 'admin',
        password: 'masked-password',
      },
    });

    const connection = await runtime.connectionManager
      .getSdkConnectionManager()
      .connect(runtime.provider, context);
    const health = await runtime.connectionManager
      .getSdkConnectionManager()
      .checkHealth(connection.id);
    const resolved = runtime.capabilityResolver.resolve(runtime.provider, {
      name: 'operations',
      version: new CapabilityVersion('1.0.0'),
      requiredFeatureFlags: ['configurationDriven'],
    });

    expect(auth.success).toBe(true);
    expect(connection.status).toBe('connected');
    expect(health?.status).toBe('connected');
    expect(resolved.id).toBe('storage-operations');

    await runtime.lifecycleManager.stop(runtime.provider);
    expect(runtime.lifecycleManager.getState(runtime.provider.manifest.id)).toBe('stopped');
  });

  it('exposes strongly typed core components', async () => {
    const configuration = new StorageConfiguration();
    const merged = configuration.merge({ connectionTimeoutMs: 12000 });
    const authProvider = new StorageAuthenticationProvider();
    const capabilityRegistry = new StorageCapabilityRegistry('provider-storage');
    const connectionManager = new StorageConnectionManager('provider-storage');
    const capabilities = await capabilityRegistry.list();

    expect(merged.connectionTimeoutMs).toBe(12000);
    expect(authProvider.getProviderAuthentication()).toBeDefined();
    expect(connectionManager.getSdkConnectionManager()).toBeDefined();
    expect(capabilities.length).toBe(5);
  });
});
