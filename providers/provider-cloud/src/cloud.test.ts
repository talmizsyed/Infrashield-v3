import { describe, expect, it } from 'vitest';
import { CapabilityVersion } from '@infrashield/providers';
import {
  CloudAuthenticationProvider,
  CloudCapabilityRegistry,
  CloudConfiguration,
  CloudConnectionManager,
  CloudInventoryCache,
  CloudMockAdapter,
  CloudProvider,
  CloudProviderFactory,
  createCloudProviderRuntime,
} from './cloud';

describe('enterprise cloud provider framework', () => {
  it('discovers provider abstractions and required cloud resources', async () => {
    const provider = new CloudProvider({ adapter: new CloudMockAdapter() });

    const abstractions = await provider.discoverProviderAbstractions();
    const inventory = await provider.discoverInventory();

    expect(abstractions).toHaveLength(3);
    expect(abstractions.some((item) => item.vendor === 'aws')).toBe(true);
    expect(abstractions.some((item) => item.vendor === 'azure')).toBe(true);
    expect(abstractions.some((item) => item.vendor === 'gcp')).toBe(true);

    expect(inventory.length).toBeGreaterThanOrEqual(24);
    expect(inventory.some((resource) => resource.kind === 'account')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'subscription')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'project')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'region')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'availabilityZone')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'virtualMachine')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'autoScalingGroup')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'image')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'instanceType')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'blockStorage')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'objectStorage')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'fileStorage')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'virtualNetwork')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'subnet')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'routeTable')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'securityGroup')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'loadBalancer')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'publicIp')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'kubernetesCluster')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'containerRegistry')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'iamUser')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'role')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'policy')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'serviceAccount')).toBe(true);
  });

  it('supports monitoring, utilization, cost metadata, events, and alerts', async () => {
    const provider = new CloudProvider({ adapter: new CloudMockAdapter() });

    const [health, metrics, alerts, events, utilization, costMetadata] = await Promise.all([
      provider.getHealth(),
      provider.getMetrics(),
      provider.getAlerts(),
      provider.getEvents(),
      provider.getResourceUtilization(),
      provider.getCostMetadata(),
    ]);

    expect(health).toHaveLength(3);
    expect(metrics[0]?.metricName).toBe('vm-running-count');
    expect(alerts[0]?.severity).toBe('warning');
    expect(events[0]?.severity).toBe('warning');
    expect(utilization[0]?.cpuPercent).toBe(47);
    expect(costMetadata[0]?.monthlyCostEstimate).toBe(124500);
  });

  it('supports refresh, connection test, capability discovery, search, and cache synchronization', async () => {
    const cache = new CloudInventoryCache();
    const provider = new CloudProvider({ inventoryCache: cache });

    const refreshed = await provider.refreshInventory();
    provider.synchronizeCache(refreshed);

    const search = await provider.searchResources({ text: 'payments', kind: 'virtualMachine' });
    const capabilities = await provider.discoverCapabilities();
    const connection = await provider.testConnection({
      endpoint: 'cloud://enterprise.control-plane.example.local',
    });

    expect(refreshed.resources.length).toBeGreaterThanOrEqual(24);
    expect(provider.getInventoryCache().resources.length).toBeGreaterThanOrEqual(24);
    expect(search.length).toBeGreaterThan(0);
    expect(capabilities.some((capability) => capability.category === 'operations')).toBe(true);
    expect(connection.connected).toBe(true);
  });

  it('registers provider manifest through factory', () => {
    const factory = new CloudProviderFactory();
    factory.create();

    const discovered = factory
      .getRegistryService()
      .discover({ capability: 'operations', tags: ['cloud'] });
    expect(discovered).toHaveLength(1);
  });

  it('runtime reuses lifecycle, authentication, connection, and capability frameworks', async () => {
    const runtime = createCloudProviderRuntime();
    expect(runtime.lifecycleManager.initialize(runtime.provider)).toBe('initialized');
    await runtime.lifecycleManager.start(runtime.provider);

    const context = await runtime.provider.createContext({
      organizationId: 'enterprise-platform',
      credentialRef: 'CLOUD_CREDENTIAL_REF',
    });

    const auth = await runtime.authenticationProvider.getProviderAuthentication().authenticate({
      provider: runtime.provider,
      context,
      method: 'api-key',
      actorId: 'cloud-admin',
      credential: {
        method: 'api-key',
        apiKey: 'masked-api-key',
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
    expect(resolved.id).toBe('cloud-operations');

    await runtime.lifecycleManager.stop(runtime.provider);
    expect(runtime.lifecycleManager.getState(runtime.provider.manifest.id)).toBe('stopped');
  });

  it('exposes strongly typed core components', async () => {
    const configuration = new CloudConfiguration();
    const merged = configuration.merge({
      connectionTimeoutMs: 15000,
      enabledVendors: ['aws', 'gcp'],
    });
    const authProvider = new CloudAuthenticationProvider();
    const capabilityRegistry = new CloudCapabilityRegistry('provider-cloud');
    const connectionManager = new CloudConnectionManager('provider-cloud');
    const capabilities = await capabilityRegistry.list();

    expect(merged.connectionTimeoutMs).toBe(15000);
    expect(merged.enabledVendors).toEqual(['aws', 'gcp']);
    expect(authProvider.getProviderAuthentication()).toBeDefined();
    expect(connectionManager.getSdkConnectionManager()).toBeDefined();
    expect(capabilities.length).toBe(8);
  });
});
