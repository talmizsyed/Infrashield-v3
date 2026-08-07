import { describe, expect, it } from 'vitest';
import { CapabilityVersion } from '@infrashield/providers';
import {
  createNetworkProviderRuntime,
  NetworkAuthenticationProvider,
  NetworkCapabilityRegistry,
  NetworkConfiguration,
  NetworkConnectionManager,
  NetworkInventoryCache,
  NetworkMockAdapter,
  NetworkProvider,
  NetworkProviderFactory,
} from './network';

describe('enterprise network provider framework', () => {
  it('discovers required network resources and vendor abstractions', async () => {
    const provider = new NetworkProvider({ adapter: new NetworkMockAdapter() });
    const vendors = await provider.discoverVendorAbstractions();
    const inventory = await provider.discoverInventory();

    expect(vendors).toHaveLength(6);
    expect(vendors.some((vendor) => vendor.vendor === 'cisco')).toBe(true);
    expect(vendors.some((vendor) => vendor.vendor === 'paloAlto')).toBe(true);
    expect(vendors.some((vendor) => vendor.vendor === 'fortinet')).toBe(true);
    expect(vendors.some((vendor) => vendor.vendor === 'juniper')).toBe(true);
    expect(vendors.some((vendor) => vendor.vendor === 'f5')).toBe(true);
    expect(vendors.some((vendor) => vendor.vendor === 'checkPoint')).toBe(true);

    expect(inventory).toHaveLength(16);
    expect(inventory.some((resource) => resource.kind === 'device')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'interface')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'vlan')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'routingTable')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'vrf')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'firewallPolicy')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'acl')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'natRule')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'vpnTunnel')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'loadBalancer')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'highAvailabilityPair')).toBe(true);
  });

  it('supports monitoring metadata and telemetry', async () => {
    const provider = new NetworkProvider({ adapter: new NetworkMockAdapter() });
    const [
      deviceHealth,
      interfaceStatus,
      bandwidth,
      cpu,
      memory,
      environment,
      events,
      alerts,
      syslog,
    ] = await Promise.all([
      provider.getDeviceHealth(),
      provider.getInterfaceStatus(),
      provider.getBandwidthUtilization(),
      provider.getCpuMetrics(),
      provider.getMemoryMetrics(),
      provider.getEnvironmentalSensors(),
      provider.getEvents(),
      provider.getAlerts(),
      provider.getSyslogMetadata(),
    ]);

    expect(deviceHealth[0]?.healthy).toBe(true);
    expect(interfaceStatus[0]?.status).toBe('up');
    expect(bandwidth[0]?.rxPercent).toBe(43);
    expect(cpu[0]?.percent).toBe(37);
    expect(memory[0]?.usedPercent).toBe(54);
    expect(environment[0]?.status).toBe('normal');
    expect(events[0]?.severity).toBe('warning');
    expect(alerts[0]?.severity).toBe('warning');
    expect(syslog[0]?.facility).toBe('local7');
  });

  it('supports refresh, connection test, capability discovery, search, and cache synchronization', async () => {
    const cache = new NetworkInventoryCache();
    const provider = new NetworkProvider({ inventoryCache: cache });

    const refreshed = await provider.refreshInventory();
    provider.synchronizeCache(refreshed);
    const search = await provider.searchDevices({ text: 'fw', vendor: 'paloAlto' });
    const capabilities = await provider.discoverCapabilities();
    const connection = await provider.testConnection({
      endpoint: 'network://enterprise.fabric.example.local',
    });

    expect(refreshed.resources.length).toBe(16);
    expect(provider.getInventoryCache().resources.length).toBe(16);
    expect(search.length).toBeGreaterThan(0);
    expect(capabilities.some((capability) => capability.category === 'operations')).toBe(true);
    expect(connection.connected).toBe(true);
  });

  it('registers provider manifest through factory', () => {
    const factory = new NetworkProviderFactory();
    factory.create();

    const discovered = factory
      .getRegistryService()
      .discover({ capability: 'operations', tags: ['network'] });
    expect(discovered).toHaveLength(1);
  });

  it('runtime reuses lifecycle, authentication, connection, and capability frameworks', async () => {
    const runtime = createNetworkProviderRuntime();
    expect(runtime.lifecycleManager.initialize(runtime.provider)).toBe('initialized');
    await runtime.lifecycleManager.start(runtime.provider);

    const context = await runtime.provider.createContext({
      domainName: 'enterprise.fabric.example.local',
      credentialRef: 'NETWORK_CREDENTIAL_REF',
    });

    const auth = await runtime.authenticationProvider.getProviderAuthentication().authenticate({
      provider: runtime.provider,
      context,
      method: 'username-password',
      actorId: 'network-admin',
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
    expect(resolved.id).toBe('network-operations');

    await runtime.lifecycleManager.stop(runtime.provider);
    expect(runtime.lifecycleManager.getState(runtime.provider.manifest.id)).toBe('stopped');
  });

  it('exposes strongly typed core components', async () => {
    const configuration = new NetworkConfiguration();
    const merged = configuration.merge({ connectionTimeoutMs: 12000 });
    const authProvider = new NetworkAuthenticationProvider();
    const capabilityRegistry = new NetworkCapabilityRegistry('provider-network');
    const connectionManager = new NetworkConnectionManager('provider-network');
    const capabilities = await capabilityRegistry.list();

    expect(merged.connectionTimeoutMs).toBe(12000);
    expect(authProvider.getProviderAuthentication()).toBeDefined();
    expect(connectionManager.getSdkConnectionManager()).toBeDefined();
    expect(capabilities.length).toBe(5);
  });
});
