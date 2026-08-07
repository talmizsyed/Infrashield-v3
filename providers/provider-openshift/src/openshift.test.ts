import { describe, expect, it } from 'vitest';
import { StructuredLogger, createMemoryLogSink } from '@infrashield/core-infrastructure';
import { CapabilityVersion } from '@infrashield/providers';
import {
  createOpenShiftProviderRuntime,
  type IOpenShiftSdk,
  OpenShiftLiveAdapter,
  OpenShiftSdkAdapter,
  OpenShiftSessionManager,
  OpenShiftAuthenticationProvider,
  OpenShiftCapabilityRegistry,
  OpenShiftConfiguration,
  OpenShiftConnectionManager,
  OpenShiftInventoryCache,
  OpenShiftMockAdapter,
  OpenShiftProvider,
  OpenShiftProviderFactory,
} from './openshift';

describe('openshift enterprise provider framework', () => {
  it('discovers required inventory for discovery/resources/networking/storage/platform', async () => {
    const provider = new OpenShiftProvider({ adapter: new OpenShiftMockAdapter() });
    const inventory = await provider.discoverInventory();

    expect(inventory).toHaveLength(22);
    expect(inventory.some((resource) => resource.kind === 'cluster')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'project')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'namespace')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'node')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'pod')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'deployment')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'statefulSet')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'daemonSet')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'replicaSet')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'job')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'cronJob')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'service')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'route')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'ingress')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'persistentVolume')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'persistentVolumeClaim')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'storageClass')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'operator')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'operatorLifecycleManager')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'imageStream')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'configMap')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'secretMetadata')).toBe(true);
  });

  it('supports monitoring services and metadata-only logs/alerts', async () => {
    const provider = new OpenShiftProvider({ adapter: new OpenShiftMockAdapter() });
    const [health, metrics, events, logs, alerts] = await Promise.all([
      provider.getClusterHealth(),
      provider.getMetrics(),
      provider.getEvents(),
      provider.getLogMetadata(),
      provider.getAlertMetadata(),
    ]);

    expect(health.healthy).toBe(true);
    expect(metrics.length).toBeGreaterThan(0);
    expect(events[0]?.severity).toBe('info');
    expect(logs[0]?.resourceId).toBe('pod-1');
    expect(alerts[0]?.status).toBe('firing');
  });

  it('supports refresh, cache, connection test, capability discovery and resource search', async () => {
    const cache = new OpenShiftInventoryCache();
    const provider = new OpenShiftProvider({ inventoryCache: cache });

    const refreshed = await provider.refreshInventory();
    provider.synchronizeCache(refreshed);
    const search = await provider.searchResources({ text: 'payments' });
    const capabilities = await provider.discoverCapabilities();
    const connection = await provider.testConnection({
      endpoint: 'https://api.openshift.enterprise.local:6443',
    });

    expect(refreshed.resources.length).toBe(23);
    expect(provider.getInventoryCache().resources.length).toBe(23);
    expect(search.length).toBeGreaterThan(0);
    expect(capabilities.some((capability) => capability.category === 'operations')).toBe(true);
    expect(connection.connected).toBe(true);
  });

  it('factory auto-registers provider with provider registry', () => {
    const factory = new OpenShiftProviderFactory();
    factory.create();

    const discovered = factory.getRegistryService().discover({
      capability: 'operations',
      tags: ['openshift'],
    });
    expect(discovered).toHaveLength(1);
  });

  it('runtime reuses lifecycle, authentication and connection frameworks', async () => {
    const runtime = createOpenShiftProviderRuntime();
    expect(runtime.lifecycleManager.initialize(runtime.provider)).toBe('initialized');
    await runtime.lifecycleManager.start(runtime.provider);

    const context = await runtime.provider.createContext({
      credentialRef: 'OPENSHIFT_CREDENTIAL_REF',
    });

    const auth = await runtime.authenticationProvider.getProviderAuthentication().authenticate({
      provider: runtime.provider,
      context,
      method: 'token',
      actorId: 'openshift-admin',
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

    const resolvedCapability = runtime.capabilityResolver.resolve(runtime.provider, {
      name: 'operations',
      version: new CapabilityVersion('1.0.0'),
      requiredFeatureFlags: ['configurationDriven'],
    });

    expect(auth.success).toBe(true);
    expect(connection.status).toBe('connected');
    expect(health?.status).toBe('connected');
    expect(resolvedCapability.id).toBe('openshift-operations');

    await runtime.lifecycleManager.stop(runtime.provider);
    expect(runtime.lifecycleManager.getState(runtime.provider.manifest.id)).toBe('stopped');
  });

  it('exposes strongly typed core components', async () => {
    const configuration = new OpenShiftConfiguration();
    const merged = configuration.merge({ requestTimeoutMs: 20000 });
    const authProvider = new OpenShiftAuthenticationProvider();
    const capabilityRegistry = new OpenShiftCapabilityRegistry('provider-openshift');
    const connectionManager = new OpenShiftConnectionManager('provider-openshift');
    const capabilities = await capabilityRegistry.list();

    expect(merged.requestTimeoutMs).toBe(20000);
    expect(authProvider.getProviderAuthentication()).toBeDefined();
    expect(connectionManager.getSdkConnectionManager()).toBeDefined();
    expect(capabilities.length).toBe(7);
  });

  it('uses OpenShiftLiveAdapter by default without changing the provider contract', async () => {
    const provider = new OpenShiftProvider();
    const inventory = await provider.discoverInventory();

    expect(inventory).toHaveLength(23);
    expect(inventory.some((resource) => resource.kind === 'cluster')).toBe(true);
  });

  it('supports live adapter services through an injected sdk abstraction', async () => {
    const sdk: IOpenShiftSdk = {
      discoverClusters: async () => [
        {
          id: 'cluster:test:cluster:test',
          kind: 'cluster',
          name: 'test',
          cluster: 'test',
          labels: Object.freeze({ source: 'sdk' }),
          metadata: Object.freeze({ endpoint: 'https://test' }),
        },
      ],
      discoverProjects: async () => [],
      discoverNamespaces: async () => [],
      listNodes: async () => [],
      listPods: async () => [],
      listDeployments: async () => [],
      listStatefulSets: async () => [],
      listDaemonSets: async () => [],
      listReplicaSets: async () => [],
      listJobs: async () => [],
      listCronJobs: async () => [],
      listServices: async () => [],
      listRoutes: async () => [],
      listIngresses: async () => [],
      listOperators: async () => [],
      listImageStreams: async () => [],
      listConfigMaps: async () => [],
      listPersistentVolumes: async () => [],
      listPersistentVolumeClaims: async () => [],
      listStorageClasses: async () => [],
      listOperatorLifecycleManagers: async () => [],
      listSecretMetadata: async () => [],
      getClusterHealth: async () => ({
        healthy: true,
        status: 'healthy',
        checkedAt: '2026-01-01T00:00:00.000Z',
        details: Object.freeze({ mode: 'sdk' }),
      }),
      getMetrics: async () => [],
      getEvents: async () => [],
      getLogMetadata: async () => [],
      getAlertMetadata: async () => [],
      testConnection: async () => ({ connected: true, latencyMs: 5, message: 'ok' }),
      disconnect: async () => undefined,
    };
    const adapter = new OpenShiftLiveAdapter({ sdk });

    const inventory = await adapter.searchResources({ text: 'test' });
    const health = await adapter.getClusterHealth();

    expect(inventory).toHaveLength(1);
    expect(health.healthy).toBe(true);
  });

  it('reuses shared connection management for live session reuse', async () => {
    const sessionManager = new OpenShiftSessionManager();

    const first = await sessionManager.getConnection();
    const second = await sessionManager.getConnection();
    await sessionManager.refreshConnection();
    const refreshed = await sessionManager.getConnection();

    expect(first.client.authorizationHeader ?? first.client.kubeconfig).toBeDefined();
    expect(second.id).toBe(first.id);
    expect(refreshed.id).toBe(first.id);
  });

  it('emits warning logs for transient live sdk retries', async () => {
    const sink = createMemoryLogSink();
    const logger = new StructuredLogger({
      loggerId: 'openshift-live-test' as never,
      sink,
      minLevel: 'debug',
    });
    let attempts = 0;
    const adapter = new OpenShiftSdkAdapter({
      logger,
      clientBundleFactory: () => ({
        core: {
          listNamespace: async () => ({ body: { items: [] } }),
          listNode: async () => {
            attempts += 1;
            if (attempts === 1) {
              throw new Error('temporary timeout');
            }
            return {
              body: {
                items: [
                  {
                    metadata: { name: 'worker-01', labels: { role: 'worker' } },
                    status: { conditions: [{ type: 'Ready', status: 'True' }] },
                  },
                ],
              },
            };
          },
          listPodForAllNamespaces: async () => ({
            body: {
              items: [
                {
                  metadata: { name: 'pod-1', namespace: 'payments', labels: { app: 'payments' } },
                  status: { phase: 'Running' },
                },
              ],
            },
          }),
          listServiceForAllNamespaces: async () => ({ body: { items: [] } }),
          listPersistentVolume: async () => ({ body: { items: [] } }),
          listPersistentVolumeClaimForAllNamespaces: async () => ({ body: { items: [] } }),
          listConfigMapForAllNamespaces: async () => ({ body: { items: [] } }),
          listSecretForAllNamespaces: async () => ({ body: { items: [] } }),
        },
        apps: {
          listDeploymentForAllNamespaces: async () => ({ body: { items: [] } }),
          listStatefulSetForAllNamespaces: async () => ({ body: { items: [] } }),
          listDaemonSetForAllNamespaces: async () => ({ body: { items: [] } }),
          listReplicaSetForAllNamespaces: async () => ({ body: { items: [] } }),
        },
        batch: {
          listJobForAllNamespaces: async () => ({ body: { items: [] } }),
          listCronJobForAllNamespaces: async () => ({ body: { items: [] } }),
        },
        networking: {
          listIngressForAllNamespaces: async () => ({ body: { items: [] } }),
        },
        storage: {
          listStorageClass: async () => ({ body: { items: [] } }),
        },
        custom: {
          listClusterCustomObject: async () => ({ body: { items: [] } }),
        },
      }),
    });

    const nodes = await adapter.listNodes();

    expect(nodes).toHaveLength(1);
    expect(sink.records.some((record) => record.level === 'warn')).toBe(true);
  });
});
