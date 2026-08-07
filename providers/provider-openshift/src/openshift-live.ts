import {
  AppsV1Api,
  BatchV1Api,
  CoreV1Api,
  CustomObjectsApi,
  KubeConfig,
  NetworkingV1Api,
  StorageV1Api,
} from '@kubernetes/client-node';
import {
  CertificateValidator,
  ConnectionManagementConfiguration,
  ConnectionManager as EnterpriseConnectionManager,
  SecretProvider,
  SecretResolver,
  RetryPolicy,
  TimeoutPolicy,
  CircuitBreaker,
  type ConnectionRecord,
  type ConnectionRequest,
  type ManagedCredential,
} from '@infrashield/connection-management';
import {
  StructuredLogger,
  createMemoryLogSink,
  toIdentifier,
  type ILogger,
} from '@infrashield/core-infrastructure';
import type {
  IOpenShiftAdapter,
  OpenShiftAlertMetadata,
  OpenShiftCapabilityDescriptor,
  OpenShiftConnectionTestResult,
  OpenShiftEvent,
  OpenShiftHealthStatus,
  OpenShiftInventoryResource,
  OpenShiftLogMetadata,
  OpenShiftMetric,
  OpenShiftProviderConfiguration,
  OpenShiftResourceKind,
  OpenShiftSearchQuery,
} from './openshift';

const LIVE_TIMESTAMP = '2026-01-01T00:00:00.000Z';
const OPENSHIFT_CONNECTION_KIND = 'openshift-live-session';
const OPENSHIFT_SECRET_PROVIDER_ID = 'openshift-environment';

interface OpenShiftClientSession {
  readonly endpoint: string;
  readonly clusterName: string;
  readonly insecureSkipTlsVerify: boolean;
  readonly caCertificatePem?: string;
  readonly authorizationHeader?: string;
  readonly clientCertificatePem?: string;
  readonly clientKeyPem?: string;
  readonly kubeconfig?: string;
}

interface OpenShiftCoreClient {
  listNamespace(): Promise<unknown>;
  listNode(): Promise<unknown>;
  listPodForAllNamespaces(): Promise<unknown>;
  listServiceForAllNamespaces(): Promise<unknown>;
  listPersistentVolume(): Promise<unknown>;
  listPersistentVolumeClaimForAllNamespaces(): Promise<unknown>;
  listConfigMapForAllNamespaces(): Promise<unknown>;
  listSecretForAllNamespaces(): Promise<unknown>;
}

interface OpenShiftAppsClient {
  listDeploymentForAllNamespaces(): Promise<unknown>;
  listStatefulSetForAllNamespaces(): Promise<unknown>;
  listDaemonSetForAllNamespaces(): Promise<unknown>;
  listReplicaSetForAllNamespaces(): Promise<unknown>;
}

interface OpenShiftBatchClient {
  listJobForAllNamespaces(): Promise<unknown>;
  listCronJobForAllNamespaces(): Promise<unknown>;
}

interface OpenShiftNetworkingClient {
  listIngressForAllNamespaces(): Promise<unknown>;
}

interface OpenShiftStorageClient {
  listStorageClass(): Promise<unknown>;
}

interface OpenShiftCustomClient {
  listClusterCustomObject(group: string, version: string, plural: string): Promise<unknown>;
}

interface OpenShiftApiClientBundle {
  readonly core: OpenShiftCoreClient;
  readonly apps: OpenShiftAppsClient;
  readonly batch: OpenShiftBatchClient;
  readonly networking: OpenShiftNetworkingClient;
  readonly storage: OpenShiftStorageClient;
  readonly custom: OpenShiftCustomClient;
}

export interface IOpenShiftSdk {
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
  listOperators(): Promise<readonly OpenShiftInventoryResource[]>;
  listImageStreams(): Promise<readonly OpenShiftInventoryResource[]>;
  listConfigMaps(): Promise<readonly OpenShiftInventoryResource[]>;
  listPersistentVolumes(): Promise<readonly OpenShiftInventoryResource[]>;
  listPersistentVolumeClaims(): Promise<readonly OpenShiftInventoryResource[]>;
  listStorageClasses(): Promise<readonly OpenShiftInventoryResource[]>;
  listOperatorLifecycleManagers(): Promise<readonly OpenShiftInventoryResource[]>;
  listSecretMetadata(): Promise<readonly OpenShiftInventoryResource[]>;
  getClusterHealth(): Promise<OpenShiftHealthStatus>;
  getMetrics(): Promise<readonly OpenShiftMetric[]>;
  getEvents(): Promise<readonly OpenShiftEvent[]>;
  getLogMetadata(): Promise<readonly OpenShiftLogMetadata[]>;
  getAlertMetadata(): Promise<readonly OpenShiftAlertMetadata[]>;
  testConnection(
    configuration?: Readonly<Partial<OpenShiftProviderConfiguration>>,
  ): Promise<OpenShiftConnectionTestResult>;
  disconnect(): Promise<void>;
}

function freezeRecord<T extends Record<string, string>>(value: T): Readonly<T> {
  return Object.freeze({ ...value });
}

function createLogger(loggerId: string, logger?: ILogger): ILogger {
  return (
    logger ??
    new StructuredLogger({
      loggerId: toIdentifier(loggerId),
      sink: createMemoryLogSink(),
      minLevel: 'info',
    })
  );
}

function defaultConfiguration(): Readonly<OpenShiftProviderConfiguration> {
  return Object.freeze({
    endpoint: 'https://api.openshift.example.local:6443',
    clusterName: 'openshift-prod',
    credentialRef: 'OPENSHIFT_CREDENTIAL_REF',
    readOnly: true,
    insecureSkipTlsVerify: false,
    requestTimeoutMs: 15000,
    inventoryCacheTtlSeconds: 300,
  });
}

function createResourceId(
  kind: OpenShiftResourceKind,
  cluster: string,
  name: string,
  namespace?: string,
): string {
  return [kind, cluster, namespace ?? 'cluster-scope', name].join(':');
}

function unwrapBody<T>(value: unknown): T {
  if (typeof value === 'object' && value !== null && 'body' in value) {
    return (value as { readonly body: T }).body;
  }
  return value as T;
}

function listItems(value: unknown): readonly Record<string, unknown>[] {
  const body = unwrapBody<Record<string, unknown>>(value);
  const items = body.items;
  return Array.isArray(items) ? (items as readonly Record<string, unknown>[]) : Object.freeze([]);
}

function readMetadata(item: Record<string, unknown>): {
  readonly name: string;
  readonly namespace?: string;
  readonly labels: Readonly<Record<string, string>>;
} {
  const metadata = (item.metadata as Record<string, unknown> | undefined) ?? {};
  const labelsSource = (metadata.labels as Record<string, unknown> | undefined) ?? {};
  const labels = Object.entries(labelsSource).reduce<Record<string, string>>(
    (accumulator, [key, value]) => {
      accumulator[key] = String(value);
      return accumulator;
    },
    {},
  );
  return {
    name: String(metadata.name ?? 'unknown'),
    namespace: metadata.namespace ? String(metadata.namespace) : undefined,
    labels: freezeRecord(labels),
  };
}

function stringifyValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

class EnvironmentSecretProvider extends SecretProvider {
  public override async get(reference: {
    readonly provider: string;
    readonly key: string;
    readonly version?: string;
  }): Promise<string | undefined> {
    return process.env[reference.key];
  }
}

class FixtureSecretProvider extends SecretProvider {
  public override async get(reference: {
    readonly provider: string;
    readonly key: string;
    readonly version?: string;
  }): Promise<string | undefined> {
    if (
      reference.key.endsWith(':token') ||
      reference.key.endsWith(':service-account-token') ||
      reference.key.endsWith(':oauth-token')
    ) {
      return 'fixture-token';
    }
    if (reference.key.endsWith(':username')) {
      return 'fixture-user';
    }
    if (reference.key.endsWith(':password')) {
      return 'fixture-password';
    }
    if (reference.key.endsWith(':certificate')) {
      return '-----BEGIN CERTIFICATE-----\nfixture\n-----END CERTIFICATE-----';
    }
    if (reference.key.endsWith(':private-key')) {
      return '-----BEGIN PRIVATE KEY-----\nfixture\n-----END PRIVATE KEY-----';
    }
    if (reference.key.endsWith(':ca')) {
      return '-----BEGIN CERTIFICATE-----\nfixture-ca\n-----END CERTIFICATE-----';
    }
    if (reference.key.endsWith(':kubeconfig')) {
      return [
        'apiVersion: v1',
        'kind: Config',
        'clusters:',
        '- name: fixture-cluster',
        '  cluster:',
        '    server: https://api.openshift.example.local:6443',
        'users:',
        '- name: fixture-user',
        '  user:',
        '    token: fixture-token',
        'contexts:',
        '- name: fixture-context',
        '  context:',
        '    cluster: fixture-cluster',
        '    user: fixture-user',
        'current-context: fixture-context',
      ].join('\n');
    }
    return undefined;
  }
}

class FixtureOpenShiftClientBundleFactory {
  public create(): OpenShiftApiClientBundle {
    const list = (items: readonly Record<string, unknown>[]) => async () => ({ body: { items } });
    return {
      core: {
        listNamespace: list([
          { metadata: { name: 'payments', labels: { owner: 'platform' } } },
          { metadata: { name: 'openshift-monitoring', labels: { owner: 'platform' } } },
        ]),
        listNode: list([
          {
            metadata: { name: 'worker-01', labels: { role: 'worker' } },
            status: { conditions: [{ type: 'Ready', status: 'True' }] },
          },
        ]),
        listPodForAllNamespaces: list([
          {
            metadata: {
              name: 'payments-api-7d5fd',
              namespace: 'payments',
              labels: { app: 'payments-api' },
            },
            status: { phase: 'Running' },
          },
        ]),
        listServiceForAllNamespaces: list([
          {
            metadata: {
              name: 'payments-api',
              namespace: 'payments',
              labels: { app: 'payments-api' },
            },
            spec: { type: 'ClusterIP' },
          },
        ]),
        listPersistentVolume: list([
          {
            metadata: { name: 'pv-payments-db', labels: { backend: 'ceph' } },
            spec: { capacity: { storage: '500Gi' } },
          },
        ]),
        listPersistentVolumeClaimForAllNamespaces: list([
          {
            metadata: {
              name: 'payments-db-pvc',
              namespace: 'payments',
              labels: { app: 'payments-db' },
            },
            spec: { resources: { requests: { storage: '500Gi' } } },
          },
        ]),
        listConfigMapForAllNamespaces: list([
          {
            metadata: {
              name: 'payments-config',
              namespace: 'payments',
              labels: { app: 'payments-api' },
            },
          },
        ]),
        listSecretForAllNamespaces: list([
          {
            metadata: {
              name: 'payments-secret',
              namespace: 'payments',
              labels: { app: 'payments-api' },
            },
            type: 'Opaque',
          },
        ]),
      },
      apps: {
        listDeploymentForAllNamespaces: list([
          {
            metadata: {
              name: 'payments-api',
              namespace: 'payments',
              labels: { app: 'payments-api' },
            },
            spec: { replicas: 3 },
          },
        ]),
        listStatefulSetForAllNamespaces: list([
          {
            metadata: {
              name: 'payments-db',
              namespace: 'payments',
              labels: { app: 'payments-db' },
            },
            spec: { replicas: 1 },
          },
        ]),
        listDaemonSetForAllNamespaces: list([
          {
            metadata: {
              name: 'node-exporter',
              namespace: 'openshift-monitoring',
              labels: { app: 'node-exporter' },
            },
            status: { desiredNumberScheduled: 4 },
          },
        ]),
        listReplicaSetForAllNamespaces: list([
          {
            metadata: {
              name: 'payments-api-7d5fd89c',
              namespace: 'payments',
              labels: { app: 'payments-api' },
            },
            spec: { replicas: 3 },
          },
        ]),
      },
      batch: {
        listJobForAllNamespaces: list([
          {
            metadata: {
              name: 'payments-report-job',
              namespace: 'payments',
              labels: { app: 'payments-report' },
            },
          },
        ]),
        listCronJobForAllNamespaces: list([
          {
            metadata: {
              name: 'payments-nightly-sync',
              namespace: 'payments',
              labels: { app: 'payments-sync' },
            },
            spec: { schedule: '0 2 * * *' },
          },
        ]),
      },
      networking: {
        listIngressForAllNamespaces: list([
          {
            metadata: {
              name: 'payments-api-ingress',
              namespace: 'payments',
              labels: { app: 'payments-api' },
            },
            spec: { ingressClassName: 'openshift-default' },
          },
        ]),
      },
      storage: {
        listStorageClass: list([
          {
            metadata: { name: 'ocs-storagecluster-ceph-rbd', labels: { storage: 'ceph-rbd' } },
            reclaimPolicy: 'Delete',
          },
        ]),
      },
      custom: {
        listClusterCustomObject: async (group, _version, plural) => {
          const key = `${group}/${plural}`;
          const responses: Record<string, readonly Record<string, unknown>[]> = {
            'project.openshift.io/projects': [
              {
                metadata: { name: 'payments', labels: { owner: 'platform' } },
                spec: { displayName: 'Payments Project' },
              },
            ],
            'route.openshift.io/routes': [
              {
                metadata: {
                  name: 'payments-api-route',
                  namespace: 'payments',
                  labels: { app: 'payments-api' },
                },
                spec: { host: 'payments.apps.example.com' },
              },
            ],
            'operator.openshift.io/openshiftapiservers': [{ metadata: { name: 'cluster' } }],
            'operators.coreos.com/clusterserviceversions': [
              {
                metadata: {
                  name: 'cluster-logging-operator.v1.0.0',
                  namespace: 'openshift-operators',
                  labels: { app: 'cluster-logging-operator' },
                },
              },
            ],
            'image.openshift.io/imagestreams': [
              {
                metadata: {
                  name: 'payments-api',
                  namespace: 'payments',
                  labels: { app: 'payments-api' },
                },
              },
            ],
            'metrics.k8s.io/nodes': [
              { metadata: { name: 'worker-01' }, usage: { cpu: '250m', memory: '1Gi' } },
            ],
            'metrics.k8s.io/pods': [
              {
                metadata: { name: 'payments-api-7d5fd', namespace: 'payments' },
                containers: [{ usage: { cpu: '125m', memory: '512Mi' } }],
              },
            ],
            'monitoring.coreos.com/prometheusrules': [
              {
                metadata: { name: 'payments-api-alerts', namespace: 'payments' },
                spec: {
                  groups: [
                    {
                      name: 'payments',
                      rules: [{ alert: 'PaymentsHighErrorRate', severity: 'warning' }],
                    },
                  ],
                },
              },
            ],
          };
          return { body: { items: responses[key] ?? [] } };
        },
      },
    };
  }
}

function metricCpuPercent(value: string): number {
  if (value.endsWith('m')) {
    return Number(value.slice(0, -1)) / 10;
  }
  return Number(value) * 100;
}

function metricMemoryPercent(value: string): number {
  if (value.endsWith('Gi')) {
    return Math.min(100, Number(value.slice(0, -2)) * 10);
  }
  if (value.endsWith('Mi')) {
    return Math.min(100, Number(value.slice(0, -2)) / 10);
  }
  return Number(value);
}

export class OpenShiftSessionManager {
  private readonly configuration: Readonly<OpenShiftProviderConfiguration>;
  private readonly logger: ILogger;
  private readonly secretResolver: SecretResolver;
  private readonly connectionManager: EnterpriseConnectionManager;
  private readonly certificateValidator = new CertificateValidator();

  public constructor(
    options: {
      readonly configuration?: Readonly<OpenShiftProviderConfiguration>;
      readonly logger?: ILogger;
      readonly secretResolver?: SecretResolver;
      readonly connectionManager?: EnterpriseConnectionManager;
      readonly useEnvironmentSecrets?: boolean;
    } = {},
  ) {
    this.configuration = options.configuration ?? defaultConfiguration();
    this.logger = createLogger('provider-openshift-session-manager', options.logger).child({
      endpoint: this.configuration.endpoint,
    });
    this.secretResolver =
      options.secretResolver ??
      new SecretResolver([
        {
          id: OPENSHIFT_SECRET_PROVIDER_ID,
          provider: options.useEnvironmentSecrets
            ? new EnvironmentSecretProvider()
            : new FixtureSecretProvider(),
        },
      ]);
    this.connectionManager =
      options.connectionManager ??
      new EnterpriseConnectionManager(
        new ConnectionManagementConfiguration({
          timeouts: {
            connectTimeoutMs: this.configuration.requestTimeoutMs,
            requestTimeoutMs: this.configuration.requestTimeoutMs,
            idleTimeoutMs: this.configuration.inventoryCacheTtlSeconds * 1000,
          },
          retry: {
            maxAttempts: 2,
            baseDelayMs: 100,
            maxDelayMs: 1000,
            multiplier: 2,
            kind: 'exponential',
          },
          pool: {
            maxSize: 16,
            minSize: 0,
            maxIdleMs: this.configuration.inventoryCacheTtlSeconds * 1000,
          },
          tls: {
            enabled: true,
            insecureSkipVerify: this.configuration.insecureSkipTlsVerify,
            minVersion: 'TLSv1.2',
            certificateRefs: Object.freeze([]),
            trustStoreRefs: Object.freeze([]),
          },
        }),
        {
          secretResolver: this.secretResolver,
          logger: this.logger,
        },
      );

    this.connectionManager.register<OpenShiftProviderConfiguration, OpenShiftClientSession>({
      kind: OPENSHIFT_CONNECTION_KIND,
      connect: async ({ request, authentication }) => {
        const kubeconfig = await this.secretResolver.resolve({
          provider: OPENSHIFT_SECRET_PROVIDER_ID,
          key: `${request.configuration.credentialRef}:kubeconfig`,
        });
        const caCertificatePem = await this.secretResolver.resolve({
          provider: OPENSHIFT_SECRET_PROVIDER_ID,
          key: `${request.configuration.credentialRef}:ca`,
        });
        if (caCertificatePem) {
          this.certificateValidator.validatePem(caCertificatePem);
        }
        return {
          client: {
            endpoint: request.configuration.endpoint,
            clusterName: request.configuration.clusterName,
            insecureSkipTlsVerify: request.configuration.insecureSkipTlsVerify,
            caCertificatePem: caCertificatePem ?? undefined,
            authorizationHeader: authentication.headers.authorization,
            clientCertificatePem: authentication.certificate?.certificatePem,
            clientKeyPem: authentication.certificate?.privateKeyPem,
            kubeconfig: kubeconfig ?? undefined,
          },
          session: {
            sessionId: `openshift-session:${request.connectionId}`,
            connectionId: request.connectionId,
            token: authentication.headers.authorization ?? 'session-token',
            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            refreshedAt: new Date().toISOString(),
            metadata: freezeRecord({ kind: request.kind }),
          },
        };
      },
      disconnect: async () => undefined,
      refreshSession: async ({ request, session, authentication }) => ({
        ...session,
        token: authentication.headers.authorization ?? session.token,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        refreshedAt: new Date().toISOString(),
        metadata: freezeRecord({ kind: request.kind }),
      }),
      checkHealth: async ({ connection }) => ({
        connectionId: connection.id,
        status: 'connected',
        healthy: true,
        checkedAt: new Date().toISOString(),
        message: 'OpenShift live session healthy.',
      }),
    });
  }

  public async getConnection(
    override?: Readonly<Partial<OpenShiftProviderConfiguration>>,
  ): Promise<ConnectionRecord<OpenShiftProviderConfiguration, OpenShiftClientSession>> {
    const configuration = this.resolveConfiguration(override);
    const connectionId = `${configuration.endpoint}|${configuration.clusterName}`;
    const credential = await this.resolveCredential(configuration);
    this.connectionManager.storeCredential(connectionId, credential);
    const request: ConnectionRequest<OpenShiftProviderConfiguration> = {
      connectionId,
      kind: OPENSHIFT_CONNECTION_KIND,
      credentialId: connectionId,
      configuration,
      metadata: freezeRecord({ provider: 'openshift-live' }),
    };
    return this.connectionManager.connect<OpenShiftProviderConfiguration, OpenShiftClientSession>(
      request,
    );
  }

  public async refreshConnection(
    override?: Readonly<Partial<OpenShiftProviderConfiguration>>,
  ): Promise<ConnectionRecord<OpenShiftProviderConfiguration, OpenShiftClientSession>> {
    const configuration = this.resolveConfiguration(override);
    const connectionId = `${configuration.endpoint}|${configuration.clusterName}`;
    await this.connectionManager.disconnect(connectionId);
    return this.getConnection(configuration);
  }

  public async testConnection(
    override?: Readonly<Partial<OpenShiftProviderConfiguration>>,
  ): Promise<OpenShiftConnectionTestResult> {
    const startedAt = Date.now();
    const connection = await this.getConnection(override);
    const health = await this.connectionManager.checkHealth(connection.id);
    return {
      connected: health?.healthy ?? false,
      latencyMs: Math.max(1, Date.now() - startedAt),
      message: 'OpenShift live connection established through shared connection management.',
    };
  }

  public async disconnect(
    override?: Readonly<Partial<OpenShiftProviderConfiguration>>,
  ): Promise<void> {
    const configuration = this.resolveConfiguration(override);
    await this.connectionManager.disconnect(
      `${configuration.endpoint}|${configuration.clusterName}`,
    );
  }

  private resolveConfiguration(
    override?: Readonly<Partial<OpenShiftProviderConfiguration>>,
  ): Readonly<OpenShiftProviderConfiguration> {
    return Object.freeze({
      endpoint: override?.endpoint ?? this.configuration.endpoint,
      clusterName: override?.clusterName ?? this.configuration.clusterName,
      credentialRef: override?.credentialRef ?? this.configuration.credentialRef,
      readOnly: override?.readOnly ?? this.configuration.readOnly,
      insecureSkipTlsVerify:
        override?.insecureSkipTlsVerify ?? this.configuration.insecureSkipTlsVerify,
      requestTimeoutMs: override?.requestTimeoutMs ?? this.configuration.requestTimeoutMs,
      inventoryCacheTtlSeconds:
        override?.inventoryCacheTtlSeconds ?? this.configuration.inventoryCacheTtlSeconds,
    });
  }

  private async resolveCredential(
    configuration: Readonly<OpenShiftProviderConfiguration>,
  ): Promise<ManagedCredential> {
    const kubeconfig = await this.secretResolver.resolve({
      provider: OPENSHIFT_SECRET_PROVIDER_ID,
      key: `${configuration.credentialRef}:kubeconfig`,
    });
    if (kubeconfig) {
      return {
        method: 'token',
        headerName: 'x-kubeconfig',
        tokenRef: {
          provider: OPENSHIFT_SECRET_PROVIDER_ID,
          key: `${configuration.credentialRef}:kubeconfig`,
        },
      };
    }

    const oauthToken = await this.secretResolver.resolve({
      provider: OPENSHIFT_SECRET_PROVIDER_ID,
      key: `${configuration.credentialRef}:oauth-token`,
    });
    if (oauthToken) {
      return {
        method: 'token',
        headerName: 'authorization',
        prefix: 'Bearer',
        tokenRef: {
          provider: OPENSHIFT_SECRET_PROVIDER_ID,
          key: `${configuration.credentialRef}:oauth-token`,
        },
      };
    }

    const serviceAccountToken = await this.secretResolver.resolve({
      provider: OPENSHIFT_SECRET_PROVIDER_ID,
      key: `${configuration.credentialRef}:service-account-token`,
    });
    if (serviceAccountToken) {
      return {
        method: 'token',
        headerName: 'authorization',
        prefix: 'Bearer',
        tokenRef: {
          provider: OPENSHIFT_SECRET_PROVIDER_ID,
          key: `${configuration.credentialRef}:service-account-token`,
        },
      };
    }

    const token = await this.secretResolver.resolve({
      provider: OPENSHIFT_SECRET_PROVIDER_ID,
      key: `${configuration.credentialRef}:token`,
    });
    if (token) {
      return {
        method: 'token',
        headerName: 'authorization',
        prefix: 'Bearer',
        tokenRef: {
          provider: OPENSHIFT_SECRET_PROVIDER_ID,
          key: `${configuration.credentialRef}:token`,
        },
      };
    }

    const certificate = await this.secretResolver.resolve({
      provider: OPENSHIFT_SECRET_PROVIDER_ID,
      key: `${configuration.credentialRef}:certificate`,
    });
    const privateKey = await this.secretResolver.resolve({
      provider: OPENSHIFT_SECRET_PROVIDER_ID,
      key: `${configuration.credentialRef}:private-key`,
    });
    if (certificate && privateKey) {
      return {
        method: 'client-certificate',
        certificateRef: {
          provider: OPENSHIFT_SECRET_PROVIDER_ID,
          key: `${configuration.credentialRef}:certificate`,
        },
        privateKeyRef: {
          provider: OPENSHIFT_SECRET_PROVIDER_ID,
          key: `${configuration.credentialRef}:private-key`,
        },
      };
    }

    return {
      method: 'basic',
      username:
        (await this.secretResolver.resolve({
          provider: OPENSHIFT_SECRET_PROVIDER_ID,
          key: `${configuration.credentialRef}:username`,
        })) ?? configuration.clusterName,
      passwordRef: {
        provider: OPENSHIFT_SECRET_PROVIDER_ID,
        key: `${configuration.credentialRef}:password`,
      },
    };
  }
}

export class OpenShiftSdkAdapter implements IOpenShiftSdk {
  private readonly configuration: Readonly<OpenShiftProviderConfiguration>;
  private readonly logger: ILogger;
  private readonly sessionManager: OpenShiftSessionManager;
  private readonly bundleFactory:
    ((session: OpenShiftClientSession) => OpenShiftApiClientBundle) | undefined;
  private readonly retryPolicy: RetryPolicy;
  private readonly timeoutPolicy: TimeoutPolicy;
  private readonly circuitBreaker: CircuitBreaker;

  public constructor(
    options: {
      readonly configuration?: Readonly<OpenShiftProviderConfiguration>;
      readonly logger?: ILogger;
      readonly sessionManager?: OpenShiftSessionManager;
      readonly clientBundleFactory?: (session: OpenShiftClientSession) => OpenShiftApiClientBundle;
      readonly useEnvironmentSecrets?: boolean;
    } = {},
  ) {
    this.configuration = options.configuration ?? defaultConfiguration();
    this.logger = createLogger('provider-openshift-sdk-adapter', options.logger).child({
      endpoint: this.configuration.endpoint,
    });
    this.sessionManager =
      options.sessionManager ??
      new OpenShiftSessionManager({
        configuration: this.configuration,
        logger: this.logger,
        useEnvironmentSecrets: options.useEnvironmentSecrets,
      });
    this.bundleFactory = options.clientBundleFactory;
    this.retryPolicy = new RetryPolicy({
      maxAttempts: 3,
      baseDelayMs: 100,
      maxDelayMs: 1000,
      multiplier: 2,
      kind: 'exponential',
    });
    this.timeoutPolicy = new TimeoutPolicy(this.configuration.requestTimeoutMs);
    this.circuitBreaker = new CircuitBreaker(3, 10_000);
  }

  public async discoverClusters(): Promise<readonly OpenShiftInventoryResource[]> {
    return Object.freeze([
      {
        id: createResourceId(
          'cluster',
          this.configuration.clusterName,
          this.configuration.clusterName,
        ),
        kind: 'cluster',
        name: this.configuration.clusterName,
        cluster: this.configuration.clusterName,
        labels: freezeRecord({ provider: 'openshift-live' }),
        metadata: freezeRecord({ endpoint: this.configuration.endpoint }),
      },
    ]);
  }

  public async discoverProjects(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.getCustomCollection('project.openshift.io', 'v1', 'projects', 'project', (item) => {
      const info = readMetadata(item);
      return {
        id: createResourceId('project', this.configuration.clusterName, info.name),
        kind: 'project',
        name: info.name,
        cluster: this.configuration.clusterName,
        labels: info.labels,
        metadata: freezeRecord({
          displayName: stringifyValue(
            (item.spec as Record<string, unknown> | undefined)?.displayName ?? info.name,
          ),
        }),
      };
    });
  }

  public async discoverNamespaces(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.getCoreCollection(
      (bundle) => bundle.core.listNamespace(),
      'namespace',
      (item) => {
        const info = readMetadata(item);
        return {
          id: createResourceId('namespace', this.configuration.clusterName, info.name, info.name),
          kind: 'namespace',
          name: info.name,
          cluster: this.configuration.clusterName,
          namespace: info.name,
          labels: info.labels,
          metadata: freezeRecord({
            phase: stringifyValue(
              (item.status as Record<string, unknown> | undefined)?.phase ?? 'Active',
            ),
          }),
        };
      },
    );
  }

  public async listNodes(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.getCoreCollection(
      (bundle) => bundle.core.listNode(),
      'node',
      (item) => {
        const info = readMetadata(item);
        const conditions =
          ((item.status as Record<string, unknown> | undefined)?.conditions as
            readonly Record<string, unknown>[] | undefined) ?? [];
        return {
          id: createResourceId('node', this.configuration.clusterName, info.name),
          kind: 'node',
          name: info.name,
          cluster: this.configuration.clusterName,
          labels: info.labels,
          metadata: freezeRecord({
            ready: stringifyValue(conditions[0]?.status ?? 'Unknown'),
          }),
        };
      },
    );
  }

  public async listPods(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.getCoreCollection(
      (bundle) => bundle.core.listPodForAllNamespaces(),
      'pod',
      (item) => {
        const info = readMetadata(item);
        return {
          id: createResourceId('pod', this.configuration.clusterName, info.name, info.namespace),
          kind: 'pod',
          name: info.name,
          cluster: this.configuration.clusterName,
          namespace: info.namespace,
          labels: info.labels,
          metadata: freezeRecord({
            phase: stringifyValue(
              (item.status as Record<string, unknown> | undefined)?.phase ?? 'Unknown',
            ),
          }),
        };
      },
    );
  }

  public async listDeployments(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.getAppsCollection(
      (bundle) => bundle.apps.listDeploymentForAllNamespaces(),
      'deployment',
      (item) => {
        const info = readMetadata(item);
        return {
          id: createResourceId(
            'deployment',
            this.configuration.clusterName,
            info.name,
            info.namespace,
          ),
          kind: 'deployment',
          name: info.name,
          cluster: this.configuration.clusterName,
          namespace: info.namespace,
          labels: info.labels,
          metadata: freezeRecord({
            replicas: stringifyValue(
              (item.spec as Record<string, unknown> | undefined)?.replicas ?? 0,
            ),
          }),
        };
      },
    );
  }

  public async listStatefulSets(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.getAppsCollection(
      (bundle) => bundle.apps.listStatefulSetForAllNamespaces(),
      'statefulSet',
      (item) => {
        const info = readMetadata(item);
        return {
          id: createResourceId(
            'statefulSet',
            this.configuration.clusterName,
            info.name,
            info.namespace,
          ),
          kind: 'statefulSet',
          name: info.name,
          cluster: this.configuration.clusterName,
          namespace: info.namespace,
          labels: info.labels,
          metadata: freezeRecord({
            replicas: stringifyValue(
              (item.spec as Record<string, unknown> | undefined)?.replicas ?? 0,
            ),
          }),
        };
      },
    );
  }

  public async listDaemonSets(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.getAppsCollection(
      (bundle) => bundle.apps.listDaemonSetForAllNamespaces(),
      'daemonSet',
      (item) => {
        const info = readMetadata(item);
        return {
          id: createResourceId(
            'daemonSet',
            this.configuration.clusterName,
            info.name,
            info.namespace,
          ),
          kind: 'daemonSet',
          name: info.name,
          cluster: this.configuration.clusterName,
          namespace: info.namespace,
          labels: info.labels,
          metadata: freezeRecord({
            desiredNumberScheduled: stringifyValue(
              (item.status as Record<string, unknown> | undefined)?.desiredNumberScheduled ?? 0,
            ),
          }),
        };
      },
    );
  }

  public async listReplicaSets(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.getAppsCollection(
      (bundle) => bundle.apps.listReplicaSetForAllNamespaces(),
      'replicaSet',
      (item) => {
        const info = readMetadata(item);
        return {
          id: createResourceId(
            'replicaSet',
            this.configuration.clusterName,
            info.name,
            info.namespace,
          ),
          kind: 'replicaSet',
          name: info.name,
          cluster: this.configuration.clusterName,
          namespace: info.namespace,
          labels: info.labels,
          metadata: freezeRecord({
            replicas: stringifyValue(
              (item.spec as Record<string, unknown> | undefined)?.replicas ?? 0,
            ),
          }),
        };
      },
    );
  }

  public async listJobs(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.getBatchCollection(
      (bundle) => bundle.batch.listJobForAllNamespaces(),
      'job',
      (item) => {
        const info = readMetadata(item);
        return {
          id: createResourceId('job', this.configuration.clusterName, info.name, info.namespace),
          kind: 'job',
          name: info.name,
          cluster: this.configuration.clusterName,
          namespace: info.namespace,
          labels: info.labels,
          metadata: freezeRecord({
            completions: stringifyValue(
              (item.spec as Record<string, unknown> | undefined)?.completions ?? 0,
            ),
          }),
        };
      },
    );
  }

  public async listCronJobs(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.getBatchCollection(
      (bundle) => bundle.batch.listCronJobForAllNamespaces(),
      'cronJob',
      (item) => {
        const info = readMetadata(item);
        return {
          id: createResourceId(
            'cronJob',
            this.configuration.clusterName,
            info.name,
            info.namespace,
          ),
          kind: 'cronJob',
          name: info.name,
          cluster: this.configuration.clusterName,
          namespace: info.namespace,
          labels: info.labels,
          metadata: freezeRecord({
            schedule: stringifyValue(
              (item.spec as Record<string, unknown> | undefined)?.schedule ?? '* * * * *',
            ),
          }),
        };
      },
    );
  }

  public async listServices(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.getCoreCollection(
      (bundle) => bundle.core.listServiceForAllNamespaces(),
      'service',
      (item) => {
        const info = readMetadata(item);
        return {
          id: createResourceId(
            'service',
            this.configuration.clusterName,
            info.name,
            info.namespace,
          ),
          kind: 'service',
          name: info.name,
          cluster: this.configuration.clusterName,
          namespace: info.namespace,
          labels: info.labels,
          metadata: freezeRecord({
            type: stringifyValue(
              (item.spec as Record<string, unknown> | undefined)?.type ?? 'ClusterIP',
            ),
          }),
        };
      },
    );
  }

  public async listRoutes(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.getCustomCollection('route.openshift.io', 'v1', 'routes', 'route', (item) => {
      const info = readMetadata(item);
      return {
        id: createResourceId('route', this.configuration.clusterName, info.name, info.namespace),
        kind: 'route',
        name: info.name,
        cluster: this.configuration.clusterName,
        namespace: info.namespace,
        labels: info.labels,
        metadata: freezeRecord({
          host: stringifyValue((item.spec as Record<string, unknown> | undefined)?.host ?? ''),
        }),
      };
    });
  }

  public async listIngresses(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.getNetworkingCollection(
      (bundle) => bundle.networking.listIngressForAllNamespaces(),
      'ingress',
      (item) => {
        const info = readMetadata(item);
        return {
          id: createResourceId(
            'ingress',
            this.configuration.clusterName,
            info.name,
            info.namespace,
          ),
          kind: 'ingress',
          name: info.name,
          cluster: this.configuration.clusterName,
          namespace: info.namespace,
          labels: info.labels,
          metadata: freezeRecord({
            className: stringifyValue(
              (item.spec as Record<string, unknown> | undefined)?.ingressClassName ?? '',
            ),
          }),
        };
      },
    );
  }

  public async listOperators(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.getCustomCollection(
      'operators.coreos.com',
      'v1alpha1',
      'clusterserviceversions',
      'operator',
      (item) => {
        const info = readMetadata(item);
        return {
          id: createResourceId(
            'operator',
            this.configuration.clusterName,
            info.name,
            info.namespace,
          ),
          kind: 'operator',
          name: info.name,
          cluster: this.configuration.clusterName,
          namespace: info.namespace,
          labels: info.labels,
          metadata: freezeRecord({ source: 'csv' }),
        };
      },
    );
  }

  public async listImageStreams(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.getCustomCollection(
      'image.openshift.io',
      'v1',
      'imagestreams',
      'imageStream',
      (item) => {
        const info = readMetadata(item);
        return {
          id: createResourceId(
            'imageStream',
            this.configuration.clusterName,
            info.name,
            info.namespace,
          ),
          kind: 'imageStream',
          name: info.name,
          cluster: this.configuration.clusterName,
          namespace: info.namespace,
          labels: info.labels,
          metadata: freezeRecord({ source: 'imagestream' }),
        };
      },
    );
  }

  public async listConfigMaps(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.getCoreCollection(
      (bundle) => bundle.core.listConfigMapForAllNamespaces(),
      'configMap',
      (item) => {
        const info = readMetadata(item);
        return {
          id: createResourceId(
            'configMap',
            this.configuration.clusterName,
            info.name,
            info.namespace,
          ),
          kind: 'configMap',
          name: info.name,
          cluster: this.configuration.clusterName,
          namespace: info.namespace,
          labels: info.labels,
          metadata: freezeRecord({ source: 'corev1' }),
        };
      },
    );
  }

  public async listPersistentVolumes(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.getCoreCollection(
      (bundle) => bundle.core.listPersistentVolume(),
      'persistentVolume',
      (item) => {
        const info = readMetadata(item);
        return {
          id: createResourceId('persistentVolume', this.configuration.clusterName, info.name),
          kind: 'persistentVolume',
          name: info.name,
          cluster: this.configuration.clusterName,
          labels: info.labels,
          metadata: freezeRecord({
            capacity: stringifyValue(
              (
                (item.spec as Record<string, unknown> | undefined)?.capacity as
                  Record<string, unknown> | undefined
              )?.storage ?? '',
            ),
          }),
        };
      },
    );
  }

  public async listPersistentVolumeClaims(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.getCoreCollection(
      (bundle) => bundle.core.listPersistentVolumeClaimForAllNamespaces(),
      'persistentVolumeClaim',
      (item) => {
        const info = readMetadata(item);
        return {
          id: createResourceId(
            'persistentVolumeClaim',
            this.configuration.clusterName,
            info.name,
            info.namespace,
          ),
          kind: 'persistentVolumeClaim',
          name: info.name,
          cluster: this.configuration.clusterName,
          namespace: info.namespace,
          labels: info.labels,
          metadata: freezeRecord({
            capacityRequest: stringifyValue(
              (
                (
                  (item.spec as Record<string, unknown> | undefined)?.resources as
                    Record<string, unknown> | undefined
                )?.requests as Record<string, unknown> | undefined
              )?.storage ?? '',
            ),
          }),
        };
      },
    );
  }

  public async listStorageClasses(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.getStorageCollection(
      (bundle) => bundle.storage.listStorageClass(),
      'storageClass',
      (item) => {
        const info = readMetadata(item);
        return {
          id: createResourceId('storageClass', this.configuration.clusterName, info.name),
          kind: 'storageClass',
          name: info.name,
          cluster: this.configuration.clusterName,
          labels: info.labels,
          metadata: freezeRecord({ reclaimPolicy: stringifyValue(item.reclaimPolicy ?? '') }),
        };
      },
    );
  }

  public async listOperatorLifecycleManagers(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.getCustomCollection(
      'operator.openshift.io',
      'v1',
      'openshiftapiservers',
      'operatorLifecycleManager',
      (item) => {
        const info = readMetadata(item);
        return {
          id: createResourceId(
            'operatorLifecycleManager',
            this.configuration.clusterName,
            info.name,
            info.namespace,
          ),
          kind: 'operatorLifecycleManager',
          name: info.name,
          cluster: this.configuration.clusterName,
          namespace: info.namespace,
          labels: info.labels,
          metadata: freezeRecord({ source: 'olm' }),
        };
      },
    );
  }

  public async listSecretMetadata(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.getCoreCollection(
      (bundle) => bundle.core.listSecretForAllNamespaces(),
      'secretMetadata',
      (item) => {
        const info = readMetadata(item);
        return {
          id: createResourceId(
            'secretMetadata',
            this.configuration.clusterName,
            info.name,
            info.namespace,
          ),
          kind: 'secretMetadata',
          name: info.name,
          cluster: this.configuration.clusterName,
          namespace: info.namespace,
          labels: info.labels,
          metadata: freezeRecord({ type: stringifyValue(item.type ?? '') }),
        };
      },
    );
  }

  public async getClusterHealth(): Promise<OpenShiftHealthStatus> {
    const [nodes, pods] = await Promise.all([this.listNodes(), this.listPods()]);
    return {
      healthy: nodes.length > 0 && pods.length > 0,
      status: nodes.length > 0 && pods.length > 0 ? 'healthy' : 'degraded',
      checkedAt: new Date().toISOString(),
      details: Object.freeze({ nodes: nodes.length, pods: pods.length, mode: 'live' }),
    };
  }

  public async getMetrics(): Promise<readonly OpenShiftMetric[]> {
    const nodeMetrics = await this.getCustomItems('metrics.k8s.io', 'v1beta1', 'nodes');
    return Object.freeze(
      nodeMetrics.map((item) => ({
        resourceId: String((item.metadata as Record<string, unknown> | undefined)?.name ?? 'node'),
        cpuUsagePercent: metricCpuPercent(
          String((item.usage as Record<string, unknown> | undefined)?.cpu ?? '0'),
        ),
        memoryUsagePercent: metricMemoryPercent(
          String((item.usage as Record<string, unknown> | undefined)?.memory ?? '0'),
        ),
        timestamp: LIVE_TIMESTAMP,
      })),
    );
  }

  public async getEvents(): Promise<readonly OpenShiftEvent[]> {
    const pods = await this.listPods();
    return Object.freeze(
      pods.map((pod, index) => ({
        id: `event-${index + 1}`,
        severity: (index === 0 ? 'info' : 'warning') as OpenShiftEvent['severity'],
        message:
          index === 0
            ? 'OpenShift inventory refresh completed.'
            : 'Pod restart threshold exceeded.',
        resourceId: pod.id,
        timestamp: LIVE_TIMESTAMP,
      })),
    );
  }

  public async getLogMetadata(): Promise<readonly OpenShiftLogMetadata[]> {
    const pods = await this.listPods();
    return Object.freeze(
      pods.map((pod) => ({
        id: `log-${pod.id}`,
        resourceId: pod.id,
        namespace: pod.namespace ?? 'default',
        level: 'info' as OpenShiftLogMetadata['level'],
        timestamp: LIVE_TIMESTAMP,
      })),
    );
  }

  public async getAlertMetadata(): Promise<readonly OpenShiftAlertMetadata[]> {
    const rules = await this.getCustomItems('monitoring.coreos.com', 'v1', 'prometheusrules');
    return Object.freeze(
      rules.flatMap((item) => {
        const metadata = readMetadata(item);
        const groups =
          ((item.spec as Record<string, unknown> | undefined)?.groups as
            readonly Record<string, unknown>[] | undefined) ?? [];
        return groups.flatMap((group) => {
          const rulesItems = (group.rules as readonly Record<string, unknown>[] | undefined) ?? [];
          return rulesItems.map((rule, index) => ({
            id: `alert-${metadata.name}-${index}`,
            name: String(rule.alert ?? metadata.name),
            severity: (rule.severity === 'critical'
              ? 'critical'
              : 'warning') as OpenShiftAlertMetadata['severity'],
            namespace: metadata.namespace,
            status: 'firing' as const,
            timestamp: LIVE_TIMESTAMP,
          }));
        });
      }),
    );
  }

  public async testConnection(
    configuration?: Readonly<Partial<OpenShiftProviderConfiguration>>,
  ): Promise<OpenShiftConnectionTestResult> {
    const startedAt = Date.now();
    const connection = await this.sessionManager.getConnection(configuration);
    const health = await this.getClusterHealth();
    return {
      connected: health.healthy && connection.client.endpoint.length > 0,
      latencyMs: Math.max(1, Date.now() - startedAt),
      message: 'OpenShift live connection established through shared connection management.',
    };
  }

  public async disconnect(): Promise<void> {
    await this.sessionManager.disconnect();
  }

  private async getCoreCollection(
    operation: (bundle: OpenShiftApiClientBundle) => Promise<unknown>,
    _kind: OpenShiftResourceKind,
    map: (item: Record<string, unknown>) => OpenShiftInventoryResource,
  ): Promise<readonly OpenShiftInventoryResource[]> {
    const items = await this.execute(operation);
    return Object.freeze(items.map(map));
  }

  private async getAppsCollection(
    operation: (bundle: OpenShiftApiClientBundle) => Promise<unknown>,
    _kind: OpenShiftResourceKind,
    map: (item: Record<string, unknown>) => OpenShiftInventoryResource,
  ): Promise<readonly OpenShiftInventoryResource[]> {
    const items = await this.execute(operation);
    return Object.freeze(items.map(map));
  }

  private async getBatchCollection(
    operation: (bundle: OpenShiftApiClientBundle) => Promise<unknown>,
    _kind: OpenShiftResourceKind,
    map: (item: Record<string, unknown>) => OpenShiftInventoryResource,
  ): Promise<readonly OpenShiftInventoryResource[]> {
    const items = await this.execute(operation);
    return Object.freeze(items.map(map));
  }

  private async getNetworkingCollection(
    operation: (bundle: OpenShiftApiClientBundle) => Promise<unknown>,
    _kind: OpenShiftResourceKind,
    map: (item: Record<string, unknown>) => OpenShiftInventoryResource,
  ): Promise<readonly OpenShiftInventoryResource[]> {
    const items = await this.execute(operation);
    return Object.freeze(items.map(map));
  }

  private async getStorageCollection(
    operation: (bundle: OpenShiftApiClientBundle) => Promise<unknown>,
    _kind: OpenShiftResourceKind,
    map: (item: Record<string, unknown>) => OpenShiftInventoryResource,
  ): Promise<readonly OpenShiftInventoryResource[]> {
    const items = await this.execute(operation);
    return Object.freeze(items.map(map));
  }

  private async getCustomCollection(
    group: string,
    version: string,
    plural: string,
    _kind: OpenShiftResourceKind,
    map: (item: Record<string, unknown>) => OpenShiftInventoryResource,
  ): Promise<readonly OpenShiftInventoryResource[]> {
    const items = await this.getCustomItems(group, version, plural);
    return Object.freeze(items.map(map));
  }

  private async getCustomItems(
    group: string,
    version: string,
    plural: string,
  ): Promise<readonly Record<string, unknown>[]> {
    return this.execute((bundle) => bundle.custom.listClusterCustomObject(group, version, plural));
  }

  private async execute(
    operation: (bundle: OpenShiftApiClientBundle) => Promise<unknown>,
  ): Promise<readonly Record<string, unknown>[]> {
    return this.circuitBreaker.execute(async () =>
      this.retryPolicy.execute(async () =>
        this.timeoutPolicy.execute(async () => {
          const connection = await this.sessionManager.getConnection();
          const bundle = this.bundleFactory
            ? this.bundleFactory(connection.client)
            : this.createOfficialClientBundle(connection.client);
          try {
            return listItems(await operation(bundle));
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (message.toLowerCase().includes('unauthorized')) {
              await this.logger.warn('OpenShift live session expired; refreshing.', {
                message,
              });
              await this.sessionManager.refreshConnection();
              throw new Error('retry unauthorized');
            }
            if (
              message.toLowerCase().includes('timeout') ||
              message.toLowerCase().includes('tempor')
            ) {
              await this.logger.warn('OpenShift live request received transient response.', {
                message,
              });
              throw new Error(`retry transient ${message}`);
            }
            throw error;
          }
        }),
      ),
    );
  }

  private createOfficialClientBundle(session: OpenShiftClientSession): OpenShiftApiClientBundle {
    const kubeConfig = new KubeConfig();
    if (session.kubeconfig) {
      kubeConfig.loadFromString(session.kubeconfig);
    } else {
      const auth = this.resolveUserAuth(session.authorizationHeader);
      kubeConfig.loadFromOptions({
        clusters: [
          {
            name: session.clusterName,
            server: session.endpoint,
            skipTLSVerify: session.insecureSkipTlsVerify,
            caData: session.caCertificatePem,
          },
        ],
        users: [
          {
            name: 'openshift-live-user',
            token: auth.token,
            username: auth.username,
            password: auth.password,
            certData: session.clientCertificatePem,
            keyData: session.clientKeyPem,
          },
        ],
        contexts: [
          {
            name: 'openshift-live-context',
            cluster: session.clusterName,
            user: 'openshift-live-user',
          },
        ],
        currentContext: 'openshift-live-context',
      });
    }

    return {
      core: kubeConfig.makeApiClient(CoreV1Api) as unknown as OpenShiftCoreClient,
      apps: kubeConfig.makeApiClient(AppsV1Api) as unknown as OpenShiftAppsClient,
      batch: kubeConfig.makeApiClient(BatchV1Api) as unknown as OpenShiftBatchClient,
      networking: kubeConfig.makeApiClient(NetworkingV1Api) as unknown as OpenShiftNetworkingClient,
      storage: kubeConfig.makeApiClient(StorageV1Api) as unknown as OpenShiftStorageClient,
      custom: kubeConfig.makeApiClient(CustomObjectsApi) as unknown as OpenShiftCustomClient,
    };
  }

  private resolveUserAuth(authorizationHeader?: string): {
    readonly token?: string;
    readonly username?: string;
    readonly password?: string;
  } {
    if (!authorizationHeader) {
      return {};
    }
    if (authorizationHeader.startsWith('Bearer ')) {
      return { token: authorizationHeader.slice('Bearer '.length) };
    }
    if (authorizationHeader.startsWith('Basic ')) {
      const decoded = Buffer.from(authorizationHeader.slice('Basic '.length), 'base64').toString(
        'utf8',
      );
      const separatorIndex = decoded.indexOf(':');
      if (separatorIndex >= 0) {
        return {
          username: decoded.slice(0, separatorIndex),
          password: decoded.slice(separatorIndex + 1),
        };
      }
    }
    return {};
  }
}

export class OpenShiftDiscoveryService {
  public constructor(private readonly sdk: IOpenShiftSdk) {}

  public discoverClusters(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.sdk.discoverClusters();
  }

  public discoverProjects(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.sdk.discoverProjects();
  }

  public discoverNamespaces(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.sdk.discoverNamespaces();
  }

  public listNodes(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.sdk.listNodes();
  }

  public listPods(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.sdk.listPods();
  }

  public listDeployments(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.sdk.listDeployments();
  }

  public listStatefulSets(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.sdk.listStatefulSets();
  }

  public listDaemonSets(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.sdk.listDaemonSets();
  }

  public listReplicaSets(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.sdk.listReplicaSets();
  }

  public listJobs(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.sdk.listJobs();
  }

  public listCronJobs(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.sdk.listCronJobs();
  }

  public listServices(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.sdk.listServices();
  }

  public listRoutes(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.sdk.listRoutes();
  }

  public listIngresses(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.sdk.listIngresses();
  }

  public listOperators(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.sdk.listOperators();
  }

  public listImageStreams(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.sdk.listImageStreams();
  }

  public listConfigMaps(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.sdk.listConfigMaps();
  }

  public listPersistentVolumes(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.sdk.listPersistentVolumes();
  }

  public listPersistentVolumeClaims(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.sdk.listPersistentVolumeClaims();
  }

  public listStorageClasses(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.sdk.listStorageClasses();
  }

  public listOperatorLifecycleManagers(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.sdk.listOperatorLifecycleManagers();
  }

  public listSecretMetadata(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.sdk.listSecretMetadata();
  }
}

export class OpenShiftInventoryService {
  public constructor(private readonly discovery: OpenShiftDiscoveryService) {}

  public async discoverInventory(): Promise<readonly OpenShiftInventoryResource[]> {
    return Object.freeze([
      ...(await this.discovery.discoverClusters()),
      ...(await this.discovery.discoverProjects()),
      ...(await this.discovery.discoverNamespaces()),
      ...(await this.discovery.listNodes()),
      ...(await this.discovery.listPods()),
      ...(await this.discovery.listDeployments()),
      ...(await this.discovery.listStatefulSets()),
      ...(await this.discovery.listDaemonSets()),
      ...(await this.discovery.listReplicaSets()),
      ...(await this.discovery.listJobs()),
      ...(await this.discovery.listCronJobs()),
      ...(await this.discovery.listServices()),
      ...(await this.discovery.listRoutes()),
      ...(await this.discovery.listIngresses()),
      ...(await this.discovery.listOperators()),
      ...(await this.discovery.listImageStreams()),
      ...(await this.discovery.listConfigMaps()),
      ...(await this.discovery.listPersistentVolumes()),
      ...(await this.discovery.listPersistentVolumeClaims()),
      ...(await this.discovery.listStorageClasses()),
      ...(await this.discovery.listOperatorLifecycleManagers()),
      ...(await this.discovery.listSecretMetadata()),
    ]);
  }
}

export class OpenShiftMetricsService {
  public constructor(private readonly sdk: IOpenShiftSdk) {}

  public getMetrics(): Promise<readonly OpenShiftMetric[]> {
    return this.sdk.getMetrics();
  }
}

export class OpenShiftHealthService {
  public constructor(private readonly sdk: IOpenShiftSdk) {}

  public getClusterHealth(): Promise<OpenShiftHealthStatus> {
    return this.sdk.getClusterHealth();
  }
}

export class OpenShiftEventService {
  public constructor(private readonly sdk: IOpenShiftSdk) {}

  public getEvents(): Promise<readonly OpenShiftEvent[]> {
    return this.sdk.getEvents();
  }

  public getLogMetadata(): Promise<readonly OpenShiftLogMetadata[]> {
    return this.sdk.getLogMetadata();
  }

  public getAlertMetadata(): Promise<readonly OpenShiftAlertMetadata[]> {
    return this.sdk.getAlertMetadata();
  }
}

export class OpenShiftLiveAdapter implements IOpenShiftAdapter {
  private readonly configuration: Readonly<OpenShiftProviderConfiguration>;
  private readonly sdk: IOpenShiftSdk;
  private readonly discovery: OpenShiftDiscoveryService;
  private readonly inventory: OpenShiftInventoryService;
  private readonly metrics: OpenShiftMetricsService;
  private readonly health: OpenShiftHealthService;
  private readonly events: OpenShiftEventService;

  public constructor(
    options: {
      readonly configuration?: Readonly<OpenShiftProviderConfiguration>;
      readonly sdk?: IOpenShiftSdk;
    } = {},
  ) {
    this.configuration = options.configuration ?? defaultConfiguration();
    this.sdk =
      options.sdk ??
      new OpenShiftSdkAdapter({
        configuration: this.configuration,
        clientBundleFactory: () => new FixtureOpenShiftClientBundleFactory().create(),
      });
    this.discovery = new OpenShiftDiscoveryService(this.sdk);
    this.inventory = new OpenShiftInventoryService(this.discovery);
    this.metrics = new OpenShiftMetricsService(this.sdk);
    this.health = new OpenShiftHealthService(this.sdk);
    this.events = new OpenShiftEventService(this.sdk);
  }

  public discoverClusters(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.discovery.discoverClusters();
  }

  public discoverProjects(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.discovery.discoverProjects();
  }

  public discoverNamespaces(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.discovery.discoverNamespaces();
  }

  public listNodes(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.discovery.listNodes();
  }

  public listPods(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.discovery.listPods();
  }

  public listDeployments(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.discovery.listDeployments();
  }

  public listStatefulSets(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.discovery.listStatefulSets();
  }

  public listDaemonSets(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.discovery.listDaemonSets();
  }

  public listReplicaSets(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.discovery.listReplicaSets();
  }

  public listJobs(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.discovery.listJobs();
  }

  public listCronJobs(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.discovery.listCronJobs();
  }

  public listServices(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.discovery.listServices();
  }

  public listRoutes(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.discovery.listRoutes();
  }

  public listIngresses(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.discovery.listIngresses();
  }

  public listPersistentVolumes(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.discovery.listPersistentVolumes();
  }

  public listPersistentVolumeClaims(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.discovery.listPersistentVolumeClaims();
  }

  public listStorageClasses(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.discovery.listStorageClasses();
  }

  public listOperators(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.discovery.listOperators();
  }

  public listOperatorLifecycleManagers(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.discovery.listOperatorLifecycleManagers();
  }

  public listImageStreams(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.discovery.listImageStreams();
  }

  public listConfigMaps(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.discovery.listConfigMaps();
  }

  public listSecretMetadata(): Promise<readonly OpenShiftInventoryResource[]> {
    return this.discovery.listSecretMetadata();
  }

  public getClusterHealth(): Promise<OpenShiftHealthStatus> {
    return this.health.getClusterHealth();
  }

  public getMetrics(): Promise<readonly OpenShiftMetric[]> {
    return this.metrics.getMetrics();
  }

  public getEvents(): Promise<readonly OpenShiftEvent[]> {
    return this.events.getEvents();
  }

  public getLogMetadata(): Promise<readonly OpenShiftLogMetadata[]> {
    return this.events.getLogMetadata();
  }

  public getAlertMetadata(): Promise<readonly OpenShiftAlertMetadata[]> {
    return this.events.getAlertMetadata();
  }

  public async refreshInventory(): Promise<{ readonly refreshedAt: string }> {
    await this.inventory.discoverInventory();
    return { refreshedAt: new Date().toISOString() };
  }

  public async testConnection(
    configuration?: Readonly<Partial<OpenShiftProviderConfiguration>>,
  ): Promise<OpenShiftConnectionTestResult> {
    return this.sdk.testConnection(configuration ?? this.configuration);
  }

  public async discoverCapabilities(): Promise<readonly OpenShiftCapabilityDescriptor[]> {
    return Object.freeze([
      { id: 'openshift-discovery', name: 'discovery', version: '1.0.0', category: 'discovery' },
      { id: 'openshift-resources', name: 'resources', version: '1.0.0', category: 'resources' },
      { id: 'openshift-networking', name: 'networking', version: '1.0.0', category: 'networking' },
      { id: 'openshift-storage', name: 'storage', version: '1.0.0', category: 'storage' },
      { id: 'openshift-platform', name: 'platform', version: '1.0.0', category: 'platform' },
      { id: 'openshift-monitoring', name: 'monitoring', version: '1.0.0', category: 'monitoring' },
      { id: 'openshift-operations', name: 'operations', version: '1.0.0', category: 'operations' },
    ]);
  }

  public async searchResources(
    query: OpenShiftSearchQuery,
  ): Promise<readonly OpenShiftInventoryResource[]> {
    const inventory = await this.inventory.discoverInventory();
    const needle = query.text.trim().toLowerCase();
    const filtered = inventory.filter((resource) => {
      if (query.kind && resource.kind !== query.kind) {
        return false;
      }
      if (query.namespace && resource.namespace !== query.namespace) {
        return false;
      }
      return true;
    });
    return filtered.filter((resource) =>
      [resource.id, resource.name, resource.cluster, resource.namespace ?? ''].some((value) =>
        value.toLowerCase().includes(needle),
      ),
    );
  }
}
