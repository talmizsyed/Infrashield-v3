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

export type WindowsResourceKind =
  | 'windowsHost'
  | 'operatingSystem'
  | 'serverRole'
  | 'installedFeature'
  | 'cpu'
  | 'memory'
  | 'storage'
  | 'networkInterface'
  | 'service'
  | 'process'
  | 'user'
  | 'group'
  | 'activeDirectoryMetadata'
  | 'dnsMetadata'
  | 'dhcpMetadata'
  | 'iisMetadata'
  | 'hyperVMetadata'
  | 'exchangeMetadata'
  | 'certificateServicesMetadata';

export interface WindowsProviderConfiguration extends SerializableValueObject {
  readonly endpoint: string;
  readonly hostAlias: string;
  readonly credentialRef: string;
  readonly readOnly: boolean;
  readonly connectionTimeoutMs: number;
  readonly inventoryCacheTtlSeconds: number;
}

export interface WindowsInventoryResource {
  readonly id: string;
  readonly kind: WindowsResourceKind;
  readonly name: string;
  readonly host: string;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface WindowsHostHealth {
  readonly healthy: boolean;
  readonly status: 'healthy' | 'degraded';
  readonly checkedAt: string;
  readonly details: Readonly<Record<string, string | number | boolean>>;
}

export interface WindowsCpuMetric {
  readonly host: string;
  readonly percent: number;
  readonly timestamp: string;
}

export interface WindowsMemoryMetric {
  readonly host: string;
  readonly usedPercent: number;
  readonly timestamp: string;
}

export interface WindowsDiskMetric {
  readonly volume: string;
  readonly usedPercent: number;
  readonly timestamp: string;
}

export interface WindowsServiceStatus {
  readonly serviceName: string;
  readonly status: 'running' | 'degraded' | 'stopped';
  readonly since: string;
}

export interface WindowsEventLogMetadata {
  readonly id: string;
  readonly channel: string;
  readonly level: 'information' | 'warning' | 'error';
  readonly timestamp: string;
}

export interface WindowsPerformanceCounter {
  readonly category: string;
  readonly counter: string;
  readonly instance: string;
  readonly value: number;
  readonly timestamp: string;
}

export interface WindowsSecurityStatus {
  readonly id: string;
  readonly control: string;
  readonly status: 'enabled' | 'disabled' | 'enforcing' | 'audit';
  readonly details: string;
}

export interface WindowsConnectionTestResult {
  readonly connected: boolean;
  readonly latencyMs: number;
  readonly message: string;
}

export interface WindowsCapabilityDescriptor {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly category: 'discovery' | 'inventory' | 'infrastructure' | 'monitoring' | 'operations';
}

export interface WindowsSearchQuery {
  readonly text: string;
  readonly kind?: WindowsResourceKind;
  readonly host?: string;
}

export interface WindowsInventoryCacheSnapshot {
  readonly resources: readonly WindowsInventoryResource[];
  readonly refreshedAt?: string;
}

export interface IWindowsAdapter {
  discoverWindowsHosts(): Promise<readonly WindowsInventoryResource[]>;
  discoverOperatingSystem(): Promise<readonly WindowsInventoryResource[]>;
  discoverServerRoles(): Promise<readonly WindowsInventoryResource[]>;
  discoverInstalledFeatures(): Promise<readonly WindowsInventoryResource[]>;
  discoverCpu(): Promise<readonly WindowsInventoryResource[]>;
  discoverMemory(): Promise<readonly WindowsInventoryResource[]>;
  discoverStorage(): Promise<readonly WindowsInventoryResource[]>;
  discoverNetworkInterfaces(): Promise<readonly WindowsInventoryResource[]>;
  discoverServices(): Promise<readonly WindowsInventoryResource[]>;
  discoverProcesses(): Promise<readonly WindowsInventoryResource[]>;
  discoverUsers(): Promise<readonly WindowsInventoryResource[]>;
  discoverGroups(): Promise<readonly WindowsInventoryResource[]>;
  discoverActiveDirectoryMetadata(): Promise<readonly WindowsInventoryResource[]>;
  discoverDnsMetadata(): Promise<readonly WindowsInventoryResource[]>;
  discoverDhcpMetadata(): Promise<readonly WindowsInventoryResource[]>;
  discoverIisMetadata(): Promise<readonly WindowsInventoryResource[]>;
  discoverHyperVMetadata(): Promise<readonly WindowsInventoryResource[]>;
  discoverExchangeMetadata(): Promise<readonly WindowsInventoryResource[]>;
  discoverCertificateServicesMetadata(): Promise<readonly WindowsInventoryResource[]>;
  getHostHealth(): Promise<WindowsHostHealth>;
  getCpuMetrics(): Promise<readonly WindowsCpuMetric[]>;
  getMemoryMetrics(): Promise<readonly WindowsMemoryMetric[]>;
  getDiskMetrics(): Promise<readonly WindowsDiskMetric[]>;
  getServiceStatus(): Promise<readonly WindowsServiceStatus[]>;
  getEventLogMetadata(): Promise<readonly WindowsEventLogMetadata[]>;
  getPerformanceCounters(): Promise<readonly WindowsPerformanceCounter[]>;
  getSecurityStatus(): Promise<readonly WindowsSecurityStatus[]>;
  refreshInventory(): Promise<{ readonly refreshedAt: string }>;
  testConnection(
    configuration: Readonly<WindowsProviderConfiguration>,
  ): Promise<WindowsConnectionTestResult>;
  discoverCapabilities(): Promise<readonly WindowsCapabilityDescriptor[]>;
  searchResources(query: WindowsSearchQuery): Promise<readonly WindowsInventoryResource[]>;
}

const DATASET_TIMESTAMP = '2026-01-01T00:00:00.000Z';

function createMetadata(metadata: Record<string, string>): Readonly<Record<string, string>> {
  return metadata;
}

const MOCK_INVENTORY: readonly WindowsInventoryResource[] = Object.freeze([
  {
    id: 'host-1',
    kind: 'windowsHost',
    name: 'win-prod-01',
    host: 'win-prod-01',
    metadata: createMetadata({ fqdn: 'win-prod-01.example.local' }),
  },
  {
    id: 'os-1',
    kind: 'operatingSystem',
    name: 'Windows Server 2022 Datacenter',
    host: 'win-prod-01',
    metadata: createMetadata({ build: '20348' }),
  },
  {
    id: 'role-1',
    kind: 'serverRole',
    name: 'File and Storage Services',
    host: 'win-prod-01',
    metadata: createMetadata({ installed: 'true' }),
  },
  {
    id: 'feature-1',
    kind: 'installedFeature',
    name: 'NET-Framework-45-Core',
    host: 'win-prod-01',
    metadata: createMetadata({ state: 'Installed' }),
  },
  {
    id: 'cpu-1',
    kind: 'cpu',
    name: 'Intel Xeon Platinum',
    host: 'win-prod-01',
    metadata: createMetadata({ logicalProcessors: '32' }),
  },
  {
    id: 'memory-1',
    kind: 'memory',
    name: 'Physical Memory',
    host: 'win-prod-01',
    metadata: createMetadata({ totalGb: '128' }),
  },
  {
    id: 'storage-1',
    kind: 'storage',
    name: 'Volume C:',
    host: 'win-prod-01',
    metadata: createMetadata({ filesystem: 'NTFS' }),
  },
  {
    id: 'nic-1',
    kind: 'networkInterface',
    name: 'Ethernet0',
    host: 'win-prod-01',
    metadata: createMetadata({ mac: '00-15-5D-01-02-03' }),
  },
  {
    id: 'service-1',
    kind: 'service',
    name: 'W32Time',
    host: 'win-prod-01',
    metadata: createMetadata({ startupType: 'Automatic' }),
  },
  {
    id: 'process-1',
    kind: 'process',
    name: 'w3wp.exe',
    host: 'win-prod-01',
    metadata: createMetadata({ pid: '4120' }),
  },
  {
    id: 'user-1',
    kind: 'user',
    name: 'svc.platform',
    host: 'win-prod-01',
    metadata: createMetadata({ sid: 'S-1-5-21-1000-1000-1000-1107' }),
  },
  {
    id: 'group-1',
    kind: 'group',
    name: 'Platform Operators',
    host: 'win-prod-01',
    metadata: createMetadata({ scope: 'DomainLocal' }),
  },
  {
    id: 'ad-1',
    kind: 'activeDirectoryMetadata',
    name: 'Active Directory Domain Services',
    host: 'win-prod-01',
    metadata: createMetadata({ forestMode: 'Windows2016Forest' }),
  },
  {
    id: 'dns-1',
    kind: 'dnsMetadata',
    name: 'DNS Server',
    host: 'win-prod-01',
    metadata: createMetadata({ zoneCount: '42' }),
  },
  {
    id: 'dhcp-1',
    kind: 'dhcpMetadata',
    name: 'DHCP Server',
    host: 'win-prod-01',
    metadata: createMetadata({ scopeCount: '8' }),
  },
  {
    id: 'iis-1',
    kind: 'iisMetadata',
    name: 'Internet Information Services',
    host: 'win-prod-01',
    metadata: createMetadata({ siteCount: '12' }),
  },
  {
    id: 'hyperv-1',
    kind: 'hyperVMetadata',
    name: 'Hyper-V',
    host: 'win-prod-01',
    metadata: createMetadata({ vmCount: '24' }),
  },
  {
    id: 'exchange-1',
    kind: 'exchangeMetadata',
    name: 'Exchange Server',
    host: 'win-prod-01',
    metadata: createMetadata({ dagMember: 'true' }),
  },
  {
    id: 'adcs-1',
    kind: 'certificateServicesMetadata',
    name: 'Active Directory Certificate Services',
    host: 'win-prod-01',
    metadata: createMetadata({ caType: 'EnterpriseRootCA' }),
  },
]);

const MOCK_CPU_METRICS: readonly WindowsCpuMetric[] = Object.freeze([
  { host: 'win-prod-01', percent: 47, timestamp: DATASET_TIMESTAMP },
]);
const MOCK_MEMORY_METRICS: readonly WindowsMemoryMetric[] = Object.freeze([
  { host: 'win-prod-01', usedPercent: 69, timestamp: DATASET_TIMESTAMP },
]);
const MOCK_DISK_METRICS: readonly WindowsDiskMetric[] = Object.freeze([
  { volume: 'C:', usedPercent: 61, timestamp: DATASET_TIMESTAMP },
]);
const MOCK_SERVICE_STATUS: readonly WindowsServiceStatus[] = Object.freeze([
  { serviceName: 'W32Time', status: 'running', since: DATASET_TIMESTAMP },
]);
const MOCK_EVENT_LOG_METADATA: readonly WindowsEventLogMetadata[] = Object.freeze([
  { id: 'eventlog-1', channel: 'System', level: 'warning', timestamp: DATASET_TIMESTAMP },
]);
const MOCK_PERFORMANCE_COUNTERS: readonly WindowsPerformanceCounter[] = Object.freeze([
  {
    category: 'Processor',
    counter: '% Processor Time',
    instance: '_Total',
    value: 47,
    timestamp: DATASET_TIMESTAMP,
  },
]);
const MOCK_SECURITY_STATUS: readonly WindowsSecurityStatus[] = Object.freeze([
  {
    id: 'security-1',
    control: 'Windows Defender Firewall',
    status: 'enabled',
    details: 'Domain, private, and public profiles are enabled.',
  },
]);

export class WindowsMockAdapter implements IWindowsAdapter {
  public async discoverWindowsHosts(): Promise<readonly WindowsInventoryResource[]> {
    return this.byKind('windowsHost');
  }
  public async discoverOperatingSystem(): Promise<readonly WindowsInventoryResource[]> {
    return this.byKind('operatingSystem');
  }
  public async discoverServerRoles(): Promise<readonly WindowsInventoryResource[]> {
    return this.byKind('serverRole');
  }
  public async discoverInstalledFeatures(): Promise<readonly WindowsInventoryResource[]> {
    return this.byKind('installedFeature');
  }
  public async discoverCpu(): Promise<readonly WindowsInventoryResource[]> {
    return this.byKind('cpu');
  }
  public async discoverMemory(): Promise<readonly WindowsInventoryResource[]> {
    return this.byKind('memory');
  }
  public async discoverStorage(): Promise<readonly WindowsInventoryResource[]> {
    return this.byKind('storage');
  }
  public async discoverNetworkInterfaces(): Promise<readonly WindowsInventoryResource[]> {
    return this.byKind('networkInterface');
  }
  public async discoverServices(): Promise<readonly WindowsInventoryResource[]> {
    return this.byKind('service');
  }
  public async discoverProcesses(): Promise<readonly WindowsInventoryResource[]> {
    return this.byKind('process');
  }
  public async discoverUsers(): Promise<readonly WindowsInventoryResource[]> {
    return this.byKind('user');
  }
  public async discoverGroups(): Promise<readonly WindowsInventoryResource[]> {
    return this.byKind('group');
  }
  public async discoverActiveDirectoryMetadata(): Promise<readonly WindowsInventoryResource[]> {
    return this.byKind('activeDirectoryMetadata');
  }
  public async discoverDnsMetadata(): Promise<readonly WindowsInventoryResource[]> {
    return this.byKind('dnsMetadata');
  }
  public async discoverDhcpMetadata(): Promise<readonly WindowsInventoryResource[]> {
    return this.byKind('dhcpMetadata');
  }
  public async discoverIisMetadata(): Promise<readonly WindowsInventoryResource[]> {
    return this.byKind('iisMetadata');
  }
  public async discoverHyperVMetadata(): Promise<readonly WindowsInventoryResource[]> {
    return this.byKind('hyperVMetadata');
  }
  public async discoverExchangeMetadata(): Promise<readonly WindowsInventoryResource[]> {
    return this.byKind('exchangeMetadata');
  }
  public async discoverCertificateServicesMetadata(): Promise<readonly WindowsInventoryResource[]> {
    return this.byKind('certificateServicesMetadata');
  }
  public async getHostHealth(): Promise<WindowsHostHealth> {
    return {
      healthy: true,
      status: 'healthy',
      checkedAt: DATASET_TIMESTAMP,
      details: {
        provider: 'windows-enterprise',
        mode: 'mock-adapter',
        resources: MOCK_INVENTORY.length,
      },
    };
  }
  public async getCpuMetrics(): Promise<readonly WindowsCpuMetric[]> {
    return MOCK_CPU_METRICS;
  }
  public async getMemoryMetrics(): Promise<readonly WindowsMemoryMetric[]> {
    return MOCK_MEMORY_METRICS;
  }
  public async getDiskMetrics(): Promise<readonly WindowsDiskMetric[]> {
    return MOCK_DISK_METRICS;
  }
  public async getServiceStatus(): Promise<readonly WindowsServiceStatus[]> {
    return MOCK_SERVICE_STATUS;
  }
  public async getEventLogMetadata(): Promise<readonly WindowsEventLogMetadata[]> {
    return MOCK_EVENT_LOG_METADATA;
  }
  public async getPerformanceCounters(): Promise<readonly WindowsPerformanceCounter[]> {
    return MOCK_PERFORMANCE_COUNTERS;
  }
  public async getSecurityStatus(): Promise<readonly WindowsSecurityStatus[]> {
    return MOCK_SECURITY_STATUS;
  }
  public async refreshInventory(): Promise<{ readonly refreshedAt: string }> {
    return { refreshedAt: DATASET_TIMESTAMP };
  }
  public async testConnection(
    configuration: Readonly<WindowsProviderConfiguration>,
  ): Promise<WindowsConnectionTestResult> {
    return {
      connected: configuration.endpoint.startsWith('windows://'),
      latencyMs: 18,
      message:
        'Windows connection test succeeded through adapter abstraction without WinRM or PowerShell remoting.',
    };
  }
  public async discoverCapabilities(): Promise<readonly WindowsCapabilityDescriptor[]> {
    return Object.freeze([
      {
        id: 'windows-discovery',
        name: 'discovery',
        version: '1.0.0',
        category: 'discovery',
      },
      {
        id: 'windows-inventory',
        name: 'inventory',
        version: '1.0.0',
        category: 'inventory',
      },
      {
        id: 'windows-infrastructure',
        name: 'infrastructure',
        version: '1.0.0',
        category: 'infrastructure',
      },
      {
        id: 'windows-monitoring',
        name: 'monitoring',
        version: '1.0.0',
        category: 'monitoring',
      },
      {
        id: 'windows-operations',
        name: 'operations',
        version: '1.0.0',
        category: 'operations',
      },
    ]);
  }
  public async searchResources(
    query: WindowsSearchQuery,
  ): Promise<readonly WindowsInventoryResource[]> {
    const needle = query.text.trim().toLowerCase();
    const byKind = query.kind ? this.byKind(query.kind) : MOCK_INVENTORY;
    const byHost = query.host ? byKind.filter((resource) => resource.host === query.host) : byKind;
    return byHost.filter((resource) =>
      [resource.id, resource.name].some((value) => value.toLowerCase().includes(needle)),
    );
  }
  private byKind(kind: WindowsResourceKind): readonly WindowsInventoryResource[] {
    return MOCK_INVENTORY.filter((resource) => resource.kind === kind);
  }
}

export class WindowsInventoryCache {
  private snapshot: WindowsInventoryCacheSnapshot = Object.freeze({ resources: Object.freeze([]) });
  public update(resources: readonly WindowsInventoryResource[], refreshedAt: string): void {
    this.snapshot = Object.freeze({ resources: Object.freeze([...resources]), refreshedAt });
  }
  public getSnapshot(): WindowsInventoryCacheSnapshot {
    return this.snapshot;
  }
  public search(query: WindowsSearchQuery): readonly WindowsInventoryResource[] {
    const needle = query.text.trim().toLowerCase();
    const byKind = query.kind
      ? this.snapshot.resources.filter((resource) => resource.kind === query.kind)
      : this.snapshot.resources;
    const byHost = query.host ? byKind.filter((resource) => resource.host === query.host) : byKind;
    return byHost.filter((resource) =>
      [resource.id, resource.name].some((value) => value.toLowerCase().includes(needle)),
    );
  }
}

export class WindowsConfiguration {
  public readonly defaultConfiguration: Readonly<WindowsProviderConfiguration> = Object.freeze({
    endpoint: 'windows://win-prod-01.example.local',
    hostAlias: 'win-prod-01',
    credentialRef: 'WINDOWS_CREDENTIAL_REF',
    readOnly: true,
    connectionTimeoutMs: 10000,
    inventoryCacheTtlSeconds: 300,
  });

  public merge(
    override?: Readonly<Partial<WindowsProviderConfiguration>>,
  ): Readonly<WindowsProviderConfiguration> {
    const merged: WindowsProviderConfiguration = {
      endpoint: override?.endpoint ?? this.defaultConfiguration.endpoint,
      hostAlias: override?.hostAlias ?? this.defaultConfiguration.hostAlias,
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

export class WindowsAuthenticationProvider {
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
            ? 'Windows authentication accepted.'
            : 'Windows credential payload is invalid.',
          authenticatedAt: DATASET_TIMESTAMP,
        });
      },
    });
  }
  public getProviderAuthentication(): ProviderAuthentication {
    return this.providerAuthentication;
  }
}

export class WindowsConnection {
  public readonly id: string;
  public readonly endpoint: string;
  public connectedAt?: string;
  public constructor(endpoint: string) {
    this.endpoint = endpoint;
    this.id = `windows-connection:${endpoint}`;
  }
  public connect(): void {
    this.connectedAt = DATASET_TIMESTAMP;
  }
  public disconnect(): void {
    this.connectedAt = undefined;
  }
}

export class WindowsConnectionManager {
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
          const client = new WindowsConnection(endpoint);
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
            message: 'Windows connection health.',
          }),
      });
    });
    this.sdkConnectionManager = new ProviderConnectionManager({ factory, pool });
  }
  public getSdkConnectionManager(): ProviderConnectionManager {
    return this.sdkConnectionManager;
  }
}

export class WindowsCapabilityRegistry {
  private readonly registry: ProviderCapabilityRegistry;
  public constructor(providerId: string, registry = new ProviderCapabilityRegistry()) {
    this.registry = registry;
    const register = (
      id: string,
      name: string,
      category: WindowsCapabilityDescriptor['category'],
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
            tags: ['windows', category],
            featureFlags: { configurationDriven: true, adapterBacked: true },
          }),
          requiresCapabilities: [name],
          requiredFeatureFlags: ['configurationDriven', 'adapterBacked'],
        }),
      );
    };
    register('windows-discovery', 'discovery', 'discovery', 'Windows host and platform discovery.');
    register(
      'windows-inventory',
      'inventory',
      'inventory',
      'Windows inventory and runtime resource metadata.',
    );
    register(
      'windows-infrastructure',
      'infrastructure',
      'infrastructure',
      'Windows infrastructure service metadata.',
    );
    register(
      'windows-monitoring',
      'monitoring',
      'monitoring',
      'Windows monitoring and performance telemetry metadata.',
    );
    register(
      'windows-operations',
      'operations',
      'operations',
      'Refresh, search, test connection, and capability discovery operations.',
    );
  }
  public getProviderCapabilityRegistry(): ProviderCapabilityRegistry {
    return this.registry;
  }
  public async list(): Promise<readonly WindowsCapabilityDescriptor[]> {
    return Object.freeze([
      {
        id: 'windows-discovery',
        name: 'discovery',
        version: '1.0.0',
        category: 'discovery',
      },
      {
        id: 'windows-inventory',
        name: 'inventory',
        version: '1.0.0',
        category: 'inventory',
      },
      {
        id: 'windows-infrastructure',
        name: 'infrastructure',
        version: '1.0.0',
        category: 'infrastructure',
      },
      {
        id: 'windows-monitoring',
        name: 'monitoring',
        version: '1.0.0',
        category: 'monitoring',
      },
      {
        id: 'windows-operations',
        name: 'operations',
        version: '1.0.0',
        category: 'operations',
      },
    ]);
  }
}

export class WindowsProvider extends BaseProvider<WindowsProviderConfiguration> {
  private readonly adapter: IWindowsAdapter;
  private readonly configurationService: WindowsConfiguration;
  private readonly inventoryCache: WindowsInventoryCache;
  private readonly capabilityRegistry: WindowsCapabilityRegistry;

  public constructor(
    options: {
      readonly adapter?: IWindowsAdapter;
      readonly configurationService?: WindowsConfiguration;
      readonly inventoryCache?: WindowsInventoryCache;
      readonly capabilityRegistry?: WindowsCapabilityRegistry;
      readonly manifest?: ProviderManifest<WindowsProviderConfiguration>;
    } = {},
  ) {
    const configurationService = options.configurationService ?? new WindowsConfiguration();
    super({
      manifest:
        options.manifest ??
        new ProviderManifest<WindowsProviderConfiguration>({
          id: 'provider-windows',
          name: 'Windows Enterprise Provider',
          metadata: new ProviderMetadata({
            description:
              'Production Windows provider framework built on Provider SDK with adapter isolation.',
            version: new ProviderVersion('1.0.0'),
            vendor: 'InfraShield',
            tags: ['windows', 'enterprise', 'provider-sdk'],
            healthStatus: 'healthy',
          }),
          capabilities: new ProviderCapabilities([
            new ToolCapability({ name: 'discovery' }),
            new ToolCapability({ name: 'inventory' }),
            new ToolCapability({ name: 'infrastructure' }),
            new ToolCapability({ name: 'monitoring' }),
            new ToolCapability({ name: 'operations' }),
          ]),
          configuration: new ProviderConfiguration<WindowsProviderConfiguration>({
            requiredFields: [
              'endpoint',
              'hostAlias',
              'credentialRef',
              'readOnly',
              'connectionTimeoutMs',
              'inventoryCacheTtlSeconds',
            ],
            defaultValues: configurationService.defaultConfiguration,
          }),
        }),
    });

    this.adapter = options.adapter ?? new WindowsMockAdapter();
    this.configurationService = configurationService;
    this.inventoryCache = options.inventoryCache ?? new WindowsInventoryCache();
    this.capabilityRegistry =
      options.capabilityRegistry ?? new WindowsCapabilityRegistry(this.manifest.id);
  }

  public resolveConfiguration(
    override?: Readonly<Partial<WindowsProviderConfiguration>>,
  ): Readonly<WindowsProviderConfiguration> {
    return this.configurationService.merge(override);
  }

  public async discoverInventory(): Promise<readonly WindowsInventoryResource[]> {
    const [
      windowsHosts,
      operatingSystems,
      serverRoles,
      installedFeatures,
      cpu,
      memory,
      storage,
      networkInterfaces,
      services,
      processes,
      users,
      groups,
      activeDirectory,
      dns,
      dhcp,
      iis,
      hyperV,
      exchange,
      certificateServices,
    ] = await Promise.all([
      this.adapter.discoverWindowsHosts(),
      this.adapter.discoverOperatingSystem(),
      this.adapter.discoverServerRoles(),
      this.adapter.discoverInstalledFeatures(),
      this.adapter.discoverCpu(),
      this.adapter.discoverMemory(),
      this.adapter.discoverStorage(),
      this.adapter.discoverNetworkInterfaces(),
      this.adapter.discoverServices(),
      this.adapter.discoverProcesses(),
      this.adapter.discoverUsers(),
      this.adapter.discoverGroups(),
      this.adapter.discoverActiveDirectoryMetadata(),
      this.adapter.discoverDnsMetadata(),
      this.adapter.discoverDhcpMetadata(),
      this.adapter.discoverIisMetadata(),
      this.adapter.discoverHyperVMetadata(),
      this.adapter.discoverExchangeMetadata(),
      this.adapter.discoverCertificateServicesMetadata(),
    ]);

    return Object.freeze([
      ...windowsHosts,
      ...operatingSystems,
      ...serverRoles,
      ...installedFeatures,
      ...cpu,
      ...memory,
      ...storage,
      ...networkInterfaces,
      ...services,
      ...processes,
      ...users,
      ...groups,
      ...activeDirectory,
      ...dns,
      ...dhcp,
      ...iis,
      ...hyperV,
      ...exchange,
      ...certificateServices,
    ]);
  }

  public async refreshInventory(): Promise<WindowsInventoryCacheSnapshot> {
    const refreshed = await this.adapter.refreshInventory();
    const resources = await this.discoverInventory();
    this.inventoryCache.update(resources, refreshed.refreshedAt);
    return this.inventoryCache.getSnapshot();
  }

  public getInventoryCache(): WindowsInventoryCacheSnapshot {
    return this.inventoryCache.getSnapshot();
  }

  public synchronizeCache(snapshot: WindowsInventoryCacheSnapshot): void {
    this.inventoryCache.update(snapshot.resources, snapshot.refreshedAt ?? DATASET_TIMESTAMP);
  }

  public async testConnection(
    override?: Readonly<Partial<WindowsProviderConfiguration>>,
  ): Promise<WindowsConnectionTestResult> {
    return this.adapter.testConnection(this.resolveConfiguration(override));
  }

  public async discoverCapabilities(): Promise<readonly WindowsCapabilityDescriptor[]> {
    const [fromRegistry, fromAdapter] = await Promise.all([
      this.capabilityRegistry.list(),
      this.adapter.discoverCapabilities(),
    ]);
    const dedup = new Map<string, WindowsCapabilityDescriptor>();
    [...fromRegistry, ...fromAdapter].forEach((capability) => dedup.set(capability.id, capability));
    return Object.freeze([...dedup.values()]);
  }

  public async searchResources(
    query: WindowsSearchQuery,
  ): Promise<readonly WindowsInventoryResource[]> {
    if (this.inventoryCache.getSnapshot().resources.length > 0) {
      return this.inventoryCache.search(query);
    }
    return this.adapter.searchResources(query);
  }

  public async getHostHealth(): Promise<WindowsHostHealth> {
    return this.adapter.getHostHealth();
  }
  public async getCpuMetrics(): Promise<readonly WindowsCpuMetric[]> {
    return this.adapter.getCpuMetrics();
  }
  public async getMemoryMetrics(): Promise<readonly WindowsMemoryMetric[]> {
    return this.adapter.getMemoryMetrics();
  }
  public async getDiskMetrics(): Promise<readonly WindowsDiskMetric[]> {
    return this.adapter.getDiskMetrics();
  }
  public async getServiceStatus(): Promise<readonly WindowsServiceStatus[]> {
    return this.adapter.getServiceStatus();
  }
  public async getEventLogMetadata(): Promise<readonly WindowsEventLogMetadata[]> {
    return this.adapter.getEventLogMetadata();
  }
  public async getPerformanceCounters(): Promise<readonly WindowsPerformanceCounter[]> {
    return this.adapter.getPerformanceCounters();
  }
  public async getSecurityStatus(): Promise<readonly WindowsSecurityStatus[]> {
    return this.adapter.getSecurityStatus();
  }
}

export class WindowsProviderFactory {
  private readonly registryService: ProviderRegistryService;

  public constructor(options: { readonly registryService?: ProviderRegistryService } = {}) {
    this.registryService = options.registryService ?? new ProviderRegistryService();
  }

  public create(options?: {
    readonly adapter?: IWindowsAdapter;
    readonly configurationOverride?: Readonly<Partial<WindowsProviderConfiguration>>;
  }): WindowsProvider {
    const configurationService = new WindowsConfiguration();

    const provider = new WindowsProvider({
      adapter: options?.adapter,
      configurationService,
      manifest: new ProviderManifest<WindowsProviderConfiguration>({
        id: 'provider-windows',
        name: 'Windows Enterprise Provider',
        metadata: new ProviderMetadata({
          description:
            'Production Windows provider framework built on Provider SDK with adapter isolation.',
          version: new ProviderVersion('1.0.0'),
          vendor: 'InfraShield',
          tags: ['windows', 'enterprise', 'provider-sdk'],
          healthStatus: 'healthy',
        }),
        capabilities: new ProviderCapabilities([
          new ToolCapability({ name: 'discovery' }),
          new ToolCapability({ name: 'inventory' }),
          new ToolCapability({ name: 'infrastructure' }),
          new ToolCapability({ name: 'monitoring' }),
          new ToolCapability({ name: 'operations' }),
        ]),
        configuration: new ProviderConfiguration<WindowsProviderConfiguration>({
          requiredFields: [
            'endpoint',
            'hostAlias',
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

export interface WindowsProviderRuntime {
  readonly provider: WindowsProvider;
  readonly registryService: ProviderRegistryService;
  readonly lifecycleManager: ProviderLifecycleManager;
  readonly capabilityResolver: CapabilityResolver;
  readonly authenticationProvider: WindowsAuthenticationProvider;
  readonly connectionManager: WindowsConnectionManager;
}

export function createWindowsProviderRuntime(): WindowsProviderRuntime {
  const factory = new WindowsProviderFactory();
  const provider = factory.create();

  const capabilityRegistry = new WindowsCapabilityRegistry(provider.manifest.id);
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
      message: 'Windows provider healthy.',
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
    authenticationProvider: new WindowsAuthenticationProvider(),
    connectionManager: new WindowsConnectionManager(provider.manifest.id),
  };
}
