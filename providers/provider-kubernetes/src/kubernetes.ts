import type { SerializableValueObject } from '@infrashield/contracts';
import { ToolCapability } from '@infrashield/ai-tools';
import {
  AuthenticationResult,
  BaseProvider,
  CapabilityDefinition,
  CapabilityMetadata,
  CapabilityResolver,
  CapabilityValidator,
  CapabilityVersion,
  ConnectionFactory,
  ConnectionHealth,
  ConnectionPool,
  CredentialStore,
  ProviderAuthentication,
  ProviderCapabilities,
  ProviderCapabilityRegistry,
  ProviderConfiguration,
  ProviderConnection,
  ProviderConnectionManager,
  ProviderHealthMonitor,
  ProviderLifecycleManager,
  ProviderManifest,
  ProviderMetadata,
  ProviderRecovery,
  ProviderRegistryService,
  ProviderShutdown,
  ProviderStartup,
  ProviderVersion,
} from '@infrashield/providers';

export type KubernetesResourceKind =
  | 'cluster'
  | 'node'
  | 'namespace'
  | 'apiServerMetadata'
  | 'pod'
  | 'deployment'
  | 'replicaSet'
  | 'statefulSet'
  | 'daemonSet'
  | 'job'
  | 'cronJob'
  | 'service'
  | 'ingress'
  | 'configMap'
  | 'secretMetadata'
  | 'persistentVolume'
  | 'persistentVolumeClaim'
  | 'storageClass'
  | 'customResourceDefinition'
  | 'helmReleaseMetadata'
  | 'rbac'
  | 'serviceAccount';

export interface KubernetesProviderConfiguration extends SerializableValueObject {
  readonly endpoint: string;
  readonly clusterName: string;
  readonly credentialRef: string;
  readonly namespaceScope: string;
  readonly readOnly: boolean;
  readonly connectionTimeoutMs: number;
  readonly inventoryCacheTtlSeconds: number;
}

export interface KubernetesInventoryResource {
  readonly id: string;
  readonly kind: KubernetesResourceKind;
  readonly name: string;
  readonly cluster: string;
  readonly namespace?: string;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface KubernetesClusterHealth {
  readonly healthy: boolean;
  readonly status: 'healthy' | 'degraded';
  readonly checkedAt: string;
  readonly details: Readonly<Record<string, string | number | boolean>>;
}

export interface KubernetesNodeHealth {
  readonly nodeName: string;
  readonly healthy: boolean;
  readonly status: 'ready' | 'notReady' | 'degraded';
  readonly checkedAt: string;
}

export interface KubernetesPodHealth {
  readonly podName: string;
  readonly namespace: string;
  readonly healthy: boolean;
  readonly status: 'running' | 'pending' | 'failed' | 'unknown';
  readonly checkedAt: string;
}

export interface KubernetesMetric {
  readonly scope: 'cluster' | 'node' | 'namespace' | 'pod';
  readonly name: string;
  readonly value: number;
  readonly unit: string;
  readonly timestamp: string;
}

export interface KubernetesEventMetadata {
  readonly id: string;
  readonly type: 'Normal' | 'Warning';
  readonly reason: string;
  readonly involvedObject: string;
  readonly timestamp: string;
}

export interface KubernetesResourceUtilization {
  readonly scope: 'cluster' | 'node' | 'namespace';
  readonly cpuPercent: number;
  readonly memoryPercent: number;
  readonly storagePercent: number;
  readonly timestamp: string;
}

export interface KubernetesAlertMetadata {
  readonly id: string;
  readonly severity: 'info' | 'warning' | 'critical';
  readonly source: string;
  readonly summary: string;
  readonly timestamp: string;
}

export interface KubernetesConnectionTestResult {
  readonly connected: boolean;
  readonly latencyMs: number;
  readonly message: string;
}

export interface KubernetesCapabilityDescriptor {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly category: 'discovery' | 'resources' | 'platform' | 'monitoring' | 'operations';
}

export interface KubernetesSearchQuery {
  readonly text: string;
  readonly kind?: KubernetesResourceKind;
  readonly cluster?: string;
  readonly namespace?: string;
}

export interface KubernetesInventoryCacheSnapshot {
  readonly resources: readonly KubernetesInventoryResource[];
  readonly refreshedAt?: string;
}

export interface IKubernetesAdapter {
  discoverClusters(): Promise<readonly KubernetesInventoryResource[]>;
  discoverNodes(): Promise<readonly KubernetesInventoryResource[]>;
  discoverNamespaces(): Promise<readonly KubernetesInventoryResource[]>;
  discoverApiServerMetadata(): Promise<readonly KubernetesInventoryResource[]>;
  discoverPods(): Promise<readonly KubernetesInventoryResource[]>;
  discoverDeployments(): Promise<readonly KubernetesInventoryResource[]>;
  discoverReplicaSets(): Promise<readonly KubernetesInventoryResource[]>;
  discoverStatefulSets(): Promise<readonly KubernetesInventoryResource[]>;
  discoverDaemonSets(): Promise<readonly KubernetesInventoryResource[]>;
  discoverJobs(): Promise<readonly KubernetesInventoryResource[]>;
  discoverCronJobs(): Promise<readonly KubernetesInventoryResource[]>;
  discoverServices(): Promise<readonly KubernetesInventoryResource[]>;
  discoverIngress(): Promise<readonly KubernetesInventoryResource[]>;
  discoverConfigMaps(): Promise<readonly KubernetesInventoryResource[]>;
  discoverSecretsMetadata(): Promise<readonly KubernetesInventoryResource[]>;
  discoverPersistentVolumes(): Promise<readonly KubernetesInventoryResource[]>;
  discoverPersistentVolumeClaims(): Promise<readonly KubernetesInventoryResource[]>;
  discoverStorageClasses(): Promise<readonly KubernetesInventoryResource[]>;
  discoverCustomResourceDefinitions(): Promise<readonly KubernetesInventoryResource[]>;
  discoverHelmReleasesMetadata(): Promise<readonly KubernetesInventoryResource[]>;
  discoverRbac(): Promise<readonly KubernetesInventoryResource[]>;
  discoverServiceAccounts(): Promise<readonly KubernetesInventoryResource[]>;
  getClusterHealth(): Promise<KubernetesClusterHealth>;
  getNodeHealth(): Promise<readonly KubernetesNodeHealth[]>;
  getPodHealth(): Promise<readonly KubernetesPodHealth[]>;
  getMetrics(): Promise<readonly KubernetesMetric[]>;
  getEvents(): Promise<readonly KubernetesEventMetadata[]>;
  getResourceUtilization(): Promise<readonly KubernetesResourceUtilization[]>;
  getAlertsMetadata(): Promise<readonly KubernetesAlertMetadata[]>;
  refreshInventory(): Promise<{ readonly refreshedAt: string }>;
  testConnection(
    configuration: Readonly<KubernetesProviderConfiguration>,
  ): Promise<KubernetesConnectionTestResult>;
  discoverCapabilities(): Promise<readonly KubernetesCapabilityDescriptor[]>;
  searchResources(query: KubernetesSearchQuery): Promise<readonly KubernetesInventoryResource[]>;
}

const DATASET_TIMESTAMP = '2026-01-01T00:00:00.000Z';

function createMetadata(metadata: Record<string, string>): Readonly<Record<string, string>> {
  return metadata;
}

const MOCK_INVENTORY: readonly KubernetesInventoryResource[] = Object.freeze([
  {
    id: 'cluster-1',
    kind: 'cluster',
    name: 'global-prod-cluster',
    cluster: 'global-prod-cluster',
    metadata: createMetadata({ provider: 'cncf-compliant' }),
  },
  {
    id: 'node-1',
    kind: 'node',
    name: 'node-pool-a-01',
    cluster: 'global-prod-cluster',
    metadata: createMetadata({ role: 'worker' }),
  },
  {
    id: 'namespace-1',
    kind: 'namespace',
    name: 'payments',
    cluster: 'global-prod-cluster',
    namespace: 'payments',
    metadata: createMetadata({ tier: 'critical' }),
  },
  {
    id: 'api-1',
    kind: 'apiServerMetadata',
    name: 'kube-apiserver',
    cluster: 'global-prod-cluster',
    metadata: createMetadata({ version: 'v1.31.0' }),
  },
  {
    id: 'pod-1',
    kind: 'pod',
    name: 'payments-api-7d5dd4f58d-4f2h2',
    cluster: 'global-prod-cluster',
    namespace: 'payments',
    metadata: createMetadata({ phase: 'Running' }),
  },
  {
    id: 'deployment-1',
    kind: 'deployment',
    name: 'payments-api',
    cluster: 'global-prod-cluster',
    namespace: 'payments',
    metadata: createMetadata({ replicas: '3' }),
  },
  {
    id: 'replicaset-1',
    kind: 'replicaSet',
    name: 'payments-api-7d5dd4f58d',
    cluster: 'global-prod-cluster',
    namespace: 'payments',
    metadata: createMetadata({ replicas: '3' }),
  },
  {
    id: 'statefulset-1',
    kind: 'statefulSet',
    name: 'payments-db',
    cluster: 'global-prod-cluster',
    namespace: 'payments',
    metadata: createMetadata({ replicas: '2' }),
  },
  {
    id: 'daemonset-1',
    kind: 'daemonSet',
    name: 'node-exporter',
    cluster: 'global-prod-cluster',
    namespace: 'monitoring',
    metadata: createMetadata({ desiredNumberScheduled: '12' }),
  },
  {
    id: 'job-1',
    kind: 'job',
    name: 'payments-reindex-20260101',
    cluster: 'global-prod-cluster',
    namespace: 'payments',
    metadata: createMetadata({ completions: '1' }),
  },
  {
    id: 'cronjob-1',
    kind: 'cronJob',
    name: 'payments-nightly-backup',
    cluster: 'global-prod-cluster',
    namespace: 'payments',
    metadata: createMetadata({ schedule: '0 2 * * *' }),
  },
  {
    id: 'service-1',
    kind: 'service',
    name: 'payments-api',
    cluster: 'global-prod-cluster',
    namespace: 'payments',
    metadata: createMetadata({ type: 'ClusterIP' }),
  },
  {
    id: 'ingress-1',
    kind: 'ingress',
    name: 'payments-edge',
    cluster: 'global-prod-cluster',
    namespace: 'payments',
    metadata: createMetadata({ class: 'nginx' }),
  },
  {
    id: 'configmap-1',
    kind: 'configMap',
    name: 'payments-config',
    cluster: 'global-prod-cluster',
    namespace: 'payments',
    metadata: createMetadata({ keys: '7' }),
  },
  {
    id: 'secret-1',
    kind: 'secretMetadata',
    name: 'payments-db-credentials',
    cluster: 'global-prod-cluster',
    namespace: 'payments',
    metadata: createMetadata({ type: 'Opaque' }),
  },
  {
    id: 'pv-1',
    kind: 'persistentVolume',
    name: 'pv-payments-db-01',
    cluster: 'global-prod-cluster',
    metadata: createMetadata({ capacity: '200Gi' }),
  },
  {
    id: 'pvc-1',
    kind: 'persistentVolumeClaim',
    name: 'payments-db-data',
    cluster: 'global-prod-cluster',
    namespace: 'payments',
    metadata: createMetadata({ requested: '200Gi' }),
  },
  {
    id: 'sc-1',
    kind: 'storageClass',
    name: 'fast-ssd',
    cluster: 'global-prod-cluster',
    metadata: createMetadata({ provisioner: 'csi.example.com' }),
  },
  {
    id: 'crd-1',
    kind: 'customResourceDefinition',
    name: 'widgets.platform.example.com',
    cluster: 'global-prod-cluster',
    metadata: createMetadata({ group: 'platform.example.com' }),
  },
  {
    id: 'helm-1',
    kind: 'helmReleaseMetadata',
    name: 'payments-stack',
    cluster: 'global-prod-cluster',
    namespace: 'payments',
    metadata: createMetadata({ chart: 'payments-stack-2.4.1' }),
  },
  {
    id: 'rbac-1',
    kind: 'rbac',
    name: 'payments-operator-rolebinding',
    cluster: 'global-prod-cluster',
    namespace: 'payments',
    metadata: createMetadata({ kind: 'RoleBinding' }),
  },
  {
    id: 'sa-1',
    kind: 'serviceAccount',
    name: 'payments-operator',
    cluster: 'global-prod-cluster',
    namespace: 'payments',
    metadata: createMetadata({ automountToken: 'true' }),
  },
]);

const MOCK_NODE_HEALTH: readonly KubernetesNodeHealth[] = Object.freeze([
  {
    nodeName: 'node-pool-a-01',
    healthy: true,
    status: 'ready',
    checkedAt: DATASET_TIMESTAMP,
  },
]);
const MOCK_POD_HEALTH: readonly KubernetesPodHealth[] = Object.freeze([
  {
    podName: 'payments-api-7d5dd4f58d-4f2h2',
    namespace: 'payments',
    healthy: true,
    status: 'running',
    checkedAt: DATASET_TIMESTAMP,
  },
]);
const MOCK_METRICS: readonly KubernetesMetric[] = Object.freeze([
  {
    scope: 'cluster',
    name: 'cluster_cpu_usage',
    value: 57,
    unit: 'percent',
    timestamp: DATASET_TIMESTAMP,
  },
]);
const MOCK_EVENTS: readonly KubernetesEventMetadata[] = Object.freeze([
  {
    id: 'event-1',
    type: 'Warning',
    reason: 'BackOff',
    involvedObject: 'pod/payments-api-7d5dd4f58d-4f2h2',
    timestamp: DATASET_TIMESTAMP,
  },
]);
const MOCK_UTILIZATION: readonly KubernetesResourceUtilization[] = Object.freeze([
  {
    scope: 'cluster',
    cpuPercent: 57,
    memoryPercent: 63,
    storagePercent: 49,
    timestamp: DATASET_TIMESTAMP,
  },
]);
const MOCK_ALERTS: readonly KubernetesAlertMetadata[] = Object.freeze([
  {
    id: 'alert-1',
    severity: 'warning',
    source: 'prometheus-rules',
    summary: 'High API server request latency',
    timestamp: DATASET_TIMESTAMP,
  },
]);

export class KubernetesMockAdapter implements IKubernetesAdapter {
  public async discoverClusters(): Promise<readonly KubernetesInventoryResource[]> {
    return this.byKind('cluster');
  }
  public async discoverNodes(): Promise<readonly KubernetesInventoryResource[]> {
    return this.byKind('node');
  }
  public async discoverNamespaces(): Promise<readonly KubernetesInventoryResource[]> {
    return this.byKind('namespace');
  }
  public async discoverApiServerMetadata(): Promise<readonly KubernetesInventoryResource[]> {
    return this.byKind('apiServerMetadata');
  }
  public async discoverPods(): Promise<readonly KubernetesInventoryResource[]> {
    return this.byKind('pod');
  }
  public async discoverDeployments(): Promise<readonly KubernetesInventoryResource[]> {
    return this.byKind('deployment');
  }
  public async discoverReplicaSets(): Promise<readonly KubernetesInventoryResource[]> {
    return this.byKind('replicaSet');
  }
  public async discoverStatefulSets(): Promise<readonly KubernetesInventoryResource[]> {
    return this.byKind('statefulSet');
  }
  public async discoverDaemonSets(): Promise<readonly KubernetesInventoryResource[]> {
    return this.byKind('daemonSet');
  }
  public async discoverJobs(): Promise<readonly KubernetesInventoryResource[]> {
    return this.byKind('job');
  }
  public async discoverCronJobs(): Promise<readonly KubernetesInventoryResource[]> {
    return this.byKind('cronJob');
  }
  public async discoverServices(): Promise<readonly KubernetesInventoryResource[]> {
    return this.byKind('service');
  }
  public async discoverIngress(): Promise<readonly KubernetesInventoryResource[]> {
    return this.byKind('ingress');
  }
  public async discoverConfigMaps(): Promise<readonly KubernetesInventoryResource[]> {
    return this.byKind('configMap');
  }
  public async discoverSecretsMetadata(): Promise<readonly KubernetesInventoryResource[]> {
    return this.byKind('secretMetadata');
  }
  public async discoverPersistentVolumes(): Promise<readonly KubernetesInventoryResource[]> {
    return this.byKind('persistentVolume');
  }
  public async discoverPersistentVolumeClaims(): Promise<readonly KubernetesInventoryResource[]> {
    return this.byKind('persistentVolumeClaim');
  }
  public async discoverStorageClasses(): Promise<readonly KubernetesInventoryResource[]> {
    return this.byKind('storageClass');
  }
  public async discoverCustomResourceDefinitions(): Promise<
    readonly KubernetesInventoryResource[]
  > {
    return this.byKind('customResourceDefinition');
  }
  public async discoverHelmReleasesMetadata(): Promise<readonly KubernetesInventoryResource[]> {
    return this.byKind('helmReleaseMetadata');
  }
  public async discoverRbac(): Promise<readonly KubernetesInventoryResource[]> {
    return this.byKind('rbac');
  }
  public async discoverServiceAccounts(): Promise<readonly KubernetesInventoryResource[]> {
    return this.byKind('serviceAccount');
  }
  public async getClusterHealth(): Promise<KubernetesClusterHealth> {
    return {
      healthy: true,
      status: 'healthy',
      checkedAt: DATASET_TIMESTAMP,
      details: {
        provider: 'kubernetes-enterprise',
        mode: 'mock-adapter',
        resources: MOCK_INVENTORY.length,
      },
    };
  }
  public async getNodeHealth(): Promise<readonly KubernetesNodeHealth[]> {
    return MOCK_NODE_HEALTH;
  }
  public async getPodHealth(): Promise<readonly KubernetesPodHealth[]> {
    return MOCK_POD_HEALTH;
  }
  public async getMetrics(): Promise<readonly KubernetesMetric[]> {
    return MOCK_METRICS;
  }
  public async getEvents(): Promise<readonly KubernetesEventMetadata[]> {
    return MOCK_EVENTS;
  }
  public async getResourceUtilization(): Promise<readonly KubernetesResourceUtilization[]> {
    return MOCK_UTILIZATION;
  }
  public async getAlertsMetadata(): Promise<readonly KubernetesAlertMetadata[]> {
    return MOCK_ALERTS;
  }
  public async refreshInventory(): Promise<{ readonly refreshedAt: string }> {
    return { refreshedAt: DATASET_TIMESTAMP };
  }
  public async testConnection(
    configuration: Readonly<KubernetesProviderConfiguration>,
  ): Promise<KubernetesConnectionTestResult> {
    return {
      connected: configuration.endpoint.startsWith('kubernetes://'),
      latencyMs: 14,
      message:
        'Kubernetes connection test succeeded through adapter abstraction without kubectl or client library usage.',
    };
  }
  public async discoverCapabilities(): Promise<readonly KubernetesCapabilityDescriptor[]> {
    return Object.freeze([
      {
        id: 'kubernetes-discovery',
        name: 'discovery',
        version: '1.0.0',
        category: 'discovery',
      },
      {
        id: 'kubernetes-resources',
        name: 'resources',
        version: '1.0.0',
        category: 'resources',
      },
      {
        id: 'kubernetes-platform',
        name: 'platform',
        version: '1.0.0',
        category: 'platform',
      },
      {
        id: 'kubernetes-monitoring',
        name: 'monitoring',
        version: '1.0.0',
        category: 'monitoring',
      },
      {
        id: 'kubernetes-operations',
        name: 'operations',
        version: '1.0.0',
        category: 'operations',
      },
    ]);
  }
  public async searchResources(
    query: KubernetesSearchQuery,
  ): Promise<readonly KubernetesInventoryResource[]> {
    const needle = query.text.trim().toLowerCase();
    const byKind = query.kind ? this.byKind(query.kind) : MOCK_INVENTORY;
    const byCluster = query.cluster
      ? byKind.filter((resource) => resource.cluster === query.cluster)
      : byKind;
    const byNamespace = query.namespace
      ? byCluster.filter((resource) => resource.namespace === query.namespace)
      : byCluster;
    return byNamespace.filter((resource) =>
      [resource.id, resource.name].some((value) => value.toLowerCase().includes(needle)),
    );
  }
  private byKind(kind: KubernetesResourceKind): readonly KubernetesInventoryResource[] {
    return MOCK_INVENTORY.filter((resource) => resource.kind === kind);
  }
}

export class KubernetesInventoryCache {
  private snapshot: KubernetesInventoryCacheSnapshot = Object.freeze({
    resources: Object.freeze([]),
  });
  public update(resources: readonly KubernetesInventoryResource[], refreshedAt: string): void {
    this.snapshot = Object.freeze({ resources: Object.freeze([...resources]), refreshedAt });
  }
  public getSnapshot(): KubernetesInventoryCacheSnapshot {
    return this.snapshot;
  }
  public search(query: KubernetesSearchQuery): readonly KubernetesInventoryResource[] {
    const needle = query.text.trim().toLowerCase();
    const byKind = query.kind
      ? this.snapshot.resources.filter((resource) => resource.kind === query.kind)
      : this.snapshot.resources;
    const byCluster = query.cluster
      ? byKind.filter((resource) => resource.cluster === query.cluster)
      : byKind;
    const byNamespace = query.namespace
      ? byCluster.filter((resource) => resource.namespace === query.namespace)
      : byCluster;
    return byNamespace.filter((resource) =>
      [resource.id, resource.name].some((value) => value.toLowerCase().includes(needle)),
    );
  }
}

export class KubernetesConfiguration {
  public readonly defaultConfiguration: Readonly<KubernetesProviderConfiguration> = Object.freeze({
    endpoint: 'kubernetes://global-prod-cluster.example.local',
    clusterName: 'global-prod-cluster',
    credentialRef: 'KUBERNETES_CREDENTIAL_REF',
    namespaceScope: '*',
    readOnly: true,
    connectionTimeoutMs: 10000,
    inventoryCacheTtlSeconds: 300,
  });

  public merge(
    override?: Readonly<Partial<KubernetesProviderConfiguration>>,
  ): Readonly<KubernetesProviderConfiguration> {
    const merged: KubernetesProviderConfiguration = {
      endpoint: override?.endpoint ?? this.defaultConfiguration.endpoint,
      clusterName: override?.clusterName ?? this.defaultConfiguration.clusterName,
      credentialRef: override?.credentialRef ?? this.defaultConfiguration.credentialRef,
      namespaceScope: override?.namespaceScope ?? this.defaultConfiguration.namespaceScope,
      readOnly: override?.readOnly ?? this.defaultConfiguration.readOnly,
      connectionTimeoutMs:
        override?.connectionTimeoutMs ?? this.defaultConfiguration.connectionTimeoutMs,
      inventoryCacheTtlSeconds:
        override?.inventoryCacheTtlSeconds ?? this.defaultConfiguration.inventoryCacheTtlSeconds,
    };
    return Object.freeze(merged);
  }
}

export class KubernetesAuthenticationProvider {
  private readonly providerAuthentication: ProviderAuthentication;
  public constructor(options: { readonly credentialStore?: CredentialStore } = {}) {
    this.providerAuthentication = new ProviderAuthentication({
      credentialStore: options.credentialStore ?? new CredentialStore(),
      autoStoreCredentials: true,
    });
    this.providerAuthentication.registerProvider({
      method: 'token',
      authenticate: async (
        context: { readonly provider: { readonly manifest: { readonly id: string } } },
        credential: {
          readonly method: 'token';
          readonly token: string;
        },
      ) => {
        const success = credential.token.length > 0;
        return new AuthenticationResult({
          success,
          method: 'token',
          providerId: context.provider.manifest.id,
          principalId: success ? 'service-account-token' : undefined,
          message: success
            ? 'Kubernetes authentication accepted.'
            : 'Kubernetes credential payload is invalid.',
          authenticatedAt: DATASET_TIMESTAMP,
        });
      },
    });
  }
  public getProviderAuthentication(): ProviderAuthentication {
    return this.providerAuthentication;
  }
}

export class KubernetesConnection {
  public readonly id: string;
  public readonly endpoint: string;
  public connectedAt?: string;
  public constructor(endpoint: string) {
    this.endpoint = endpoint;
    this.id = `kubernetes-connection:${endpoint}`;
  }
  public connect(): void {
    this.connectedAt = DATASET_TIMESTAMP;
  }
  public disconnect(): void {
    this.connectedAt = undefined;
  }
}

export class KubernetesConnectionManager {
  private readonly sdkConnectionManager: ProviderConnectionManager;
  public constructor(providerId: string) {
    const factory = new ConnectionFactory();
    const pool = new ConnectionPool();
    factory.register(providerId, (provider, context) => {
      const endpoint = String(context.configuration.endpoint);
      return new ProviderConnection({
        provider,
        context,
        connect: async () => {
          const client = new KubernetesConnection(endpoint);
          client.connect();
          return client;
        },
        disconnect: async (client) => {
          client?.disconnect();
        },
        checkHealth: async (client) =>
          new ConnectionHealth({
            status: client?.connectedAt ? 'connected' : 'degraded',
            latencyMs: 14,
            lastCheckedAt: DATASET_TIMESTAMP,
            message: 'Kubernetes connection health.',
          }),
      });
    });
    this.sdkConnectionManager = new ProviderConnectionManager({ factory, pool });
  }
  public getSdkConnectionManager(): ProviderConnectionManager {
    return this.sdkConnectionManager;
  }
}

export class KubernetesCapabilityRegistry {
  private readonly registry: ProviderCapabilityRegistry;
  public constructor(providerId: string, registry = new ProviderCapabilityRegistry()) {
    this.registry = registry;
    const register = (
      id: string,
      name: string,
      category: KubernetesCapabilityDescriptor['category'],
      description: string,
    ): void => {
      this.registry.register(
        new CapabilityDefinition({
          id,
          providerId,
          name,
          version: new CapabilityVersion('1.0.0'),
          metadata: new CapabilityMetadata({
            description,
            tags: ['kubernetes', 'cncf', category],
            featureFlags: { configurationDriven: true, adapterBacked: true },
          }),
          requiresCapabilities: [name],
          requiredFeatureFlags: ['configurationDriven', 'adapterBacked'],
        }),
      );
    };
    register('kubernetes-discovery', 'discovery', 'discovery', 'Cluster discovery surfaces.');
    register(
      'kubernetes-resources',
      'resources',
      'resources',
      'Workload, networking, storage, and configuration resources.',
    );
    register(
      'kubernetes-platform',
      'platform',
      'platform',
      'CRDs, Helm release metadata, RBAC, and service accounts.',
    );
    register(
      'kubernetes-monitoring',
      'monitoring',
      'monitoring',
      'Cluster, node, pod health and operational telemetry.',
    );
    register(
      'kubernetes-operations',
      'operations',
      'operations',
      'Refresh, search, connection test, and capability discovery.',
    );
  }
  public getProviderCapabilityRegistry(): ProviderCapabilityRegistry {
    return this.registry;
  }
  public async list(): Promise<readonly KubernetesCapabilityDescriptor[]> {
    return Object.freeze([
      {
        id: 'kubernetes-discovery',
        name: 'discovery',
        version: '1.0.0',
        category: 'discovery',
      },
      {
        id: 'kubernetes-resources',
        name: 'resources',
        version: '1.0.0',
        category: 'resources',
      },
      {
        id: 'kubernetes-platform',
        name: 'platform',
        version: '1.0.0',
        category: 'platform',
      },
      {
        id: 'kubernetes-monitoring',
        name: 'monitoring',
        version: '1.0.0',
        category: 'monitoring',
      },
      {
        id: 'kubernetes-operations',
        name: 'operations',
        version: '1.0.0',
        category: 'operations',
      },
    ]);
  }
}

export class KubernetesProvider extends BaseProvider<KubernetesProviderConfiguration> {
  private readonly adapter: IKubernetesAdapter;
  private readonly configurationService: KubernetesConfiguration;
  private readonly inventoryCache: KubernetesInventoryCache;
  private readonly capabilityRegistry: KubernetesCapabilityRegistry;

  public constructor(
    options: {
      readonly adapter?: IKubernetesAdapter;
      readonly configurationService?: KubernetesConfiguration;
      readonly inventoryCache?: KubernetesInventoryCache;
      readonly capabilityRegistry?: KubernetesCapabilityRegistry;
      readonly manifest?: ProviderManifest<KubernetesProviderConfiguration>;
    } = {},
  ) {
    const configurationService = options.configurationService ?? new KubernetesConfiguration();
    super({
      manifest:
        options.manifest ??
        new ProviderManifest<KubernetesProviderConfiguration>({
          id: 'provider-kubernetes',
          name: 'Kubernetes Enterprise Provider',
          metadata: new ProviderMetadata({
            description:
              'Cloud-agnostic Kubernetes enterprise provider built on Provider SDK with adapter isolation.',
            version: new ProviderVersion('1.0.0'),
            vendor: 'InfraShield',
            tags: ['kubernetes', 'cncf', 'enterprise', 'provider-sdk'],
            healthStatus: 'healthy',
          }),
          capabilities: new ProviderCapabilities([
            new ToolCapability({ name: 'discovery' }),
            new ToolCapability({ name: 'resources' }),
            new ToolCapability({ name: 'platform' }),
            new ToolCapability({ name: 'monitoring' }),
            new ToolCapability({ name: 'operations' }),
          ]),
          configuration: new ProviderConfiguration<KubernetesProviderConfiguration>({
            requiredFields: [
              'endpoint',
              'clusterName',
              'credentialRef',
              'namespaceScope',
              'readOnly',
              'connectionTimeoutMs',
              'inventoryCacheTtlSeconds',
            ],
            defaultValues: configurationService.defaultConfiguration,
          }),
        }),
    });

    this.adapter = options.adapter ?? new KubernetesMockAdapter();
    this.configurationService = configurationService;
    this.inventoryCache = options.inventoryCache ?? new KubernetesInventoryCache();
    this.capabilityRegistry =
      options.capabilityRegistry ?? new KubernetesCapabilityRegistry(this.manifest.id);
  }

  public resolveConfiguration(
    override?: Readonly<Partial<KubernetesProviderConfiguration>>,
  ): Readonly<KubernetesProviderConfiguration> {
    return this.configurationService.merge(override);
  }

  public async discoverInventory(): Promise<readonly KubernetesInventoryResource[]> {
    const [
      clusters,
      nodes,
      namespaces,
      apiServerMetadata,
      pods,
      deployments,
      replicaSets,
      statefulSets,
      daemonSets,
      jobs,
      cronJobs,
      services,
      ingress,
      configMaps,
      secrets,
      persistentVolumes,
      persistentVolumeClaims,
      storageClasses,
      customResourceDefinitions,
      helmReleases,
      rbac,
      serviceAccounts,
    ] = await Promise.all([
      this.adapter.discoverClusters(),
      this.adapter.discoverNodes(),
      this.adapter.discoverNamespaces(),
      this.adapter.discoverApiServerMetadata(),
      this.adapter.discoverPods(),
      this.adapter.discoverDeployments(),
      this.adapter.discoverReplicaSets(),
      this.adapter.discoverStatefulSets(),
      this.adapter.discoverDaemonSets(),
      this.adapter.discoverJobs(),
      this.adapter.discoverCronJobs(),
      this.adapter.discoverServices(),
      this.adapter.discoverIngress(),
      this.adapter.discoverConfigMaps(),
      this.adapter.discoverSecretsMetadata(),
      this.adapter.discoverPersistentVolumes(),
      this.adapter.discoverPersistentVolumeClaims(),
      this.adapter.discoverStorageClasses(),
      this.adapter.discoverCustomResourceDefinitions(),
      this.adapter.discoverHelmReleasesMetadata(),
      this.adapter.discoverRbac(),
      this.adapter.discoverServiceAccounts(),
    ]);

    return Object.freeze([
      ...clusters,
      ...nodes,
      ...namespaces,
      ...apiServerMetadata,
      ...pods,
      ...deployments,
      ...replicaSets,
      ...statefulSets,
      ...daemonSets,
      ...jobs,
      ...cronJobs,
      ...services,
      ...ingress,
      ...configMaps,
      ...secrets,
      ...persistentVolumes,
      ...persistentVolumeClaims,
      ...storageClasses,
      ...customResourceDefinitions,
      ...helmReleases,
      ...rbac,
      ...serviceAccounts,
    ]);
  }

  public async refreshInventory(): Promise<KubernetesInventoryCacheSnapshot> {
    const refreshed = await this.adapter.refreshInventory();
    const resources = await this.discoverInventory();
    this.inventoryCache.update(resources, refreshed.refreshedAt);
    return this.inventoryCache.getSnapshot();
  }

  public getInventoryCache(): KubernetesInventoryCacheSnapshot {
    return this.inventoryCache.getSnapshot();
  }

  public synchronizeCache(snapshot: KubernetesInventoryCacheSnapshot): void {
    this.inventoryCache.update(snapshot.resources, snapshot.refreshedAt ?? DATASET_TIMESTAMP);
  }

  public async testConnection(
    override?: Readonly<Partial<KubernetesProviderConfiguration>>,
  ): Promise<KubernetesConnectionTestResult> {
    return this.adapter.testConnection(this.resolveConfiguration(override));
  }

  public async discoverCapabilities(): Promise<readonly KubernetesCapabilityDescriptor[]> {
    const [fromRegistry, fromAdapter] = await Promise.all([
      this.capabilityRegistry.list(),
      this.adapter.discoverCapabilities(),
    ]);
    const dedup = new Map<string, KubernetesCapabilityDescriptor>();
    [...fromRegistry, ...fromAdapter].forEach((capability) => dedup.set(capability.id, capability));
    return Object.freeze([...dedup.values()]);
  }

  public async searchResources(
    query: KubernetesSearchQuery,
  ): Promise<readonly KubernetesInventoryResource[]> {
    if (this.inventoryCache.getSnapshot().resources.length > 0) {
      return this.inventoryCache.search(query);
    }
    return this.adapter.searchResources(query);
  }

  public async getClusterHealth(): Promise<KubernetesClusterHealth> {
    return this.adapter.getClusterHealth();
  }
  public async getNodeHealth(): Promise<readonly KubernetesNodeHealth[]> {
    return this.adapter.getNodeHealth();
  }
  public async getPodHealth(): Promise<readonly KubernetesPodHealth[]> {
    return this.adapter.getPodHealth();
  }
  public async getMetrics(): Promise<readonly KubernetesMetric[]> {
    return this.adapter.getMetrics();
  }
  public async getEvents(): Promise<readonly KubernetesEventMetadata[]> {
    return this.adapter.getEvents();
  }
  public async getResourceUtilization(): Promise<readonly KubernetesResourceUtilization[]> {
    return this.adapter.getResourceUtilization();
  }
  public async getAlertsMetadata(): Promise<readonly KubernetesAlertMetadata[]> {
    return this.adapter.getAlertsMetadata();
  }
}

export class KubernetesProviderFactory {
  private readonly registryService: ProviderRegistryService;

  public constructor(options: { readonly registryService?: ProviderRegistryService } = {}) {
    this.registryService = options.registryService ?? new ProviderRegistryService();
  }

  public create(options?: {
    readonly adapter?: IKubernetesAdapter;
    readonly configurationOverride?: Readonly<Partial<KubernetesProviderConfiguration>>;
  }): KubernetesProvider {
    const configurationService = new KubernetesConfiguration();

    const provider = new KubernetesProvider({
      adapter: options?.adapter,
      configurationService,
      manifest: new ProviderManifest<KubernetesProviderConfiguration>({
        id: 'provider-kubernetes',
        name: 'Kubernetes Enterprise Provider',
        metadata: new ProviderMetadata({
          description:
            'Cloud-agnostic Kubernetes enterprise provider built on Provider SDK with adapter isolation.',
          version: new ProviderVersion('1.0.0'),
          vendor: 'InfraShield',
          tags: ['kubernetes', 'cncf', 'enterprise', 'provider-sdk'],
          healthStatus: 'healthy',
        }),
        capabilities: new ProviderCapabilities([
          new ToolCapability({ name: 'discovery' }),
          new ToolCapability({ name: 'resources' }),
          new ToolCapability({ name: 'platform' }),
          new ToolCapability({ name: 'monitoring' }),
          new ToolCapability({ name: 'operations' }),
        ]),
        configuration: new ProviderConfiguration<KubernetesProviderConfiguration>({
          requiredFields: [
            'endpoint',
            'clusterName',
            'credentialRef',
            'namespaceScope',
            'readOnly',
            'connectionTimeoutMs',
            'inventoryCacheTtlSeconds',
          ],
          defaultValues: configurationService.merge(options?.configurationOverride),
        }),
      }),
    });

    this.registryService.register(provider.manifest);
    return provider;
  }

  public getRegistryService(): ProviderRegistryService {
    return this.registryService;
  }
}

export interface KubernetesProviderRuntime {
  readonly provider: KubernetesProvider;
  readonly registryService: ProviderRegistryService;
  readonly lifecycleManager: ProviderLifecycleManager;
  readonly capabilityResolver: CapabilityResolver;
  readonly authenticationProvider: KubernetesAuthenticationProvider;
  readonly connectionManager: KubernetesConnectionManager;
}

export function createKubernetesProviderRuntime(): KubernetesProviderRuntime {
  const factory = new KubernetesProviderFactory();
  const provider = factory.create();

  const capabilityRegistry = new KubernetesCapabilityRegistry(provider.manifest.id);
  const capabilityResolver = new CapabilityResolver(
    capabilityRegistry.getProviderCapabilityRegistry(),
    new CapabilityValidator(),
  );

  const lifecycleManager = new ProviderLifecycleManager({
    startup: new ProviderStartup(async () => undefined),
    shutdown: new ProviderShutdown(async () => undefined),
    healthMonitor: new ProviderHealthMonitor(async () => ({
      providerId: provider.manifest.id,
      status: 'healthy',
      healthy: true,
      checkedAt: DATASET_TIMESTAMP,
      message: 'Kubernetes provider healthy.',
    })),
    recovery: new ProviderRecovery({
      maxAttempts: 2,
      recover: async () => true,
    }),
  });

  return {
    provider,
    registryService: factory.getRegistryService(),
    lifecycleManager,
    capabilityResolver,
    authenticationProvider: new KubernetesAuthenticationProvider(),
    connectionManager: new KubernetesConnectionManager(provider.manifest.id),
  };
}
