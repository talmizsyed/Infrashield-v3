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
  ProviderStartup,
  ProviderShutdown,
  ProviderVersion,
} from '@infrashield/providers';

export type MockInventoryResourceKind =
  'cluster' | 'namespace' | 'node' | 'deployment' | 'pod' | 'service';

export interface MockProviderConfiguration extends SerializableValueObject {
  readonly endpoint: string;
  readonly region: string;
  readonly tenantId: string;
  readonly apiKey: string;
  readonly readOnly: boolean;
  readonly latencyMs: number;
}

export interface MockInventoryResource {
  readonly id: string;
  readonly kind: MockInventoryResourceKind;
  readonly name: string;
  readonly parentId?: string;
  readonly labels: Readonly<Record<string, string>>;
  readonly status: 'running' | 'degraded' | 'stopped';
}

export interface MockMetricPoint {
  readonly resourceId: string;
  readonly cpuPercent: number;
  readonly memoryPercent: number;
  readonly timestamp: string;
}

export interface MockProviderEvent {
  readonly id: string;
  readonly type: 'info' | 'warning' | 'error';
  readonly message: string;
  readonly resourceId?: string;
  readonly timestamp: string;
}

export interface MockHealthStatus {
  readonly healthy: boolean;
  readonly status: 'healthy' | 'degraded';
  readonly checkedAt: string;
  readonly details: Readonly<Record<string, string | number | boolean>>;
}

export interface MockCommandResult {
  readonly command: string;
  readonly resourceId?: string;
  readonly accepted: boolean;
  readonly output: string;
  readonly executedAt: string;
}

const DATASET_TIMESTAMP = '2026-01-01T00:00:00.000Z';

function createLabels(labels: Record<string, string>): Readonly<Record<string, string>> {
  return labels;
}

const MOCK_INVENTORY: readonly MockInventoryResource[] = Object.freeze([
  {
    id: 'cluster-1',
    kind: 'cluster',
    name: 'mock-production',
    labels: createLabels({ environment: 'prod', provider: 'mock' }),
    status: 'running',
  },
  {
    id: 'namespace-payments',
    kind: 'namespace',
    name: 'payments',
    parentId: 'cluster-1',
    labels: createLabels({ team: 'platform', criticality: 'high' }),
    status: 'running',
  },
  {
    id: 'node-1',
    kind: 'node',
    name: 'worker-01',
    parentId: 'cluster-1',
    labels: createLabels({ zone: 'us-east-1a', role: 'compute' }),
    status: 'running',
  },
  {
    id: 'deployment-payments-api',
    kind: 'deployment',
    name: 'payments-api',
    parentId: 'namespace-payments',
    labels: createLabels({ app: 'payments', tier: 'api' }),
    status: 'running',
  },
  {
    id: 'pod-payments-api-7f9f',
    kind: 'pod',
    name: 'payments-api-7f9f',
    parentId: 'deployment-payments-api',
    labels: createLabels({ app: 'payments', replica: '1' }),
    status: 'degraded',
  },
  {
    id: 'service-payments-api',
    kind: 'service',
    name: 'payments-api',
    parentId: 'namespace-payments',
    labels: createLabels({ app: 'payments', protocol: 'http' }),
    status: 'running',
  },
]);

const MOCK_METRICS: readonly MockMetricPoint[] = Object.freeze([
  {
    resourceId: 'pod-payments-api-7f9f',
    cpuPercent: 63,
    memoryPercent: 71,
    timestamp: DATASET_TIMESTAMP,
  },
  {
    resourceId: 'node-1',
    cpuPercent: 49,
    memoryPercent: 54,
    timestamp: DATASET_TIMESTAMP,
  },
]);

const MOCK_EVENTS: readonly MockProviderEvent[] = Object.freeze([
  {
    id: 'evt-1',
    type: 'info',
    message: 'Inventory refresh completed.',
    timestamp: DATASET_TIMESTAMP,
  },
  {
    id: 'evt-2',
    type: 'warning',
    resourceId: 'pod-payments-api-7f9f',
    message: 'CPU sustained above 60%.',
    timestamp: DATASET_TIMESTAMP,
  },
]);

export class MockConnection {
  public readonly id: string;
  public readonly endpoint: string;
  public connectedAt?: string;

  public constructor(endpoint: string) {
    this.endpoint = endpoint;
    this.id = `mock-connection:${endpoint}`;
  }

  public connect(): void {
    this.connectedAt = DATASET_TIMESTAMP;
  }

  public disconnect(): void {
    this.connectedAt = undefined;
  }
}

export class MockAuthentication {
  public readonly method = 'api-key' as const;

  public async authenticate(
    context: { readonly provider: { readonly manifest: { readonly id: string } } },
    credential: { readonly method: 'api-key'; readonly apiKey: string },
  ): Promise<AuthenticationResult> {
    const isValid = credential.apiKey.startsWith('mock-');
    return new AuthenticationResult({
      success: isValid,
      method: 'api-key',
      providerId: context.provider.manifest.id,
      principalId: isValid ? 'mock-operator' : undefined,
      message: isValid ? 'Authenticated mock operator.' : 'Invalid mock api key.',
      authenticatedAt: DATASET_TIMESTAMP,
    });
  }
}

export class MockInventoryService {
  public async discover(): Promise<readonly MockInventoryResource[]> {
    return MOCK_INVENTORY;
  }
}

export class MockMetricsService {
  public async list(): Promise<readonly MockMetricPoint[]> {
    return MOCK_METRICS;
  }
}

export class MockHealthService {
  public async getHealth(): Promise<MockHealthStatus> {
    return {
      healthy: true,
      status: 'healthy',
      checkedAt: DATASET_TIMESTAMP,
      details: {
        source: 'reference-mock-provider',
        resources: MOCK_INVENTORY.length,
        warnings: 1,
      },
    };
  }
}

export class MockEventService {
  public async list(): Promise<readonly MockProviderEvent[]> {
    return MOCK_EVENTS;
  }
}

export class MockCommandExecutor {
  public async execute(command: string, resourceId?: string): Promise<MockCommandResult> {
    return {
      command,
      resourceId,
      accepted: true,
      output: `mock:${command}:ok`,
      executedAt: DATASET_TIMESTAMP,
    };
  }
}

export class MockConfigurationService {
  public readonly defaultConfiguration: Readonly<MockProviderConfiguration> = Object.freeze({
    endpoint: 'https://mock-provider.infrashield.local',
    region: 'us-east-1',
    tenantId: 'tenant-default',
    apiKey: 'mock-default-key',
    readOnly: true,
    latencyMs: 12,
  });

  public merge(
    override?: Readonly<Partial<MockProviderConfiguration>>,
  ): Readonly<MockProviderConfiguration> {
    const merged: MockProviderConfiguration = {
      endpoint: override?.endpoint ?? this.defaultConfiguration.endpoint,
      region: override?.region ?? this.defaultConfiguration.region,
      tenantId: override?.tenantId ?? this.defaultConfiguration.tenantId,
      apiKey: override?.apiKey ?? this.defaultConfiguration.apiKey,
      readOnly: override?.readOnly ?? this.defaultConfiguration.readOnly,
      latencyMs: override?.latencyMs ?? this.defaultConfiguration.latencyMs,
    };

    return Object.freeze(merged);
  }
}

export class MockProvider extends BaseProvider<MockProviderConfiguration> {
  private readonly inventoryService: MockInventoryService;
  private readonly metricsService: MockMetricsService;
  private readonly healthService: MockHealthService;
  private readonly eventService: MockEventService;
  private readonly commandExecutor: MockCommandExecutor;
  private readonly configurationService: MockConfigurationService;

  public constructor(
    options: {
      readonly manifest?: ProviderManifest<MockProviderConfiguration>;
      readonly inventoryService?: MockInventoryService;
      readonly metricsService?: MockMetricsService;
      readonly healthService?: MockHealthService;
      readonly eventService?: MockEventService;
      readonly commandExecutor?: MockCommandExecutor;
      readonly configurationService?: MockConfigurationService;
    } = {},
  ) {
    const configurationService = options.configurationService ?? new MockConfigurationService();

    super({
      manifest:
        options.manifest ??
        new ProviderManifest<MockProviderConfiguration>({
          id: 'provider-mock',
          name: 'Reference Mock Provider',
          metadata: new ProviderMetadata({
            description: 'Canonical provider SDK reference implementation with deterministic data.',
            version: new ProviderVersion('1.0.0'),
            vendor: 'InfraShield',
            tags: ['mock', 'reference', 'sdk'],
            healthStatus: 'healthy',
          }),
          capabilities: new ProviderCapabilities([
            new ToolCapability({ name: 'inventory' }),
            new ToolCapability({ name: 'metrics' }),
            new ToolCapability({ name: 'events' }),
            new ToolCapability({ name: 'health' }),
            new ToolCapability({ name: 'commands' }),
            new ToolCapability({ name: 'configuration' }),
          ]),
          configuration: new ProviderConfiguration<MockProviderConfiguration>({
            requiredFields: ['endpoint', 'region', 'tenantId', 'apiKey', 'readOnly', 'latencyMs'],
            defaultValues: configurationService.defaultConfiguration,
          }),
        }),
    });

    this.inventoryService = options.inventoryService ?? new MockInventoryService();
    this.metricsService = options.metricsService ?? new MockMetricsService();
    this.healthService = options.healthService ?? new MockHealthService();
    this.eventService = options.eventService ?? new MockEventService();
    this.commandExecutor = options.commandExecutor ?? new MockCommandExecutor();
    this.configurationService = configurationService;
  }

  public async discoverInventory(): Promise<readonly MockInventoryResource[]> {
    return this.inventoryService.discover();
  }

  public async getMetrics(): Promise<readonly MockMetricPoint[]> {
    return this.metricsService.list();
  }

  public async getEvents(): Promise<readonly MockProviderEvent[]> {
    return this.eventService.list();
  }

  public async getHealthDetails(): Promise<MockHealthStatus> {
    return this.healthService.getHealth();
  }

  public async executeCommand(command: string, resourceId?: string): Promise<MockCommandResult> {
    return this.commandExecutor.execute(command, resourceId);
  }

  public resolveConfiguration(
    override?: Readonly<Partial<MockProviderConfiguration>>,
  ): Readonly<MockProviderConfiguration> {
    return this.configurationService.merge(override);
  }

  public async testConnectivity(
    configuration?: Readonly<Partial<MockProviderConfiguration>>,
  ): Promise<{
    readonly connected: boolean;
    readonly latencyMs: number;
    readonly message: string;
  }> {
    const resolved = this.resolveConfiguration(configuration);
    return {
      connected: resolved.endpoint.startsWith('https://'),
      latencyMs: resolved.latencyMs,
      message: 'Mock connectivity test succeeded.',
    };
  }
}

export class MockProviderFactory {
  public create(options?: {
    readonly configurationOverride?: Readonly<Partial<MockProviderConfiguration>>;
  }): MockProvider {
    const provider = new MockProvider();
    if (options?.configurationOverride) {
      provider.resolveConfiguration(options.configurationOverride);
    }
    return provider;
  }
}

export interface MockProviderRuntime {
  readonly provider: MockProvider;
  readonly registryService: ProviderRegistryService;
  readonly lifecycleManager: ProviderLifecycleManager;
  readonly capabilityResolver: CapabilityResolver;
  readonly authentication: ProviderAuthentication;
  readonly connectionManager: ProviderConnectionManager;
  readonly credentialStore: CredentialStore;
  readonly connectionPool: ConnectionPool;
}

export function createMockProviderRuntime(): MockProviderRuntime {
  const provider = new MockProvider();
  const registryService = new ProviderRegistryService();
  registryService.register(provider.manifest);

  const capabilityRegistry = new ProviderCapabilityRegistry();
  const definition = new CapabilityDefinition({
    id: 'inventory-list',
    providerId: provider.manifest.id,
    name: 'inventory',
    version: new CapabilityVersion('1.0.0'),
    metadata: new CapabilityMetadata({
      description: 'List deterministic inventory resources.',
      tags: ['reference', 'inventory'],
      featureFlags: { deterministic: true },
    }),
    requiresCapabilities: ['inventory'],
    requiredFeatureFlags: ['deterministic'],
  });
  capabilityRegistry.register(definition);

  const capabilityResolver = new CapabilityResolver(capabilityRegistry, new CapabilityValidator());

  const lifecycleManager = new ProviderLifecycleManager({
    startup: new ProviderStartup(async () => undefined),
    shutdown: new ProviderShutdown(async () => undefined),
    healthMonitor: new ProviderHealthMonitor(async () => ({
      providerId: provider.manifest.id,
      status: 'healthy',
      healthy: true,
      checkedAt: DATASET_TIMESTAMP,
      message: 'Mock provider healthy.',
    })),
    recovery: new ProviderRecovery({
      maxAttempts: 1,
      recover: async () => true,
    }),
  });

  const credentialStore = new CredentialStore();
  const authentication = new ProviderAuthentication({
    credentialStore,
    autoStoreCredentials: true,
  });
  authentication.registerProvider(new MockAuthentication());

  const connectionFactory = new ConnectionFactory();
  const connectionPool = new ConnectionPool();
  connectionFactory.register(provider.manifest.id, (registeredProvider, context) => {
    const endpoint = String(context.configuration.endpoint);
    return new ProviderConnection({
      provider: registeredProvider,
      context,
      connect: async () => {
        const client = new MockConnection(endpoint);
        client.connect();
        return client;
      },
      disconnect: async (client) => {
        client?.disconnect();
      },
      checkHealth: async (client) =>
        new ConnectionHealth({
          status: client?.connectedAt ? 'connected' : 'degraded',
          latencyMs: 12,
          lastCheckedAt: DATASET_TIMESTAMP,
          message: 'Mock connection health.',
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
  };
}
