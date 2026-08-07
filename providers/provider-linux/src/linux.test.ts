import { describe, expect, it } from 'vitest';
import { CapabilityVersion } from '@infrashield/providers';
import {
  createLinuxProviderRuntime,
  LinuxAuthenticationProvider,
  LinuxCapabilityRegistry,
  LinuxConfiguration,
  LinuxConnectionManager,
  LinuxInventoryCache,
  LinuxMockAdapter,
  LinuxProvider,
  LinuxProviderFactory,
} from './linux';

describe('linux enterprise provider framework', () => {
  it('discovers required linux inventory and administration metadata', async () => {
    const provider = new LinuxProvider({ adapter: new LinuxMockAdapter() });
    const inventory = await provider.discoverInventory();

    expect(inventory).toHaveLength(23);
    expect(inventory.some((resource) => resource.kind === 'host')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'operatingSystem')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'distribution')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'kernel')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'cpu')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'memory')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'numa')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'filesystem')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'mountPoint')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'blockDevice')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'networkInterface')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'installedPackage')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'runningService')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'process')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'user')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'group')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'systemdService')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'crontab')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'sshConfiguration')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'firewall')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'selinuxOrApparmor')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'kernelParameter')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'environmentInformation')).toBe(true);
  });

  it('supports monitoring and security metadata', async () => {
    const provider = new LinuxProvider({ adapter: new LinuxMockAdapter() });
    const [cpu, memory, disk, fsHealth, net, proc, service, health, logs, security] =
      await Promise.all([
        provider.getCpuUtilization(),
        provider.getMemoryUtilization(),
        provider.getDiskUtilization(),
        provider.getFilesystemHealth(),
        provider.getNetworkStatistics(),
        provider.getProcessStatistics(),
        provider.getServiceStatus(),
        provider.getSystemHealth(),
        provider.getLogsMetadata(),
        provider.getSecurityMetadata(),
      ]);

    expect(cpu[0]?.percent).toBe(42);
    expect(memory[0]?.usedPercent).toBe(63);
    expect(disk[0]?.usedPercent).toBe(58);
    expect(fsHealth[0]?.healthy).toBe(true);
    expect(net[0]?.interfaceName).toBe('ens192');
    expect(proc[0]?.processName).toBe('java');
    expect(service[0]?.status).toBe('running');
    expect(health.healthy).toBe(true);
    expect(logs[0]?.source).toBe('journald');
    expect(security[0]?.status).toBe('enforcing');
  });

  it('supports refresh, connection test, capability discovery, search, and cache synchronization', async () => {
    const cache = new LinuxInventoryCache();
    const provider = new LinuxProvider({ inventoryCache: cache });

    const refreshed = await provider.refreshInventory();
    provider.synchronizeCache(refreshed);
    const search = await provider.searchResources({ text: 'platform' });
    const capabilities = await provider.discoverCapabilities();
    const connection = await provider.testConnection({
      endpoint: 'linux://linux-prod-01.example.local',
    });

    expect(refreshed.resources.length).toBe(23);
    expect(provider.getInventoryCache().resources.length).toBe(23);
    expect(search.length).toBeGreaterThan(0);
    expect(capabilities.some((capability) => capability.category === 'operations')).toBe(true);
    expect(connection.connected).toBe(true);
  });

  it('registers provider manifest through factory', () => {
    const factory = new LinuxProviderFactory();
    factory.create();

    const discovered = factory
      .getRegistryService()
      .discover({ capability: 'operations', tags: ['linux'] });
    expect(discovered).toHaveLength(1);
  });

  it('runtime reuses lifecycle, authentication, connection, and capability frameworks', async () => {
    const runtime = createLinuxProviderRuntime();
    expect(runtime.lifecycleManager.initialize(runtime.provider)).toBe('initialized');
    await runtime.lifecycleManager.start(runtime.provider);

    const context = await runtime.provider.createContext({
      hostAlias: 'linux-prod-01',
      credentialRef: 'LINUX_CREDENTIAL_REF',
    });

    const auth = await runtime.authenticationProvider.getProviderAuthentication().authenticate({
      provider: runtime.provider,
      context,
      method: 'username-password',
      actorId: 'linux-admin',
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
    expect(resolved.id).toBe('linux-operations');

    await runtime.lifecycleManager.stop(runtime.provider);
    expect(runtime.lifecycleManager.getState(runtime.provider.manifest.id)).toBe('stopped');
  });

  it('exposes strongly typed core components', async () => {
    const configuration = new LinuxConfiguration();
    const merged = configuration.merge({ connectionTimeoutMs: 12000 });
    const authProvider = new LinuxAuthenticationProvider();
    const capabilityRegistry = new LinuxCapabilityRegistry('provider-linux');
    const connectionManager = new LinuxConnectionManager('provider-linux');
    const capabilities = await capabilityRegistry.list();

    expect(merged.connectionTimeoutMs).toBe(12000);
    expect(authProvider.getProviderAuthentication()).toBeDefined();
    expect(connectionManager.getSdkConnectionManager()).toBeDefined();
    expect(capabilities.length).toBe(5);
  });
});
