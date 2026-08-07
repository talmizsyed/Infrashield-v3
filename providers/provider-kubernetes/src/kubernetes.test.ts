import { describe, expect, it } from 'vitest';
import { CapabilityVersion } from '@infrashield/providers';
import {
  createKubernetesProviderRuntime,
  KubernetesAuthenticationProvider,
  KubernetesCapabilityRegistry,
  KubernetesConfiguration,
  KubernetesConnectionManager,
  KubernetesInventoryCache,
  KubernetesMockAdapter,
  KubernetesProvider,
  KubernetesProviderFactory,
} from './kubernetes';

describe('kubernetes enterprise provider framework', () => {
  it('discovers required kubernetes discovery, resources, and platform metadata', async () => {
    const provider = new KubernetesProvider({ adapter: new KubernetesMockAdapter() });
    const inventory = await provider.discoverInventory();

    expect(inventory).toHaveLength(22);
    expect(inventory.some((resource) => resource.kind === 'cluster')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'node')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'namespace')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'apiServerMetadata')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'pod')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'deployment')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'replicaSet')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'statefulSet')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'daemonSet')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'job')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'cronJob')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'service')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'ingress')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'configMap')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'secretMetadata')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'persistentVolume')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'persistentVolumeClaim')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'storageClass')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'customResourceDefinition')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'helmReleaseMetadata')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'rbac')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'serviceAccount')).toBe(true);
  });

  it('supports monitoring metadata and utilization surfaces', async () => {
    const provider = new KubernetesProvider({ adapter: new KubernetesMockAdapter() });
    const [clusterHealth, nodeHealth, podHealth, metrics, events, utilization, alerts] =
      await Promise.all([
        provider.getClusterHealth(),
        provider.getNodeHealth(),
        provider.getPodHealth(),
        provider.getMetrics(),
        provider.getEvents(),
        provider.getResourceUtilization(),
        provider.getAlertsMetadata(),
      ]);

    expect(clusterHealth.healthy).toBe(true);
    expect(nodeHealth[0]?.status).toBe('ready');
    expect(podHealth[0]?.status).toBe('running');
    expect(metrics[0]?.name).toBe('cluster_cpu_usage');
    expect(events[0]?.reason).toBe('BackOff');
    expect(utilization[0]?.cpuPercent).toBe(57);
    expect(alerts[0]?.severity).toBe('warning');
  });

  it('supports refresh, connection test, capability discovery, search, and cache synchronization', async () => {
    const cache = new KubernetesInventoryCache();
    const provider = new KubernetesProvider({ inventoryCache: cache });

    const refreshed = await provider.refreshInventory();
    provider.synchronizeCache(refreshed);
    const search = await provider.searchResources({ text: 'payments', namespace: 'payments' });
    const capabilities = await provider.discoverCapabilities();
    const connection = await provider.testConnection({
      endpoint: 'kubernetes://global-prod-cluster.example.local',
    });

    expect(refreshed.resources.length).toBe(22);
    expect(provider.getInventoryCache().resources.length).toBe(22);
    expect(search.length).toBeGreaterThan(0);
    expect(capabilities.some((capability) => capability.category === 'operations')).toBe(true);
    expect(connection.connected).toBe(true);
  });

  it('registers provider manifest through factory', () => {
    const factory = new KubernetesProviderFactory();
    factory.create();

    const discovered = factory
      .getRegistryService()
      .discover({ capability: 'operations', tags: ['kubernetes'] });
    expect(discovered).toHaveLength(1);
  });

  it('runtime reuses lifecycle, authentication, connection, and capability frameworks', async () => {
    const runtime = createKubernetesProviderRuntime();
    expect(runtime.lifecycleManager.initialize(runtime.provider)).toBe('initialized');
    await runtime.lifecycleManager.start(runtime.provider);

    const context = await runtime.provider.createContext({
      clusterName: 'global-prod-cluster',
      credentialRef: 'KUBERNETES_CREDENTIAL_REF',
    });

    const auth = await runtime.authenticationProvider.getProviderAuthentication().authenticate({
      provider: runtime.provider,
      context,
      method: 'token',
      actorId: 'kubernetes-admin',
      credential: {
        method: 'token',
        token: 'masked-token',
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
    expect(resolved.id).toBe('kubernetes-operations');

    await runtime.lifecycleManager.stop(runtime.provider);
    expect(runtime.lifecycleManager.getState(runtime.provider.manifest.id)).toBe('stopped');
  });

  it('exposes strongly typed core components', async () => {
    const configuration = new KubernetesConfiguration();
    const merged = configuration.merge({ connectionTimeoutMs: 12000 });
    const authProvider = new KubernetesAuthenticationProvider();
    const capabilityRegistry = new KubernetesCapabilityRegistry('provider-kubernetes');
    const connectionManager = new KubernetesConnectionManager('provider-kubernetes');
    const capabilities = await capabilityRegistry.list();

    expect(merged.connectionTimeoutMs).toBe(12000);
    expect(authProvider.getProviderAuthentication()).toBeDefined();
    expect(connectionManager.getSdkConnectionManager()).toBeDefined();
    expect(capabilities.length).toBe(5);
  });
});
