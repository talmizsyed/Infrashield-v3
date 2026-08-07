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

export type StorageVendor =
  | 'netApp'
  | 'dellEmcPowerStore'
  | 'dellEmcUnity'
  | 'dellPowerMax'
  | 'pureStorage'
  | 'hpeAlletra'
  | 'ibmFlashSystem';

export type StorageResourceKind =
  | 'storageArray'
  | 'controller'
  | 'pool'
  | 'volume'
  | 'lun'
  | 'fileSystem'
  | 'nasShare'
  | 'snapshot'
  | 'replicationGroup'
  | 'storagePort'
  | 'fcEndpoint'
  | 'iscsiEndpoint'
  | 'nfsEndpoint'
  | 'smbEndpoint';

export interface StorageProviderConfiguration extends SerializableValueObject {
  readonly endpoint: string;
  readonly domainName: string;
  readonly credentialRef: string;
  readonly readOnly: boolean;
  readonly connectionTimeoutMs: number;
  readonly inventoryCacheTtlSeconds: number;
}

export interface StorageInventoryResource {
  readonly id: string;
  readonly kind: StorageResourceKind;
  readonly name: string;
  readonly vendor: StorageVendor;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface StorageVendorAbstraction {
  readonly vendor: StorageVendor;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface StorageArrayHealth {
  readonly arrayName: string;
  readonly vendor: StorageVendor;
  readonly healthy: boolean;
  readonly status: 'healthy' | 'degraded' | 'down';
  readonly checkedAt: string;
}

export interface StorageCapacityMetric {
  readonly arrayName: string;
  readonly totalTb: number;
  readonly usedTb: number;
  readonly freeTb: number;
  readonly checkedAt: string;
}

export interface StoragePerformanceMetric {
  readonly arrayName: string;
  readonly profile: string;
  readonly value: number;
  readonly unit: string;
  readonly checkedAt: string;
}

export interface StorageIopsMetric {
  readonly resourceName: string;
  readonly readIops: number;
  readonly writeIops: number;
  readonly checkedAt: string;
}

export interface StorageThroughputMetric {
  readonly resourceName: string;
  readonly readMbps: number;
  readonly writeMbps: number;
  readonly checkedAt: string;
}

export interface StorageLatencyMetric {
  readonly resourceName: string;
  readonly readMs: number;
  readonly writeMs: number;
  readonly checkedAt: string;
}

export interface StorageReplicationHealth {
  readonly replicationGroupName: string;
  readonly healthy: boolean;
  readonly status: 'synchronized' | 'lagging' | 'error';
  readonly checkedAt: string;
}

export interface StorageSnapshotHealth {
  readonly snapshotName: string;
  readonly healthy: boolean;
  readonly status: 'healthy' | 'degraded' | 'error';
  readonly checkedAt: string;
}

export interface StorageEvent {
  readonly id: string;
  readonly source: string;
  readonly severity: 'info' | 'warning' | 'critical';
  readonly message: string;
  readonly timestamp: string;
}

export interface StorageAlert {
  readonly id: string;
  readonly source: string;
  readonly severity: 'info' | 'warning' | 'critical';
  readonly summary: string;
  readonly timestamp: string;
}

export interface StorageConnectionTestResult {
  readonly connected: boolean;
  readonly latencyMs: number;
  readonly message: string;
}

export interface StorageCapabilityDescriptor {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly category: 'discovery' | 'provisioning' | 'dataProtection' | 'monitoring' | 'operations';
}

export interface StorageSearchQuery {
  readonly text: string;
  readonly vendor?: StorageVendor;
  readonly kind?: StorageResourceKind;
}

export interface StorageInventoryCacheSnapshot {
  readonly resources: readonly StorageInventoryResource[];
  readonly refreshedAt?: string;
}

export interface IStorageAdapter {
  discoverVendorAbstractions(): Promise<readonly StorageVendorAbstraction[]>;
  discoverStorageArrays(): Promise<readonly StorageInventoryResource[]>;
  discoverControllers(): Promise<readonly StorageInventoryResource[]>;
  discoverPools(): Promise<readonly StorageInventoryResource[]>;
  discoverVolumes(): Promise<readonly StorageInventoryResource[]>;
  discoverLuns(): Promise<readonly StorageInventoryResource[]>;
  discoverFileSystems(): Promise<readonly StorageInventoryResource[]>;
  discoverNasShares(): Promise<readonly StorageInventoryResource[]>;
  discoverSnapshots(): Promise<readonly StorageInventoryResource[]>;
  discoverReplicationGroups(): Promise<readonly StorageInventoryResource[]>;
  discoverStoragePorts(): Promise<readonly StorageInventoryResource[]>;
  discoverFcEndpoints(): Promise<readonly StorageInventoryResource[]>;
  discoverIscsiEndpoints(): Promise<readonly StorageInventoryResource[]>;
  discoverNfsEndpoints(): Promise<readonly StorageInventoryResource[]>;
  discoverSmbEndpoints(): Promise<readonly StorageInventoryResource[]>;
  getArrayHealth(): Promise<readonly StorageArrayHealth[]>;
  getCapacity(): Promise<readonly StorageCapacityMetric[]>;
  getPerformance(): Promise<readonly StoragePerformanceMetric[]>;
  getIops(): Promise<readonly StorageIopsMetric[]>;
  getThroughput(): Promise<readonly StorageThroughputMetric[]>;
  getLatency(): Promise<readonly StorageLatencyMetric[]>;
  getReplicationHealth(): Promise<readonly StorageReplicationHealth[]>;
  getSnapshotHealth(): Promise<readonly StorageSnapshotHealth[]>;
  getEvents(): Promise<readonly StorageEvent[]>;
  getAlerts(): Promise<readonly StorageAlert[]>;
  refreshInventory(): Promise<{ readonly refreshedAt: string }>;
  testConnection(
    configuration: Readonly<StorageProviderConfiguration>,
  ): Promise<StorageConnectionTestResult>;
  discoverCapabilities(): Promise<readonly StorageCapabilityDescriptor[]>;
  searchStorageResources(query: StorageSearchQuery): Promise<readonly StorageInventoryResource[]>;
}

const DATASET_TIMESTAMP = '2026-01-01T00:00:00.000Z';

function metadata(values: Record<string, string>): Readonly<Record<string, string>> {
  return values;
}

const MOCK_VENDORS: readonly StorageVendorAbstraction[] = Object.freeze([
  { vendor: 'netApp', metadata: metadata({ family: 'ontap', profile: 'unified-storage' }) },
  {
    vendor: 'dellEmcPowerStore',
    metadata: metadata({ family: 'powerstore-os', profile: 'block-and-file' }),
  },
  {
    vendor: 'dellEmcUnity',
    metadata: metadata({ family: 'unity-os', profile: 'midrange-unified' }),
  },
  {
    vendor: 'dellPowerMax',
    metadata: metadata({ family: 'powermax-os', profile: 'mission-critical' }),
  },
  { vendor: 'pureStorage', metadata: metadata({ family: 'purity', profile: 'all-flash' }) },
  { vendor: 'hpeAlletra', metadata: metadata({ family: 'alletra-os', profile: 'cloud-managed' }) },
  {
    vendor: 'ibmFlashSystem',
    metadata: metadata({ family: 'spectrum-virtualize', profile: 'enterprise-flash' }),
  },
]);

const MOCK_INVENTORY: readonly StorageInventoryResource[] = Object.freeze([
  {
    id: 'array-1',
    kind: 'storageArray',
    name: 'netapp-array-01',
    vendor: 'netApp',
    metadata: metadata({ site: 'dc1', model: 'AFF-A400' }),
  },
  {
    id: 'controller-1',
    kind: 'controller',
    name: 'ctrl-a',
    vendor: 'netApp',
    metadata: metadata({ parentArray: 'netapp-array-01', role: 'active' }),
  },
  {
    id: 'pool-1',
    kind: 'pool',
    name: 'performance-pool',
    vendor: 'pureStorage',
    metadata: metadata({ tier: 'flash', parentArray: 'pure-array-01' }),
  },
  {
    id: 'volume-1',
    kind: 'volume',
    name: 'payments-vol-01',
    vendor: 'dellEmcPowerStore',
    metadata: metadata({ sizeGb: '2048', pool: 'performance-pool' }),
  },
  {
    id: 'lun-1',
    kind: 'lun',
    name: 'lun-payments-db',
    vendor: 'dellPowerMax',
    metadata: metadata({ sizeGb: '1024', mappedHost: 'oracle-db-01' }),
  },
  {
    id: 'filesystem-1',
    kind: 'fileSystem',
    name: 'fs-analytics',
    vendor: 'hpeAlletra',
    metadata: metadata({ protocol: 'nfs', sizeTb: '20' }),
  },
  {
    id: 'nasshare-1',
    kind: 'nasShare',
    name: 'share-finance',
    vendor: 'dellEmcUnity',
    metadata: metadata({ protocol: 'smb', path: '\\\\unity\\finance' }),
  },
  {
    id: 'snapshot-1',
    kind: 'snapshot',
    name: 'payments-vol-01-snap-20260101',
    vendor: 'netApp',
    metadata: metadata({ parentVolume: 'payments-vol-01', retentionHours: '48' }),
  },
  {
    id: 'repgrp-1',
    kind: 'replicationGroup',
    name: 'rg-payments-dr',
    vendor: 'ibmFlashSystem',
    metadata: metadata({ mode: 'async', targetSite: 'dc2' }),
  },
  {
    id: 'port-1',
    kind: 'storagePort',
    name: 'port-a1',
    vendor: 'netApp',
    metadata: metadata({ speedGbps: '32', type: 'fc' }),
  },
  {
    id: 'fc-endpoint-1',
    kind: 'fcEndpoint',
    name: 'wwpn-10:00:00:00:00:aa:bb:cc',
    vendor: 'dellPowerMax',
    metadata: metadata({ fabric: 'san-a' }),
  },
  {
    id: 'iscsi-endpoint-1',
    kind: 'iscsiEndpoint',
    name: 'iqn.1992-08.com.netapp:sn.1234567890',
    vendor: 'netApp',
    metadata: metadata({ ip: '10.40.20.15' }),
  },
  {
    id: 'nfs-endpoint-1',
    kind: 'nfsEndpoint',
    name: 'nfs://alletra-array-01/analytics',
    vendor: 'hpeAlletra',
    metadata: metadata({ version: '4.1' }),
  },
  {
    id: 'smb-endpoint-1',
    kind: 'smbEndpoint',
    name: '\\\\unity-array-01\\finance',
    vendor: 'dellEmcUnity',
    metadata: metadata({ version: '3.1.1' }),
  },
]);

const MOCK_ARRAY_HEALTH: readonly StorageArrayHealth[] = Object.freeze([
  {
    arrayName: 'netapp-array-01',
    vendor: 'netApp',
    healthy: true,
    status: 'healthy',
    checkedAt: DATASET_TIMESTAMP,
  },
]);
const MOCK_CAPACITY: readonly StorageCapacityMetric[] = Object.freeze([
  {
    arrayName: 'netapp-array-01',
    totalTb: 100,
    usedTb: 62,
    freeTb: 38,
    checkedAt: DATASET_TIMESTAMP,
  },
]);
const MOCK_PERFORMANCE: readonly StoragePerformanceMetric[] = Object.freeze([
  {
    arrayName: 'netapp-array-01',
    profile: 'overall-performance',
    value: 87,
    unit: 'score',
    checkedAt: DATASET_TIMESTAMP,
  },
]);
const MOCK_IOPS: readonly StorageIopsMetric[] = Object.freeze([
  {
    resourceName: 'payments-vol-01',
    readIops: 24000,
    writeIops: 11000,
    checkedAt: DATASET_TIMESTAMP,
  },
]);
const MOCK_THROUGHPUT: readonly StorageThroughputMetric[] = Object.freeze([
  {
    resourceName: 'payments-vol-01',
    readMbps: 680,
    writeMbps: 420,
    checkedAt: DATASET_TIMESTAMP,
  },
]);
const MOCK_LATENCY: readonly StorageLatencyMetric[] = Object.freeze([
  {
    resourceName: 'payments-vol-01',
    readMs: 1.4,
    writeMs: 1.9,
    checkedAt: DATASET_TIMESTAMP,
  },
]);
const MOCK_REPLICATION_HEALTH: readonly StorageReplicationHealth[] = Object.freeze([
  {
    replicationGroupName: 'rg-payments-dr',
    healthy: true,
    status: 'synchronized',
    checkedAt: DATASET_TIMESTAMP,
  },
]);
const MOCK_SNAPSHOT_HEALTH: readonly StorageSnapshotHealth[] = Object.freeze([
  {
    snapshotName: 'payments-vol-01-snap-20260101',
    healthy: true,
    status: 'healthy',
    checkedAt: DATASET_TIMESTAMP,
  },
]);
const MOCK_EVENTS: readonly StorageEvent[] = Object.freeze([
  {
    id: 'event-1',
    source: 'netapp-array-01',
    severity: 'warning',
    message: 'Controller failover test completed with brief path flap',
    timestamp: DATASET_TIMESTAMP,
  },
]);
const MOCK_ALERTS: readonly StorageAlert[] = Object.freeze([
  {
    id: 'alert-1',
    source: 'storage-observability',
    severity: 'warning',
    summary: 'Pool utilization exceeded 80 percent threshold',
    timestamp: DATASET_TIMESTAMP,
  },
]);

export class StorageMockAdapter implements IStorageAdapter {
  public async discoverVendorAbstractions(): Promise<readonly StorageVendorAbstraction[]> {
    return MOCK_VENDORS;
  }
  public async discoverStorageArrays(): Promise<readonly StorageInventoryResource[]> {
    return this.byKind('storageArray');
  }
  public async discoverControllers(): Promise<readonly StorageInventoryResource[]> {
    return this.byKind('controller');
  }
  public async discoverPools(): Promise<readonly StorageInventoryResource[]> {
    return this.byKind('pool');
  }
  public async discoverVolumes(): Promise<readonly StorageInventoryResource[]> {
    return this.byKind('volume');
  }
  public async discoverLuns(): Promise<readonly StorageInventoryResource[]> {
    return this.byKind('lun');
  }
  public async discoverFileSystems(): Promise<readonly StorageInventoryResource[]> {
    return this.byKind('fileSystem');
  }
  public async discoverNasShares(): Promise<readonly StorageInventoryResource[]> {
    return this.byKind('nasShare');
  }
  public async discoverSnapshots(): Promise<readonly StorageInventoryResource[]> {
    return this.byKind('snapshot');
  }
  public async discoverReplicationGroups(): Promise<readonly StorageInventoryResource[]> {
    return this.byKind('replicationGroup');
  }
  public async discoverStoragePorts(): Promise<readonly StorageInventoryResource[]> {
    return this.byKind('storagePort');
  }
  public async discoverFcEndpoints(): Promise<readonly StorageInventoryResource[]> {
    return this.byKind('fcEndpoint');
  }
  public async discoverIscsiEndpoints(): Promise<readonly StorageInventoryResource[]> {
    return this.byKind('iscsiEndpoint');
  }
  public async discoverNfsEndpoints(): Promise<readonly StorageInventoryResource[]> {
    return this.byKind('nfsEndpoint');
  }
  public async discoverSmbEndpoints(): Promise<readonly StorageInventoryResource[]> {
    return this.byKind('smbEndpoint');
  }
  public async getArrayHealth(): Promise<readonly StorageArrayHealth[]> {
    return MOCK_ARRAY_HEALTH;
  }
  public async getCapacity(): Promise<readonly StorageCapacityMetric[]> {
    return MOCK_CAPACITY;
  }
  public async getPerformance(): Promise<readonly StoragePerformanceMetric[]> {
    return MOCK_PERFORMANCE;
  }
  public async getIops(): Promise<readonly StorageIopsMetric[]> {
    return MOCK_IOPS;
  }
  public async getThroughput(): Promise<readonly StorageThroughputMetric[]> {
    return MOCK_THROUGHPUT;
  }
  public async getLatency(): Promise<readonly StorageLatencyMetric[]> {
    return MOCK_LATENCY;
  }
  public async getReplicationHealth(): Promise<readonly StorageReplicationHealth[]> {
    return MOCK_REPLICATION_HEALTH;
  }
  public async getSnapshotHealth(): Promise<readonly StorageSnapshotHealth[]> {
    return MOCK_SNAPSHOT_HEALTH;
  }
  public async getEvents(): Promise<readonly StorageEvent[]> {
    return MOCK_EVENTS;
  }
  public async getAlerts(): Promise<readonly StorageAlert[]> {
    return MOCK_ALERTS;
  }
  public async refreshInventory(): Promise<{ readonly refreshedAt: string }> {
    return { refreshedAt: DATASET_TIMESTAMP };
  }
  public async testConnection(
    configuration: Readonly<StorageProviderConfiguration>,
  ): Promise<StorageConnectionTestResult> {
    return {
      connected: configuration.endpoint.startsWith('storage://'),
      latencyMs: 19,
      message:
        'Storage connection test succeeded through adapter abstraction without vendor SDKs or protocol transport implementations.',
    };
  }
  public async discoverCapabilities(): Promise<readonly StorageCapabilityDescriptor[]> {
    return Object.freeze([
      {
        id: 'storage-discovery',
        name: 'discovery',
        version: '1.0.0',
        category: 'discovery',
      },
      {
        id: 'storage-provisioning',
        name: 'provisioning',
        version: '1.0.0',
        category: 'provisioning',
      },
      {
        id: 'storage-data-protection',
        name: 'dataProtection',
        version: '1.0.0',
        category: 'dataProtection',
      },
      {
        id: 'storage-monitoring',
        name: 'monitoring',
        version: '1.0.0',
        category: 'monitoring',
      },
      {
        id: 'storage-operations',
        name: 'operations',
        version: '1.0.0',
        category: 'operations',
      },
    ]);
  }
  public async searchStorageResources(
    query: StorageSearchQuery,
  ): Promise<readonly StorageInventoryResource[]> {
    const needle = query.text.trim().toLowerCase();
    const byVendor = query.vendor
      ? MOCK_INVENTORY.filter((resource) => resource.vendor === query.vendor)
      : MOCK_INVENTORY;
    const byKind = query.kind
      ? byVendor.filter((resource) => resource.kind === query.kind)
      : byVendor;
    return byKind.filter((resource) =>
      [resource.id, resource.name].some((value) => value.toLowerCase().includes(needle)),
    );
  }

  private byKind(kind: StorageResourceKind): readonly StorageInventoryResource[] {
    return MOCK_INVENTORY.filter((resource) => resource.kind === kind);
  }
}

export class StorageInventoryCache {
  private snapshot: StorageInventoryCacheSnapshot = Object.freeze({ resources: Object.freeze([]) });

  public update(resources: readonly StorageInventoryResource[], refreshedAt: string): void {
    this.snapshot = Object.freeze({ resources: Object.freeze([...resources]), refreshedAt });
  }

  public getSnapshot(): StorageInventoryCacheSnapshot {
    return this.snapshot;
  }

  public searchStorageResources(query: StorageSearchQuery): readonly StorageInventoryResource[] {
    const needle = query.text.trim().toLowerCase();
    const byVendor = query.vendor
      ? this.snapshot.resources.filter((resource) => resource.vendor === query.vendor)
      : this.snapshot.resources;
    const byKind = query.kind
      ? byVendor.filter((resource) => resource.kind === query.kind)
      : byVendor;
    return byKind.filter((resource) =>
      [resource.id, resource.name].some((value) => value.toLowerCase().includes(needle)),
    );
  }
}

export class StorageConfiguration {
  public readonly defaultConfiguration: Readonly<StorageProviderConfiguration> = Object.freeze({
    endpoint: 'storage://enterprise.fabric.example.local',
    domainName: 'enterprise.fabric.example.local',
    credentialRef: 'STORAGE_CREDENTIAL_REF',
    readOnly: true,
    connectionTimeoutMs: 10000,
    inventoryCacheTtlSeconds: 300,
  });

  public merge(
    override?: Readonly<Partial<StorageProviderConfiguration>>,
  ): Readonly<StorageProviderConfiguration> {
    const merged: StorageProviderConfiguration = {
      endpoint: override?.endpoint ?? this.defaultConfiguration.endpoint,
      domainName: override?.domainName ?? this.defaultConfiguration.domainName,
      credentialRef: override?.credentialRef ?? this.defaultConfiguration.credentialRef,
      readOnly: override?.readOnly ?? this.defaultConfiguration.readOnly,
      connectionTimeoutMs:
        override?.connectionTimeoutMs ?? this.defaultConfiguration.connectionTimeoutMs,
      inventoryCacheTtlSeconds:
        override?.inventoryCacheTtlSeconds ?? this.defaultConfiguration.inventoryCacheTtlSeconds,
    };
    return Object.freeze(merged);
  }
}

export class StorageAuthenticationProvider {
  private readonly providerAuthentication: ProviderAuthentication;

  public constructor(options: { readonly credentialStore?: CredentialStore } = {}) {
    this.providerAuthentication = new ProviderAuthentication({
      credentialStore: options.credentialStore ?? new CredentialStore(),
      autoStoreCredentials: true,
    });
    this.providerAuthentication.registerProvider({
      method: 'username-password',
      authenticate: async (
        context: { readonly provider: { readonly manifest: { readonly id: string } } },
        credential: {
          readonly method: 'username-password';
          readonly username: string;
          readonly password: string;
        },
      ) => {
        const success = credential.username.length > 0 && credential.password.length > 0;
        return new AuthenticationResult({
          success,
          method: 'username-password',
          providerId: context.provider.manifest.id,
          principalId: success ? credential.username : undefined,
          message: success
            ? 'Storage authentication accepted.'
            : 'Storage credential payload is invalid.',
          authenticatedAt: DATASET_TIMESTAMP,
        });
      },
    });
  }

  public getProviderAuthentication(): ProviderAuthentication {
    return this.providerAuthentication;
  }
}

export class StorageConnection {
  public readonly id: string;
  public readonly endpoint: string;
  public connectedAt?: string;

  public constructor(endpoint: string) {
    this.endpoint = endpoint;
    this.id = `storage-connection:${endpoint}`;
  }

  public connect(): void {
    this.connectedAt = DATASET_TIMESTAMP;
  }

  public disconnect(): void {
    this.connectedAt = undefined;
  }
}

export class StorageConnectionManager {
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
          const client = new StorageConnection(endpoint);
          client.connect();
          return client;
        },
        disconnect: async (client) => {
          client?.disconnect();
        },
        checkHealth: async (client) =>
          new ConnectionHealth({
            status: client?.connectedAt ? 'connected' : 'degraded',
            latencyMs: 19,
            lastCheckedAt: DATASET_TIMESTAMP,
            message: 'Storage connection health.',
          }),
      });
    });
    this.sdkConnectionManager = new ProviderConnectionManager({ factory, pool });
  }

  public getSdkConnectionManager(): ProviderConnectionManager {
    return this.sdkConnectionManager;
  }
}

export class StorageCapabilityRegistry {
  private readonly registry: ProviderCapabilityRegistry;

  public constructor(providerId: string, registry = new ProviderCapabilityRegistry()) {
    this.registry = registry;
    const register = (
      id: string,
      name: string,
      category: StorageCapabilityDescriptor['category'],
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
            tags: ['storage', 'vendor-neutral', category],
            featureFlags: { configurationDriven: true, adapterBacked: true },
          }),
          requiresCapabilities: [name],
          requiredFeatureFlags: ['configurationDriven', 'adapterBacked'],
        }),
      );
    };

    register('storage-discovery', 'discovery', 'discovery', 'Discovery across storage platforms.');
    register(
      'storage-provisioning',
      'provisioning',
      'provisioning',
      'Pools, volumes, and endpoints.',
    );
    register(
      'storage-data-protection',
      'dataProtection',
      'dataProtection',
      'Snapshots and replication health surfaces.',
    );
    register(
      'storage-monitoring',
      'monitoring',
      'monitoring',
      'Performance and capacity telemetry.',
    );
    register(
      'storage-operations',
      'operations',
      'operations',
      'Refresh, search, and synchronization.',
    );
  }

  public getProviderCapabilityRegistry(): ProviderCapabilityRegistry {
    return this.registry;
  }

  public async list(): Promise<readonly StorageCapabilityDescriptor[]> {
    return Object.freeze([
      {
        id: 'storage-discovery',
        name: 'discovery',
        version: '1.0.0',
        category: 'discovery',
      },
      {
        id: 'storage-provisioning',
        name: 'provisioning',
        version: '1.0.0',
        category: 'provisioning',
      },
      {
        id: 'storage-data-protection',
        name: 'dataProtection',
        version: '1.0.0',
        category: 'dataProtection',
      },
      {
        id: 'storage-monitoring',
        name: 'monitoring',
        version: '1.0.0',
        category: 'monitoring',
      },
      {
        id: 'storage-operations',
        name: 'operations',
        version: '1.0.0',
        category: 'operations',
      },
    ]);
  }
}

export class StorageProvider extends BaseProvider<StorageProviderConfiguration> {
  private readonly adapter: IStorageAdapter;
  private readonly configurationService: StorageConfiguration;
  private readonly inventoryCache: StorageInventoryCache;
  private readonly capabilityRegistry: StorageCapabilityRegistry;

  public constructor(
    options: {
      readonly adapter?: IStorageAdapter;
      readonly configurationService?: StorageConfiguration;
      readonly inventoryCache?: StorageInventoryCache;
      readonly capabilityRegistry?: StorageCapabilityRegistry;
      readonly manifest?: ProviderManifest<StorageProviderConfiguration>;
    } = {},
  ) {
    const configurationService = options.configurationService ?? new StorageConfiguration();
    super({
      manifest:
        options.manifest ??
        new ProviderManifest<StorageProviderConfiguration>({
          id: 'provider-storage',
          name: 'Enterprise Storage Provider',
          metadata: new ProviderMetadata({
            description:
              'Vendor-neutral enterprise storage provider built on Provider SDK with adapter isolation.',
            version: new ProviderVersion('1.0.0'),
            vendor: 'InfraShield',
            tags: ['storage', 'vendor-neutral', 'enterprise', 'provider-sdk'],
            healthStatus: 'healthy',
          }),
          capabilities: new ProviderCapabilities([
            new ToolCapability({ name: 'discovery' }),
            new ToolCapability({ name: 'provisioning' }),
            new ToolCapability({ name: 'dataProtection' }),
            new ToolCapability({ name: 'monitoring' }),
            new ToolCapability({ name: 'operations' }),
          ]),
          configuration: new ProviderConfiguration<StorageProviderConfiguration>({
            requiredFields: [
              'endpoint',
              'domainName',
              'credentialRef',
              'readOnly',
              'connectionTimeoutMs',
              'inventoryCacheTtlSeconds',
            ],
            defaultValues: configurationService.defaultConfiguration,
          }),
        }),
    });

    this.adapter = options.adapter ?? new StorageMockAdapter();
    this.configurationService = configurationService;
    this.inventoryCache = options.inventoryCache ?? new StorageInventoryCache();
    this.capabilityRegistry =
      options.capabilityRegistry ?? new StorageCapabilityRegistry(this.manifest.id);
  }

  public resolveConfiguration(
    override?: Readonly<Partial<StorageProviderConfiguration>>,
  ): Readonly<StorageProviderConfiguration> {
    return this.configurationService.merge(override);
  }

  public async discoverVendorAbstractions(): Promise<readonly StorageVendorAbstraction[]> {
    return this.adapter.discoverVendorAbstractions();
  }

  public async discoverInventory(): Promise<readonly StorageInventoryResource[]> {
    const [
      storageArrays,
      controllers,
      pools,
      volumes,
      luns,
      fileSystems,
      nasShares,
      snapshots,
      replicationGroups,
      storagePorts,
      fcEndpoints,
      iscsiEndpoints,
      nfsEndpoints,
      smbEndpoints,
    ] = await Promise.all([
      this.adapter.discoverStorageArrays(),
      this.adapter.discoverControllers(),
      this.adapter.discoverPools(),
      this.adapter.discoverVolumes(),
      this.adapter.discoverLuns(),
      this.adapter.discoverFileSystems(),
      this.adapter.discoverNasShares(),
      this.adapter.discoverSnapshots(),
      this.adapter.discoverReplicationGroups(),
      this.adapter.discoverStoragePorts(),
      this.adapter.discoverFcEndpoints(),
      this.adapter.discoverIscsiEndpoints(),
      this.adapter.discoverNfsEndpoints(),
      this.adapter.discoverSmbEndpoints(),
    ]);

    return Object.freeze([
      ...storageArrays,
      ...controllers,
      ...pools,
      ...volumes,
      ...luns,
      ...fileSystems,
      ...nasShares,
      ...snapshots,
      ...replicationGroups,
      ...storagePorts,
      ...fcEndpoints,
      ...iscsiEndpoints,
      ...nfsEndpoints,
      ...smbEndpoints,
    ]);
  }

  public async refreshInventory(): Promise<StorageInventoryCacheSnapshot> {
    const refreshed = await this.adapter.refreshInventory();
    const resources = await this.discoverInventory();
    this.inventoryCache.update(resources, refreshed.refreshedAt);
    return this.inventoryCache.getSnapshot();
  }

  public getInventoryCache(): StorageInventoryCacheSnapshot {
    return this.inventoryCache.getSnapshot();
  }

  public synchronizeCache(snapshot: StorageInventoryCacheSnapshot): void {
    this.inventoryCache.update(snapshot.resources, snapshot.refreshedAt ?? DATASET_TIMESTAMP);
  }

  public async testConnection(
    override?: Readonly<Partial<StorageProviderConfiguration>>,
  ): Promise<StorageConnectionTestResult> {
    return this.adapter.testConnection(this.resolveConfiguration(override));
  }

  public async discoverCapabilities(): Promise<readonly StorageCapabilityDescriptor[]> {
    const [fromRegistry, fromAdapter] = await Promise.all([
      this.capabilityRegistry.list(),
      this.adapter.discoverCapabilities(),
    ]);
    const dedup = new Map<string, StorageCapabilityDescriptor>();
    [...fromRegistry, ...fromAdapter].forEach((capability) => dedup.set(capability.id, capability));
    return Object.freeze([...dedup.values()]);
  }

  public async searchStorageResources(
    query: StorageSearchQuery,
  ): Promise<readonly StorageInventoryResource[]> {
    if (this.inventoryCache.getSnapshot().resources.length > 0) {
      return this.inventoryCache.searchStorageResources(query);
    }
    return this.adapter.searchStorageResources(query);
  }

  public async getArrayHealth(): Promise<readonly StorageArrayHealth[]> {
    return this.adapter.getArrayHealth();
  }
  public async getCapacity(): Promise<readonly StorageCapacityMetric[]> {
    return this.adapter.getCapacity();
  }
  public async getPerformance(): Promise<readonly StoragePerformanceMetric[]> {
    return this.adapter.getPerformance();
  }
  public async getIops(): Promise<readonly StorageIopsMetric[]> {
    return this.adapter.getIops();
  }
  public async getThroughput(): Promise<readonly StorageThroughputMetric[]> {
    return this.adapter.getThroughput();
  }
  public async getLatency(): Promise<readonly StorageLatencyMetric[]> {
    return this.adapter.getLatency();
  }
  public async getReplicationHealth(): Promise<readonly StorageReplicationHealth[]> {
    return this.adapter.getReplicationHealth();
  }
  public async getSnapshotHealth(): Promise<readonly StorageSnapshotHealth[]> {
    return this.adapter.getSnapshotHealth();
  }
  public async getEvents(): Promise<readonly StorageEvent[]> {
    return this.adapter.getEvents();
  }
  public async getAlerts(): Promise<readonly StorageAlert[]> {
    return this.adapter.getAlerts();
  }
}

export class StorageProviderFactory {
  private readonly registryService: ProviderRegistryService;

  public constructor(options: { readonly registryService?: ProviderRegistryService } = {}) {
    this.registryService = options.registryService ?? new ProviderRegistryService();
  }

  public create(options?: {
    readonly adapter?: IStorageAdapter;
    readonly configurationOverride?: Readonly<Partial<StorageProviderConfiguration>>;
  }): StorageProvider {
    const configurationService = new StorageConfiguration();

    const provider = new StorageProvider({
      adapter: options?.adapter,
      configurationService,
      manifest: new ProviderManifest<StorageProviderConfiguration>({
        id: 'provider-storage',
        name: 'Enterprise Storage Provider',
        metadata: new ProviderMetadata({
          description:
            'Vendor-neutral enterprise storage provider built on Provider SDK with adapter isolation.',
          version: new ProviderVersion('1.0.0'),
          vendor: 'InfraShield',
          tags: ['storage', 'vendor-neutral', 'enterprise', 'provider-sdk'],
          healthStatus: 'healthy',
        }),
        capabilities: new ProviderCapabilities([
          new ToolCapability({ name: 'discovery' }),
          new ToolCapability({ name: 'provisioning' }),
          new ToolCapability({ name: 'dataProtection' }),
          new ToolCapability({ name: 'monitoring' }),
          new ToolCapability({ name: 'operations' }),
        ]),
        configuration: new ProviderConfiguration<StorageProviderConfiguration>({
          requiredFields: [
            'endpoint',
            'domainName',
            'credentialRef',
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

export interface StorageProviderRuntime {
  readonly provider: StorageProvider;
  readonly registryService: ProviderRegistryService;
  readonly lifecycleManager: ProviderLifecycleManager;
  readonly capabilityResolver: CapabilityResolver;
  readonly authenticationProvider: StorageAuthenticationProvider;
  readonly connectionManager: StorageConnectionManager;
}

export function createStorageProviderRuntime(): StorageProviderRuntime {
  const factory = new StorageProviderFactory();
  const provider = factory.create();

  const capabilityRegistry = new StorageCapabilityRegistry(provider.manifest.id);
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
      message: 'Storage provider healthy.',
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
    authenticationProvider: new StorageAuthenticationProvider(),
    connectionManager: new StorageConnectionManager(provider.manifest.id),
  };
}
