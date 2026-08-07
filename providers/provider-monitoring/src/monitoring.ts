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

export type MonitoringPlatform =
  'solarWinds' | 'dynatrace' | 'prometheus' | 'grafana' | 'elastic' | 'splunk';

export type MonitoringObjectKind =
  | 'monitoringServer'
  | 'managedNode'
  | 'application'
  | 'service'
  | 'dashboard'
  | 'alertRule'
  | 'metricsSource'
  | 'logSource';

export interface MonitoringProviderConfiguration extends SerializableValueObject {
  readonly endpoint: string;
  readonly organizationId: string;
  readonly credentialRef: string;
  readonly enabledPlatforms: readonly MonitoringPlatform[];
  readonly readOnly: boolean;
  readonly connectionTimeoutMs: number;
  readonly inventoryCacheTtlSeconds: number;
}

export interface MonitoringInventoryObject {
  readonly id: string;
  readonly kind: MonitoringObjectKind;
  readonly platform: MonitoringPlatform;
  readonly name: string;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface MonitoringPlatformAbstraction {
  readonly platform: MonitoringPlatform;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface MonitoringHealth {
  readonly scopeName: string;
  readonly platform: MonitoringPlatform;
  readonly healthy: boolean;
  readonly status: 'healthy' | 'degraded' | 'down';
  readonly checkedAt: string;
}

export interface MonitoringMetric {
  readonly scopeName: string;
  readonly metricName: string;
  readonly value: number;
  readonly unit: string;
  readonly checkedAt: string;
}

export interface MonitoringAlert {
  readonly id: string;
  readonly source: string;
  readonly severity: 'info' | 'warning' | 'critical';
  readonly summary: string;
  readonly timestamp: string;
}

export interface MonitoringIncident {
  readonly id: string;
  readonly title: string;
  readonly severity: 'info' | 'warning' | 'critical';
  readonly status: 'open' | 'acknowledged' | 'resolved';
  readonly platform: MonitoringPlatform;
  readonly createdAt: string;
}

export interface MonitoringEvent {
  readonly id: string;
  readonly source: string;
  readonly severity: 'info' | 'warning' | 'critical';
  readonly message: string;
  readonly timestamp: string;
}

export interface MonitoringPerformance {
  readonly objectName: string;
  readonly responseTimeMs: number;
  readonly throughputPerSecond: number;
  readonly checkedAt: string;
}

export interface MonitoringAvailability {
  readonly objectName: string;
  readonly availabilityPercent: number;
  readonly period: string;
  readonly checkedAt: string;
}

export interface MonitoringTopologyMetadata {
  readonly objectName: string;
  readonly layer: string;
  readonly dependencies: readonly string[];
}

export interface MonitoringApmMetadata {
  readonly applicationName: string;
  readonly serviceCount: number;
  readonly traceSamplingRate: number;
  readonly checkedAt: string;
}

export interface MonitoringLogMetadata {
  readonly sourceName: string;
  readonly dailyVolumeGb: number;
  readonly retentionDays: number;
  readonly checkedAt: string;
}

export interface MonitoringConnectionTestResult {
  readonly connected: boolean;
  readonly latencyMs: number;
  readonly message: string;
}

export interface MonitoringCapabilityDescriptor {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly category:
    | 'discovery'
    | 'monitoring'
    | 'alerting'
    | 'incident'
    | 'topology'
    | 'apm'
    | 'logging'
    | 'operations';
}

export interface MonitoringSearchQuery {
  readonly text: string;
  readonly platform?: MonitoringPlatform;
  readonly kind?: MonitoringObjectKind;
}

export interface MonitoringInventoryCacheSnapshot {
  readonly objects: readonly MonitoringInventoryObject[];
  readonly refreshedAt?: string;
}

export interface IMonitoringAdapter {
  discoverPlatforms(): Promise<readonly MonitoringPlatformAbstraction[]>;
  discoverMonitoringServers(): Promise<readonly MonitoringInventoryObject[]>;
  discoverManagedNodes(): Promise<readonly MonitoringInventoryObject[]>;
  discoverApplications(): Promise<readonly MonitoringInventoryObject[]>;
  discoverServices(): Promise<readonly MonitoringInventoryObject[]>;
  discoverDashboards(): Promise<readonly MonitoringInventoryObject[]>;
  discoverAlertRules(): Promise<readonly MonitoringInventoryObject[]>;
  discoverMetricsSources(): Promise<readonly MonitoringInventoryObject[]>;
  discoverLogSources(): Promise<readonly MonitoringInventoryObject[]>;
  getHealth(): Promise<readonly MonitoringHealth[]>;
  getMetrics(): Promise<readonly MonitoringMetric[]>;
  getAlerts(): Promise<readonly MonitoringAlert[]>;
  getIncidents(): Promise<readonly MonitoringIncident[]>;
  getEvents(): Promise<readonly MonitoringEvent[]>;
  getPerformance(): Promise<readonly MonitoringPerformance[]>;
  getAvailability(): Promise<readonly MonitoringAvailability[]>;
  getTopologyMetadata(): Promise<readonly MonitoringTopologyMetadata[]>;
  getApmMetadata(): Promise<readonly MonitoringApmMetadata[]>;
  getLogMetadata(): Promise<readonly MonitoringLogMetadata[]>;
  refreshInventory(): Promise<{ readonly refreshedAt: string }>;
  testConnection(
    configuration: Readonly<MonitoringProviderConfiguration>,
  ): Promise<MonitoringConnectionTestResult>;
  discoverCapabilities(): Promise<readonly MonitoringCapabilityDescriptor[]>;
  searchMonitoringObjects(
    query: MonitoringSearchQuery,
  ): Promise<readonly MonitoringInventoryObject[]>;
}

const DATASET_TIMESTAMP = '2026-01-01T00:00:00.000Z';

function metadata(values: Record<string, string>): Readonly<Record<string, string>> {
  return values;
}

function platformList(...platforms: readonly MonitoringPlatform[]): readonly MonitoringPlatform[] {
  return Object.freeze([...platforms]);
}

const MOCK_PLATFORMS: readonly MonitoringPlatformAbstraction[] = Object.freeze([
  {
    platform: 'solarWinds',
    metadata: metadata({
      family: 'solarwinds-observability',
      profile: 'infrastructure-monitoring',
    }),
  },
  {
    platform: 'dynatrace',
    metadata: metadata({ family: 'dynatrace-platform', profile: 'full-stack-observability' }),
  },
  {
    platform: 'prometheus',
    metadata: metadata({ family: 'prometheus', profile: 'metrics-time-series' }),
  },
  {
    platform: 'grafana',
    metadata: metadata({ family: 'grafana', profile: 'visualization-and-alerting' }),
  },
  {
    platform: 'elastic',
    metadata: metadata({ family: 'elastic-stack', profile: 'search-and-analytics' }),
  },
  {
    platform: 'splunk',
    metadata: metadata({ family: 'splunk-platform', profile: 'log-and-security-analytics' }),
  },
]);

const MOCK_INVENTORY: readonly MonitoringInventoryObject[] = Object.freeze([
  {
    id: 'server-sw-01',
    kind: 'monitoringServer',
    platform: 'solarWinds',
    name: 'solarwinds-core-01',
    metadata: metadata({ site: 'dc1', role: 'poller' }),
  },
  {
    id: 'server-dt-01',
    kind: 'monitoringServer',
    platform: 'dynatrace',
    name: 'dynatrace-cluster-01',
    metadata: metadata({ site: 'dc1', role: 'cluster-node' }),
  },
  {
    id: 'server-pr-01',
    kind: 'monitoringServer',
    platform: 'prometheus',
    name: 'prometheus-ha-01',
    metadata: metadata({ site: 'dc1', role: 'scrape-engine' }),
  },
  {
    id: 'server-gf-01',
    kind: 'monitoringServer',
    platform: 'grafana',
    name: 'grafana-core-01',
    metadata: metadata({ site: 'dc1', role: 'dashboard-engine' }),
  },
  {
    id: 'server-es-01',
    kind: 'monitoringServer',
    platform: 'elastic',
    name: 'elastic-core-01',
    metadata: metadata({ site: 'dc1', role: 'data-node' }),
  },
  {
    id: 'server-sp-01',
    kind: 'monitoringServer',
    platform: 'splunk',
    name: 'splunk-indexer-01',
    metadata: metadata({ site: 'dc1', role: 'indexer' }),
  },
  {
    id: 'node-01',
    kind: 'managedNode',
    platform: 'solarWinds',
    name: 'edge-router-01',
    metadata: metadata({ nodeType: 'network', status: 'managed' }),
  },
  {
    id: 'app-01',
    kind: 'application',
    platform: 'dynatrace',
    name: 'payments-api',
    metadata: metadata({ env: 'prod', tier: 'critical' }),
  },
  {
    id: 'svc-01',
    kind: 'service',
    platform: 'dynatrace',
    name: 'payments-orchestrator',
    metadata: metadata({ sloTarget: '99.95', owner: 'platform-runtime' }),
  },
  {
    id: 'dash-01',
    kind: 'dashboard',
    platform: 'grafana',
    name: 'enterprise-overview',
    metadata: metadata({ folder: 'operations', refreshSeconds: '30' }),
  },
  {
    id: 'rule-01',
    kind: 'alertRule',
    platform: 'prometheus',
    name: 'high-error-rate',
    metadata: metadata({ severity: 'critical', expr: 'error_rate > 5' }),
  },
  {
    id: 'metric-src-01',
    kind: 'metricsSource',
    platform: 'prometheus',
    name: 'kubernetes-scrape-jobs',
    metadata: metadata({ jobs: '85', interval: '30s' }),
  },
  {
    id: 'metric-src-02',
    kind: 'metricsSource',
    platform: 'dynatrace',
    name: 'oneagent-stream',
    metadata: metadata({ entities: '420', interval: '15s' }),
  },
  {
    id: 'log-src-01',
    kind: 'logSource',
    platform: 'elastic',
    name: 'kubernetes-prod-logs',
    metadata: metadata({ dailyGb: '820', indexPattern: 'logs-k8s-*' }),
  },
  {
    id: 'log-src-02',
    kind: 'logSource',
    platform: 'splunk',
    name: 'security-audit-stream',
    metadata: metadata({ dailyGb: '460', sourcetype: 'audit' }),
  },
]);

const MOCK_HEALTH: readonly MonitoringHealth[] = Object.freeze([
  {
    scopeName: 'enterprise-observability',
    platform: 'solarWinds',
    healthy: true,
    status: 'healthy',
    checkedAt: DATASET_TIMESTAMP,
  },
  {
    scopeName: 'enterprise-observability',
    platform: 'dynatrace',
    healthy: true,
    status: 'healthy',
    checkedAt: DATASET_TIMESTAMP,
  },
  {
    scopeName: 'enterprise-observability',
    platform: 'prometheus',
    healthy: true,
    status: 'healthy',
    checkedAt: DATASET_TIMESTAMP,
  },
  {
    scopeName: 'enterprise-observability',
    platform: 'grafana',
    healthy: true,
    status: 'healthy',
    checkedAt: DATASET_TIMESTAMP,
  },
  {
    scopeName: 'enterprise-observability',
    platform: 'elastic',
    healthy: true,
    status: 'healthy',
    checkedAt: DATASET_TIMESTAMP,
  },
  {
    scopeName: 'enterprise-observability',
    platform: 'splunk',
    healthy: true,
    status: 'healthy',
    checkedAt: DATASET_TIMESTAMP,
  },
]);

const MOCK_METRICS: readonly MonitoringMetric[] = Object.freeze([
  {
    scopeName: 'payments-api',
    metricName: 'request-rate',
    value: 1420,
    unit: 'req/s',
    checkedAt: DATASET_TIMESTAMP,
  },
  {
    scopeName: 'kubernetes-cluster',
    metricName: 'cpu-utilization',
    value: 63,
    unit: 'percent',
    checkedAt: DATASET_TIMESTAMP,
  },
]);

const MOCK_ALERTS: readonly MonitoringAlert[] = Object.freeze([
  {
    id: 'alert-01',
    source: 'prometheus-alertmanager',
    severity: 'warning',
    summary: 'SLO burn rate above warning threshold.',
    timestamp: DATASET_TIMESTAMP,
  },
]);

const MOCK_INCIDENTS: readonly MonitoringIncident[] = Object.freeze([
  {
    id: 'incident-01',
    title: 'High latency in payments-api',
    severity: 'warning',
    status: 'acknowledged',
    platform: 'dynatrace',
    createdAt: DATASET_TIMESTAMP,
  },
]);

const MOCK_EVENTS: readonly MonitoringEvent[] = Object.freeze([
  {
    id: 'event-01',
    source: 'topology-sync',
    severity: 'info',
    message: 'Topology graph synchronized across monitoring adapters.',
    timestamp: DATASET_TIMESTAMP,
  },
]);

const MOCK_PERFORMANCE: readonly MonitoringPerformance[] = Object.freeze([
  {
    objectName: 'payments-api',
    responseTimeMs: 141,
    throughputPerSecond: 1520,
    checkedAt: DATASET_TIMESTAMP,
  },
]);

const MOCK_AVAILABILITY: readonly MonitoringAvailability[] = Object.freeze([
  {
    objectName: 'payments-api',
    availabilityPercent: 99.97,
    period: '30d',
    checkedAt: DATASET_TIMESTAMP,
  },
]);

const MOCK_TOPOLOGY: readonly MonitoringTopologyMetadata[] = Object.freeze([
  {
    objectName: 'payments-api',
    layer: 'application',
    dependencies: Object.freeze(['payments-db', 'event-bus', 'identity-service']),
  },
]);

const MOCK_APM_METADATA: readonly MonitoringApmMetadata[] = Object.freeze([
  {
    applicationName: 'payments-api',
    serviceCount: 14,
    traceSamplingRate: 0.2,
    checkedAt: DATASET_TIMESTAMP,
  },
]);

const MOCK_LOG_METADATA: readonly MonitoringLogMetadata[] = Object.freeze([
  {
    sourceName: 'kubernetes-prod-logs',
    dailyVolumeGb: 820,
    retentionDays: 30,
    checkedAt: DATASET_TIMESTAMP,
  },
]);

export class MonitoringMockAdapter implements IMonitoringAdapter {
  protected readonly platforms: readonly MonitoringPlatform[];

  public constructor(
    platforms: readonly MonitoringPlatform[] = platformList(
      ...platformList('solarWinds', 'dynatrace', 'prometheus', 'grafana', 'elastic', 'splunk'),
    ),
  ) {
    this.platforms = Object.freeze([...platforms]);
  }

  public async discoverPlatforms(): Promise<readonly MonitoringPlatformAbstraction[]> {
    return Object.freeze(MOCK_PLATFORMS.filter((item) => this.platforms.includes(item.platform)));
  }

  public async discoverMonitoringServers(): Promise<readonly MonitoringInventoryObject[]> {
    return this.byKind('monitoringServer');
  }

  public async discoverManagedNodes(): Promise<readonly MonitoringInventoryObject[]> {
    return this.byKind('managedNode');
  }

  public async discoverApplications(): Promise<readonly MonitoringInventoryObject[]> {
    return this.byKind('application');
  }

  public async discoverServices(): Promise<readonly MonitoringInventoryObject[]> {
    return this.byKind('service');
  }

  public async discoverDashboards(): Promise<readonly MonitoringInventoryObject[]> {
    return this.byKind('dashboard');
  }

  public async discoverAlertRules(): Promise<readonly MonitoringInventoryObject[]> {
    return this.byKind('alertRule');
  }

  public async discoverMetricsSources(): Promise<readonly MonitoringInventoryObject[]> {
    return this.byKind('metricsSource');
  }

  public async discoverLogSources(): Promise<readonly MonitoringInventoryObject[]> {
    return this.byKind('logSource');
  }

  public async getHealth(): Promise<readonly MonitoringHealth[]> {
    return Object.freeze(MOCK_HEALTH.filter((item) => this.platforms.includes(item.platform)));
  }

  public async getMetrics(): Promise<readonly MonitoringMetric[]> {
    return MOCK_METRICS;
  }

  public async getAlerts(): Promise<readonly MonitoringAlert[]> {
    return MOCK_ALERTS;
  }

  public async getIncidents(): Promise<readonly MonitoringIncident[]> {
    return Object.freeze(MOCK_INCIDENTS.filter((item) => this.platforms.includes(item.platform)));
  }

  public async getEvents(): Promise<readonly MonitoringEvent[]> {
    return MOCK_EVENTS;
  }

  public async getPerformance(): Promise<readonly MonitoringPerformance[]> {
    return MOCK_PERFORMANCE;
  }

  public async getAvailability(): Promise<readonly MonitoringAvailability[]> {
    return MOCK_AVAILABILITY;
  }

  public async getTopologyMetadata(): Promise<readonly MonitoringTopologyMetadata[]> {
    return MOCK_TOPOLOGY;
  }

  public async getApmMetadata(): Promise<readonly MonitoringApmMetadata[]> {
    return MOCK_APM_METADATA;
  }

  public async getLogMetadata(): Promise<readonly MonitoringLogMetadata[]> {
    return MOCK_LOG_METADATA;
  }

  public async refreshInventory(): Promise<{ readonly refreshedAt: string }> {
    return { refreshedAt: DATASET_TIMESTAMP };
  }

  public async testConnection(
    configuration: Readonly<MonitoringProviderConfiguration>,
  ): Promise<MonitoringConnectionTestResult> {
    return {
      connected: configuration.endpoint.startsWith('monitoring://'),
      latencyMs: 17,
      message:
        'Monitoring connection test succeeded through adapter abstraction without monitoring platform APIs.',
    };
  }

  public async discoverCapabilities(): Promise<readonly MonitoringCapabilityDescriptor[]> {
    return Object.freeze([
      { id: 'monitoring-discovery', name: 'discovery', version: '1.0.0', category: 'discovery' },
      { id: 'monitoring-monitoring', name: 'monitoring', version: '1.0.0', category: 'monitoring' },
      { id: 'monitoring-alerting', name: 'alerting', version: '1.0.0', category: 'alerting' },
      { id: 'monitoring-incident', name: 'incident', version: '1.0.0', category: 'incident' },
      { id: 'monitoring-topology', name: 'topology', version: '1.0.0', category: 'topology' },
      { id: 'monitoring-apm', name: 'apm', version: '1.0.0', category: 'apm' },
      { id: 'monitoring-logging', name: 'logging', version: '1.0.0', category: 'logging' },
      { id: 'monitoring-operations', name: 'operations', version: '1.0.0', category: 'operations' },
    ]);
  }

  public async searchMonitoringObjects(
    query: MonitoringSearchQuery,
  ): Promise<readonly MonitoringInventoryObject[]> {
    const needle = query.text.trim().toLowerCase();
    const byPlatform = query.platform
      ? this.scopedInventory().filter((item) => item.platform === query.platform)
      : this.scopedInventory();
    const byKind = query.kind ? byPlatform.filter((item) => item.kind === query.kind) : byPlatform;

    return Object.freeze(
      byKind.filter((item) =>
        [item.id, item.name].some((value) => value.toLowerCase().includes(needle)),
      ),
    );
  }

  protected scopedInventory(): readonly MonitoringInventoryObject[] {
    return Object.freeze(MOCK_INVENTORY.filter((item) => this.platforms.includes(item.platform)));
  }

  private byKind(kind: MonitoringObjectKind): readonly MonitoringInventoryObject[] {
    return Object.freeze(this.scopedInventory().filter((item) => item.kind === kind));
  }
}

export class SolarWindsAdapter extends MonitoringMockAdapter {
  public constructor() {
    super(platformList('solarWinds'));
  }
}

export class DynatraceAdapter extends MonitoringMockAdapter {
  public constructor() {
    super(platformList('dynatrace'));
  }
}

export class PrometheusAdapter extends MonitoringMockAdapter {
  public constructor() {
    super(platformList('prometheus'));
  }
}

export class GrafanaAdapter extends MonitoringMockAdapter {
  public constructor() {
    super(platformList('grafana'));
  }
}

export class ElasticAdapter extends MonitoringMockAdapter {
  public constructor() {
    super(platformList('elastic'));
  }
}

export class SplunkAdapter extends MonitoringMockAdapter {
  public constructor() {
    super(platformList('splunk'));
  }
}

export class MonitoringInventoryCache {
  private snapshot: MonitoringInventoryCacheSnapshot = Object.freeze({
    objects: Object.freeze([]),
  });

  public update(objects: readonly MonitoringInventoryObject[], refreshedAt: string): void {
    this.snapshot = Object.freeze({ objects: Object.freeze([...objects]), refreshedAt });
  }

  public getSnapshot(): MonitoringInventoryCacheSnapshot {
    return this.snapshot;
  }

  public searchMonitoringObjects(
    query: MonitoringSearchQuery,
  ): readonly MonitoringInventoryObject[] {
    const needle = query.text.trim().toLowerCase();
    const byPlatform = query.platform
      ? this.snapshot.objects.filter((item) => item.platform === query.platform)
      : this.snapshot.objects;
    const byKind = query.kind ? byPlatform.filter((item) => item.kind === query.kind) : byPlatform;

    return Object.freeze(
      byKind.filter((item) =>
        [item.id, item.name].some((value) => value.toLowerCase().includes(needle)),
      ),
    );
  }
}

export class MonitoringConfiguration {
  public readonly defaultConfiguration: Readonly<MonitoringProviderConfiguration> = Object.freeze({
    endpoint: 'monitoring://enterprise.observability.example.local',
    organizationId: 'enterprise-observability',
    credentialRef: 'MONITORING_CREDENTIAL_REF',
    enabledPlatforms: platformList(
      'solarWinds',
      'dynatrace',
      'prometheus',
      'grafana',
      'elastic',
      'splunk',
    ),
    readOnly: true,
    connectionTimeoutMs: 10000,
    inventoryCacheTtlSeconds: 300,
  });

  public merge(
    override?: Readonly<Partial<MonitoringProviderConfiguration>>,
  ): Readonly<MonitoringProviderConfiguration> {
    const enabledPlatforms =
      override?.enabledPlatforms ?? this.defaultConfiguration.enabledPlatforms;
    const merged: MonitoringProviderConfiguration = {
      endpoint: override?.endpoint ?? this.defaultConfiguration.endpoint,
      organizationId: override?.organizationId ?? this.defaultConfiguration.organizationId,
      credentialRef: override?.credentialRef ?? this.defaultConfiguration.credentialRef,
      enabledPlatforms: Object.freeze([...enabledPlatforms]),
      readOnly: override?.readOnly ?? this.defaultConfiguration.readOnly,
      connectionTimeoutMs:
        override?.connectionTimeoutMs ?? this.defaultConfiguration.connectionTimeoutMs,
      inventoryCacheTtlSeconds:
        override?.inventoryCacheTtlSeconds ?? this.defaultConfiguration.inventoryCacheTtlSeconds,
    };
    return Object.freeze(merged);
  }
}

export class MonitoringAuthenticationProvider {
  private readonly providerAuthentication: ProviderAuthentication;

  public constructor(options: { readonly credentialStore?: CredentialStore } = {}) {
    this.providerAuthentication = new ProviderAuthentication({
      credentialStore: options.credentialStore ?? new CredentialStore(),
      autoStoreCredentials: true,
    });

    this.providerAuthentication.registerProvider({
      method: 'api-key',
      authenticate: async (
        context: { readonly provider: { readonly manifest: { readonly id: string } } },
        credential: { readonly method: 'api-key'; readonly apiKey: string },
      ) => {
        const success = credential.apiKey.trim().length > 0;
        return new AuthenticationResult({
          success,
          method: 'api-key',
          providerId: context.provider.manifest.id,
          principalId: success ? 'monitoring-api-key-principal' : undefined,
          message: success
            ? 'Monitoring authentication accepted.'
            : 'Monitoring API key payload is invalid.',
          authenticatedAt: DATASET_TIMESTAMP,
        });
      },
    });
  }

  public getProviderAuthentication(): ProviderAuthentication {
    return this.providerAuthentication;
  }
}

export class MonitoringConnection {
  public readonly id: string;
  public readonly endpoint: string;
  public connectedAt?: string;

  public constructor(endpoint: string) {
    this.endpoint = endpoint;
    this.id = `monitoring-connection:${endpoint}`;
  }

  public connect(): void {
    this.connectedAt = DATASET_TIMESTAMP;
  }

  public disconnect(): void {
    this.connectedAt = undefined;
  }
}

export class MonitoringConnectionManager {
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
          const client = new MonitoringConnection(endpoint);
          client.connect();
          return client;
        },
        disconnect: async (client) => {
          client?.disconnect();
        },
        checkHealth: async (client) =>
          new ConnectionHealth({
            status: client?.connectedAt ? 'connected' : 'degraded',
            latencyMs: 17,
            lastCheckedAt: DATASET_TIMESTAMP,
            message: 'Monitoring connection health.',
          }),
      });
    });

    this.sdkConnectionManager = new ProviderConnectionManager({ factory, pool });
  }

  public getSdkConnectionManager(): ProviderConnectionManager {
    return this.sdkConnectionManager;
  }
}

export class MonitoringCapabilityRegistry {
  private readonly registry: ProviderCapabilityRegistry;

  public constructor(providerId: string, registry = new ProviderCapabilityRegistry()) {
    this.registry = registry;

    const register = (
      id: string,
      name: string,
      category: MonitoringCapabilityDescriptor['category'],
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
            tags: ['monitoring', 'vendor-neutral', category],
            featureFlags: { configurationDriven: true, adapterBacked: true },
          }),
          requiresCapabilities: [name],
          requiredFeatureFlags: ['configurationDriven', 'adapterBacked'],
        }),
      );
    };

    register('monitoring-discovery', 'discovery', 'discovery', 'Monitoring inventory discovery.');
    register('monitoring-monitoring', 'monitoring', 'monitoring', 'Health and metrics surfaces.');
    register('monitoring-alerting', 'alerting', 'alerting', 'Alert rule and alert surfaces.');
    register('monitoring-incident', 'incident', 'incident', 'Incident metadata and lifecycle.');
    register('monitoring-topology', 'topology', 'topology', 'Dependency and topology metadata.');
    register('monitoring-apm', 'apm', 'apm', 'APM metadata across applications and services.');
    register('monitoring-logging', 'logging', 'logging', 'Log source and retention metadata.');
    register(
      'monitoring-operations',
      'operations',
      'operations',
      'Refresh, search, synchronization.',
    );
  }

  public getProviderCapabilityRegistry(): ProviderCapabilityRegistry {
    return this.registry;
  }

  public async list(): Promise<readonly MonitoringCapabilityDescriptor[]> {
    return Object.freeze([
      { id: 'monitoring-discovery', name: 'discovery', version: '1.0.0', category: 'discovery' },
      {
        id: 'monitoring-monitoring',
        name: 'monitoring',
        version: '1.0.0',
        category: 'monitoring',
      },
      { id: 'monitoring-alerting', name: 'alerting', version: '1.0.0', category: 'alerting' },
      { id: 'monitoring-incident', name: 'incident', version: '1.0.0', category: 'incident' },
      { id: 'monitoring-topology', name: 'topology', version: '1.0.0', category: 'topology' },
      { id: 'monitoring-apm', name: 'apm', version: '1.0.0', category: 'apm' },
      { id: 'monitoring-logging', name: 'logging', version: '1.0.0', category: 'logging' },
      {
        id: 'monitoring-operations',
        name: 'operations',
        version: '1.0.0',
        category: 'operations',
      },
    ]);
  }
}

export class MonitoringProvider extends BaseProvider<MonitoringProviderConfiguration> {
  private readonly adapter: IMonitoringAdapter;
  private readonly configurationService: MonitoringConfiguration;
  private readonly inventoryCache: MonitoringInventoryCache;
  private readonly capabilityRegistry: MonitoringCapabilityRegistry;

  public constructor(
    options: {
      readonly adapter?: IMonitoringAdapter;
      readonly configurationService?: MonitoringConfiguration;
      readonly inventoryCache?: MonitoringInventoryCache;
      readonly capabilityRegistry?: MonitoringCapabilityRegistry;
      readonly manifest?: ProviderManifest<MonitoringProviderConfiguration>;
    } = {},
  ) {
    const configurationService = options.configurationService ?? new MonitoringConfiguration();
    super({
      manifest:
        options.manifest ??
        new ProviderManifest<MonitoringProviderConfiguration>({
          id: 'provider-monitoring',
          name: 'Enterprise Monitoring Provider',
          metadata: new ProviderMetadata({
            description:
              'Vendor-neutral enterprise monitoring provider built on Provider SDK with adapter isolation.',
            version: new ProviderVersion('1.0.0'),
            vendor: 'InfraShield',
            tags: ['monitoring', 'vendor-neutral', 'enterprise', 'provider-sdk'],
            healthStatus: 'healthy',
          }),
          capabilities: new ProviderCapabilities([
            new ToolCapability({ name: 'discovery' }),
            new ToolCapability({ name: 'monitoring' }),
            new ToolCapability({ name: 'alerting' }),
            new ToolCapability({ name: 'incident' }),
            new ToolCapability({ name: 'topology' }),
            new ToolCapability({ name: 'apm' }),
            new ToolCapability({ name: 'logging' }),
            new ToolCapability({ name: 'operations' }),
          ]),
          configuration: new ProviderConfiguration<MonitoringProviderConfiguration>({
            requiredFields: [
              'endpoint',
              'organizationId',
              'credentialRef',
              'enabledPlatforms',
              'readOnly',
              'connectionTimeoutMs',
              'inventoryCacheTtlSeconds',
            ],
            defaultValues: configurationService.defaultConfiguration,
          }),
        }),
    });

    this.adapter = options.adapter ?? new MonitoringMockAdapter();
    this.configurationService = configurationService;
    this.inventoryCache = options.inventoryCache ?? new MonitoringInventoryCache();
    this.capabilityRegistry =
      options.capabilityRegistry ?? new MonitoringCapabilityRegistry(this.manifest.id);
  }

  public resolveConfiguration(
    override?: Readonly<Partial<MonitoringProviderConfiguration>>,
  ): Readonly<MonitoringProviderConfiguration> {
    return this.configurationService.merge(override);
  }

  public async discoverPlatformAbstractions(): Promise<readonly MonitoringPlatformAbstraction[]> {
    return this.adapter.discoverPlatforms();
  }

  public async discoverInventory(): Promise<readonly MonitoringInventoryObject[]> {
    const [
      monitoringServers,
      managedNodes,
      applications,
      services,
      dashboards,
      alertRules,
      metricsSources,
      logSources,
    ] = await Promise.all([
      this.adapter.discoverMonitoringServers(),
      this.adapter.discoverManagedNodes(),
      this.adapter.discoverApplications(),
      this.adapter.discoverServices(),
      this.adapter.discoverDashboards(),
      this.adapter.discoverAlertRules(),
      this.adapter.discoverMetricsSources(),
      this.adapter.discoverLogSources(),
    ]);

    return Object.freeze([
      ...monitoringServers,
      ...managedNodes,
      ...applications,
      ...services,
      ...dashboards,
      ...alertRules,
      ...metricsSources,
      ...logSources,
    ]);
  }

  public async refreshInventory(): Promise<MonitoringInventoryCacheSnapshot> {
    const refreshed = await this.adapter.refreshInventory();
    const objects = await this.discoverInventory();
    this.inventoryCache.update(objects, refreshed.refreshedAt);
    return this.inventoryCache.getSnapshot();
  }

  public getInventoryCache(): MonitoringInventoryCacheSnapshot {
    return this.inventoryCache.getSnapshot();
  }

  public synchronizeCache(snapshot: MonitoringInventoryCacheSnapshot): void {
    this.inventoryCache.update(snapshot.objects, snapshot.refreshedAt ?? DATASET_TIMESTAMP);
  }

  public async testConnection(
    override?: Readonly<Partial<MonitoringProviderConfiguration>>,
  ): Promise<MonitoringConnectionTestResult> {
    return this.adapter.testConnection(this.resolveConfiguration(override));
  }

  public async discoverCapabilities(): Promise<readonly MonitoringCapabilityDescriptor[]> {
    const [fromRegistry, fromAdapter] = await Promise.all([
      this.capabilityRegistry.list(),
      this.adapter.discoverCapabilities(),
    ]);

    const dedup = new Map<string, MonitoringCapabilityDescriptor>();
    [...fromRegistry, ...fromAdapter].forEach((capability) => dedup.set(capability.id, capability));
    return Object.freeze([...dedup.values()]);
  }

  public async searchMonitoringObjects(
    query: MonitoringSearchQuery,
  ): Promise<readonly MonitoringInventoryObject[]> {
    if (this.inventoryCache.getSnapshot().objects.length > 0) {
      return this.inventoryCache.searchMonitoringObjects(query);
    }
    return this.adapter.searchMonitoringObjects(query);
  }

  public async getHealth(): Promise<readonly MonitoringHealth[]> {
    return this.adapter.getHealth();
  }

  public async getMetrics(): Promise<readonly MonitoringMetric[]> {
    return this.adapter.getMetrics();
  }

  public async getAlerts(): Promise<readonly MonitoringAlert[]> {
    return this.adapter.getAlerts();
  }

  public async getIncidents(): Promise<readonly MonitoringIncident[]> {
    return this.adapter.getIncidents();
  }

  public async getEvents(): Promise<readonly MonitoringEvent[]> {
    return this.adapter.getEvents();
  }

  public async getPerformance(): Promise<readonly MonitoringPerformance[]> {
    return this.adapter.getPerformance();
  }

  public async getAvailability(): Promise<readonly MonitoringAvailability[]> {
    return this.adapter.getAvailability();
  }

  public async getTopologyMetadata(): Promise<readonly MonitoringTopologyMetadata[]> {
    return this.adapter.getTopologyMetadata();
  }

  public async getApmMetadata(): Promise<readonly MonitoringApmMetadata[]> {
    return this.adapter.getApmMetadata();
  }

  public async getLogMetadata(): Promise<readonly MonitoringLogMetadata[]> {
    return this.adapter.getLogMetadata();
  }
}

export class MonitoringProviderFactory {
  private readonly registryService: ProviderRegistryService;

  public constructor(options: { readonly registryService?: ProviderRegistryService } = {}) {
    this.registryService = options.registryService ?? new ProviderRegistryService();
  }

  public create(options?: {
    readonly adapter?: IMonitoringAdapter;
    readonly configurationOverride?: Readonly<Partial<MonitoringProviderConfiguration>>;
  }): MonitoringProvider {
    const configurationService = new MonitoringConfiguration();

    const provider = new MonitoringProvider({
      adapter: options?.adapter,
      configurationService,
      manifest: new ProviderManifest<MonitoringProviderConfiguration>({
        id: 'provider-monitoring',
        name: 'Enterprise Monitoring Provider',
        metadata: new ProviderMetadata({
          description:
            'Vendor-neutral enterprise monitoring provider built on Provider SDK with adapter isolation.',
          version: new ProviderVersion('1.0.0'),
          vendor: 'InfraShield',
          tags: ['monitoring', 'vendor-neutral', 'enterprise', 'provider-sdk'],
          healthStatus: 'healthy',
        }),
        capabilities: new ProviderCapabilities([
          new ToolCapability({ name: 'discovery' }),
          new ToolCapability({ name: 'monitoring' }),
          new ToolCapability({ name: 'alerting' }),
          new ToolCapability({ name: 'incident' }),
          new ToolCapability({ name: 'topology' }),
          new ToolCapability({ name: 'apm' }),
          new ToolCapability({ name: 'logging' }),
          new ToolCapability({ name: 'operations' }),
        ]),
        configuration: new ProviderConfiguration<MonitoringProviderConfiguration>({
          requiredFields: [
            'endpoint',
            'organizationId',
            'credentialRef',
            'enabledPlatforms',
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

export interface MonitoringProviderRuntime {
  readonly provider: MonitoringProvider;
  readonly registryService: ProviderRegistryService;
  readonly lifecycleManager: ProviderLifecycleManager;
  readonly capabilityResolver: CapabilityResolver;
  readonly authenticationProvider: MonitoringAuthenticationProvider;
  readonly connectionManager: MonitoringConnectionManager;
}

export function createMonitoringProviderRuntime(): MonitoringProviderRuntime {
  const factory = new MonitoringProviderFactory();
  const provider = factory.create();

  const capabilityRegistry = new MonitoringCapabilityRegistry(provider.manifest.id);
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
      message: 'Monitoring provider healthy.',
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
    authenticationProvider: new MonitoringAuthenticationProvider(),
    connectionManager: new MonitoringConnectionManager(provider.manifest.id),
  };
}
