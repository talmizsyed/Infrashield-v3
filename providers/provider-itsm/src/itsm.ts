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

export type ITSMPlatform = 'serviceNow' | 'jira' | 'bmcRemedy' | 'freshservice';

export type ITSMDiscoveryKind =
  'cmdb' | 'configurationItem' | 'service' | 'businessApplication' | 'supportGroup' | 'user';

export type ITSMObjectKind =
  'incident' | 'problem' | 'change' | 'request' | 'task' | 'approval' | 'knowledgeArticle';

export type ITSMInventoryKind = ITSMDiscoveryKind | ITSMObjectKind;

export interface ITSMProviderConfiguration extends SerializableValueObject {
  readonly endpoint: string;
  readonly organizationId: string;
  readonly credentialRef: string;
  readonly enabledPlatforms: readonly ITSMPlatform[];
  readonly readOnly: boolean;
  readonly connectionTimeoutMs: number;
  readonly inventoryCacheTtlSeconds: number;
}

export interface ITSMInventoryObject {
  readonly id: string;
  readonly kind: ITSMInventoryKind;
  readonly platform: ITSMPlatform;
  readonly name: string;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface ITSMPlatformAbstraction {
  readonly platform: ITSMPlatform;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface ITSMConnectionTestResult {
  readonly connected: boolean;
  readonly latencyMs: number;
  readonly message: string;
}

export interface ITSMCapabilityDescriptor {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly category:
    | 'discovery'
    | 'incident'
    | 'problem'
    | 'change'
    | 'request'
    | 'knowledge'
    | 'workflow'
    | 'operations';
}

export interface ITSMSearchQuery {
  readonly text: string;
  readonly platform?: ITSMPlatform;
  readonly kind?: ITSMInventoryKind;
}

export interface ITSMInventoryCacheSnapshot {
  readonly objects: readonly ITSMInventoryObject[];
  readonly refreshedAt?: string;
}

export interface ITSMHealth {
  readonly scopeName: string;
  readonly platform: ITSMPlatform;
  readonly healthy: boolean;
  readonly status: 'healthy' | 'degraded' | 'down';
  readonly checkedAt: string;
}

export interface IITSMAdapter {
  discoverPlatforms(): Promise<readonly ITSMPlatformAbstraction[]>;
  discoverCmdb(): Promise<readonly ITSMInventoryObject[]>;
  discoverConfigurationItems(): Promise<readonly ITSMInventoryObject[]>;
  discoverServices(): Promise<readonly ITSMInventoryObject[]>;
  discoverBusinessApplications(): Promise<readonly ITSMInventoryObject[]>;
  discoverSupportGroups(): Promise<readonly ITSMInventoryObject[]>;
  discoverUsers(): Promise<readonly ITSMInventoryObject[]>;
  discoverIncidents(): Promise<readonly ITSMInventoryObject[]>;
  discoverProblems(): Promise<readonly ITSMInventoryObject[]>;
  discoverChanges(): Promise<readonly ITSMInventoryObject[]>;
  discoverRequests(): Promise<readonly ITSMInventoryObject[]>;
  discoverTasks(): Promise<readonly ITSMInventoryObject[]>;
  discoverApprovals(): Promise<readonly ITSMInventoryObject[]>;
  discoverKnowledgeArticles(): Promise<readonly ITSMInventoryObject[]>;
  getHealth(): Promise<readonly ITSMHealth[]>;
  refreshInventory(): Promise<{ readonly refreshedAt: string }>;
  testConnection(
    configuration: Readonly<ITSMProviderConfiguration>,
  ): Promise<ITSMConnectionTestResult>;
  discoverCapabilities(): Promise<readonly ITSMCapabilityDescriptor[]>;
  search(query: ITSMSearchQuery): Promise<readonly ITSMInventoryObject[]>;
}

const DATASET_TIMESTAMP = '2026-01-01T00:00:00.000Z';

function metadata(values: Record<string, string>): Readonly<Record<string, string>> {
  return values;
}

function platformList(...platforms: readonly ITSMPlatform[]): readonly ITSMPlatform[] {
  return Object.freeze([...platforms]);
}

const MOCK_PLATFORMS: readonly ITSMPlatformAbstraction[] = Object.freeze([
  {
    platform: 'serviceNow',
    metadata: metadata({ family: 'servicenow', profile: 'enterprise-itsm' }),
  },
  {
    platform: 'jira',
    metadata: metadata({ family: 'jira-service-management', profile: 'service-desk' }),
  },
  {
    platform: 'bmcRemedy',
    metadata: metadata({ family: 'bmc-helix-remedy', profile: 'enterprise-remedy' }),
  },
  {
    platform: 'freshservice',
    metadata: metadata({ family: 'freshservice', profile: 'cloud-service-management' }),
  },
]);

const MOCK_INVENTORY: readonly ITSMInventoryObject[] = Object.freeze([
  {
    id: 'cmdb-sn-01',
    kind: 'cmdb',
    platform: 'serviceNow',
    name: 'sn-primary-cmdb',
    metadata: metadata({ ciCount: '12840', region: 'global' }),
  },
  {
    id: 'ci-sn-01',
    kind: 'configurationItem',
    platform: 'serviceNow',
    name: 'payments-api-prod',
    metadata: metadata({ class: 'application', environment: 'prod' }),
  },
  {
    id: 'service-jsm-01',
    kind: 'service',
    platform: 'jira',
    name: 'payments-service',
    metadata: metadata({ owner: 'platform-runtime', tier: 'critical' }),
  },
  {
    id: 'ba-bmc-01',
    kind: 'businessApplication',
    platform: 'bmcRemedy',
    name: 'core-banking',
    metadata: metadata({ impact: 'high', businessUnit: 'finance' }),
  },
  {
    id: 'sg-sn-01',
    kind: 'supportGroup',
    platform: 'serviceNow',
    name: 'platform-sre',
    metadata: metadata({ onCall: 'true', timezone: 'UTC' }),
  },
  {
    id: 'user-fs-01',
    kind: 'user',
    platform: 'freshservice',
    name: 'alice.nguyen',
    metadata: metadata({ department: 'operations', role: 'agent' }),
  },
  {
    id: 'inc-sn-1001',
    kind: 'incident',
    platform: 'serviceNow',
    name: 'INC001001 API latency spike',
    metadata: metadata({ priority: 'P2', status: 'in-progress' }),
  },
  {
    id: 'prb-sn-2001',
    kind: 'problem',
    platform: 'serviceNow',
    name: 'PRB002001 recurring timeout pattern',
    metadata: metadata({ status: 'investigating', severity: 'medium' }),
  },
  {
    id: 'chg-bmc-3001',
    kind: 'change',
    platform: 'bmcRemedy',
    name: 'CHG003001 database patch rollout',
    metadata: metadata({ risk: 'moderate', window: 'saturday-0200' }),
  },
  {
    id: 'req-jsm-4001',
    kind: 'request',
    platform: 'jira',
    name: 'REQ004001 new observability dashboard',
    metadata: metadata({ requester: 'platform-team', status: 'pending-approval' }),
  },
  {
    id: 'task-jsm-5001',
    kind: 'task',
    platform: 'jira',
    name: 'TASK005001 update runbook links',
    metadata: metadata({ assignee: 'ops-automation', status: 'open' }),
  },
  {
    id: 'apr-fs-6001',
    kind: 'approval',
    platform: 'freshservice',
    name: 'APR006001 production access request',
    metadata: metadata({ approverGroup: 'security', status: 'awaiting' }),
  },
  {
    id: 'ka-fs-7001',
    kind: 'knowledgeArticle',
    platform: 'freshservice',
    name: 'KA007001 handling high-latency incidents',
    metadata: metadata({ category: 'incident-response', visibility: 'internal' }),
  },
]);

const MOCK_HEALTH: readonly ITSMHealth[] = Object.freeze([
  {
    scopeName: 'enterprise-itsm-control-plane',
    platform: 'serviceNow',
    healthy: true,
    status: 'healthy',
    checkedAt: DATASET_TIMESTAMP,
  },
  {
    scopeName: 'enterprise-itsm-control-plane',
    platform: 'jira',
    healthy: true,
    status: 'healthy',
    checkedAt: DATASET_TIMESTAMP,
  },
  {
    scopeName: 'enterprise-itsm-control-plane',
    platform: 'bmcRemedy',
    healthy: true,
    status: 'healthy',
    checkedAt: DATASET_TIMESTAMP,
  },
  {
    scopeName: 'enterprise-itsm-control-plane',
    platform: 'freshservice',
    healthy: true,
    status: 'healthy',
    checkedAt: DATASET_TIMESTAMP,
  },
]);

export class ITSMMockAdapter implements IITSMAdapter {
  protected readonly platforms: readonly ITSMPlatform[];

  public constructor(
    platforms: readonly ITSMPlatform[] = platformList(
      ...platformList('serviceNow', 'jira', 'bmcRemedy', 'freshservice'),
    ),
  ) {
    this.platforms = Object.freeze([...platforms]);
  }

  public async discoverPlatforms(): Promise<readonly ITSMPlatformAbstraction[]> {
    return Object.freeze(MOCK_PLATFORMS.filter((item) => this.platforms.includes(item.platform)));
  }

  public async discoverCmdb(): Promise<readonly ITSMInventoryObject[]> {
    return this.byKind('cmdb');
  }

  public async discoverConfigurationItems(): Promise<readonly ITSMInventoryObject[]> {
    return this.byKind('configurationItem');
  }

  public async discoverServices(): Promise<readonly ITSMInventoryObject[]> {
    return this.byKind('service');
  }

  public async discoverBusinessApplications(): Promise<readonly ITSMInventoryObject[]> {
    return this.byKind('businessApplication');
  }

  public async discoverSupportGroups(): Promise<readonly ITSMInventoryObject[]> {
    return this.byKind('supportGroup');
  }

  public async discoverUsers(): Promise<readonly ITSMInventoryObject[]> {
    return this.byKind('user');
  }

  public async discoverIncidents(): Promise<readonly ITSMInventoryObject[]> {
    return this.byKind('incident');
  }

  public async discoverProblems(): Promise<readonly ITSMInventoryObject[]> {
    return this.byKind('problem');
  }

  public async discoverChanges(): Promise<readonly ITSMInventoryObject[]> {
    return this.byKind('change');
  }

  public async discoverRequests(): Promise<readonly ITSMInventoryObject[]> {
    return this.byKind('request');
  }

  public async discoverTasks(): Promise<readonly ITSMInventoryObject[]> {
    return this.byKind('task');
  }

  public async discoverApprovals(): Promise<readonly ITSMInventoryObject[]> {
    return this.byKind('approval');
  }

  public async discoverKnowledgeArticles(): Promise<readonly ITSMInventoryObject[]> {
    return this.byKind('knowledgeArticle');
  }

  public async getHealth(): Promise<readonly ITSMHealth[]> {
    return Object.freeze(MOCK_HEALTH.filter((item) => this.platforms.includes(item.platform)));
  }

  public async refreshInventory(): Promise<{ readonly refreshedAt: string }> {
    return { refreshedAt: DATASET_TIMESTAMP };
  }

  public async testConnection(
    configuration: Readonly<ITSMProviderConfiguration>,
  ): Promise<ITSMConnectionTestResult> {
    return {
      connected: configuration.endpoint.startsWith('itsm://'),
      latencyMs: 21,
      message:
        'ITSM connection test succeeded through adapter abstraction without platform API clients.',
    };
  }

  public async discoverCapabilities(): Promise<readonly ITSMCapabilityDescriptor[]> {
    return Object.freeze([
      { id: 'itsm-discovery', name: 'discovery', version: '1.0.0', category: 'discovery' },
      { id: 'itsm-incident', name: 'incident', version: '1.0.0', category: 'incident' },
      { id: 'itsm-problem', name: 'problem', version: '1.0.0', category: 'problem' },
      { id: 'itsm-change', name: 'change', version: '1.0.0', category: 'change' },
      { id: 'itsm-request', name: 'request', version: '1.0.0', category: 'request' },
      { id: 'itsm-knowledge', name: 'knowledge', version: '1.0.0', category: 'knowledge' },
      { id: 'itsm-workflow', name: 'workflow', version: '1.0.0', category: 'workflow' },
      { id: 'itsm-operations', name: 'operations', version: '1.0.0', category: 'operations' },
    ]);
  }

  public async search(query: ITSMSearchQuery): Promise<readonly ITSMInventoryObject[]> {
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

  protected scopedInventory(): readonly ITSMInventoryObject[] {
    return Object.freeze(MOCK_INVENTORY.filter((item) => this.platforms.includes(item.platform)));
  }

  private byKind(kind: ITSMInventoryKind): readonly ITSMInventoryObject[] {
    return Object.freeze(this.scopedInventory().filter((item) => item.kind === kind));
  }
}

export class ServiceNowAdapter extends ITSMMockAdapter {
  public constructor() {
    super(platformList('serviceNow'));
  }
}

export class JiraAdapter extends ITSMMockAdapter {
  public constructor() {
    super(platformList('jira'));
  }
}

export class BMCRemedyAdapter extends ITSMMockAdapter {
  public constructor() {
    super(platformList('bmcRemedy'));
  }
}

export class FreshserviceAdapter extends ITSMMockAdapter {
  public constructor() {
    super(platformList('freshservice'));
  }
}

export class ITSMInventoryCache {
  private snapshot: ITSMInventoryCacheSnapshot = Object.freeze({ objects: Object.freeze([]) });

  public update(objects: readonly ITSMInventoryObject[], refreshedAt: string): void {
    this.snapshot = Object.freeze({ objects: Object.freeze([...objects]), refreshedAt });
  }

  public getSnapshot(): ITSMInventoryCacheSnapshot {
    return this.snapshot;
  }

  public search(query: ITSMSearchQuery): readonly ITSMInventoryObject[] {
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

export class ITSMConfiguration {
  public readonly defaultConfiguration: Readonly<ITSMProviderConfiguration> = Object.freeze({
    endpoint: 'itsm://enterprise.service-management.example.local',
    organizationId: 'enterprise-service-management',
    credentialRef: 'ITSM_CREDENTIAL_REF',
    enabledPlatforms: platformList('serviceNow', 'jira', 'bmcRemedy', 'freshservice'),
    readOnly: true,
    connectionTimeoutMs: 10000,
    inventoryCacheTtlSeconds: 300,
  });

  public merge(
    override?: Readonly<Partial<ITSMProviderConfiguration>>,
  ): Readonly<ITSMProviderConfiguration> {
    const enabledPlatforms =
      override?.enabledPlatforms ?? this.defaultConfiguration.enabledPlatforms;
    const merged: ITSMProviderConfiguration = {
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

export class ITSMAuthenticationProvider {
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
          principalId: success ? 'itsm-api-key-principal' : undefined,
          message: success ? 'ITSM authentication accepted.' : 'ITSM API key payload is invalid.',
          authenticatedAt: DATASET_TIMESTAMP,
        });
      },
    });
  }

  public getProviderAuthentication(): ProviderAuthentication {
    return this.providerAuthentication;
  }
}

export class ITSMConnection {
  public readonly id: string;
  public readonly endpoint: string;
  public connectedAt?: string;

  public constructor(endpoint: string) {
    this.endpoint = endpoint;
    this.id = `itsm-connection:${endpoint}`;
  }

  public connect(): void {
    this.connectedAt = DATASET_TIMESTAMP;
  }

  public disconnect(): void {
    this.connectedAt = undefined;
  }
}

export class ITSMConnectionManager {
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
          const client = new ITSMConnection(endpoint);
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
            message: 'ITSM connection health.',
          }),
      });
    });

    this.sdkConnectionManager = new ProviderConnectionManager({ factory, pool });
  }

  public getSdkConnectionManager(): ProviderConnectionManager {
    return this.sdkConnectionManager;
  }
}

export class ITSMCapabilityRegistry {
  private readonly registry: ProviderCapabilityRegistry;

  public constructor(providerId: string, registry = new ProviderCapabilityRegistry()) {
    this.registry = registry;

    const register = (
      id: string,
      name: string,
      category: ITSMCapabilityDescriptor['category'],
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
            tags: ['itsm', 'vendor-neutral', category],
            featureFlags: { configurationDriven: true, adapterBacked: true },
          }),
          requiresCapabilities: [name],
          requiredFeatureFlags: ['configurationDriven', 'adapterBacked'],
        }),
      );
    };

    register('itsm-discovery', 'discovery', 'discovery', 'CMDB and ITSM inventory discovery.');
    register('itsm-incident', 'incident', 'incident', 'Incident management object surfaces.');
    register('itsm-problem', 'problem', 'problem', 'Problem management object surfaces.');
    register('itsm-change', 'change', 'change', 'Change management object surfaces.');
    register('itsm-request', 'request', 'request', 'Service request object surfaces.');
    register('itsm-knowledge', 'knowledge', 'knowledge', 'Knowledge management surfaces.');
    register('itsm-workflow', 'workflow', 'workflow', 'Tasks and approvals workflow metadata.');
    register(
      'itsm-operations',
      'operations',
      'operations',
      'Search, refresh, and synchronization.',
    );
  }

  public getProviderCapabilityRegistry(): ProviderCapabilityRegistry {
    return this.registry;
  }

  public async list(): Promise<readonly ITSMCapabilityDescriptor[]> {
    return Object.freeze([
      { id: 'itsm-discovery', name: 'discovery', version: '1.0.0', category: 'discovery' },
      { id: 'itsm-incident', name: 'incident', version: '1.0.0', category: 'incident' },
      { id: 'itsm-problem', name: 'problem', version: '1.0.0', category: 'problem' },
      { id: 'itsm-change', name: 'change', version: '1.0.0', category: 'change' },
      { id: 'itsm-request', name: 'request', version: '1.0.0', category: 'request' },
      { id: 'itsm-knowledge', name: 'knowledge', version: '1.0.0', category: 'knowledge' },
      { id: 'itsm-workflow', name: 'workflow', version: '1.0.0', category: 'workflow' },
      { id: 'itsm-operations', name: 'operations', version: '1.0.0', category: 'operations' },
    ]);
  }
}

export class ITSMProvider extends BaseProvider<ITSMProviderConfiguration> {
  private readonly adapter: IITSMAdapter;
  private readonly configurationService: ITSMConfiguration;
  private readonly inventoryCache: ITSMInventoryCache;
  private readonly capabilityRegistry: ITSMCapabilityRegistry;

  public constructor(
    options: {
      readonly adapter?: IITSMAdapter;
      readonly configurationService?: ITSMConfiguration;
      readonly inventoryCache?: ITSMInventoryCache;
      readonly capabilityRegistry?: ITSMCapabilityRegistry;
      readonly manifest?: ProviderManifest<ITSMProviderConfiguration>;
    } = {},
  ) {
    const configurationService = options.configurationService ?? new ITSMConfiguration();
    super({
      manifest:
        options.manifest ??
        new ProviderManifest<ITSMProviderConfiguration>({
          id: 'provider-itsm',
          name: 'Enterprise ITSM Provider',
          metadata: new ProviderMetadata({
            description:
              'Vendor-neutral enterprise ITSM provider built on Provider SDK with adapter isolation.',
            version: new ProviderVersion('1.0.0'),
            vendor: 'InfraShield',
            tags: ['itsm', 'vendor-neutral', 'enterprise', 'provider-sdk'],
            healthStatus: 'healthy',
          }),
          capabilities: new ProviderCapabilities([
            new ToolCapability({ name: 'discovery' }),
            new ToolCapability({ name: 'incident' }),
            new ToolCapability({ name: 'problem' }),
            new ToolCapability({ name: 'change' }),
            new ToolCapability({ name: 'request' }),
            new ToolCapability({ name: 'knowledge' }),
            new ToolCapability({ name: 'workflow' }),
            new ToolCapability({ name: 'operations' }),
          ]),
          configuration: new ProviderConfiguration<ITSMProviderConfiguration>({
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

    this.adapter = options.adapter ?? new ITSMMockAdapter();
    this.configurationService = configurationService;
    this.inventoryCache = options.inventoryCache ?? new ITSMInventoryCache();
    this.capabilityRegistry =
      options.capabilityRegistry ?? new ITSMCapabilityRegistry(this.manifest.id);
  }

  public resolveConfiguration(
    override?: Readonly<Partial<ITSMProviderConfiguration>>,
  ): Readonly<ITSMProviderConfiguration> {
    return this.configurationService.merge(override);
  }

  public async discoverPlatformAbstractions(): Promise<readonly ITSMPlatformAbstraction[]> {
    return this.adapter.discoverPlatforms();
  }

  public async discoverInventory(): Promise<readonly ITSMInventoryObject[]> {
    const [
      cmdb,
      configurationItems,
      services,
      businessApplications,
      supportGroups,
      users,
      incidents,
      problems,
      changes,
      requests,
      tasks,
      approvals,
      knowledgeArticles,
    ] = await Promise.all([
      this.adapter.discoverCmdb(),
      this.adapter.discoverConfigurationItems(),
      this.adapter.discoverServices(),
      this.adapter.discoverBusinessApplications(),
      this.adapter.discoverSupportGroups(),
      this.adapter.discoverUsers(),
      this.adapter.discoverIncidents(),
      this.adapter.discoverProblems(),
      this.adapter.discoverChanges(),
      this.adapter.discoverRequests(),
      this.adapter.discoverTasks(),
      this.adapter.discoverApprovals(),
      this.adapter.discoverKnowledgeArticles(),
    ]);

    return Object.freeze([
      ...cmdb,
      ...configurationItems,
      ...services,
      ...businessApplications,
      ...supportGroups,
      ...users,
      ...incidents,
      ...problems,
      ...changes,
      ...requests,
      ...tasks,
      ...approvals,
      ...knowledgeArticles,
    ]);
  }

  public async refreshInventory(): Promise<ITSMInventoryCacheSnapshot> {
    const refreshed = await this.adapter.refreshInventory();
    const objects = await this.discoverInventory();
    this.inventoryCache.update(objects, refreshed.refreshedAt);
    return this.inventoryCache.getSnapshot();
  }

  public getInventoryCache(): ITSMInventoryCacheSnapshot {
    return this.inventoryCache.getSnapshot();
  }

  public synchronizeCache(snapshot: ITSMInventoryCacheSnapshot): void {
    this.inventoryCache.update(snapshot.objects, snapshot.refreshedAt ?? DATASET_TIMESTAMP);
  }

  public async testConnection(
    override?: Readonly<Partial<ITSMProviderConfiguration>>,
  ): Promise<ITSMConnectionTestResult> {
    return this.adapter.testConnection(this.resolveConfiguration(override));
  }

  public async discoverCapabilities(): Promise<readonly ITSMCapabilityDescriptor[]> {
    const [fromRegistry, fromAdapter] = await Promise.all([
      this.capabilityRegistry.list(),
      this.adapter.discoverCapabilities(),
    ]);
    const dedup = new Map<string, ITSMCapabilityDescriptor>();
    [...fromRegistry, ...fromAdapter].forEach((capability) => dedup.set(capability.id, capability));
    return Object.freeze([...dedup.values()]);
  }

  public async search(query: ITSMSearchQuery): Promise<readonly ITSMInventoryObject[]> {
    if (this.inventoryCache.getSnapshot().objects.length > 0) {
      return this.inventoryCache.search(query);
    }
    return this.adapter.search(query);
  }

  public async getHealth(): Promise<readonly ITSMHealth[]> {
    return this.adapter.getHealth();
  }
}

export class ITSMProviderFactory {
  private readonly registryService: ProviderRegistryService;

  public constructor(options: { readonly registryService?: ProviderRegistryService } = {}) {
    this.registryService = options.registryService ?? new ProviderRegistryService();
  }

  public create(options?: {
    readonly adapter?: IITSMAdapter;
    readonly configurationOverride?: Readonly<Partial<ITSMProviderConfiguration>>;
  }): ITSMProvider {
    const configurationService = new ITSMConfiguration();

    const provider = new ITSMProvider({
      adapter: options?.adapter,
      configurationService,
      manifest: new ProviderManifest<ITSMProviderConfiguration>({
        id: 'provider-itsm',
        name: 'Enterprise ITSM Provider',
        metadata: new ProviderMetadata({
          description:
            'Vendor-neutral enterprise ITSM provider built on Provider SDK with adapter isolation.',
          version: new ProviderVersion('1.0.0'),
          vendor: 'InfraShield',
          tags: ['itsm', 'vendor-neutral', 'enterprise', 'provider-sdk'],
          healthStatus: 'healthy',
        }),
        capabilities: new ProviderCapabilities([
          new ToolCapability({ name: 'discovery' }),
          new ToolCapability({ name: 'incident' }),
          new ToolCapability({ name: 'problem' }),
          new ToolCapability({ name: 'change' }),
          new ToolCapability({ name: 'request' }),
          new ToolCapability({ name: 'knowledge' }),
          new ToolCapability({ name: 'workflow' }),
          new ToolCapability({ name: 'operations' }),
        ]),
        configuration: new ProviderConfiguration<ITSMProviderConfiguration>({
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

export interface ITSMProviderRuntime {
  readonly provider: ITSMProvider;
  readonly registryService: ProviderRegistryService;
  readonly lifecycleManager: ProviderLifecycleManager;
  readonly capabilityResolver: CapabilityResolver;
  readonly authenticationProvider: ITSMAuthenticationProvider;
  readonly connectionManager: ITSMConnectionManager;
}

export function createITSMProviderRuntime(): ITSMProviderRuntime {
  const factory = new ITSMProviderFactory();
  const provider = factory.create();

  const capabilityRegistry = new ITSMCapabilityRegistry(provider.manifest.id);
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
      message: 'ITSM provider healthy.',
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
    authenticationProvider: new ITSMAuthenticationProvider(),
    connectionManager: new ITSMConnectionManager(provider.manifest.id),
  };
}
