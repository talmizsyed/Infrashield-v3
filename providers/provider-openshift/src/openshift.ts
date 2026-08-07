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
  ProviderCapabilityRegistry,
  ProviderCapabilities,
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

export type OpenShiftResourceKind =
  | 'cluster'
  | 'project'
  | 'namespace'
  | 'node'
  | 'pod'
  | 'deployment'
  | 'statefulSet'
  | 'daemonSet'
  | 'replicaSet'
  | 'job'
  | 'cronJob'
  | 'service'
  | 'route'
  | 'ingress'
  | 'persistentVolume'
  | 'persistentVolumeClaim'
  | 'storageClass'
  | 'operator'
  | 'operatorLifecycleManager'
  | 'imageStream'
  | 'configMap'
  | 'secretMetadata';

export interface OpenShiftProviderConfiguration extends SerializableValueObject {
  readonly endpoint: string;
  readonly clusterName: string;
  readonly credentialRef: string;
  readonly readOnly: boolean;
  readonly insecureSkipTlsVerify: boolean;
  readonly requestTimeoutMs: number;
  readonly inventoryCacheTtlSeconds: number;
}

export interface OpenShiftInventoryResource {
  readonly id: string;
  readonly kind: OpenShiftResourceKind;
  readonly name: string;
  readonly cluster: string;
  readonly namespace?: string;
  readonly labels: Readonly<Record<string, string>>;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface OpenShiftHealthStatus {
  readonly healthy: boolean;
  readonly status: 'healthy' | 'degraded';
  readonly checkedAt: string;
  readonly details: Readonly<Record<string, string | number | boolean>>;
}

export interface OpenShiftMetric {
  readonly resourceId: string;
  readonly cpuUsagePercent: number;
  readonly memoryUsagePercent: number;
  readonly timestamp: string;
}

export interface OpenShiftEvent {
  readonly id: string;
  readonly severity: 'info' | 'warning' | 'error';
  readonly message: string;
  readonly resourceId?: string;
  readonly timestamp: string;
}

export interface OpenShiftLogMetadata {
  readonly id: string;
  readonly resourceId: string;
  readonly namespace: string;
  readonly level: 'info' | 'warning' | 'error';
  readonly timestamp: string;
}

export interface OpenShiftAlertMetadata {
  readonly id: string;
  readonly name: string;
  readonly severity: 'warning' | 'critical';
  readonly namespace?: string;
  readonly status: 'firing' | 'resolved';
  readonly timestamp: string;
}

export interface OpenShiftConnectionTestResult {
  readonly connected: boolean;
  readonly latencyMs: number;
  readonly message: string;
}

export interface OpenShiftCapabilityDescriptor {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly category:
    'discovery' | 'resources' | 'networking' | 'storage' | 'platform' | 'monitoring' | 'operations';
}

export interface OpenShiftSearchQuery {
  readonly text: string;
  readonly kind?: OpenShiftResourceKind;
  readonly namespace?: string;
}

export interface OpenShiftInventoryCacheSnapshot {
  readonly resources: readonly OpenShiftInventoryResource[];
  readonly refreshedAt?: string;
}

export interface IOpenShiftAdapter {
  discoverClusters(): Promise<readonly OpenShiftInventoryResource[]>;
  discoverProjects(): Promise<readonly OpenShiftInventoryResource[]>;
  discoverNamespaces(): Promise<readonly OpenShiftInventoryResource[]>;
  listNodes(): Promise<readonly OpenShiftInventoryResource[]>;
  listPods(): Promise<readonly OpenShiftInventoryResource[]>;
  listDeployments(): Promise<readonly OpenShiftInventoryResource[]>;
  listStatefulSets(): Promise<readonly OpenShiftInventoryResource[]>;
  listDaemonSets(): Promise<readonly OpenShiftInventoryResource[]>;
  listReplicaSets(): Promise<readonly OpenShiftInventoryResource[]>;
  listJobs(): Promise<readonly OpenShiftInventoryResource[]>;
  listCronJobs(): Promise<readonly OpenShiftInventoryResource[]>;
  listServices(): Promise<readonly OpenShiftInventoryResource[]>;
  listRoutes(): Promise<readonly OpenShiftInventoryResource[]>;
  listIngresses(): Promise<readonly OpenShiftInventoryResource[]>;
  listPersistentVolumes(): Promise<readonly OpenShiftInventoryResource[]>;
  listPersistentVolumeClaims(): Promise<readonly OpenShiftInventoryResource[]>;
  listStorageClasses(): Promise<readonly OpenShiftInventoryResource[]>;
  listOperators(): Promise<readonly OpenShiftInventoryResource[]>;
  listOperatorLifecycleManagers(): Promise<readonly OpenShiftInventoryResource[]>;
  listImageStreams(): Promise<readonly OpenShiftInventoryResource[]>;
  listConfigMaps(): Promise<readonly OpenShiftInventoryResource[]>;
  listSecretMetadata(): Promise<readonly OpenShiftInventoryResource[]>;
  getClusterHealth(): Promise<OpenShiftHealthStatus>;
  getMetrics(): Promise<readonly OpenShiftMetric[]>;
  getEvents(): Promise<readonly OpenShiftEvent[]>;
  getLogMetadata(): Promise<readonly OpenShiftLogMetadata[]>;
  getAlertMetadata(): Promise<readonly OpenShiftAlertMetadata[]>;
  refreshInventory(): Promise<{ readonly refreshedAt: string }>;
  testConnection(
    configuration: Readonly<OpenShiftProviderConfiguration>,
  ): Promise<OpenShiftConnectionTestResult>;
  discoverCapabilities(): Promise<readonly OpenShiftCapabilityDescriptor[]>;
  searchResources(query: OpenShiftSearchQuery): Promise<readonly OpenShiftInventoryResource[]>;
}

const DATASET_TIMESTAMP = '2026-01-01T00:00:00.000Z';

function createLabels(labels: Record<string, string>): Readonly<Record<string, string>> {
  return labels;
}

function createMetadata(metadata: Record<string, string>): Readonly<Record<string, string>> {
  return metadata;
}

const MOCK_INVENTORY: readonly OpenShiftInventoryResource[] = Object.freeze([
  {
    id: 'cluster-1',
    kind: 'cluster',
    name: 'openshift-prod',
    cluster: 'openshift-prod',
    labels: createLabels({ environment: 'prod' }),
    metadata: createMetadata({ apiVersion: 'config.openshift.io/v1' }),
  },
  {
    id: 'project-payments',
    kind: 'project',
    name: 'payments',
    cluster: 'openshift-prod',
    labels: createLabels({ owner: 'platform' }),
    metadata: createMetadata({ displayName: 'Payments Project' }),
  },
  {
    id: 'namespace-payments',
    kind: 'namespace',
    name: 'payments',
    cluster: 'openshift-prod',
    namespace: 'payments',
    labels: createLabels({ team: 'payments' }),
    metadata: createMetadata({ phase: 'Active' }),
  },
  {
    id: 'node-1',
    kind: 'node',
    name: 'worker-01',
    cluster: 'openshift-prod',
    labels: createLabels({ role: 'worker' }),
    metadata: createMetadata({ os: 'rhcos' }),
  },
  {
    id: 'pod-1',
    kind: 'pod',
    name: 'payments-api-7d5fd',
    cluster: 'openshift-prod',
    namespace: 'payments',
    labels: createLabels({ app: 'payments-api' }),
    metadata: createMetadata({ phase: 'Running' }),
  },
  {
    id: 'deployment-1',
    kind: 'deployment',
    name: 'payments-api',
    cluster: 'openshift-prod',
    namespace: 'payments',
    labels: createLabels({ app: 'payments-api' }),
    metadata: createMetadata({ replicas: '3' }),
  },
  {
    id: 'statefulset-1',
    kind: 'statefulSet',
    name: 'payments-db',
    cluster: 'openshift-prod',
    namespace: 'payments',
    labels: createLabels({ app: 'payments-db' }),
    metadata: createMetadata({ replicas: '1' }),
  },
  {
    id: 'daemonset-1',
    kind: 'daemonSet',
    name: 'node-exporter',
    cluster: 'openshift-prod',
    namespace: 'openshift-monitoring',
    labels: createLabels({ app: 'node-exporter' }),
    metadata: createMetadata({ desiredNumberScheduled: '4' }),
  },
  {
    id: 'replicaset-1',
    kind: 'replicaSet',
    name: 'payments-api-7d5fd89c',
    cluster: 'openshift-prod',
    namespace: 'payments',
    labels: createLabels({ app: 'payments-api' }),
    metadata: createMetadata({ replicas: '3' }),
  },
  {
    id: 'job-1',
    kind: 'job',
    name: 'payments-report-job',
    cluster: 'openshift-prod',
    namespace: 'payments',
    labels: createLabels({ app: 'payments-report' }),
    metadata: createMetadata({ completions: '1' }),
  },
  {
    id: 'cronjob-1',
    kind: 'cronJob',
    name: 'payments-nightly-sync',
    cluster: 'openshift-prod',
    namespace: 'payments',
    labels: createLabels({ app: 'payments-sync' }),
    metadata: createMetadata({ schedule: '0 2 * * *' }),
  },
  {
    id: 'service-1',
    kind: 'service',
    name: 'payments-api',
    cluster: 'openshift-prod',
    namespace: 'payments',
    labels: createLabels({ app: 'payments-api' }),
    metadata: createMetadata({ type: 'ClusterIP' }),
  },
  {
    id: 'route-1',
    kind: 'route',
    name: 'payments-api-route',
    cluster: 'openshift-prod',
    namespace: 'payments',
    labels: createLabels({ app: 'payments-api' }),
    metadata: createMetadata({ host: 'payments.apps.example.com' }),
  },
  {
    id: 'ingress-1',
    kind: 'ingress',
    name: 'payments-api-ingress',
    cluster: 'openshift-prod',
    namespace: 'payments',
    labels: createLabels({ app: 'payments-api' }),
    metadata: createMetadata({ className: 'openshift-default' }),
  },
  {
    id: 'pv-1',
    kind: 'persistentVolume',
    name: 'pv-payments-db',
    cluster: 'openshift-prod',
    labels: createLabels({ backend: 'ceph' }),
    metadata: createMetadata({ capacity: '500Gi' }),
  },
  {
    id: 'pvc-1',
    kind: 'persistentVolumeClaim',
    name: 'payments-db-pvc',
    cluster: 'openshift-prod',
    namespace: 'payments',
    labels: createLabels({ app: 'payments-db' }),
    metadata: createMetadata({ capacityRequest: '500Gi' }),
  },
  {
    id: 'sc-1',
    kind: 'storageClass',
    name: 'ocs-storagecluster-ceph-rbd',
    cluster: 'openshift-prod',
    labels: createLabels({ storage: 'ceph-rbd' }),
    metadata: createMetadata({ reclaimPolicy: 'Delete' }),
  },
  {
    id: 'operator-1',
    kind: 'operator',
    name: 'cluster-logging-operator',
    cluster: 'openshift-prod',
    namespace: 'openshift-operators',
    labels: createLabels({ catalog: 'redhat-operators' }),
    metadata: createMetadata({ channel: 'stable' }),
  },
  {
    id: 'olm-1',
    kind: 'operatorLifecycleManager',
    name: 'olm',
    cluster: 'openshift-prod',
    namespace: 'openshift-operator-lifecycle-manager',
    labels: createLabels({ component: 'olm' }),
    metadata: createMetadata({ version: 'v0.27.0' }),
  },
  {
    id: 'imagestream-1',
    kind: 'imageStream',
    name: 'payments-api',
    cluster: 'openshift-prod',
    namespace: 'payments',
    labels: createLabels({ app: 'payments-api' }),
    metadata: createMetadata({ latestTag: '1.4.2' }),
  },
  {
    id: 'configmap-1',
    kind: 'configMap',
    name: 'payments-api-config',
    cluster: 'openshift-prod',
    namespace: 'payments',
    labels: createLabels({ app: 'payments-api' }),
    metadata: createMetadata({ keys: '12' }),
  },
  {
    id: 'secretmeta-1',
    kind: 'secretMetadata',
    name: 'payments-api-secret',
    cluster: 'openshift-prod',
    namespace: 'payments',
    labels: createLabels({ app: 'payments-api' }),
    metadata: createMetadata({ type: 'kubernetes.io/opaque' }),
  },
]);

const MOCK_METRICS: readonly OpenShiftMetric[] = Object.freeze([
  {
    resourceId: 'pod-1',
    cpuUsagePercent: 54,
    memoryUsagePercent: 67,
    timestamp: DATASET_TIMESTAMP,
  },
  {
    resourceId: 'node-1',
    cpuUsagePercent: 61,
    memoryUsagePercent: 59,
    timestamp: DATASET_TIMESTAMP,
  },
]);

const MOCK_EVENTS: readonly OpenShiftEvent[] = Object.freeze([
  {
    id: 'event-1',
    severity: 'info',
    message: 'Deployment rollout completed successfully.',
    resourceId: 'deployment-1',
    timestamp: DATASET_TIMESTAMP,
  },
  {
    id: 'event-2',
    severity: 'warning',
    message: 'Pod restart count increasing.',
    resourceId: 'pod-1',
    timestamp: DATASET_TIMESTAMP,
  },
]);

const MOCK_LOG_METADATA: readonly OpenShiftLogMetadata[] = Object.freeze([
  {
    id: 'log-meta-1',
    resourceId: 'pod-1',
    namespace: 'payments',
    level: 'info',
    timestamp: DATASET_TIMESTAMP,
  },
]);

const MOCK_ALERT_METADATA: readonly OpenShiftAlertMetadata[] = Object.freeze([
  {
    id: 'alert-1',
    name: 'HighPodMemoryUsage',
    severity: 'warning',
    namespace: 'payments',
    status: 'firing',
    timestamp: DATASET_TIMESTAMP,
  },
]);

export class OpenShiftMockAdapter implements IOpenShiftAdapter {
  public async discoverClusters(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.byKind('cluster');
  }

  public async discoverProjects(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.byKind('project');
  }

  public async discoverNamespaces(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.byKind('namespace');
  }

  public async listNodes(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.byKind('node');
  }

  public async listPods(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.byKind('pod');
  }

  public async listDeployments(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.byKind('deployment');
  }

  public async listStatefulSets(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.byKind('statefulSet');
  }

  public async listDaemonSets(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.byKind('daemonSet');
  }

  public async listReplicaSets(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.byKind('replicaSet');
  }

  public async listJobs(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.byKind('job');
  }

  public async listCronJobs(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.byKind('cronJob');
  }

  public async listServices(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.byKind('service');
  }

  public async listRoutes(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.byKind('route');
  }

  public async listIngresses(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.byKind('ingress');
  }

  public async listPersistentVolumes(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.byKind('persistentVolume');
  }

  public async listPersistentVolumeClaims(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.byKind('persistentVolumeClaim');
  }

  public async listStorageClasses(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.byKind('storageClass');
  }

  public async listOperators(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.byKind('operator');
  }

  public async listOperatorLifecycleManagers(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.byKind('operatorLifecycleManager');
  }

  public async listImageStreams(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.byKind('imageStream');
  }

  public async listConfigMaps(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.byKind('configMap');
  }

  public async listSecretMetadata(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.byKind('secretMetadata');
  }

  public async getClusterHealth(): Promise<OpenShiftHealthStatus> {
    return {
      healthy: true,
      status: 'healthy',
      checkedAt: DATASET_TIMESTAMP,
      details: {
        provider: 'openshift-enterprise',
        mode: 'mock-adapter',
        resources: MOCK_INVENTORY.length,
      },
    };
  }

  public async getMetrics(): Promise<readonly OpenShiftMetric[]> {
    return MOCK_METRICS;
  }

  public async getEvents(): Promise<readonly OpenShiftEvent[]> {
    return MOCK_EVENTS;
  }

  public async getLogMetadata(): Promise<readonly OpenShiftLogMetadata[]> {
    return MOCK_LOG_METADATA;
  }

  public async getAlertMetadata(): Promise<readonly OpenShiftAlertMetadata[]> {
    return MOCK_ALERT_METADATA;
  }

  public async refreshInventory(): Promise<{ readonly refreshedAt: string }> {
    return { refreshedAt: DATASET_TIMESTAMP };
  }

  public async testConnection(
    configuration: Readonly<OpenShiftProviderConfiguration>,
  ): Promise<OpenShiftConnectionTestResult> {
    return {
      connected: configuration.endpoint.startsWith('https://'),
      latencyMs: 18,
      message: 'OpenShift connection test succeeded through adapter abstraction.',
    };
  }

  public async discoverCapabilities(): Promise<readonly OpenShiftCapabilityDescriptor[]> {
    return Object.freeze([
      {
        id: 'openshift-discovery',
        name: 'discovery',
        version: '1.0.0',
        category: 'discovery',
      },
      {
        id: 'openshift-resources',
        name: 'resources',
        version: '1.0.0',
        category: 'resources',
      },
      {
        id: 'openshift-networking',
        name: 'networking',
        version: '1.0.0',
        category: 'networking',
      },
      {
        id: 'openshift-storage',
        name: 'storage',
        version: '1.0.0',
        category: 'storage',
      },
      {
        id: 'openshift-platform',
        name: 'platform',
        version: '1.0.0',
        category: 'platform',
      },
      {
        id: 'openshift-monitoring',
        name: 'monitoring',
        version: '1.0.0',
        category: 'monitoring',
      },
      {
        id: 'openshift-operations',
        name: 'operations',
        version: '1.0.0',
        category: 'operations',
      },
    ]);
  }

  public async searchResources(
    query: OpenShiftSearchQuery,
  ): Promise<readonly OpenShiftInventoryResource[]> {
    const needle = query.text.trim().toLowerCase();
    const byKind = query.kind ? this.byKind(query.kind) : MOCK_INVENTORY;
    const byNamespace = query.namespace
      ? byKind.filter((resource) => resource.namespace === query.namespace)
      : byKind;

    return byNamespace.filter((resource) =>
      [resource.id, resource.name].some((value) => value.toLowerCase().includes(needle)),
    );
  }

  private byKind(kind: OpenShiftResourceKind): readonly OpenShiftInventoryResource[] {
    return MOCK_INVENTORY.filter((resource) => resource.kind === kind);
  }
}

export class OpenShiftInventoryCache {
  private snapshot: OpenShiftInventoryCacheSnapshot = Object.freeze({
    resources: Object.freeze([]),
  });

  public update(resources: readonly OpenShiftInventoryResource[], refreshedAt: string): void {
    this.snapshot = Object.freeze({
      resources: Object.freeze([...resources]),
      refreshedAt,
    });
  }

  public getSnapshot(): OpenShiftInventoryCacheSnapshot {
    return this.snapshot;
  }

  public search(query: OpenShiftSearchQuery): readonly OpenShiftInventoryResource[] {
    const needle = query.text.trim().toLowerCase();
    const byKind = query.kind
      ? this.snapshot.resources.filter((resource) => resource.kind === query.kind)
      : this.snapshot.resources;
    const byNamespace = query.namespace
      ? byKind.filter((resource) => resource.namespace === query.namespace)
      : byKind;

    return byNamespace.filter((resource) =>
      [resource.id, resource.name].some((value) => value.toLowerCase().includes(needle)),
    );
  }
}

export class OpenShiftConfiguration {
  public readonly defaultConfiguration: Readonly<OpenShiftProviderConfiguration> = Object.freeze({
    endpoint: 'https://api.openshift.example.local:6443',
    clusterName: 'openshift-prod',
    credentialRef: 'OPENSHIFT_CREDENTIAL_REF',
    readOnly: true,
    insecureSkipTlsVerify: false,
    requestTimeoutMs: 15000,
    inventoryCacheTtlSeconds: 300,
  });

  public merge(
    override?: Readonly<Partial<OpenShiftProviderConfiguration>>,
  ): Readonly<OpenShiftProviderConfiguration> {
    const merged: OpenShiftProviderConfiguration = {
      endpoint: override?.endpoint ?? this.defaultConfiguration.endpoint,
      clusterName: override?.clusterName ?? this.defaultConfiguration.clusterName,
      credentialRef: override?.credentialRef ?? this.defaultConfiguration.credentialRef,
      readOnly: override?.readOnly ?? this.defaultConfiguration.readOnly,
      insecureSkipTlsVerify:
        override?.insecureSkipTlsVerify ?? this.defaultConfiguration.insecureSkipTlsVerify,
      requestTimeoutMs: override?.requestTimeoutMs ?? this.defaultConfiguration.requestTimeoutMs,
      inventoryCacheTtlSeconds:
        override?.inventoryCacheTtlSeconds ?? this.defaultConfiguration.inventoryCacheTtlSeconds,
    };

    return Object.freeze(merged);
  }
}

export class OpenShiftAuthenticationProvider {
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
        credential: { readonly method: 'token'; readonly token: string },
      ) => {
        const success = credential.token.length > 0;
        return new AuthenticationResult({
          success,
          method: 'token',
          providerId: context.provider.manifest.id,
          principalId: success ? 'openshift-service-account' : undefined,
          message: success
            ? 'OpenShift authentication accepted.'
            : 'OpenShift credential payload is invalid.',
          authenticatedAt: DATASET_TIMESTAMP,
        });
      },
    });
  }

  public getProviderAuthentication(): ProviderAuthentication {
    return this.providerAuthentication;
  }
}

export class OpenShiftConnection {
  public readonly id: string;
  public readonly endpoint: string;
  public connectedAt?: string;

  public constructor(endpoint: string) {
    this.endpoint = endpoint;
    this.id = `openshift-connection:${endpoint}`;
  }

  public connect(): void {
    this.connectedAt = DATASET_TIMESTAMP;
  }

  public disconnect(): void {
    this.connectedAt = undefined;
  }
}

export class OpenShiftConnectionManager {
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
          const client = new OpenShiftConnection(endpoint);
          client.connect();
          return client;
        },
        disconnect: async (client) => {
          client?.disconnect();
        },
        checkHealth: async (client) =>
          new ConnectionHealth({
            status: client?.connectedAt ? 'connected' : 'degraded',
            latencyMs: 18,
            lastCheckedAt: DATASET_TIMESTAMP,
            message: 'OpenShift connection health.',
          }),
      });
    });

    this.sdkConnectionManager = new ProviderConnectionManager({
      factory,
      pool,
    });
  }

  public getSdkConnectionManager(): ProviderConnectionManager {
    return this.sdkConnectionManager;
  }
}

export class OpenShiftCapabilityRegistry {
  private readonly registry: ProviderCapabilityRegistry;

  public constructor(providerId: string, registry = new ProviderCapabilityRegistry()) {
    this.registry = registry;

    const register = (
      id: string,
      name: string,
      category: OpenShiftCapabilityDescriptor['category'],
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
            tags: ['openshift', category],
            featureFlags: {
              configurationDriven: true,
              adapterBacked: true,
            },
          }),
          requiresCapabilities: [name],
          requiredFeatureFlags: ['configurationDriven', 'adapterBacked'],
        }),
      );
    };

    register(
      'openshift-discovery',
      'discovery',
      'discovery',
      'Cluster, project and namespace discovery.',
    );
    register('openshift-resources', 'resources', 'resources', 'Core workload resource inventory.');
    register(
      'openshift-networking',
      'networking',
      'networking',
      'Service, route and ingress inventory.',
    );
    register('openshift-storage', 'storage', 'storage', 'PV, PVC and storage class inventory.');
    register(
      'openshift-platform',
      'platform',
      'platform',
      'Operators, OLM and platform metadata inventory.',
    );
    register(
      'openshift-monitoring',
      'monitoring',
      'monitoring',
      'Health, metrics, events, logs and alerts metadata.',
    );
    register(
      'openshift-operations',
      'operations',
      'operations',
      'Refresh, connection test, capability discovery and search.',
    );
  }

  public getProviderCapabilityRegistry(): ProviderCapabilityRegistry {
    return this.registry;
  }

  public async list(): Promise<readonly OpenShiftCapabilityDescriptor[]> {
    return Object.freeze([
      {
        id: 'openshift-discovery',
        name: 'discovery',
        version: '1.0.0',
        category: 'discovery',
      },
      {
        id: 'openshift-resources',
        name: 'resources',
        version: '1.0.0',
        category: 'resources',
      },
      {
        id: 'openshift-networking',
        name: 'networking',
        version: '1.0.0',
        category: 'networking',
      },
      {
        id: 'openshift-storage',
        name: 'storage',
        version: '1.0.0',
        category: 'storage',
      },
      {
        id: 'openshift-platform',
        name: 'platform',
        version: '1.0.0',
        category: 'platform',
      },
      {
        id: 'openshift-monitoring',
        name: 'monitoring',
        version: '1.0.0',
        category: 'monitoring',
      },
      {
        id: 'openshift-operations',
        name: 'operations',
        version: '1.0.0',
        category: 'operations',
      },
    ]);
  }
}

export class OpenShiftProvider extends BaseProvider<OpenShiftProviderConfiguration> {
  private readonly adapter: IOpenShiftAdapter;
  private readonly configurationService: OpenShiftConfiguration;
  private readonly inventoryCache: OpenShiftInventoryCache;
  private readonly capabilityRegistry: OpenShiftCapabilityRegistry;

  public constructor(
    options: {
      readonly adapter?: IOpenShiftAdapter;
      readonly configurationService?: OpenShiftConfiguration;
      readonly inventoryCache?: OpenShiftInventoryCache;
      readonly capabilityRegistry?: OpenShiftCapabilityRegistry;
      readonly manifest?: ProviderManifest<OpenShiftProviderConfiguration>;
    } = {},
  ) {
    const configurationService = options.configurationService ?? new OpenShiftConfiguration();

    super({
      manifest:
        options.manifest ??
        new ProviderManifest<OpenShiftProviderConfiguration>({
          id: 'provider-openshift',
          name: 'OpenShift Enterprise Provider',
          metadata: new ProviderMetadata({
            description:
              'Production OpenShift provider framework built on Provider SDK with adapter isolation.',
            version: new ProviderVersion('1.0.0'),
            vendor: 'InfraShield',
            tags: ['openshift', 'enterprise', 'provider-sdk'],
            healthStatus: 'healthy',
          }),
          capabilities: new ProviderCapabilities([
            new ToolCapability({ name: 'discovery' }),
            new ToolCapability({ name: 'resources' }),
            new ToolCapability({ name: 'networking' }),
            new ToolCapability({ name: 'storage' }),
            new ToolCapability({ name: 'platform' }),
            new ToolCapability({ name: 'monitoring' }),
            new ToolCapability({ name: 'operations' }),
          ]),
          configuration: new ProviderConfiguration<OpenShiftProviderConfiguration>({
            requiredFields: [
              'endpoint',
              'clusterName',
              'credentialRef',
              'readOnly',
              'insecureSkipTlsVerify',
              'requestTimeoutMs',
              'inventoryCacheTtlSeconds',
            ],
            defaultValues: configurationService.defaultConfiguration,
          }),
        }),
    });

    this.adapter = options.adapter ?? new OpenShiftMockAdapter();
    this.configurationService = configurationService;
    this.inventoryCache = options.inventoryCache ?? new OpenShiftInventoryCache();
    this.capabilityRegistry =
      options.capabilityRegistry ?? new OpenShiftCapabilityRegistry(this.manifest.id);
  }

  public resolveConfiguration(
    override?: Readonly<Partial<OpenShiftProviderConfiguration>>,
  ): Readonly<OpenShiftProviderConfiguration> {
    return this.configurationService.merge(override);
  }

  public async discoverInventory(): Promise<readonly OpenShiftInventoryResource[]> {
    const [
      clusters,
      projects,
      namespaces,
      nodes,
      pods,
      deployments,
      statefulSets,
      daemonSets,
      replicaSets,
      jobs,
      cronJobs,
      services,
      routes,
      ingresses,
      persistentVolumes,
      persistentVolumeClaims,
      storageClasses,
      operators,
      olms,
      imageStreams,
      configMaps,
      secretMetadata,
    ] = await Promise.all([
      this.adapter.discoverClusters(),
      this.adapter.discoverProjects(),
      this.adapter.discoverNamespaces(),
      this.adapter.listNodes(),
      this.adapter.listPods(),
      this.adapter.listDeployments(),
      this.adapter.listStatefulSets(),
      this.adapter.listDaemonSets(),
      this.adapter.listReplicaSets(),
      this.adapter.listJobs(),
      this.adapter.listCronJobs(),
      this.adapter.listServices(),
      this.adapter.listRoutes(),
      this.adapter.listIngresses(),
      this.adapter.listPersistentVolumes(),
      this.adapter.listPersistentVolumeClaims(),
      this.adapter.listStorageClasses(),
      this.adapter.listOperators(),
      this.adapter.listOperatorLifecycleManagers(),
      this.adapter.listImageStreams(),
      this.adapter.listConfigMaps(),
      this.adapter.listSecretMetadata(),
    ]);

    return Object.freeze([
      ...clusters,
      ...projects,
      ...namespaces,
      ...nodes,
      ...pods,
      ...deployments,
      ...statefulSets,
      ...daemonSets,
      ...replicaSets,
      ...jobs,
      ...cronJobs,
      ...services,
      ...routes,
      ...ingresses,
      ...persistentVolumes,
      ...persistentVolumeClaims,
      ...storageClasses,
      ...operators,
      ...olms,
      ...imageStreams,
      ...configMaps,
      ...secretMetadata,
    ]);
  }

  public async refreshInventory(): Promise<OpenShiftInventoryCacheSnapshot> {
    const refreshed = await this.adapter.refreshInventory();
    const resources = await this.discoverInventory();
    this.inventoryCache.update(resources, refreshed.refreshedAt);
    return this.inventoryCache.getSnapshot();
  }

  public getInventoryCache(): OpenShiftInventoryCacheSnapshot {
    return this.inventoryCache.getSnapshot();
  }

  public async testConnection(
    override?: Readonly<Partial<OpenShiftProviderConfiguration>>,
  ): Promise<OpenShiftConnectionTestResult> {
    return this.adapter.testConnection(this.resolveConfiguration(override));
  }

  public async discoverCapabilities(): Promise<readonly OpenShiftCapabilityDescriptor[]> {
    const [fromRegistry, fromAdapter] = await Promise.all([
      this.capabilityRegistry.list(),
      this.adapter.discoverCapabilities(),
    ]);

    const dedup = new Map<string, OpenShiftCapabilityDescriptor>();
    [...fromRegistry, ...fromAdapter].forEach((capability) => dedup.set(capability.id, capability));
    return Object.freeze([...dedup.values()]);
  }

  public async searchResources(
    query: OpenShiftSearchQuery,
  ): Promise<readonly OpenShiftInventoryResource[]> {
    if (this.inventoryCache.getSnapshot().resources.length > 0) {
      return this.inventoryCache.search(query);
    }
    return this.adapter.searchResources(query);
  }

  public async getClusterHealth(): Promise<OpenShiftHealthStatus> {
    return this.adapter.getClusterHealth();
  }

  public async getMetrics(): Promise<readonly OpenShiftMetric[]> {
    return this.adapter.getMetrics();
  }

  public async getEvents(): Promise<readonly OpenShiftEvent[]> {
    return this.adapter.getEvents();
  }

  public async getLogMetadata(): Promise<readonly OpenShiftLogMetadata[]> {
    return this.adapter.getLogMetadata();
  }

  public async getAlertMetadata(): Promise<readonly OpenShiftAlertMetadata[]> {
    return this.adapter.getAlertMetadata();
  }
}

export class OpenShiftProviderFactory {
  private readonly registryService: ProviderRegistryService;

  public constructor(options: { readonly registryService?: ProviderRegistryService } = {}) {
    this.registryService = options.registryService ?? new ProviderRegistryService();
  }

  public create(options?: {
    readonly adapter?: IOpenShiftAdapter;
    readonly configurationOverride?: Readonly<Partial<OpenShiftProviderConfiguration>>;
  }): OpenShiftProvider {
    const configurationService = new OpenShiftConfiguration();

    const provider = new OpenShiftProvider({
      adapter: options?.adapter,
      configurationService,
      manifest: new ProviderManifest<OpenShiftProviderConfiguration>({
        id: 'provider-openshift',
        name: 'OpenShift Enterprise Provider',
        metadata: new ProviderMetadata({
          description:
            'Production OpenShift provider framework built on Provider SDK with adapter isolation.',
          version: new ProviderVersion('1.0.0'),
          vendor: 'InfraShield',
          tags: ['openshift', 'enterprise', 'provider-sdk'],
          healthStatus: 'healthy',
        }),
        capabilities: new ProviderCapabilities([
          new ToolCapability({ name: 'discovery' }),
          new ToolCapability({ name: 'resources' }),
          new ToolCapability({ name: 'networking' }),
          new ToolCapability({ name: 'storage' }),
          new ToolCapability({ name: 'platform' }),
          new ToolCapability({ name: 'monitoring' }),
          new ToolCapability({ name: 'operations' }),
        ]),
        configuration: new ProviderConfiguration<OpenShiftProviderConfiguration>({
          requiredFields: [
            'endpoint',
            'clusterName',
            'credentialRef',
            'readOnly',
            'insecureSkipTlsVerify',
            'requestTimeoutMs',
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

export interface OpenShiftProviderRuntime {
  readonly provider: OpenShiftProvider;
  readonly registryService: ProviderRegistryService;
  readonly lifecycleManager: ProviderLifecycleManager;
  readonly capabilityResolver: CapabilityResolver;
  readonly authenticationProvider: OpenShiftAuthenticationProvider;
  readonly connectionManager: OpenShiftConnectionManager;
}

export function createOpenShiftProviderRuntime(): OpenShiftProviderRuntime {
  const factory = new OpenShiftProviderFactory();
  const provider = factory.create();

  const capabilityRegistry = new OpenShiftCapabilityRegistry(provider.manifest.id);
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
      message: 'OpenShift provider healthy.',
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
    authenticationProvider: new OpenShiftAuthenticationProvider(),
    connectionManager: new OpenShiftConnectionManager(provider.manifest.id),
  };
}
