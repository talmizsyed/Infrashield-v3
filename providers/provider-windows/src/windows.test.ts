import { describe, expect, it } from 'vitest';
import { CapabilityVersion } from '@infrashield/providers';
import {
  createWindowsProviderRuntime,
  WindowsAuthenticationProvider,
  WindowsCapabilityRegistry,
  WindowsConfiguration,
  WindowsConnectionManager,
  WindowsInventoryCache,
  WindowsMockAdapter,
  WindowsProvider,
  WindowsProviderFactory,
} from './windows';

describe('windows enterprise provider framework', () => {
  it('discovers required windows inventory and infrastructure metadata', async () => {
    const provider = new WindowsProvider({ adapter: new WindowsMockAdapter() });
    const inventory = await provider.discoverInventory();

    expect(inventory).toHaveLength(19);
    expect(inventory.some((resource) => resource.kind === 'windowsHost')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'operatingSystem')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'serverRole')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'installedFeature')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'cpu')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'memory')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'storage')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'networkInterface')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'service')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'process')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'user')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'group')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'activeDirectoryMetadata')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'dnsMetadata')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'dhcpMetadata')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'iisMetadata')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'hyperVMetadata')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'exchangeMetadata')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'certificateServicesMetadata')).toBe(
      true,
    );
  });

  it('supports monitoring metadata and security status', async () => {
    const provider = new WindowsProvider({ adapter: new WindowsMockAdapter() });
    const [health, cpu, memory, disk, services, events, counters, security] = await Promise.all([
      provider.getHostHealth(),
      provider.getCpuMetrics(),
      provider.getMemoryMetrics(),
      provider.getDiskMetrics(),
      provider.getServiceStatus(),
      provider.getEventLogMetadata(),
      provider.getPerformanceCounters(),
      provider.getSecurityStatus(),
    ]);

    expect(health.healthy).toBe(true);
    expect(cpu[0]?.percent).toBe(47);
    expect(memory[0]?.usedPercent).toBe(69);
    expect(disk[0]?.usedPercent).toBe(61);
    expect(services[0]?.status).toBe('running');
    expect(events[0]?.channel).toBe('System');
    expect(counters[0]?.counter).toBe('% Processor Time');
    expect(security[0]?.status).toBe('enabled');
  });

  it('supports refresh, connection test, capability discovery, search, and cache synchronization', async () => {
    const cache = new WindowsInventoryCache();
    const provider = new WindowsProvider({ inventoryCache: cache });

    const refreshed = await provider.refreshInventory();
    provider.synchronizeCache(refreshed);
    const search = await provider.searchResources({ text: 'Platform' });
    const capabilities = await provider.discoverCapabilities();
    const connection = await provider.testConnection({
      endpoint: 'windows://win-prod-01.example.local',
    });

    expect(refreshed.resources.length).toBe(19);
    expect(provider.getInventoryCache().resources.length).toBe(19);
    expect(search.length).toBeGreaterThan(0);
    expect(capabilities.some((capability) => capability.category === 'operations')).toBe(true);
    expect(connection.connected).toBe(true);
  });

  it('registers provider manifest through factory', () => {
    const factory = new WindowsProviderFactory();
    factory.create();

    const discovered = factory
      .getRegistryService()
      .discover({ capability: 'operations', tags: ['windows'] });
    expect(discovered).toHaveLength(1);
  });

  it('runtime reuses lifecycle, authentication, connection, and capability frameworks', async () => {
    const runtime = createWindowsProviderRuntime();
    expect(runtime.lifecycleManager.initialize(runtime.provider)).toBe('initialized');
    await runtime.lifecycleManager.start(runtime.provider);

    const context = await runtime.provider.createContext({
      hostAlias: 'win-prod-01',
      credentialRef: 'WINDOWS_CREDENTIAL_REF',
    });

    const auth = await runtime.authenticationProvider.getProviderAuthentication().authenticate({
      provider: runtime.provider,
      context,
      method: 'username-password',
      actorId: 'windows-admin',
      credential: {
        method: 'username-password',
        username: 'administrator',
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
    expect(resolved.id).toBe('windows-operations');

    await runtime.lifecycleManager.stop(runtime.provider);
    expect(runtime.lifecycleManager.getState(runtime.provider.manifest.id)).toBe('stopped');
  });

  it('exposes strongly typed core components', async () => {
    const configuration = new WindowsConfiguration();
    const merged = configuration.merge({ connectionTimeoutMs: 12000 });
    const authProvider = new WindowsAuthenticationProvider();
    const capabilityRegistry = new WindowsCapabilityRegistry('provider-windows');
    const connectionManager = new WindowsConnectionManager('provider-windows');
    const capabilities = await capabilityRegistry.list();

    expect(merged.connectionTimeoutMs).toBe(12000);
    expect(authProvider.getProviderAuthentication()).toBeDefined();
    expect(connectionManager.getSdkConnectionManager()).toBeDefined();
    expect(capabilities.length).toBe(5);
  });
});
