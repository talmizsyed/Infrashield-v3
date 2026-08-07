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

export type NetworkVendor = 'cisco' | 'paloAlto' | 'fortinet' | 'juniper' | 'f5' | 'checkPoint';

export type NetworkProtocol = 'rest' | 'ssh' | 'snmp' | 'netconf';

export interface IRestProtocol {
  sendRestRequest(path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE'): Promise<unknown>;
}

export interface ISshProtocol {
  sendSshCommand(command: string): Promise<string>;
}

export interface ISnmpProtocol {
  querySnmpOid(oid: string): Promise<string>;
}

export interface INetconfProtocol {
  executeNetconfRpc(rpc: string): Promise<string>;
}

export type NetworkResourceKind =
  | 'device'
  | 'interface'
  | 'vlan'
  | 'routingTable'
  | 'vrf'
  | 'firewallPolicy'
  | 'acl'
  | 'natRule'
  | 'vpnTunnel'
  | 'loadBalancer'
  | 'highAvailabilityPair';

export interface NetworkProviderConfiguration extends SerializableValueObject {
  readonly endpoint: string;
  readonly domainName: string;
  readonly credentialRef: string;
  readonly readOnly: boolean;
  readonly connectionTimeoutMs: number;
  readonly inventoryCacheTtlSeconds: number;
}

export interface NetworkInventoryResource {
  readonly id: string;
  readonly kind: NetworkResourceKind;
  readonly name: string;
  readonly vendor: NetworkVendor;
  readonly protocols: readonly NetworkProtocol[];
  readonly metadata: Readonly<Record<string, string>>;
}

export interface NetworkVendorAbstraction {
  readonly vendor: NetworkVendor;
  readonly supportedProtocols: readonly NetworkProtocol[];
  readonly metadata: Readonly<Record<string, string>>;
}

export interface NetworkDeviceHealth {
  readonly deviceName: string;
  readonly vendor: NetworkVendor;
  readonly healthy: boolean;
  readonly status: 'healthy' | 'degraded' | 'down';
  readonly checkedAt: string;
}

export interface NetworkInterfaceStatus {
  readonly deviceName: string;
  readonly interfaceName: string;
  readonly status: 'up' | 'down' | 'degraded';
  readonly checkedAt: string;
}

export interface NetworkBandwidthUtilization {
  readonly deviceName: string;
  readonly interfaceName: string;
  readonly rxPercent: number;
  readonly txPercent: number;
  readonly checkedAt: string;
}

export interface NetworkCpuMetric {
  readonly deviceName: string;
  readonly percent: number;
  readonly checkedAt: string;
}

export interface NetworkMemoryMetric {
  readonly deviceName: string;
  readonly usedPercent: number;
  readonly checkedAt: string;
}

export interface NetworkEnvironmentalSensor {
  readonly deviceName: string;
  readonly sensorName: string;
  readonly value: number;
  readonly unit: string;
  readonly status: 'normal' | 'warning' | 'critical';
}

export interface NetworkEvent {
  readonly id: string;
  readonly deviceName: string;
  readonly severity: 'info' | 'warning' | 'critical';
  readonly message: string;
  readonly timestamp: string;
}

export interface NetworkAlert {
  readonly id: string;
  readonly source: string;
  readonly severity: 'info' | 'warning' | 'critical';
  readonly summary: string;
  readonly timestamp: string;
}

export interface NetworkSyslogMetadata {
  readonly id: string;
  readonly sourceDevice: string;
  readonly facility: string;
  readonly severity: string;
  readonly timestamp: string;
}

export interface NetworkConnectionTestResult {
  readonly connected: boolean;
  readonly latencyMs: number;
  readonly message: string;
}

export interface NetworkCapabilityDescriptor {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly category: 'discovery' | 'security' | 'traffic' | 'monitoring' | 'operations';
}

export interface NetworkDeviceSearchQuery {
  readonly text: string;
  readonly vendor?: NetworkVendor;
}

export interface NetworkInventoryCacheSnapshot {
  readonly resources: readonly NetworkInventoryResource[];
  readonly refreshedAt?: string;
}

export interface INetworkAdapter {
  discoverVendorAbstractions(): Promise<readonly NetworkVendorAbstraction[]>;
  discoverDevices(): Promise<readonly NetworkInventoryResource[]>;
  discoverInterfaces(): Promise<readonly NetworkInventoryResource[]>;
  discoverVlans(): Promise<readonly NetworkInventoryResource[]>;
  discoverRoutingTables(): Promise<readonly NetworkInventoryResource[]>;
  discoverVrfs(): Promise<readonly NetworkInventoryResource[]>;
  discoverFirewallPolicies(): Promise<readonly NetworkInventoryResource[]>;
  discoverAcls(): Promise<readonly NetworkInventoryResource[]>;
  discoverNatRules(): Promise<readonly NetworkInventoryResource[]>;
  discoverVpnTunnels(): Promise<readonly NetworkInventoryResource[]>;
  discoverLoadBalancers(): Promise<readonly NetworkInventoryResource[]>;
  discoverHighAvailabilityPairs(): Promise<readonly NetworkInventoryResource[]>;
  getDeviceHealth(): Promise<readonly NetworkDeviceHealth[]>;
  getInterfaceStatus(): Promise<readonly NetworkInterfaceStatus[]>;
  getBandwidthUtilization(): Promise<readonly NetworkBandwidthUtilization[]>;
  getCpuMetrics(): Promise<readonly NetworkCpuMetric[]>;
  getMemoryMetrics(): Promise<readonly NetworkMemoryMetric[]>;
  getEnvironmentalSensors(): Promise<readonly NetworkEnvironmentalSensor[]>;
  getEvents(): Promise<readonly NetworkEvent[]>;
  getAlerts(): Promise<readonly NetworkAlert[]>;
  getSyslogMetadata(): Promise<readonly NetworkSyslogMetadata[]>;
  refreshInventory(): Promise<{ readonly refreshedAt: string }>;
  testConnection(
    configuration: Readonly<NetworkProviderConfiguration>,
  ): Promise<NetworkConnectionTestResult>;
  discoverCapabilities(): Promise<readonly NetworkCapabilityDescriptor[]>;
  searchDevices(query: NetworkDeviceSearchQuery): Promise<readonly NetworkInventoryResource[]>;
}

const DATASET_TIMESTAMP = '2026-01-01T00:00:00.000Z';

function metadata(values: Record<string, string>): Readonly<Record<string, string>> {
  return values;
}

function protocolList(...protocols: readonly NetworkProtocol[]): readonly NetworkProtocol[] {
  return Object.freeze([...protocols]);
}

const MOCK_VENDORS: readonly NetworkVendorAbstraction[] = Object.freeze([
  {
    vendor: 'cisco',
    supportedProtocols: protocolList('rest', 'ssh', 'snmp', 'netconf'),
    metadata: metadata({ family: 'ios-xe,nx-os', profile: 'enterprise-core' }),
  },
  {
    vendor: 'paloAlto',
    supportedProtocols: protocolList('rest', 'ssh', 'snmp'),
    metadata: metadata({ family: 'pan-os', profile: 'enterprise-security' }),
  },
  {
    vendor: 'fortinet',
    supportedProtocols: protocolList('rest', 'ssh', 'snmp'),
    metadata: metadata({ family: 'fortios', profile: 'enterprise-edge' }),
  },
  {
    vendor: 'juniper',
    supportedProtocols: protocolList('rest', 'ssh', 'snmp', 'netconf'),
    metadata: metadata({ family: 'junos', profile: 'enterprise-core' }),
  },
  {
    vendor: 'f5',
    supportedProtocols: protocolList('rest', 'ssh', 'snmp'),
    metadata: metadata({ family: 'tmos', profile: 'application-delivery' }),
  },
  {
    vendor: 'checkPoint',
    supportedProtocols: protocolList('rest', 'ssh', 'snmp'),
    metadata: metadata({ family: 'gaia', profile: 'enterprise-security' }),
  },
]);

const MOCK_INVENTORY: readonly NetworkInventoryResource[] = Object.freeze([
  {
    id: 'device-cisco-1',
    kind: 'device',
    name: 'cisco-core-01',
    vendor: 'cisco',
    protocols: protocolList('rest', 'ssh', 'snmp', 'netconf'),
    metadata: metadata({ role: 'core-router', site: 'dc1' }),
  },
  {
    id: 'device-palo-1',
    kind: 'device',
    name: 'palo-fw-01',
    vendor: 'paloAlto',
    protocols: protocolList('rest', 'ssh', 'snmp'),
    metadata: metadata({ role: 'perimeter-firewall', site: 'dc1' }),
  },
  {
    id: 'device-fortinet-1',
    kind: 'device',
    name: 'fortinet-edge-01',
    vendor: 'fortinet',
    protocols: protocolList('rest', 'ssh', 'snmp'),
    metadata: metadata({ role: 'sd-wan-edge', site: 'dc2' }),
  },
  {
    id: 'device-juniper-1',
    kind: 'device',
    name: 'juniper-core-01',
    vendor: 'juniper',
    protocols: protocolList('rest', 'ssh', 'snmp', 'netconf'),
    metadata: metadata({ role: 'spine-router', site: 'dc2' }),
  },
  {
    id: 'device-f5-1',
    kind: 'device',
    name: 'f5-ltm-01',
    vendor: 'f5',
    protocols: protocolList('rest', 'ssh', 'snmp'),
    metadata: metadata({ role: 'load-balancer', site: 'dc1' }),
  },
  {
    id: 'device-checkpoint-1',
    kind: 'device',
    name: 'checkpoint-fw-01',
    vendor: 'checkPoint',
    protocols: protocolList('rest', 'ssh', 'snmp'),
    metadata: metadata({ role: 'east-west-firewall', site: 'dc2' }),
  },
  {
    id: 'interface-1',
    kind: 'interface',
    name: 'GigabitEthernet0/0',
    vendor: 'cisco',
    protocols: protocolList('snmp', 'netconf'),
    metadata: metadata({ parentDevice: 'cisco-core-01', state: 'up' }),
  },
  {
    id: 'vlan-1',
    kind: 'vlan',
    name: 'VLAN-120',
    vendor: 'cisco',
    protocols: protocolList('netconf'),
    metadata: metadata({ parentDevice: 'cisco-core-01', subnet: '10.120.0.0/24' }),
  },
  {
    id: 'route-1',
    kind: 'routingTable',
    name: '0.0.0.0/0',
    vendor: 'juniper',
    protocols: protocolList('netconf'),
    metadata: metadata({ parentDevice: 'juniper-core-01', nextHop: '10.0.0.1' }),
  },
  {
    id: 'vrf-1',
    kind: 'vrf',
    name: 'PROD-APP',
    vendor: 'cisco',
    protocols: protocolList('netconf'),
    metadata: metadata({ parentDevice: 'cisco-core-01', routeTargets: '65000:120' }),
  },
  {
    id: 'fw-policy-1',
    kind: 'firewallPolicy',
    name: 'allow-app-to-db',
    vendor: 'paloAlto',
    protocols: protocolList('rest'),
    metadata: metadata({ parentDevice: 'palo-fw-01', action: 'allow' }),
  },
  {
    id: 'acl-1',
    kind: 'acl',
    name: 'ACL-EDGE-IN',
    vendor: 'fortinet',
    protocols: protocolList('rest'),
    metadata: metadata({ parentDevice: 'fortinet-edge-01', direction: 'ingress' }),
  },
  {
    id: 'nat-1',
    kind: 'natRule',
    name: 'nat-web-egress',
    vendor: 'checkPoint',
    protocols: protocolList('rest'),
    metadata: metadata({ parentDevice: 'checkpoint-fw-01', translatedTo: '198.51.100.20' }),
  },
  {
    id: 'vpn-1',
    kind: 'vpnTunnel',
    name: 'dc1-dc2-ipsec',
    vendor: 'fortinet',
    protocols: protocolList('rest'),
    metadata: metadata({ parentDevice: 'fortinet-edge-01', status: 'up' }),
  },
  {
    id: 'lb-1',
    kind: 'loadBalancer',
    name: 'payments-vip',
    vendor: 'f5',
    protocols: protocolList('rest'),
    metadata: metadata({ parentDevice: 'f5-ltm-01', vip: '203.0.113.15' }),
  },
  {
    id: 'ha-1',
    kind: 'highAvailabilityPair',
    name: 'palo-ha-cluster-a',
    vendor: 'paloAlto',
    protocols: protocolList('rest'),
    metadata: metadata({ primary: 'palo-fw-01', secondary: 'palo-fw-02' }),
  },
]);

const MOCK_DEVICE_HEALTH: readonly NetworkDeviceHealth[] = Object.freeze([
  {
    deviceName: 'cisco-core-01',
    vendor: 'cisco',
    healthy: true,
    status: 'healthy',
    checkedAt: DATASET_TIMESTAMP,
  },
]);
const MOCK_INTERFACE_STATUS: readonly NetworkInterfaceStatus[] = Object.freeze([
  {
    deviceName: 'cisco-core-01',
    interfaceName: 'GigabitEthernet0/0',
    status: 'up',
    checkedAt: DATASET_TIMESTAMP,
  },
]);
const MOCK_BANDWIDTH: readonly NetworkBandwidthUtilization[] = Object.freeze([
  {
    deviceName: 'cisco-core-01',
    interfaceName: 'GigabitEthernet0/0',
    rxPercent: 43,
    txPercent: 38,
    checkedAt: DATASET_TIMESTAMP,
  },
]);
const MOCK_CPU: readonly NetworkCpuMetric[] = Object.freeze([
  { deviceName: 'cisco-core-01', percent: 37, checkedAt: DATASET_TIMESTAMP },
]);
const MOCK_MEMORY: readonly NetworkMemoryMetric[] = Object.freeze([
  { deviceName: 'cisco-core-01', usedPercent: 54, checkedAt: DATASET_TIMESTAMP },
]);
const MOCK_ENVIRONMENT: readonly NetworkEnvironmentalSensor[] = Object.freeze([
  {
    deviceName: 'cisco-core-01',
    sensorName: 'chassis-temperature',
    value: 41,
    unit: 'celsius',
    status: 'normal',
  },
]);
const MOCK_EVENTS: readonly NetworkEvent[] = Object.freeze([
  {
    id: 'event-1',
    deviceName: 'palo-fw-01',
    severity: 'warning',
    message: 'Policy compilation took longer than expected',
    timestamp: DATASET_TIMESTAMP,
  },
]);
const MOCK_ALERTS: readonly NetworkAlert[] = Object.freeze([
  {
    id: 'alert-1',
    source: 'network-observability',
    severity: 'warning',
    summary: 'Interface utilization exceeded 80 percent on edge trunk',
    timestamp: DATASET_TIMESTAMP,
  },
]);
const MOCK_SYSLOG: readonly NetworkSyslogMetadata[] = Object.freeze([
  {
    id: 'syslog-1',
    sourceDevice: 'juniper-core-01',
    facility: 'local7',
    severity: 'notice',
    timestamp: DATASET_TIMESTAMP,
  },
]);

export class NetworkMockAdapter implements INetworkAdapter {
  public async discoverVendorAbstractions(): Promise<readonly NetworkVendorAbstraction[]> {
    return MOCK_VENDORS;
  }
  public async discoverDevices(): Promise<readonly NetworkInventoryResource[]> {
    return this.byKind('device');
  }
  public async discoverInterfaces(): Promise<readonly NetworkInventoryResource[]> {
    return this.byKind('interface');
  }
  public async discoverVlans(): Promise<readonly NetworkInventoryResource[]> {
    return this.byKind('vlan');
  }
  public async discoverRoutingTables(): Promise<readonly NetworkInventoryResource[]> {
    return this.byKind('routingTable');
  }
  public async discoverVrfs(): Promise<readonly NetworkInventoryResource[]> {
    return this.byKind('vrf');
  }
  public async discoverFirewallPolicies(): Promise<readonly NetworkInventoryResource[]> {
    return this.byKind('firewallPolicy');
  }
  public async discoverAcls(): Promise<readonly NetworkInventoryResource[]> {
    return this.byKind('acl');
  }
  public async discoverNatRules(): Promise<readonly NetworkInventoryResource[]> {
    return this.byKind('natRule');
  }
  public async discoverVpnTunnels(): Promise<readonly NetworkInventoryResource[]> {
    return this.byKind('vpnTunnel');
  }
  public async discoverLoadBalancers(): Promise<readonly NetworkInventoryResource[]> {
    return this.byKind('loadBalancer');
  }
  public async discoverHighAvailabilityPairs(): Promise<readonly NetworkInventoryResource[]> {
    return this.byKind('highAvailabilityPair');
  }
  public async getDeviceHealth(): Promise<readonly NetworkDeviceHealth[]> {
    return MOCK_DEVICE_HEALTH;
  }
  public async getInterfaceStatus(): Promise<readonly NetworkInterfaceStatus[]> {
    return MOCK_INTERFACE_STATUS;
  }
  public async getBandwidthUtilization(): Promise<readonly NetworkBandwidthUtilization[]> {
    return MOCK_BANDWIDTH;
  }
  public async getCpuMetrics(): Promise<readonly NetworkCpuMetric[]> {
    return MOCK_CPU;
  }
  public async getMemoryMetrics(): Promise<readonly NetworkMemoryMetric[]> {
    return MOCK_MEMORY;
  }
  public async getEnvironmentalSensors(): Promise<readonly NetworkEnvironmentalSensor[]> {
    return MOCK_ENVIRONMENT;
  }
  public async getEvents(): Promise<readonly NetworkEvent[]> {
    return MOCK_EVENTS;
  }
  public async getAlerts(): Promise<readonly NetworkAlert[]> {
    return MOCK_ALERTS;
  }
  public async getSyslogMetadata(): Promise<readonly NetworkSyslogMetadata[]> {
    return MOCK_SYSLOG;
  }
  public async refreshInventory(): Promise<{ readonly refreshedAt: string }> {
    return { refreshedAt: DATASET_TIMESTAMP };
  }
  public async testConnection(
    configuration: Readonly<NetworkProviderConfiguration>,
  ): Promise<NetworkConnectionTestResult> {
    return {
      connected: configuration.endpoint.startsWith('network://'),
      latencyMs: 21,
      message:
        'Network connection test succeeded through adapter abstraction without vendor SDKs or protocol transport implementations.',
    };
  }
  public async discoverCapabilities(): Promise<readonly NetworkCapabilityDescriptor[]> {
    return Object.freeze([
      { id: 'network-discovery', name: 'discovery', version: '1.0.0', category: 'discovery' },
      { id: 'network-security', name: 'security', version: '1.0.0', category: 'security' },
      { id: 'network-traffic', name: 'traffic', version: '1.0.0', category: 'traffic' },
      { id: 'network-monitoring', name: 'monitoring', version: '1.0.0', category: 'monitoring' },
      { id: 'network-operations', name: 'operations', version: '1.0.0', category: 'operations' },
    ]);
  }
  public async searchDevices(
    query: NetworkDeviceSearchQuery,
  ): Promise<readonly NetworkInventoryResource[]> {
    const needle = query.text.trim().toLowerCase();
    const devices = this.byKind('device');
    const byVendor = query.vendor
      ? devices.filter((device) => device.vendor === query.vendor)
      : devices;
    return byVendor.filter((device) =>
      [device.id, device.name].some((value) => value.toLowerCase().includes(needle)),
    );
  }

  private byKind(kind: NetworkResourceKind): readonly NetworkInventoryResource[] {
    return MOCK_INVENTORY.filter((resource) => resource.kind === kind);
  }
}

export class NetworkInventoryCache {
  private snapshot: NetworkInventoryCacheSnapshot = Object.freeze({ resources: Object.freeze([]) });

  public update(resources: readonly NetworkInventoryResource[], refreshedAt: string): void {
    this.snapshot = Object.freeze({ resources: Object.freeze([...resources]), refreshedAt });
  }

  public getSnapshot(): NetworkInventoryCacheSnapshot {
    return this.snapshot;
  }

  public searchDevices(query: NetworkDeviceSearchQuery): readonly NetworkInventoryResource[] {
    const needle = query.text.trim().toLowerCase();
    const devices = this.snapshot.resources.filter((resource) => resource.kind === 'device');
    const byVendor = query.vendor
      ? devices.filter((resource) => resource.vendor === query.vendor)
      : devices;
    return byVendor.filter((resource) =>
      [resource.id, resource.name].some((value) => value.toLowerCase().includes(needle)),
    );
  }
}

export class NetworkConfiguration {
  public readonly defaultConfiguration: Readonly<NetworkProviderConfiguration> = Object.freeze({
    endpoint: 'network://enterprise.fabric.example.local',
    domainName: 'enterprise.fabric.example.local',
    credentialRef: 'NETWORK_CREDENTIAL_REF',
    readOnly: true,
    connectionTimeoutMs: 10000,
    inventoryCacheTtlSeconds: 300,
  });

  public merge(
    override?: Readonly<Partial<NetworkProviderConfiguration>>,
  ): Readonly<NetworkProviderConfiguration> {
    const merged: NetworkProviderConfiguration = {
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

export class NetworkAuthenticationProvider {
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
            ? 'Network authentication accepted.'
            : 'Network credential payload is invalid.',
          authenticatedAt: DATASET_TIMESTAMP,
        });
      },
    });
  }

  public getProviderAuthentication(): ProviderAuthentication {
    return this.providerAuthentication;
  }
}

export class NetworkConnection {
  public readonly id: string;
  public readonly endpoint: string;
  public connectedAt?: string;

  public constructor(endpoint: string) {
    this.endpoint = endpoint;
    this.id = `network-connection:${endpoint}`;
  }

  public connect(): void {
    this.connectedAt = DATASET_TIMESTAMP;
  }

  public disconnect(): void {
    this.connectedAt = undefined;
  }
}

export class NetworkConnectionManager {
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
          const client = new NetworkConnection(endpoint);
          client.connect();
          return client;
        },
        disconnect: async (client) => {
          client?.disconnect();
        },
        checkHealth: async (client) =>
          new ConnectionHealth({
            status: client?.connectedAt ? 'connected' : 'degraded',
            latencyMs: 21,
            lastCheckedAt: DATASET_TIMESTAMP,
            message: 'Network connection health.',
          }),
      });
    });
    this.sdkConnectionManager = new ProviderConnectionManager({ factory, pool });
  }

  public getSdkConnectionManager(): ProviderConnectionManager {
    return this.sdkConnectionManager;
  }
}

export class NetworkCapabilityRegistry {
  private readonly registry: ProviderCapabilityRegistry;

  public constructor(providerId: string, registry = new ProviderCapabilityRegistry()) {
    this.registry = registry;
    const register = (
      id: string,
      name: string,
      category: NetworkCapabilityDescriptor['category'],
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
            tags: ['network', 'vendor-neutral', category],
            featureFlags: { configurationDriven: true, adapterBacked: true },
          }),
          requiresCapabilities: [name],
          requiredFeatureFlags: ['configurationDriven', 'adapterBacked'],
        }),
      );
    };

    register('network-discovery', 'discovery', 'discovery', 'Discovery across network domains.');
    register('network-security', 'security', 'security', 'Security policy and control surfaces.');
    register(
      'network-traffic',
      'traffic',
      'traffic',
      'Routing, VLAN, NAT, and bandwidth surfaces.',
    );
    register('network-monitoring', 'monitoring', 'monitoring', 'Operational and health telemetry.');
    register(
      'network-operations',
      'operations',
      'operations',
      'Refresh, test, search, and synchronization.',
    );
  }

  public getProviderCapabilityRegistry(): ProviderCapabilityRegistry {
    return this.registry;
  }

  public async list(): Promise<readonly NetworkCapabilityDescriptor[]> {
    return Object.freeze([
      { id: 'network-discovery', name: 'discovery', version: '1.0.0', category: 'discovery' },
      { id: 'network-security', name: 'security', version: '1.0.0', category: 'security' },
      { id: 'network-traffic', name: 'traffic', version: '1.0.0', category: 'traffic' },
      { id: 'network-monitoring', name: 'monitoring', version: '1.0.0', category: 'monitoring' },
      { id: 'network-operations', name: 'operations', version: '1.0.0', category: 'operations' },
    ]);
  }
}

export class NetworkProvider extends BaseProvider<NetworkProviderConfiguration> {
  private readonly adapter: INetworkAdapter;
  private readonly configurationService: NetworkConfiguration;
  private readonly inventoryCache: NetworkInventoryCache;
  private readonly capabilityRegistry: NetworkCapabilityRegistry;

  public constructor(
    options: {
      readonly adapter?: INetworkAdapter;
      readonly configurationService?: NetworkConfiguration;
      readonly inventoryCache?: NetworkInventoryCache;
      readonly capabilityRegistry?: NetworkCapabilityRegistry;
      readonly manifest?: ProviderManifest<NetworkProviderConfiguration>;
    } = {},
  ) {
    const configurationService = options.configurationService ?? new NetworkConfiguration();
    super({
      manifest:
        options.manifest ??
        new ProviderManifest<NetworkProviderConfiguration>({
          id: 'provider-network',
          name: 'Enterprise Network Provider',
          metadata: new ProviderMetadata({
            description:
              'Vendor-neutral enterprise network provider built on Provider SDK with adapter isolation.',
            version: new ProviderVersion('1.0.0'),
            vendor: 'InfraShield',
            tags: ['network', 'vendor-neutral', 'enterprise', 'provider-sdk'],
            healthStatus: 'healthy',
          }),
          capabilities: new ProviderCapabilities([
            new ToolCapability({ name: 'discovery' }),
            new ToolCapability({ name: 'security' }),
            new ToolCapability({ name: 'traffic' }),
            new ToolCapability({ name: 'monitoring' }),
            new ToolCapability({ name: 'operations' }),
          ]),
          configuration: new ProviderConfiguration<NetworkProviderConfiguration>({
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

    this.adapter = options.adapter ?? new NetworkMockAdapter();
    this.configurationService = configurationService;
    this.inventoryCache = options.inventoryCache ?? new NetworkInventoryCache();
    this.capabilityRegistry =
      options.capabilityRegistry ?? new NetworkCapabilityRegistry(this.manifest.id);
  }

  public resolveConfiguration(
    override?: Readonly<Partial<NetworkProviderConfiguration>>,
  ): Readonly<NetworkProviderConfiguration> {
    return this.configurationService.merge(override);
  }

  public async discoverVendorAbstractions(): Promise<readonly NetworkVendorAbstraction[]> {
    return this.adapter.discoverVendorAbstractions();
  }

  public async discoverInventory(): Promise<readonly NetworkInventoryResource[]> {
    const [
      devices,
      interfaces,
      vlans,
      routingTables,
      vrfs,
      firewallPolicies,
      acls,
      natRules,
      vpnTunnels,
      loadBalancers,
      highAvailabilityPairs,
    ] = await Promise.all([
      this.adapter.discoverDevices(),
      this.adapter.discoverInterfaces(),
      this.adapter.discoverVlans(),
      this.adapter.discoverRoutingTables(),
      this.adapter.discoverVrfs(),
      this.adapter.discoverFirewallPolicies(),
      this.adapter.discoverAcls(),
      this.adapter.discoverNatRules(),
      this.adapter.discoverVpnTunnels(),
      this.adapter.discoverLoadBalancers(),
      this.adapter.discoverHighAvailabilityPairs(),
    ]);

    return Object.freeze([
      ...devices,
      ...interfaces,
      ...vlans,
      ...routingTables,
      ...vrfs,
      ...firewallPolicies,
      ...acls,
      ...natRules,
      ...vpnTunnels,
      ...loadBalancers,
      ...highAvailabilityPairs,
    ]);
  }

  public async refreshInventory(): Promise<NetworkInventoryCacheSnapshot> {
    const refreshed = await this.adapter.refreshInventory();
    const resources = await this.discoverInventory();
    this.inventoryCache.update(resources, refreshed.refreshedAt);
    return this.inventoryCache.getSnapshot();
  }

  public getInventoryCache(): NetworkInventoryCacheSnapshot {
    return this.inventoryCache.getSnapshot();
  }

  public synchronizeCache(snapshot: NetworkInventoryCacheSnapshot): void {
    this.inventoryCache.update(snapshot.resources, snapshot.refreshedAt ?? DATASET_TIMESTAMP);
  }

  public async testConnection(
    override?: Readonly<Partial<NetworkProviderConfiguration>>,
  ): Promise<NetworkConnectionTestResult> {
    return this.adapter.testConnection(this.resolveConfiguration(override));
  }

  public async discoverCapabilities(): Promise<readonly NetworkCapabilityDescriptor[]> {
    const [fromRegistry, fromAdapter] = await Promise.all([
      this.capabilityRegistry.list(),
      this.adapter.discoverCapabilities(),
    ]);
    const dedup = new Map<string, NetworkCapabilityDescriptor>();
    [...fromRegistry, ...fromAdapter].forEach((capability) => dedup.set(capability.id, capability));
    return Object.freeze([...dedup.values()]);
  }

  public async searchDevices(
    query: NetworkDeviceSearchQuery,
  ): Promise<readonly NetworkInventoryResource[]> {
    if (this.inventoryCache.getSnapshot().resources.length > 0) {
      return this.inventoryCache.searchDevices(query);
    }
    return this.adapter.searchDevices(query);
  }

  public async getDeviceHealth(): Promise<readonly NetworkDeviceHealth[]> {
    return this.adapter.getDeviceHealth();
  }
  public async getInterfaceStatus(): Promise<readonly NetworkInterfaceStatus[]> {
    return this.adapter.getInterfaceStatus();
  }
  public async getBandwidthUtilization(): Promise<readonly NetworkBandwidthUtilization[]> {
    return this.adapter.getBandwidthUtilization();
  }
  public async getCpuMetrics(): Promise<readonly NetworkCpuMetric[]> {
    return this.adapter.getCpuMetrics();
  }
  public async getMemoryMetrics(): Promise<readonly NetworkMemoryMetric[]> {
    return this.adapter.getMemoryMetrics();
  }
  public async getEnvironmentalSensors(): Promise<readonly NetworkEnvironmentalSensor[]> {
    return this.adapter.getEnvironmentalSensors();
  }
  public async getEvents(): Promise<readonly NetworkEvent[]> {
    return this.adapter.getEvents();
  }
  public async getAlerts(): Promise<readonly NetworkAlert[]> {
    return this.adapter.getAlerts();
  }
  public async getSyslogMetadata(): Promise<readonly NetworkSyslogMetadata[]> {
    return this.adapter.getSyslogMetadata();
  }
}

export class NetworkProviderFactory {
  private readonly registryService: ProviderRegistryService;

  public constructor(options: { readonly registryService?: ProviderRegistryService } = {}) {
    this.registryService = options.registryService ?? new ProviderRegistryService();
  }

  public create(options?: {
    readonly adapter?: INetworkAdapter;
    readonly configurationOverride?: Readonly<Partial<NetworkProviderConfiguration>>;
  }): NetworkProvider {
    const configurationService = new NetworkConfiguration();

    const provider = new NetworkProvider({
      adapter: options?.adapter,
      configurationService,
      manifest: new ProviderManifest<NetworkProviderConfiguration>({
        id: 'provider-network',
        name: 'Enterprise Network Provider',
        metadata: new ProviderMetadata({
          description:
            'Vendor-neutral enterprise network provider built on Provider SDK with adapter isolation.',
          version: new ProviderVersion('1.0.0'),
          vendor: 'InfraShield',
          tags: ['network', 'vendor-neutral', 'enterprise', 'provider-sdk'],
          healthStatus: 'healthy',
        }),
        capabilities: new ProviderCapabilities([
          new ToolCapability({ name: 'discovery' }),
          new ToolCapability({ name: 'security' }),
          new ToolCapability({ name: 'traffic' }),
          new ToolCapability({ name: 'monitoring' }),
          new ToolCapability({ name: 'operations' }),
        ]),
        configuration: new ProviderConfiguration<NetworkProviderConfiguration>({
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

export interface NetworkProviderRuntime {
  readonly provider: NetworkProvider;
  readonly registryService: ProviderRegistryService;
  readonly lifecycleManager: ProviderLifecycleManager;
  readonly capabilityResolver: CapabilityResolver;
  readonly authenticationProvider: NetworkAuthenticationProvider;
  readonly connectionManager: NetworkConnectionManager;
}

export function createNetworkProviderRuntime(): NetworkProviderRuntime {
  const factory = new NetworkProviderFactory();
  const provider = factory.create();

  const capabilityRegistry = new NetworkCapabilityRegistry(provider.manifest.id);
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
      message: 'Network provider healthy.',
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
    authenticationProvider: new NetworkAuthenticationProvider(),
    connectionManager: new NetworkConnectionManager(provider.manifest.id),
  };
}
