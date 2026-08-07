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

export type VmwareInventoryKind =
  | 'datacenter'
  | 'cluster'
  | 'esxiHost'
  | 'virtualMachine'
  | 'resourcePool'
  | 'folder'
  | 'datastore'
  | 'network'
  | 'template'
  | 'snapshot';

export interface VmwareProviderConfiguration extends SerializableValueObject {
  readonly endpoint: string;
  readonly username: string;
  readonly credentialRef: string;
  readonly readOnly: boolean;
  readonly insecureSkipTlsVerify: boolean;
  readonly requestTimeoutMs: number;
  readonly inventoryCacheTtlSeconds: number;
}

export interface VmwareInventoryResource {
  readonly id: string;
  readonly kind: VmwareInventoryKind;
  readonly name: string;
  readonly parentId?: string;
  readonly moRef: string;
  readonly labels: Readonly<Record<string, string>>;
  readonly status: 'running' | 'degraded' | 'stopped';
}

export interface VmwareHealthStatus {
  readonly healthy: boolean;
  readonly status: 'healthy' | 'degraded';
  readonly checkedAt: string;
  readonly details: Readonly<Record<string, string | number | boolean>>;
}

export interface VmwarePerformanceMetric {
  readonly resourceId: string;
  readonly cpuUsagePercent: number;
  readonly memoryUsagePercent: number;
  readonly networkKbps: number;
  readonly storageIops: number;
  readonly timestamp: string;
}

export interface VmwareCapacitySummary {
  readonly totalCpuCores: number;
  readonly usedCpuCores: number;
  readonly totalMemoryGb: number;
  readonly usedMemoryGb: number;
  readonly totalStorageTb: number;
  readonly usedStorageTb: number;
  readonly measuredAt: string;
}

export interface VmwareProviderEvent {
  readonly id: string;
  readonly severity: 'info' | 'warning' | 'error';
  readonly message: string;
  readonly resourceId?: string;
  readonly timestamp: string;
}

export interface VmwareAlarm {
  readonly id: string;
  readonly name: string;
  readonly severity: 'warning' | 'critical';
  readonly entityId: string;
  readonly acknowledged: boolean;
  readonly triggeredAt: string;
}

export interface VmwareTask {
  readonly id: string;
  readonly name: string;
  readonly state: 'queued' | 'running' | 'success' | 'error';
  readonly entityId?: string;
  readonly startedAt: string;
  readonly completedAt?: string;
}

export interface VmwareConnectionTestResult {
  readonly connected: boolean;
  readonly latencyMs: number;
  readonly message: string;
}

export interface VmwareCapabilityDescriptor {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly category: 'discovery' | 'monitoring' | 'operations';
}

export interface VmwareInventoryCacheSnapshot {
  readonly resources: readonly VmwareInventoryResource[];
  readonly refreshedAt?: string;
}

export interface VmwareSearchQuery {
  readonly text: string;
  readonly kind?: VmwareInventoryKind;
}

export interface VmwareUnsupportedOperationResult {
  readonly supported: false;
  readonly reason: string;
}

export interface VmwareVmPowerOperations {
  powerOn(vmId: string): Promise<VmwareUnsupportedOperationResult>;
  powerOff(vmId: string): Promise<VmwareUnsupportedOperationResult>;
  restart(vmId: string): Promise<VmwareUnsupportedOperationResult>;
}

export interface VmwareSnapshotOperations {
  create(vmId: string, name: string): Promise<VmwareUnsupportedOperationResult>;
  revert(snapshotId: string): Promise<VmwareUnsupportedOperationResult>;
  remove(snapshotId: string): Promise<VmwareUnsupportedOperationResult>;
}

export interface VmwareInventoryAdapter {
  listDatacenters(): Promise<readonly VmwareInventoryResource[]>;
  listClusters(): Promise<readonly VmwareInventoryResource[]>;
  listEsxiHosts(): Promise<readonly VmwareInventoryResource[]>;
  listVirtualMachines(): Promise<readonly VmwareInventoryResource[]>;
  listResourcePools(): Promise<readonly VmwareInventoryResource[]>;
  listFolders(): Promise<readonly VmwareInventoryResource[]>;
  listDatastores(): Promise<readonly VmwareInventoryResource[]>;
  listNetworks(): Promise<readonly VmwareInventoryResource[]>;
  listTemplates(): Promise<readonly VmwareInventoryResource[]>;
  listSnapshots(): Promise<readonly VmwareInventoryResource[]>;
}

export interface VmwareMonitoringAdapter {
  getHealth(): Promise<VmwareHealthStatus>;
  getPerformanceMetrics(): Promise<readonly VmwarePerformanceMetric[]>;
  getCapacity(): Promise<VmwareCapacitySummary>;
  getEvents(): Promise<readonly VmwareProviderEvent[]>;
  getAlarms(): Promise<readonly VmwareAlarm[]>;
  getTasks(): Promise<readonly VmwareTask[]>;
}

export interface VmwareOperationsAdapter {
  refreshInventory(): Promise<{ readonly refreshedAt: string }>;
  testConnection(
    configuration: Readonly<VmwareProviderConfiguration>,
  ): Promise<VmwareConnectionTestResult>;
  discoverCapabilities(): Promise<readonly VmwareCapabilityDescriptor[]>;
  searchVirtualMachines(query: VmwareSearchQuery): Promise<readonly VmwareInventoryResource[]>;
}

export interface VmwareAdapter
  extends VmwareInventoryAdapter, VmwareMonitoringAdapter, VmwareOperationsAdapter {}

const DATASET_TIMESTAMP = '2026-01-01T00:00:00.000Z';

function createLabels(labels: Record<string, string>): Readonly<Record<string, string>> {
  return labels;
}

const MOCK_INVENTORY: readonly VmwareInventoryResource[] = Object.freeze([
  {
    id: 'dc-1',
    kind: 'datacenter',
    name: 'primary-datacenter',
    moRef: 'datacenter-21',
    labels: createLabels({ site: 'ashburn', tier: 'core' }),
    status: 'running',
  },
  {
    id: 'cluster-1',
    kind: 'cluster',
    name: 'production-cluster',
    parentId: 'dc-1',
    moRef: 'domain-c42',
    labels: createLabels({ sla: 'gold', environment: 'prod' }),
    status: 'running',
  },
  {
    id: 'host-1',
    kind: 'esxiHost',
    name: 'esxi-01.infrashield.local',
    parentId: 'cluster-1',
    moRef: 'host-301',
    labels: createLabels({ vendor: 'dell', generation: '15g' }),
    status: 'running',
  },
  {
    id: 'rp-1',
    kind: 'resourcePool',
    name: 'payments-resource-pool',
    parentId: 'cluster-1',
    moRef: 'resgroup-401',
    labels: createLabels({ team: 'payments', priority: 'high' }),
    status: 'running',
  },
  {
    id: 'folder-1',
    kind: 'folder',
    name: 'payments-folder',
    parentId: 'dc-1',
    moRef: 'group-v500',
    labels: createLabels({ managedBy: 'platform' }),
    status: 'running',
  },
  {
    id: 'ds-1',
    kind: 'datastore',
    name: 'vsanDatastore',
    parentId: 'cluster-1',
    moRef: 'datastore-88',
    labels: createLabels({ type: 'vsan', profile: 'all-flash' }),
    status: 'running',
  },
  {
    id: 'net-1',
    kind: 'network',
    name: 'dvpg-prod-web',
    parentId: 'dc-1',
    moRef: 'dvportgroup-92',
    labels: createLabels({ vlan: '210', segment: 'web' }),
    status: 'running',
  },
  {
    id: 'vm-1',
    kind: 'virtualMachine',
    name: 'payments-api-01',
    parentId: 'rp-1',
    moRef: 'vm-601',
    labels: createLabels({ app: 'payments-api', role: 'primary' }),
    status: 'running',
  },
  {
    id: 'tmpl-1',
    kind: 'template',
    name: 'ubuntu-22-base-template',
    parentId: 'folder-1',
    moRef: 'vm-910',
    labels: createLabels({ os: 'ubuntu22', hardened: 'true' }),
    status: 'running',
  },
  {
    id: 'snap-1',
    kind: 'snapshot',
    name: 'payments-api-prepatch',
    parentId: 'vm-1',
    moRef: 'snapshot-111',
    labels: createLabels({ vm: 'payments-api-01', policy: 'nightly' }),
    status: 'running',
  },
]);

const MOCK_PERFORMANCE: readonly VmwarePerformanceMetric[] = Object.freeze([
  {
    resourceId: 'vm-1',
    cpuUsagePercent: 42,
    memoryUsagePercent: 65,
    networkKbps: 740,
    storageIops: 380,
    timestamp: DATASET_TIMESTAMP,
  },
  {
    resourceId: 'host-1',
    cpuUsagePercent: 58,
    memoryUsagePercent: 61,
    networkKbps: 1320,
    storageIops: 810,
    timestamp: DATASET_TIMESTAMP,
  },
]);

const MOCK_EVENTS: readonly VmwareProviderEvent[] = Object.freeze([
  {
    id: 'evt-1',
    severity: 'info',
    message: 'vCenter inventory refresh completed.',
    timestamp: DATASET_TIMESTAMP,
  },
  {
    id: 'evt-2',
    severity: 'warning',
    resourceId: 'vm-1',
    message: 'Snapshot count exceeds recommendation.',
    timestamp: DATASET_TIMESTAMP,
  },
]);

const MOCK_ALARMS: readonly VmwareAlarm[] = Object.freeze([
  {
    id: 'alarm-1',
    name: 'Datastore usage high',
    severity: 'warning',
    entityId: 'ds-1',
    acknowledged: false,
    triggeredAt: DATASET_TIMESTAMP,
  },
]);

const MOCK_TASKS: readonly VmwareTask[] = Object.freeze([
  {
    id: 'task-1',
    name: 'Relocate virtual machine',
    state: 'success',
    entityId: 'vm-1',
    startedAt: DATASET_TIMESTAMP,
    completedAt: DATASET_TIMESTAMP,
  },
]);

export class VmwareConnection {
  public readonly id: string;
  public readonly endpoint: string;
  public connectedAt?: string;

  public constructor(endpoint: string) {
    this.endpoint = endpoint;
    this.id = `vmware-connection:${endpoint}`;
  }

  public connect(): void {
    this.connectedAt = DATASET_TIMESTAMP;
  }

  public disconnect(): void {
    this.connectedAt = undefined;
  }
}

export class VmwareAuthentication {
  public readonly method = 'username-password' as const;

  public async authenticate(
    context: { readonly provider: { readonly manifest: { readonly id: string } } },
    credential: {
      readonly method: 'username-password';
      readonly username: string;
      readonly password: string;
    },
  ): Promise<AuthenticationResult> {
    const success = credential.username.length > 0 && credential.password.length > 0;

    return new AuthenticationResult({
      success,
      method: 'username-password',
      providerId: context.provider.manifest.id,
      principalId: success ? credential.username : undefined,
      message: success
        ? 'VMware authentication accepted.'
        : 'VMware credential payload is invalid.',
      authenticatedAt: DATASET_TIMESTAMP,
    });
  }
}

export class VmwareConfiguration {
  public readonly defaultConfiguration: Readonly<VmwareProviderConfiguration> = Object.freeze({
    endpoint: 'https://vcenter.example.local',
    username: 'automation-operator',
    credentialRef: 'VMWARE_CREDENTIAL_REF',
    readOnly: true,
    insecureSkipTlsVerify: false,
    requestTimeoutMs: 15000,
    inventoryCacheTtlSeconds: 300,
  });

  public merge(
    override?: Readonly<Partial<VmwareProviderConfiguration>>,
  ): Readonly<VmwareProviderConfiguration> {
    const merged: VmwareProviderConfiguration = {
      endpoint: override?.endpoint ?? this.defaultConfiguration.endpoint,
      username: override?.username ?? this.defaultConfiguration.username,
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

export class VmwareCapabilityRegistry {
  private readonly registry: ProviderCapabilityRegistry;

  public constructor(providerId = 'provider-vmware', registry = new ProviderCapabilityRegistry()) {
    this.registry = registry;

    this.register(
      providerId,
      'vmware-inventory-discovery',
      'inventory',
      'Discovery coverage across VMware inventory objects.',
      'discovery',
    );
    this.register(
      providerId,
      'vmware-health-metrics',
      'monitoring',
      'Health, performance, capacity and operational telemetry.',
      'monitoring',
    );
    this.register(
      providerId,
      'vmware-operations',
      'operations',
      'Inventory refresh, connection testing and search operations.',
      'operations',
    );
  }

  public getProviderCapabilityRegistry(): ProviderCapabilityRegistry {
    return this.registry;
  }

  public async list(): Promise<readonly VmwareCapabilityDescriptor[]> {
    return Object.freeze([
      {
        id: 'vmware-inventory-discovery',
        name: 'inventory',
        version: '1.0.0',
        category: 'discovery',
      },
      {
        id: 'vmware-health-metrics',
        name: 'monitoring',
        version: '1.0.0',
        category: 'monitoring',
      },
      {
        id: 'vmware-operations',
        name: 'operations',
        version: '1.0.0',
        category: 'operations',
      },
    ]);
  }

  private register(
    providerId: string,
    capabilityId: string,
    capabilityName: string,
    description: string,
    category: VmwareCapabilityDescriptor['category'],
  ): void {
    this.registry.register(
      new CapabilityDefinition({
        id: capabilityId,
        providerId,
        name: capabilityName,
        version: new CapabilityVersion('1.0.0'),
        metadata: new CapabilityMetadata({
          description,
          tags: ['vmware', category],
          featureFlags: {
            configurationDriven: true,
            adapterBacked: true,
          },
        }),
        requiresCapabilities: [capabilityName],
        requiredFeatureFlags: ['configurationDriven', 'adapterBacked'],
      }),
    );
  }
}

export class VmwareInventoryCache {
  private snapshot: VmwareInventoryCacheSnapshot = Object.freeze({ resources: Object.freeze([]) });

  public update(resources: readonly VmwareInventoryResource[], refreshedAt: string): void {
    this.snapshot = Object.freeze({
      resources: Object.freeze([...resources]),
      refreshedAt,
    });
  }

  public getSnapshot(): VmwareInventoryCacheSnapshot {
    return this.snapshot;
  }

  public search(query: VmwareSearchQuery): readonly VmwareInventoryResource[] {
    const needle = query.text.trim().toLowerCase();
    const filteredByKind = query.kind
      ? this.snapshot.resources.filter((resource) => resource.kind === query.kind)
      : this.snapshot.resources;

    return filteredByKind.filter((resource) =>
      [resource.id, resource.name, resource.moRef].some((value) =>
        value.toLowerCase().includes(needle),
      ),
    );
  }
}

class VmwareInterfaceOnlyVmPowerOperations implements VmwareVmPowerOperations {
  public async powerOn(_vmId: string): Promise<VmwareUnsupportedOperationResult> {
    return {
      supported: false,
      reason: 'VM power operations are interface-only and pending live VMware API integration.',
    };
  }

  public async powerOff(_vmId: string): Promise<VmwareUnsupportedOperationResult> {
    return {
      supported: false,
      reason: 'VM power operations are interface-only and pending live VMware API integration.',
    };
  }

  public async restart(_vmId: string): Promise<VmwareUnsupportedOperationResult> {
    return {
      supported: false,
      reason: 'VM power operations are interface-only and pending live VMware API integration.',
    };
  }
}

class VmwareInterfaceOnlySnapshotOperations implements VmwareSnapshotOperations {
  public async create(_vmId: string, _name: string): Promise<VmwareUnsupportedOperationResult> {
    return {
      supported: false,
      reason: 'Snapshot operations are interface-only and pending live VMware API integration.',
    };
  }

  public async revert(_snapshotId: string): Promise<VmwareUnsupportedOperationResult> {
    return {
      supported: false,
      reason: 'Snapshot operations are interface-only and pending live VMware API integration.',
    };
  }

  public async remove(_snapshotId: string): Promise<VmwareUnsupportedOperationResult> {
    return {
      supported: false,
      reason: 'Snapshot operations are interface-only and pending live VMware API integration.',
    };
  }
}

export class MockVmwareAdapter implements VmwareAdapter {
  public async listDatacenters(): Promise<readonly VmwareInventoryResource[]> {
    return this.byKind('datacenter');
  }

  public async listClusters(): Promise<readonly VmwareInventoryResource[]> {
    return this.byKind('cluster');
  }

  public async listEsxiHosts(): Promise<readonly VmwareInventoryResource[]> {
    return this.byKind('esxiHost');
  }

  public async listVirtualMachines(): Promise<readonly VmwareInventoryResource[]> {
    return this.byKind('virtualMachine');
  }

  public async listResourcePools(): Promise<readonly VmwareInventoryResource[]> {
    return this.byKind('resourcePool');
  }

  public async listFolders(): Promise<readonly VmwareInventoryResource[]> {
    return this.byKind('folder');
  }

  public async listDatastores(): Promise<readonly VmwareInventoryResource[]> {
    return this.byKind('datastore');
  }

  public async listNetworks(): Promise<readonly VmwareInventoryResource[]> {
    return this.byKind('network');
  }

  public async listTemplates(): Promise<readonly VmwareInventoryResource[]> {
    return this.byKind('template');
  }

  public async listSnapshots(): Promise<readonly VmwareInventoryResource[]> {
    return this.byKind('snapshot');
  }

  public async getHealth(): Promise<VmwareHealthStatus> {
    return {
      healthy: true,
      status: 'healthy',
      checkedAt: DATASET_TIMESTAMP,
      details: {
        provider: 'vmware-enterprise',
        apiMode: 'mock-adapter',
        resources: MOCK_INVENTORY.length,
      },
    };
  }

  public async getPerformanceMetrics(): Promise<readonly VmwarePerformanceMetric[]> {
    return MOCK_PERFORMANCE;
  }

  public async getCapacity(): Promise<VmwareCapacitySummary> {
    return {
      totalCpuCores: 128,
      usedCpuCores: 74,
      totalMemoryGb: 512,
      usedMemoryGb: 339,
      totalStorageTb: 240,
      usedStorageTb: 119,
      measuredAt: DATASET_TIMESTAMP,
    };
  }

  public async getEvents(): Promise<readonly VmwareProviderEvent[]> {
    return MOCK_EVENTS;
  }

  public async getAlarms(): Promise<readonly VmwareAlarm[]> {
    return MOCK_ALARMS;
  }

  public async getTasks(): Promise<readonly VmwareTask[]> {
    return MOCK_TASKS;
  }

  public async refreshInventory(): Promise<{ readonly refreshedAt: string }> {
    return { refreshedAt: DATASET_TIMESTAMP };
  }

  public async testConnection(
    configuration: Readonly<VmwareProviderConfiguration>,
  ): Promise<VmwareConnectionTestResult> {
    return {
      connected: configuration.endpoint.startsWith('https://'),
      latencyMs: 22,
      message: 'VMware connection test succeeded through adapter abstraction.',
    };
  }

  public async discoverCapabilities(): Promise<readonly VmwareCapabilityDescriptor[]> {
    return Object.freeze([
      {
        id: 'vmware-inventory-discovery',
        name: 'inventory',
        version: '1.0.0',
        category: 'discovery',
      },
      {
        id: 'vmware-health-metrics',
        name: 'monitoring',
        version: '1.0.0',
        category: 'monitoring',
      },
      {
        id: 'vmware-operations',
        name: 'operations',
        version: '1.0.0',
        category: 'operations',
      },
    ]);
  }

  public async searchVirtualMachines(
    query: VmwareSearchQuery,
  ): Promise<readonly VmwareInventoryResource[]> {
    const needle = query.text.trim().toLowerCase();
    return this.byKind('virtualMachine').filter((vm) => vm.name.toLowerCase().includes(needle));
  }

  private byKind(kind: VmwareInventoryKind): readonly VmwareInventoryResource[] {
    return MOCK_INVENTORY.filter((resource) => resource.kind === kind);
  }
}

export class VmwareProvider extends BaseProvider<VmwareProviderConfiguration> {
  private readonly adapter: VmwareAdapter;
  private readonly configurationService: VmwareConfiguration;
  private readonly inventoryCache: VmwareInventoryCache;
  private readonly capabilityRegistry: VmwareCapabilityRegistry;

  public readonly vmPowerOperations: VmwareVmPowerOperations;
  public readonly snapshotOperations: VmwareSnapshotOperations;

  public constructor(
    options: {
      readonly manifest?: ProviderManifest<VmwareProviderConfiguration>;
      readonly adapter?: VmwareAdapter;
      readonly configurationService?: VmwareConfiguration;
      readonly inventoryCache?: VmwareInventoryCache;
      readonly capabilityRegistry?: VmwareCapabilityRegistry;
    } = {},
  ) {
    const configurationService = options.configurationService ?? new VmwareConfiguration();

    super({
      manifest:
        options.manifest ??
        new ProviderManifest<VmwareProviderConfiguration>({
          id: 'provider-vmware',
          name: 'VMware Enterprise Provider',
          metadata: new ProviderMetadata({
            description:
              'Production-grade VMware provider with adapter-isolated API integration seams.',
            version: new ProviderVersion('1.0.0'),
            vendor: 'InfraShield',
            tags: ['vmware', 'enterprise', 'provider-sdk'],
            healthStatus: 'healthy',
          }),
          capabilities: new ProviderCapabilities([
            new ToolCapability({ name: 'inventory' }),
            new ToolCapability({ name: 'monitoring' }),
            new ToolCapability({ name: 'operations' }),
          ]),
          configuration: new ProviderConfiguration<VmwareProviderConfiguration>({
            requiredFields: [
              'endpoint',
              'username',
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

    this.adapter = options.adapter ?? new MockVmwareAdapter();
    this.configurationService = configurationService;
    this.inventoryCache = options.inventoryCache ?? new VmwareInventoryCache();
    this.capabilityRegistry =
      options.capabilityRegistry ?? new VmwareCapabilityRegistry(this.manifest.id);
    this.vmPowerOperations = new VmwareInterfaceOnlyVmPowerOperations();
    this.snapshotOperations = new VmwareInterfaceOnlySnapshotOperations();
  }

  public resolveConfiguration(
    override?: Readonly<Partial<VmwareProviderConfiguration>>,
  ): Readonly<VmwareProviderConfiguration> {
    return this.configurationService.merge(override);
  }

  public async discoverInventory(): Promise<readonly VmwareInventoryResource[]> {
    const [
      datacenters,
      clusters,
      hosts,
      virtualMachines,
      resourcePools,
      folders,
      datastores,
      networks,
      templates,
      snapshots,
    ] = await Promise.all([
      this.adapter.listDatacenters(),
      this.adapter.listClusters(),
      this.adapter.listEsxiHosts(),
      this.adapter.listVirtualMachines(),
      this.adapter.listResourcePools(),
      this.adapter.listFolders(),
      this.adapter.listDatastores(),
      this.adapter.listNetworks(),
      this.adapter.listTemplates(),
      this.adapter.listSnapshots(),
    ]);

    return Object.freeze([
      ...datacenters,
      ...clusters,
      ...hosts,
      ...virtualMachines,
      ...resourcePools,
      ...folders,
      ...datastores,
      ...networks,
      ...templates,
      ...snapshots,
    ]);
  }

  public async refreshInventory(): Promise<VmwareInventoryCacheSnapshot> {
    const refresh = await this.adapter.refreshInventory();
    const resources = await this.discoverInventory();
    this.inventoryCache.update(resources, refresh.refreshedAt);
    return this.inventoryCache.getSnapshot();
  }

  public getInventoryCache(): VmwareInventoryCacheSnapshot {
    return this.inventoryCache.getSnapshot();
  }

  public async testConnection(
    override?: Readonly<Partial<VmwareProviderConfiguration>>,
  ): Promise<VmwareConnectionTestResult> {
    const resolved = this.resolveConfiguration(override);
    return this.adapter.testConnection(resolved);
  }

  public async discoverCapabilities(): Promise<readonly VmwareCapabilityDescriptor[]> {
    const [registeredCapabilities, adapterCapabilities] = await Promise.all([
      this.capabilityRegistry.list(),
      this.adapter.discoverCapabilities(),
    ]);

    const dedup = new Map<string, VmwareCapabilityDescriptor>();
    [...registeredCapabilities, ...adapterCapabilities].forEach((capability) => {
      dedup.set(capability.id, capability);
    });

    return Object.freeze([...dedup.values()]);
  }

  public async getHealth(): Promise<VmwareHealthStatus> {
    return this.adapter.getHealth();
  }

  public async getPerformanceMetrics(): Promise<readonly VmwarePerformanceMetric[]> {
    return this.adapter.getPerformanceMetrics();
  }

  public async getCapacity(): Promise<VmwareCapacitySummary> {
    return this.adapter.getCapacity();
  }

  public async getEvents(): Promise<readonly VmwareProviderEvent[]> {
    return this.adapter.getEvents();
  }

  public async getAlarms(): Promise<readonly VmwareAlarm[]> {
    return this.adapter.getAlarms();
  }

  public async getTasks(): Promise<readonly VmwareTask[]> {
    return this.adapter.getTasks();
  }

  public async searchVirtualMachines(
    query: VmwareSearchQuery,
  ): Promise<readonly VmwareInventoryResource[]> {
    if (this.inventoryCache.getSnapshot().resources.length > 0) {
      return this.inventoryCache.search({ ...query, kind: 'virtualMachine' });
    }
    return this.adapter.searchVirtualMachines(query);
  }
}

export class VmwareProviderFactory {
  private readonly registryService: ProviderRegistryService;

  public constructor(options: { readonly registryService?: ProviderRegistryService } = {}) {
    this.registryService = options.registryService ?? new ProviderRegistryService();
  }

  public create(options?: {
    readonly configurationOverride?: Readonly<Partial<VmwareProviderConfiguration>>;
    readonly adapter?: VmwareAdapter;
  }): VmwareProvider {
    const configurationService = new VmwareConfiguration();
    const provider = new VmwareProvider({
      adapter: options?.adapter,
      configurationService,
      manifest: new ProviderManifest<VmwareProviderConfiguration>({
        id: 'provider-vmware',
        name: 'VMware Enterprise Provider',
        metadata: new ProviderMetadata({
          description:
            'Production-grade VMware provider with adapter-isolated API integration seams.',
          version: new ProviderVersion('1.0.0'),
          vendor: 'InfraShield',
          tags: ['vmware', 'enterprise', 'provider-sdk'],
          healthStatus: 'healthy',
        }),
        capabilities: new ProviderCapabilities([
          new ToolCapability({ name: 'inventory' }),
          new ToolCapability({ name: 'monitoring' }),
          new ToolCapability({ name: 'operations' }),
        ]),
        configuration: new ProviderConfiguration<VmwareProviderConfiguration>({
          requiredFields: [
            'endpoint',
            'username',
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

export interface VmwareProviderRuntime {
  readonly provider: VmwareProvider;
  readonly registryService: ProviderRegistryService;
  readonly lifecycleManager: ProviderLifecycleManager;
  readonly capabilityResolver: CapabilityResolver;
  readonly authentication: ProviderAuthentication;
  readonly connectionManager: ProviderConnectionManager;
  readonly credentialStore: CredentialStore;
  readonly connectionPool: ConnectionPool;
  readonly capabilityRegistry: VmwareCapabilityRegistry;
}

export function createVmwareProviderRuntime(): VmwareProviderRuntime {
  const provider = new VmwareProvider();
  const registryService = new ProviderRegistryService();
  registryService.register(provider.manifest);

  const capabilityRegistry = new VmwareCapabilityRegistry(provider.manifest.id);
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
      message: 'VMware provider healthy.',
    })),
    recovery: new ProviderRecovery({
      maxAttempts: 2,
      recover: async () => true,
    }),
  });

  const credentialStore = new CredentialStore();
  const authentication = new ProviderAuthentication({
    credentialStore,
    autoStoreCredentials: true,
  });
  authentication.registerProvider(new VmwareAuthentication());

  const connectionFactory = new ConnectionFactory();
  const connectionPool = new ConnectionPool();
  connectionFactory.register(provider.manifest.id, (registeredProvider, context) => {
    const endpoint = String(context.configuration.endpoint);
    return new ProviderConnection({
      provider: registeredProvider,
      context,
      connect: async () => {
        const client = new VmwareConnection(endpoint);
        client.connect();
        return client;
      },
      disconnect: async (client) => {
        client?.disconnect();
      },
      checkHealth: async (client) =>
        new ConnectionHealth({
          status: client?.connectedAt ? 'connected' : 'degraded',
          latencyMs: 22,
          lastCheckedAt: DATASET_TIMESTAMP,
          message: 'VMware connection health.',
        }),
    });
  });

  const connectionManager = new ProviderConnectionManager({
    factory: connectionFactory,
    pool: connectionPool,
  });

  return {
    provider,
    registryService,
    lifecycleManager,
    capabilityResolver,
    authentication,
    connectionManager,
    credentialStore,
    connectionPool,
    capabilityRegistry,
  };
}
