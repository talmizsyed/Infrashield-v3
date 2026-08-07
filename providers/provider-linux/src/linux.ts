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

export type LinuxResourceKind =
  | 'host'
  | 'operatingSystem'
  | 'distribution'
  | 'kernel'
  | 'cpu'
  | 'memory'
  | 'numa'
  | 'filesystem'
  | 'mountPoint'
  | 'blockDevice'
  | 'networkInterface'
  | 'installedPackage'
  | 'runningService'
  | 'process'
  | 'user'
  | 'group'
  | 'systemdService'
  | 'crontab'
  | 'sshConfiguration'
  | 'firewall'
  | 'selinuxOrApparmor'
  | 'kernelParameter'
  | 'environmentInformation';

export interface LinuxProviderConfiguration extends SerializableValueObject {
  readonly endpoint: string;
  readonly hostAlias: string;
  readonly credentialRef: string;
  readonly readOnly: boolean;
  readonly connectionTimeoutMs: number;
  readonly inventoryCacheTtlSeconds: number;
}

export interface LinuxInventoryResource {
  readonly id: string;
  readonly kind: LinuxResourceKind;
  readonly name: string;
  readonly host: string;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface LinuxSystemHealth {
  readonly healthy: boolean;
  readonly status: 'healthy' | 'degraded';
  readonly checkedAt: string;
  readonly details: Readonly<Record<string, string | number | boolean>>;
}

export interface LinuxCpuUtilization {
  readonly host: string;
  readonly percent: number;
  readonly timestamp: string;
}

export interface LinuxMemoryUtilization {
  readonly host: string;
  readonly usedPercent: number;
  readonly timestamp: string;
}

export interface LinuxDiskUtilization {
  readonly mountPoint: string;
  readonly usedPercent: number;
  readonly timestamp: string;
}

export interface LinuxFilesystemHealth {
  readonly filesystem: string;
  readonly healthy: boolean;
  readonly message: string;
}

export interface LinuxNetworkStatistic {
  readonly interfaceName: string;
  readonly rxBytesPerSec: number;
  readonly txBytesPerSec: number;
  readonly timestamp: string;
}

export interface LinuxProcessStatistic {
  readonly processName: string;
  readonly pid: number;
  readonly cpuPercent: number;
  readonly memoryPercent: number;
}

export interface LinuxServiceStatus {
  readonly serviceName: string;
  readonly status: 'running' | 'degraded' | 'stopped';
  readonly since: string;
}

export interface LinuxLogMetadata {
  readonly id: string;
  readonly source: string;
  readonly level: 'info' | 'warning' | 'error';
  readonly timestamp: string;
}

export interface LinuxSecurityMetadata {
  readonly id: string;
  readonly control: string;
  readonly status: 'enabled' | 'disabled' | 'enforcing' | 'permissive';
  readonly details: string;
}

export interface LinuxConnectionTestResult {
  readonly connected: boolean;
  readonly latencyMs: number;
  readonly message: string;
}

export interface LinuxCapabilityDescriptor {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly category: 'discovery' | 'inventory' | 'monitoring' | 'administration' | 'operations';
}

export interface LinuxSearchQuery {
  readonly text: string;
  readonly kind?: LinuxResourceKind;
  readonly host?: string;
}

export interface LinuxInventoryCacheSnapshot {
  readonly resources: readonly LinuxInventoryResource[];
  readonly refreshedAt?: string;
}

export interface ILinuxAdapter {
  discoverHosts(): Promise<readonly LinuxInventoryResource[]>;
  discoverOperatingSystems(): Promise<readonly LinuxInventoryResource[]>;
  discoverDistributions(): Promise<readonly LinuxInventoryResource[]>;
  discoverKernels(): Promise<readonly LinuxInventoryResource[]>;
  discoverCpu(): Promise<readonly LinuxInventoryResource[]>;
  discoverMemory(): Promise<readonly LinuxInventoryResource[]>;
  discoverNuma(): Promise<readonly LinuxInventoryResource[]>;
  discoverFilesystems(): Promise<readonly LinuxInventoryResource[]>;
  discoverMountPoints(): Promise<readonly LinuxInventoryResource[]>;
  discoverBlockDevices(): Promise<readonly LinuxInventoryResource[]>;
  discoverNetworkInterfaces(): Promise<readonly LinuxInventoryResource[]>;
  discoverInstalledPackages(): Promise<readonly LinuxInventoryResource[]>;
  discoverRunningServices(): Promise<readonly LinuxInventoryResource[]>;
  discoverProcesses(): Promise<readonly LinuxInventoryResource[]>;
  discoverUsers(): Promise<readonly LinuxInventoryResource[]>;
  discoverGroups(): Promise<readonly LinuxInventoryResource[]>;
  discoverSystemdServices(): Promise<readonly LinuxInventoryResource[]>;
  discoverCrontab(): Promise<readonly LinuxInventoryResource[]>;
  discoverSshConfiguration(): Promise<readonly LinuxInventoryResource[]>;
  discoverFirewall(): Promise<readonly LinuxInventoryResource[]>;
  discoverSelinuxOrApparmor(): Promise<readonly LinuxInventoryResource[]>;
  discoverKernelParameters(): Promise<readonly LinuxInventoryResource[]>;
  discoverEnvironmentInformation(): Promise<readonly LinuxInventoryResource[]>;
  getCpuUtilization(): Promise<readonly LinuxCpuUtilization[]>;
  getMemoryUtilization(): Promise<readonly LinuxMemoryUtilization[]>;
  getDiskUtilization(): Promise<readonly LinuxDiskUtilization[]>;
  getFilesystemHealth(): Promise<readonly LinuxFilesystemHealth[]>;
  getNetworkStatistics(): Promise<readonly LinuxNetworkStatistic[]>;
  getProcessStatistics(): Promise<readonly LinuxProcessStatistic[]>;
  getServiceStatus(): Promise<readonly LinuxServiceStatus[]>;
  getSystemHealth(): Promise<LinuxSystemHealth>;
  getLogsMetadata(): Promise<readonly LinuxLogMetadata[]>;
  getSecurityMetadata(): Promise<readonly LinuxSecurityMetadata[]>;
  refreshInventory(): Promise<{ readonly refreshedAt: string }>;
  testConnection(
    configuration: Readonly<LinuxProviderConfiguration>,
  ): Promise<LinuxConnectionTestResult>;
  discoverCapabilities(): Promise<readonly LinuxCapabilityDescriptor[]>;
  searchResources(query: LinuxSearchQuery): Promise<readonly LinuxInventoryResource[]>;
}

const DATASET_TIMESTAMP = '2026-01-01T00:00:00.000Z';

function createMetadata(metadata: Record<string, string>): Readonly<Record<string, string>> {
  return metadata;
}

const MOCK_INVENTORY: readonly LinuxInventoryResource[] = Object.freeze([
  {
    id: 'host-1',
    kind: 'host',
    name: 'linux-prod-01',
    host: 'linux-prod-01',
    metadata: createMetadata({ fqdn: 'linux-prod-01.example.local' }),
  },
  {
    id: 'os-1',
    kind: 'operatingSystem',
    name: 'Linux',
    host: 'linux-prod-01',
    metadata: createMetadata({ family: 'unix' }),
  },
  {
    id: 'distro-1',
    kind: 'distribution',
    name: 'Red Hat Enterprise Linux',
    host: 'linux-prod-01',
    metadata: createMetadata({ version: '9.4' }),
  },
  {
    id: 'kernel-1',
    kind: 'kernel',
    name: '5.14.0-427',
    host: 'linux-prod-01',
    metadata: createMetadata({ release: 'el9' }),
  },
  {
    id: 'cpu-1',
    kind: 'cpu',
    name: 'Intel Xeon Gold',
    host: 'linux-prod-01',
    metadata: createMetadata({ cores: '32' }),
  },
  {
    id: 'memory-1',
    kind: 'memory',
    name: 'Physical Memory',
    host: 'linux-prod-01',
    metadata: createMetadata({ totalGb: '256' }),
  },
  {
    id: 'numa-1',
    kind: 'numa',
    name: 'NUMA Node 0',
    host: 'linux-prod-01',
    metadata: createMetadata({ cpus: '0-15' }),
  },
  {
    id: 'fs-1',
    kind: 'filesystem',
    name: 'xfs-root',
    host: 'linux-prod-01',
    metadata: createMetadata({ fsType: 'xfs' }),
  },
  {
    id: 'mount-1',
    kind: 'mountPoint',
    name: '/',
    host: 'linux-prod-01',
    metadata: createMetadata({ device: '/dev/mapper/rootvg-rootlv' }),
  },
  {
    id: 'blk-1',
    kind: 'blockDevice',
    name: '/dev/sda',
    host: 'linux-prod-01',
    metadata: createMetadata({ sizeGb: '1024' }),
  },
  {
    id: 'nic-1',
    kind: 'networkInterface',
    name: 'ens192',
    host: 'linux-prod-01',
    metadata: createMetadata({ mac: '00:50:56:aa:bb:cc' }),
  },
  {
    id: 'pkg-1',
    kind: 'installedPackage',
    name: 'openssh-server',
    host: 'linux-prod-01',
    metadata: createMetadata({ version: '8.7p1' }),
  },
  {
    id: 'svc-1',
    kind: 'runningService',
    name: 'sshd',
    host: 'linux-prod-01',
    metadata: createMetadata({ state: 'running' }),
  },
  {
    id: 'proc-1',
    kind: 'process',
    name: 'java',
    host: 'linux-prod-01',
    metadata: createMetadata({ pid: '31822' }),
  },
  {
    id: 'user-1',
    kind: 'user',
    name: 'platform',
    host: 'linux-prod-01',
    metadata: createMetadata({ uid: '1001' }),
  },
  {
    id: 'group-1',
    kind: 'group',
    name: 'platform',
    host: 'linux-prod-01',
    metadata: createMetadata({ gid: '1001' }),
  },
  {
    id: 'systemd-1',
    kind: 'systemdService',
    name: 'chronyd.service',
    host: 'linux-prod-01',
    metadata: createMetadata({ enabled: 'true' }),
  },
  {
    id: 'cron-1',
    kind: 'crontab',
    name: 'nightly-maintenance',
    host: 'linux-prod-01',
    metadata: createMetadata({ schedule: '0 1 * * *' }),
  },
  {
    id: 'sshcfg-1',
    kind: 'sshConfiguration',
    name: '/etc/ssh/sshd_config',
    host: 'linux-prod-01',
    metadata: createMetadata({ permitRootLogin: 'no' }),
  },
  {
    id: 'fw-1',
    kind: 'firewall',
    name: 'firewalld',
    host: 'linux-prod-01',
    metadata: createMetadata({ defaultZone: 'public' }),
  },
  {
    id: 'selinux-1',
    kind: 'selinuxOrApparmor',
    name: 'SELinux',
    host: 'linux-prod-01',
    metadata: createMetadata({ mode: 'enforcing' }),
  },
  {
    id: 'sysctl-1',
    kind: 'kernelParameter',
    name: 'vm.swappiness',
    host: 'linux-prod-01',
    metadata: createMetadata({ value: '10' }),
  },
  {
    id: 'env-1',
    kind: 'environmentInformation',
    name: 'runtime-environment',
    host: 'linux-prod-01',
    metadata: createMetadata({ timezone: 'UTC' }),
  },
]);

const MOCK_CPU: readonly LinuxCpuUtilization[] = Object.freeze([
  { host: 'linux-prod-01', percent: 42, timestamp: DATASET_TIMESTAMP },
]);
const MOCK_MEMORY: readonly LinuxMemoryUtilization[] = Object.freeze([
  { host: 'linux-prod-01', usedPercent: 63, timestamp: DATASET_TIMESTAMP },
]);
const MOCK_DISK: readonly LinuxDiskUtilization[] = Object.freeze([
  { mountPoint: '/', usedPercent: 58, timestamp: DATASET_TIMESTAMP },
]);
const MOCK_FS_HEALTH: readonly LinuxFilesystemHealth[] = Object.freeze([
  { filesystem: 'xfs-root', healthy: true, message: 'Filesystem healthy' },
]);
const MOCK_NET: readonly LinuxNetworkStatistic[] = Object.freeze([
  {
    interfaceName: 'ens192',
    rxBytesPerSec: 824000,
    txBytesPerSec: 742000,
    timestamp: DATASET_TIMESTAMP,
  },
]);
const MOCK_PROC: readonly LinuxProcessStatistic[] = Object.freeze([
  { processName: 'java', pid: 31822, cpuPercent: 22, memoryPercent: 31 },
]);
const MOCK_SERVICE_STATUS: readonly LinuxServiceStatus[] = Object.freeze([
  { serviceName: 'sshd', status: 'running', since: DATASET_TIMESTAMP },
]);
const MOCK_LOGS: readonly LinuxLogMetadata[] = Object.freeze([
  { id: 'log-1', source: 'journald', level: 'warning', timestamp: DATASET_TIMESTAMP },
]);
const MOCK_SECURITY: readonly LinuxSecurityMetadata[] = Object.freeze([
  { id: 'sec-1', control: 'SELinux', status: 'enforcing', details: 'Policy targeted' },
]);

export class LinuxMockAdapter implements ILinuxAdapter {
  public async discoverHosts(): Promise<readonly LinuxInventoryResource[]> {
    return this.byKind('host');
  }
  public async discoverOperatingSystems(): Promise<readonly LinuxInventoryResource[]> {
    return this.byKind('operatingSystem');
  }
  public async discoverDistributions(): Promise<readonly LinuxInventoryResource[]> {
    return this.byKind('distribution');
  }
  public async discoverKernels(): Promise<readonly LinuxInventoryResource[]> {
    return this.byKind('kernel');
  }
  public async discoverCpu(): Promise<readonly LinuxInventoryResource[]> {
    return this.byKind('cpu');
  }
  public async discoverMemory(): Promise<readonly LinuxInventoryResource[]> {
    return this.byKind('memory');
  }
  public async discoverNuma(): Promise<readonly LinuxInventoryResource[]> {
    return this.byKind('numa');
  }
  public async discoverFilesystems(): Promise<readonly LinuxInventoryResource[]> {
    return this.byKind('filesystem');
  }
  public async discoverMountPoints(): Promise<readonly LinuxInventoryResource[]> {
    return this.byKind('mountPoint');
  }
  public async discoverBlockDevices(): Promise<readonly LinuxInventoryResource[]> {
    return this.byKind('blockDevice');
  }
  public async discoverNetworkInterfaces(): Promise<readonly LinuxInventoryResource[]> {
    return this.byKind('networkInterface');
  }
  public async discoverInstalledPackages(): Promise<readonly LinuxInventoryResource[]> {
    return this.byKind('installedPackage');
  }
  public async discoverRunningServices(): Promise<readonly LinuxInventoryResource[]> {
    return this.byKind('runningService');
  }
  public async discoverProcesses(): Promise<readonly LinuxInventoryResource[]> {
    return this.byKind('process');
  }
  public async discoverUsers(): Promise<readonly LinuxInventoryResource[]> {
    return this.byKind('user');
  }
  public async discoverGroups(): Promise<readonly LinuxInventoryResource[]> {
    return this.byKind('group');
  }
  public async discoverSystemdServices(): Promise<readonly LinuxInventoryResource[]> {
    return this.byKind('systemdService');
  }
  public async discoverCrontab(): Promise<readonly LinuxInventoryResource[]> {
    return this.byKind('crontab');
  }
  public async discoverSshConfiguration(): Promise<readonly LinuxInventoryResource[]> {
    return this.byKind('sshConfiguration');
  }
  public async discoverFirewall(): Promise<readonly LinuxInventoryResource[]> {
    return this.byKind('firewall');
  }
  public async discoverSelinuxOrApparmor(): Promise<readonly LinuxInventoryResource[]> {
    return this.byKind('selinuxOrApparmor');
  }
  public async discoverKernelParameters(): Promise<readonly LinuxInventoryResource[]> {
    return this.byKind('kernelParameter');
  }
  public async discoverEnvironmentInformation(): Promise<readonly LinuxInventoryResource[]> {
    return this.byKind('environmentInformation');
  }
  public async getCpuUtilization(): Promise<readonly LinuxCpuUtilization[]> {
    return MOCK_CPU;
  }
  public async getMemoryUtilization(): Promise<readonly LinuxMemoryUtilization[]> {
    return MOCK_MEMORY;
  }
  public async getDiskUtilization(): Promise<readonly LinuxDiskUtilization[]> {
    return MOCK_DISK;
  }
  public async getFilesystemHealth(): Promise<readonly LinuxFilesystemHealth[]> {
    return MOCK_FS_HEALTH;
  }
  public async getNetworkStatistics(): Promise<readonly LinuxNetworkStatistic[]> {
    return MOCK_NET;
  }
  public async getProcessStatistics(): Promise<readonly LinuxProcessStatistic[]> {
    return MOCK_PROC;
  }
  public async getServiceStatus(): Promise<readonly LinuxServiceStatus[]> {
    return MOCK_SERVICE_STATUS;
  }
  public async getSystemHealth(): Promise<LinuxSystemHealth> {
    return {
      healthy: true,
      status: 'healthy',
      checkedAt: DATASET_TIMESTAMP,
      details: {
        provider: 'linux-enterprise',
        mode: 'mock-adapter',
        resources: MOCK_INVENTORY.length,
      },
    };
  }
  public async getLogsMetadata(): Promise<readonly LinuxLogMetadata[]> {
    return MOCK_LOGS;
  }
  public async getSecurityMetadata(): Promise<readonly LinuxSecurityMetadata[]> {
    return MOCK_SECURITY;
  }
  public async refreshInventory(): Promise<{ readonly refreshedAt: string }> {
    return { refreshedAt: DATASET_TIMESTAMP };
  }
  public async testConnection(
    configuration: Readonly<LinuxProviderConfiguration>,
  ): Promise<LinuxConnectionTestResult> {
    return {
      connected: configuration.endpoint.startsWith('linux://'),
      latencyMs: 16,
      message: 'Linux connection test succeeded through adapter abstraction.',
    };
  }
  public async discoverCapabilities(): Promise<readonly LinuxCapabilityDescriptor[]> {
    return Object.freeze([
      { id: 'linux-discovery', name: 'discovery', version: '1.0.0', category: 'discovery' },
      { id: 'linux-inventory', name: 'inventory', version: '1.0.0', category: 'inventory' },
      { id: 'linux-monitoring', name: 'monitoring', version: '1.0.0', category: 'monitoring' },
      {
        id: 'linux-administration',
        name: 'administration',
        version: '1.0.0',
        category: 'administration',
      },
      { id: 'linux-operations', name: 'operations', version: '1.0.0', category: 'operations' },
    ]);
  }
  public async searchResources(
    query: LinuxSearchQuery,
  ): Promise<readonly LinuxInventoryResource[]> {
    const needle = query.text.trim().toLowerCase();
    const byKind = query.kind ? this.byKind(query.kind) : MOCK_INVENTORY;
    const byHost = query.host ? byKind.filter((resource) => resource.host === query.host) : byKind;
    return byHost.filter((resource) =>
      [resource.id, resource.name].some((value) => value.toLowerCase().includes(needle)),
    );
  }
  private byKind(kind: LinuxResourceKind): readonly LinuxInventoryResource[] {
    return MOCK_INVENTORY.filter((resource) => resource.kind === kind);
  }
}

export class LinuxInventoryCache {
  private snapshot: LinuxInventoryCacheSnapshot = Object.freeze({ resources: Object.freeze([]) });
  public update(resources: readonly LinuxInventoryResource[], refreshedAt: string): void {
    this.snapshot = Object.freeze({ resources: Object.freeze([...resources]), refreshedAt });
  }
  public getSnapshot(): LinuxInventoryCacheSnapshot {
    return this.snapshot;
  }
  public search(query: LinuxSearchQuery): readonly LinuxInventoryResource[] {
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

export class LinuxConfiguration {
  public readonly defaultConfiguration: Readonly<LinuxProviderConfiguration> = Object.freeze({
    endpoint: 'linux://linux-prod-01.example.local',
    hostAlias: 'linux-prod-01',
    credentialRef: 'LINUX_CREDENTIAL_REF',
    readOnly: true,
    connectionTimeoutMs: 10000,
    inventoryCacheTtlSeconds: 300,
  });

  public merge(
    override?: Readonly<Partial<LinuxProviderConfiguration>>,
  ): Readonly<LinuxProviderConfiguration> {
    const merged: LinuxProviderConfiguration = {
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

export class LinuxAuthenticationProvider {
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
            ? 'Linux authentication accepted.'
            : 'Linux credential payload is invalid.',
          authenticatedAt: DATASET_TIMESTAMP,
        });
      },
    });
  }
  public getProviderAuthentication(): ProviderAuthentication {
    return this.providerAuthentication;
  }
}

export class LinuxConnection {
  public readonly id: string;
  public readonly endpoint: string;
  public connectedAt?: string;
  public constructor(endpoint: string) {
    this.endpoint = endpoint;
    this.id = `linux-connection:${endpoint}`;
  }
  public connect(): void {
    this.connectedAt = DATASET_TIMESTAMP;
  }
  public disconnect(): void {
    this.connectedAt = undefined;
  }
}

export class LinuxConnectionManager {
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
          const client = new LinuxConnection(endpoint);
          client.connect();
          return client;
        },
        disconnect: async (client) => {
          client?.disconnect();
        },
        checkHealth: async (client) =>
          new ConnectionHealth({
            status: client?.connectedAt ? 'connected' : 'degraded',
            latencyMs: 16,
            lastCheckedAt: DATASET_TIMESTAMP,
            message: 'Linux connection health.',
          }),
      });
    });
    this.sdkConnectionManager = new ProviderConnectionManager({ factory, pool });
  }
  public getSdkConnectionManager(): ProviderConnectionManager {
    return this.sdkConnectionManager;
  }
}

export class LinuxCapabilityRegistry {
  private readonly registry: ProviderCapabilityRegistry;
  public constructor(providerId: string, registry = new ProviderCapabilityRegistry()) {
    this.registry = registry;
    const register = (
      id: string,
      name: string,
      category: LinuxCapabilityDescriptor['category'],
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
            tags: ['linux', category],
            featureFlags: { configurationDriven: true, adapterBacked: true },
          }),
          requiresCapabilities: [name],
          requiredFeatureFlags: ['configurationDriven', 'adapterBacked'],
        }),
      );
    };
    register('linux-discovery', 'discovery', 'discovery', 'Host and platform discovery.');
    register(
      'linux-inventory',
      'inventory',
      'inventory',
      'Linux inventory objects and system resources.',
    );
    register(
      'linux-monitoring',
      'monitoring',
      'monitoring',
      'Linux monitoring and health telemetry.',
    );
    register(
      'linux-administration',
      'administration',
      'administration',
      'Linux administration metadata surfaces.',
    );
    register(
      'linux-operations',
      'operations',
      'operations',
      'Refresh, search, test connection, and capability discovery.',
    );
  }
  public getProviderCapabilityRegistry(): ProviderCapabilityRegistry {
    return this.registry;
  }
  public async list(): Promise<readonly LinuxCapabilityDescriptor[]> {
    return Object.freeze([
      { id: 'linux-discovery', name: 'discovery', version: '1.0.0', category: 'discovery' },
      { id: 'linux-inventory', name: 'inventory', version: '1.0.0', category: 'inventory' },
      { id: 'linux-monitoring', name: 'monitoring', version: '1.0.0', category: 'monitoring' },
      {
        id: 'linux-administration',
        name: 'administration',
        version: '1.0.0',
        category: 'administration',
      },
      { id: 'linux-operations', name: 'operations', version: '1.0.0', category: 'operations' },
    ]);
  }
}

export class LinuxProvider extends BaseProvider<LinuxProviderConfiguration> {
  private readonly adapter: ILinuxAdapter;
  private readonly configurationService: LinuxConfiguration;
  private readonly inventoryCache: LinuxInventoryCache;
  private readonly capabilityRegistry: LinuxCapabilityRegistry;

  public constructor(
    options: {
      readonly adapter?: ILinuxAdapter;
      readonly configurationService?: LinuxConfiguration;
      readonly inventoryCache?: LinuxInventoryCache;
      readonly capabilityRegistry?: LinuxCapabilityRegistry;
      readonly manifest?: ProviderManifest<LinuxProviderConfiguration>;
    } = {},
  ) {
    const configurationService = options.configurationService ?? new LinuxConfiguration();
    super({
      manifest:
        options.manifest ??
        new ProviderManifest<LinuxProviderConfiguration>({
          id: 'provider-linux',
          name: 'Linux Enterprise Provider',
          metadata: new ProviderMetadata({
            description:
              'Production Linux provider framework built on Provider SDK with adapter isolation.',
            version: new ProviderVersion('1.0.0'),
            vendor: 'InfraShield',
            tags: ['linux', 'enterprise', 'provider-sdk'],
            healthStatus: 'healthy',
          }),
          capabilities: new ProviderCapabilities([
            new ToolCapability({ name: 'discovery' }),
            new ToolCapability({ name: 'inventory' }),
            new ToolCapability({ name: 'monitoring' }),
            new ToolCapability({ name: 'administration' }),
            new ToolCapability({ name: 'operations' }),
          ]),
          configuration: new ProviderConfiguration<LinuxProviderConfiguration>({
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

    this.adapter = options.adapter ?? new LinuxMockAdapter();
    this.configurationService = configurationService;
    this.inventoryCache = options.inventoryCache ?? new LinuxInventoryCache();
    this.capabilityRegistry =
      options.capabilityRegistry ?? new LinuxCapabilityRegistry(this.manifest.id);
  }

  public resolveConfiguration(
    override?: Readonly<Partial<LinuxProviderConfiguration>>,
  ): Readonly<LinuxProviderConfiguration> {
    return this.configurationService.merge(override);
  }

  public async discoverInventory(): Promise<readonly LinuxInventoryResource[]> {
    const [
      hosts,
      operatingSystems,
      distributions,
      kernels,
      cpu,
      memory,
      numa,
      filesystems,
      mountPoints,
      blockDevices,
      networkInterfaces,
      installedPackages,
      runningServices,
      processes,
      users,
      groups,
      systemdServices,
      crontab,
      sshConfiguration,
      firewall,
      selinuxOrApparmor,
      kernelParameters,
      environmentInformation,
    ] = await Promise.all([
      this.adapter.discoverHosts(),
      this.adapter.discoverOperatingSystems(),
      this.adapter.discoverDistributions(),
      this.adapter.discoverKernels(),
      this.adapter.discoverCpu(),
      this.adapter.discoverMemory(),
      this.adapter.discoverNuma(),
      this.adapter.discoverFilesystems(),
      this.adapter.discoverMountPoints(),
      this.adapter.discoverBlockDevices(),
      this.adapter.discoverNetworkInterfaces(),
      this.adapter.discoverInstalledPackages(),
      this.adapter.discoverRunningServices(),
      this.adapter.discoverProcesses(),
      this.adapter.discoverUsers(),
      this.adapter.discoverGroups(),
      this.adapter.discoverSystemdServices(),
      this.adapter.discoverCrontab(),
      this.adapter.discoverSshConfiguration(),
      this.adapter.discoverFirewall(),
      this.adapter.discoverSelinuxOrApparmor(),
      this.adapter.discoverKernelParameters(),
      this.adapter.discoverEnvironmentInformation(),
    ]);

    return Object.freeze([
      ...hosts,
      ...operatingSystems,
      ...distributions,
      ...kernels,
      ...cpu,
      ...memory,
      ...numa,
      ...filesystems,
      ...mountPoints,
      ...blockDevices,
      ...networkInterfaces,
      ...installedPackages,
      ...runningServices,
      ...processes,
      ...users,
      ...groups,
      ...systemdServices,
      ...crontab,
      ...sshConfiguration,
      ...firewall,
      ...selinuxOrApparmor,
      ...kernelParameters,
      ...environmentInformation,
    ]);
  }

  public async refreshInventory(): Promise<LinuxInventoryCacheSnapshot> {
    const refreshed = await this.adapter.refreshInventory();
    const resources = await this.discoverInventory();
    this.inventoryCache.update(resources, refreshed.refreshedAt);
    return this.inventoryCache.getSnapshot();
  }

  public getInventoryCache(): LinuxInventoryCacheSnapshot {
    return this.inventoryCache.getSnapshot();
  }

  public synchronizeCache(snapshot: LinuxInventoryCacheSnapshot): void {
    this.inventoryCache.update(snapshot.resources, snapshot.refreshedAt ?? DATASET_TIMESTAMP);
  }

  public async testConnection(
    override?: Readonly<Partial<LinuxProviderConfiguration>>,
  ): Promise<LinuxConnectionTestResult> {
    return this.adapter.testConnection(this.resolveConfiguration(override));
  }

  public async discoverCapabilities(): Promise<readonly LinuxCapabilityDescriptor[]> {
    const [fromRegistry, fromAdapter] = await Promise.all([
      this.capabilityRegistry.list(),
      this.adapter.discoverCapabilities(),
    ]);
    const dedup = new Map<string, LinuxCapabilityDescriptor>();
    [...fromRegistry, ...fromAdapter].forEach((capability) => dedup.set(capability.id, capability));
    return Object.freeze([...dedup.values()]);
  }

  public async searchResources(
    query: LinuxSearchQuery,
  ): Promise<readonly LinuxInventoryResource[]> {
    if (this.inventoryCache.getSnapshot().resources.length > 0) {
      return this.inventoryCache.search(query);
    }
    return this.adapter.searchResources(query);
  }

  public async getCpuUtilization(): Promise<readonly LinuxCpuUtilization[]> {
    return this.adapter.getCpuUtilization();
  }
  public async getMemoryUtilization(): Promise<readonly LinuxMemoryUtilization[]> {
    return this.adapter.getMemoryUtilization();
  }
  public async getDiskUtilization(): Promise<readonly LinuxDiskUtilization[]> {
    return this.adapter.getDiskUtilization();
  }
  public async getFilesystemHealth(): Promise<readonly LinuxFilesystemHealth[]> {
    return this.adapter.getFilesystemHealth();
  }
  public async getNetworkStatistics(): Promise<readonly LinuxNetworkStatistic[]> {
    return this.adapter.getNetworkStatistics();
  }
  public async getProcessStatistics(): Promise<readonly LinuxProcessStatistic[]> {
    return this.adapter.getProcessStatistics();
  }
  public async getServiceStatus(): Promise<readonly LinuxServiceStatus[]> {
    return this.adapter.getServiceStatus();
  }
  public async getSystemHealth(): Promise<LinuxSystemHealth> {
    return this.adapter.getSystemHealth();
  }
  public async getLogsMetadata(): Promise<readonly LinuxLogMetadata[]> {
    return this.adapter.getLogsMetadata();
  }
  public async getSecurityMetadata(): Promise<readonly LinuxSecurityMetadata[]> {
    return this.adapter.getSecurityMetadata();
  }
}

export class LinuxProviderFactory {
  private readonly registryService: ProviderRegistryService;

  public constructor(options: { readonly registryService?: ProviderRegistryService } = {}) {
    this.registryService = options.registryService ?? new ProviderRegistryService();
  }

  public create(options?: {
    readonly adapter?: ILinuxAdapter;
    readonly configurationOverride?: Readonly<Partial<LinuxProviderConfiguration>>;
  }): LinuxProvider {
    const configurationService = new LinuxConfiguration();

    const provider = new LinuxProvider({
      adapter: options?.adapter,
      configurationService,
      manifest: new ProviderManifest<LinuxProviderConfiguration>({
        id: 'provider-linux',
        name: 'Linux Enterprise Provider',
        metadata: new ProviderMetadata({
          description:
            'Production Linux provider framework built on Provider SDK with adapter isolation.',
          version: new ProviderVersion('1.0.0'),
          vendor: 'InfraShield',
          tags: ['linux', 'enterprise', 'provider-sdk'],
          healthStatus: 'healthy',
        }),
        capabilities: new ProviderCapabilities([
          new ToolCapability({ name: 'discovery' }),
          new ToolCapability({ name: 'inventory' }),
          new ToolCapability({ name: 'monitoring' }),
          new ToolCapability({ name: 'administration' }),
          new ToolCapability({ name: 'operations' }),
        ]),
        configuration: new ProviderConfiguration<LinuxProviderConfiguration>({
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

export interface LinuxProviderRuntime {
  readonly provider: LinuxProvider;
  readonly registryService: ProviderRegistryService;
  readonly lifecycleManager: ProviderLifecycleManager;
  readonly capabilityResolver: CapabilityResolver;
  readonly authenticationProvider: LinuxAuthenticationProvider;
  readonly connectionManager: LinuxConnectionManager;
}

export function createLinuxProviderRuntime(): LinuxProviderRuntime {
  const factory = new LinuxProviderFactory();
  const provider = factory.create();

  const capabilityRegistry = new LinuxCapabilityRegistry(provider.manifest.id);
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
      message: 'Linux provider healthy.',
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
    authenticationProvider: new LinuxAuthenticationProvider(),
    connectionManager: new LinuxConnectionManager(provider.manifest.id),
  };
}
