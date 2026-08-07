import { describe, expect, it } from 'vitest';
import { CapabilityVersion } from '@infrashield/providers';
import {
  createMonitoringProviderRuntime,
  DynatraceAdapter,
  ElasticAdapter,
  GrafanaAdapter,
  MonitoringAuthenticationProvider,
  MonitoringCapabilityRegistry,
  MonitoringConfiguration,
  MonitoringConnectionManager,
  MonitoringInventoryCache,
  MonitoringMockAdapter,
  MonitoringProvider,
  MonitoringProviderFactory,
  PrometheusAdapter,
  SolarWindsAdapter,
  SplunkAdapter,
} from './monitoring';

describe('enterprise monitoring provider framework', () => {
  it('discovers platform abstractions and required monitoring objects', async () => {
    const provider = new MonitoringProvider({ adapter: new MonitoringMockAdapter() });

    const platforms = await provider.discoverPlatformAbstractions();
    const inventory = await provider.discoverInventory();

    expect(platforms).toHaveLength(6);
    expect(platforms.some((item) => item.platform === 'solarWinds')).toBe(true);
    expect(platforms.some((item) => item.platform === 'dynatrace')).toBe(true);
    expect(platforms.some((item) => item.platform === 'prometheus')).toBe(true);
    expect(platforms.some((item) => item.platform === 'grafana')).toBe(true);
    expect(platforms.some((item) => item.platform === 'elastic')).toBe(true);
    expect(platforms.some((item) => item.platform === 'splunk')).toBe(true);

    expect(inventory).toHaveLength(15);
    expect(inventory.some((item) => item.kind === 'monitoringServer')).toBe(true);
    expect(inventory.some((item) => item.kind === 'managedNode')).toBe(true);
    expect(inventory.some((item) => item.kind === 'application')).toBe(true);
    expect(inventory.some((item) => item.kind === 'service')).toBe(true);
    expect(inventory.some((item) => item.kind === 'dashboard')).toBe(true);
    expect(inventory.some((item) => item.kind === 'alertRule')).toBe(true);
    expect(inventory.some((item) => item.kind === 'metricsSource')).toBe(true);
    expect(inventory.some((item) => item.kind === 'logSource')).toBe(true);
  });

  it('supports monitoring telemetry metadata', async () => {
    const provider = new MonitoringProvider({ adapter: new MonitoringMockAdapter() });

    const [
      health,
      metrics,
      alerts,
      incidents,
      events,
      performance,
      availability,
      topology,
      apmMetadata,
      logMetadata,
    ] = await Promise.all([
      provider.getHealth(),
      provider.getMetrics(),
      provider.getAlerts(),
      provider.getIncidents(),
      provider.getEvents(),
      provider.getPerformance(),
      provider.getAvailability(),
      provider.getTopologyMetadata(),
      provider.getApmMetadata(),
      provider.getLogMetadata(),
    ]);

    expect(health).toHaveLength(6);
    expect(metrics[0]?.metricName).toBe('request-rate');
    expect(alerts[0]?.severity).toBe('warning');
    expect(incidents[0]?.status).toBe('acknowledged');
    expect(events[0]?.severity).toBe('info');
    expect(performance[0]?.responseTimeMs).toBe(141);
    expect(availability[0]?.availabilityPercent).toBe(99.97);
    expect(topology[0]?.dependencies.length).toBe(3);
    expect(apmMetadata[0]?.serviceCount).toBe(14);
    expect(logMetadata[0]?.dailyVolumeGb).toBe(820);
  });

  it('supports refresh, connection test, capability discovery, search, and cache synchronization', async () => {
    const cache = new MonitoringInventoryCache();
    const provider = new MonitoringProvider({ inventoryCache: cache });

    const refreshed = await provider.refreshInventory();
    provider.synchronizeCache(refreshed);

    const search = await provider.searchMonitoringObjects({
      text: 'payments',
      kind: 'application',
    });
    const capabilities = await provider.discoverCapabilities();
    const connection = await provider.testConnection({
      endpoint: 'monitoring://enterprise.observability.example.local',
    });

    expect(refreshed.objects).toHaveLength(15);
    expect(provider.getInventoryCache().objects).toHaveLength(15);
    expect(search.length).toBeGreaterThan(0);
    expect(capabilities.some((item) => item.category === 'operations')).toBe(true);
    expect(connection.connected).toBe(true);
  });

  it('registers provider manifest through factory', () => {
    const factory = new MonitoringProviderFactory();
    factory.create();

    const discovered = factory
      .getRegistryService()
      .discover({ capability: 'operations', tags: ['monitoring'] });
    expect(discovered).toHaveLength(1);
  });

  it('runtime reuses lifecycle, authentication, connection, and capability frameworks', async () => {
    const runtime = createMonitoringProviderRuntime();
    expect(runtime.lifecycleManager.initialize(runtime.provider)).toBe('initialized');
    await runtime.lifecycleManager.start(runtime.provider);

    const context = await runtime.provider.createContext({
      organizationId: 'enterprise-observability',
      credentialRef: 'MONITORING_CREDENTIAL_REF',
    });

    const auth = await runtime.authenticationProvider.getProviderAuthentication().authenticate({
      provider: runtime.provider,
      context,
      method: 'api-key',
      actorId: 'monitoring-admin',
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
    expect(resolved.id).toBe('monitoring-operations');

    await runtime.lifecycleManager.stop(runtime.provider);
    expect(runtime.lifecycleManager.getState(runtime.provider.manifest.id)).toBe('stopped');
  });

  it('exposes strongly typed core components and platform adapter classes', async () => {
    const configuration = new MonitoringConfiguration();
    const merged = configuration.merge({
      connectionTimeoutMs: 15000,
      enabledPlatforms: ['solarWinds', 'prometheus', 'elastic'],
    });
    const authProvider = new MonitoringAuthenticationProvider();
    const capabilityRegistry = new MonitoringCapabilityRegistry('provider-monitoring');
    const connectionManager = new MonitoringConnectionManager('provider-monitoring');
    const capabilities = await capabilityRegistry.list();

    const adapters = [
      new SolarWindsAdapter(),
      new DynatraceAdapter(),
      new PrometheusAdapter(),
      new GrafanaAdapter(),
      new ElasticAdapter(),
      new SplunkAdapter(),
    ];
    const adapterPlatforms = await Promise.all(
      adapters.map((adapter) => adapter.discoverPlatforms()),
    );

    expect(merged.connectionTimeoutMs).toBe(15000);
    expect(merged.enabledPlatforms).toEqual(['solarWinds', 'prometheus', 'elastic']);
    expect(authProvider.getProviderAuthentication()).toBeDefined();
    expect(connectionManager.getSdkConnectionManager()).toBeDefined();
    expect(capabilities.length).toBe(8);
    expect(adapterPlatforms.every((platforms) => platforms.length === 1)).toBe(true);
  });
});
