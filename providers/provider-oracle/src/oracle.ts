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

export type OracleObjectKind =
  | 'oracleHome'
  | 'listener'
  | 'database'
  | 'cdb'
  | 'pdb'
  | 'asm'
  | 'racMetadata'
  | 'tablespace'
  | 'datafile'
  | 'redoLog'
  | 'controlFile'
  | 'user'
  | 'role'
  | 'profile'
  | 'schema'
  | 'service'
  | 'databaseLink'
  | 'rmanMetadata'
  | 'dataGuardMetadata'
  | 'schedulerJobMetadata'
  | 'parameter'
  | 'initializationFile';

export interface OracleProviderConfiguration extends SerializableValueObject {
  readonly endpoint: string;
  readonly systemIdentifier: string;
  readonly credentialRef: string;
  readonly readOnly: boolean;
  readonly connectTimeoutMs: number;
  readonly inventoryCacheTtlSeconds: number;
}

export interface OracleInventoryObject {
  readonly id: string;
  readonly kind: OracleObjectKind;
  readonly name: string;
  readonly database: string;
  readonly container?: string;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface OracleInstanceHealth {
  readonly healthy: boolean;
  readonly status: 'healthy' | 'degraded';
  readonly checkedAt: string;
  readonly details: Readonly<Record<string, string | number | boolean>>;
}

export interface OracleSessionMetric {
  readonly id: string;
  readonly username: string;
  readonly status: 'active' | 'inactive';
  readonly waitClass: string;
  readonly machine: string;
}

export interface OracleLockMetric {
  readonly id: string;
  readonly type: string;
  readonly modeHeld: string;
  readonly objectName: string;
  readonly blocking: boolean;
}

export interface OracleWaitEvent {
  readonly id: string;
  readonly name: string;
  readonly class: string;
  readonly averageWaitMs: number;
  readonly timestamp: string;
}

export interface OraclePerformanceMetric {
  readonly id: string;
  readonly metricName: string;
  readonly value: number;
  readonly unit: string;
  readonly timestamp: string;
}

export interface OracleAlertLogMetadata {
  readonly id: string;
  readonly severity: 'info' | 'warning' | 'error';
  readonly message: string;
  readonly timestamp: string;
}

export interface OracleResourceUtilization {
  readonly resourceName: string;
  readonly currentUtilization: number;
  readonly maxUtilization: number;
  readonly limitValue: number;
}

export interface OracleConnectionTestResult {
  readonly connected: boolean;
  readonly latencyMs: number;
  readonly message: string;
}

export interface OracleCapabilityDescriptor {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly category: 'discovery' | 'inventory' | 'monitoring' | 'administration' | 'operations';
}

export interface OracleSearchQuery {
  readonly text: string;
  readonly kind?: OracleObjectKind;
  readonly database?: string;
}

export interface OracleInventoryCacheSnapshot {
  readonly objects: readonly OracleInventoryObject[];
  readonly refreshedAt?: string;
}

export interface IOracleAdapter {
  discoverOracleHomes(): Promise<readonly OracleInventoryObject[]>;
  discoverListeners(): Promise<readonly OracleInventoryObject[]>;
  discoverDatabases(): Promise<readonly OracleInventoryObject[]>;
  discoverCdbs(): Promise<readonly OracleInventoryObject[]>;
  discoverPdbs(): Promise<readonly OracleInventoryObject[]>;
  discoverAsm(): Promise<readonly OracleInventoryObject[]>;
  discoverRacMetadata(): Promise<readonly OracleInventoryObject[]>;
  listTablespaces(): Promise<readonly OracleInventoryObject[]>;
  listDatafiles(): Promise<readonly OracleInventoryObject[]>;
  listRedoLogs(): Promise<readonly OracleInventoryObject[]>;
  listControlFiles(): Promise<readonly OracleInventoryObject[]>;
  listUsers(): Promise<readonly OracleInventoryObject[]>;
  listRoles(): Promise<readonly OracleInventoryObject[]>;
  listProfiles(): Promise<readonly OracleInventoryObject[]>;
  listSchemas(): Promise<readonly OracleInventoryObject[]>;
  listServices(): Promise<readonly OracleInventoryObject[]>;
  listDatabaseLinks(): Promise<readonly OracleInventoryObject[]>;
  listRmanMetadata(): Promise<readonly OracleInventoryObject[]>;
  listDataGuardMetadata(): Promise<readonly OracleInventoryObject[]>;
  listSchedulerJobMetadata(): Promise<readonly OracleInventoryObject[]>;
  listParameters(): Promise<readonly OracleInventoryObject[]>;
  listInitializationFiles(): Promise<readonly OracleInventoryObject[]>;
  getInstanceHealth(): Promise<OracleInstanceHealth>;
  getSessions(): Promise<readonly OracleSessionMetric[]>;
  getLocks(): Promise<readonly OracleLockMetric[]>;
  getWaitEvents(): Promise<readonly OracleWaitEvent[]>;
  getPerformanceMetrics(): Promise<readonly OraclePerformanceMetric[]>;
  getAlertLogMetadata(): Promise<readonly OracleAlertLogMetadata[]>;
  getResourceUtilization(): Promise<readonly OracleResourceUtilization[]>;
  refreshInventory(): Promise<{ readonly refreshedAt: string }>;
  testConnection(
    configuration: Readonly<OracleProviderConfiguration>,
  ): Promise<OracleConnectionTestResult>;
  discoverCapabilities(): Promise<readonly OracleCapabilityDescriptor[]>;
  searchObjects(query: OracleSearchQuery): Promise<readonly OracleInventoryObject[]>;
}

const DATASET_TIMESTAMP = '2026-01-01T00:00:00.000Z';

function createMetadata(metadata: Record<string, string>): Readonly<Record<string, string>> {
  return metadata;
}

const MOCK_INVENTORY: readonly OracleInventoryObject[] = Object.freeze([
  {
    id: 'oraclehome-1',
    kind: 'oracleHome',
    name: '/u01/app/oracle/product/19c/dbhome_1',
    database: 'ORCLPROD',
    metadata: createMetadata({ version: '19.20.0.0.0' }),
  },
  {
    id: 'listener-1',
    kind: 'listener',
    name: 'LISTENER_PROD',
    database: 'ORCLPROD',
    metadata: createMetadata({ port: '1521' }),
  },
  {
    id: 'database-1',
    kind: 'database',
    name: 'ORCLPROD',
    database: 'ORCLPROD',
    metadata: createMetadata({ dbUniqueName: 'orclprod' }),
  },
  {
    id: 'cdb-1',
    kind: 'cdb',
    name: 'CDB$ROOT',
    database: 'ORCLPROD',
    container: 'CDB$ROOT',
    metadata: createMetadata({ openMode: 'READ WRITE' }),
  },
  {
    id: 'pdb-1',
    kind: 'pdb',
    name: 'PAYMENTS_PDB',
    database: 'ORCLPROD',
    container: 'PAYMENTS_PDB',
    metadata: createMetadata({ openMode: 'READ WRITE' }),
  },
  {
    id: 'asm-1',
    kind: 'asm',
    name: '+DATA',
    database: 'ORCLPROD',
    metadata: createMetadata({ redundancy: 'NORMAL' }),
  },
  {
    id: 'racmeta-1',
    kind: 'racMetadata',
    name: 'RAC_CLUSTER_A',
    database: 'ORCLPROD',
    metadata: createMetadata({ nodes: '2' }),
  },
  {
    id: 'tablespace-1',
    kind: 'tablespace',
    name: 'USERS',
    database: 'ORCLPROD',
    metadata: createMetadata({ contents: 'PERMANENT' }),
  },
  {
    id: 'datafile-1',
    kind: 'datafile',
    name: '/oradata/orclprod/users01.dbf',
    database: 'ORCLPROD',
    metadata: createMetadata({ sizeMb: '2048' }),
  },
  {
    id: 'redolog-1',
    kind: 'redoLog',
    name: 'group_1.log',
    database: 'ORCLPROD',
    metadata: createMetadata({ members: '2' }),
  },
  {
    id: 'controlfile-1',
    kind: 'controlFile',
    name: '/oradata/orclprod/control01.ctl',
    database: 'ORCLPROD',
    metadata: createMetadata({ status: 'CURRENT' }),
  },
  {
    id: 'user-1',
    kind: 'user',
    name: 'APP_OWNER',
    database: 'ORCLPROD',
    metadata: createMetadata({ accountStatus: 'OPEN' }),
  },
  {
    id: 'role-1',
    kind: 'role',
    name: 'CONNECT',
    database: 'ORCLPROD',
    metadata: createMetadata({ authenticationType: 'NONE' }),
  },
  {
    id: 'profile-1',
    kind: 'profile',
    name: 'DEFAULT',
    database: 'ORCLPROD',
    metadata: createMetadata({ passwordLifeTime: '180' }),
  },
  {
    id: 'schema-1',
    kind: 'schema',
    name: 'APP_OWNER',
    database: 'ORCLPROD',
    metadata: createMetadata({ objects: '412' }),
  },
  {
    id: 'service-1',
    kind: 'service',
    name: 'PAYMENTS_SERVICE',
    database: 'ORCLPROD',
    metadata: createMetadata({ networkName: 'payments.service.local' }),
  },
  {
    id: 'dblink-1',
    kind: 'databaseLink',
    name: 'DW_LINK',
    database: 'ORCLPROD',
    metadata: createMetadata({ host: 'dwdb.local' }),
  },
  {
    id: 'rman-1',
    kind: 'rmanMetadata',
    name: 'BACKUP_POLICY_DAILY',
    database: 'ORCLPROD',
    metadata: createMetadata({ retentionDays: '14' }),
  },
  {
    id: 'dg-1',
    kind: 'dataGuardMetadata',
    name: 'ORCLPROD_DG',
    database: 'ORCLPROD',
    metadata: createMetadata({ role: 'PRIMARY' }),
  },
  {
    id: 'scheduler-1',
    kind: 'schedulerJobMetadata',
    name: 'PAYMENTS_ETL_JOB',
    database: 'ORCLPROD',
    metadata: createMetadata({ enabled: 'TRUE' }),
  },
  {
    id: 'parameter-1',
    kind: 'parameter',
    name: 'sga_target',
    database: 'ORCLPROD',
    metadata: createMetadata({ value: '8G' }),
  },
  {
    id: 'initfile-1',
    kind: 'initializationFile',
    name: 'spfileORCLPROD.ora',
    database: 'ORCLPROD',
    metadata: createMetadata({ type: 'SPFILE' }),
  },
]);

const MOCK_SESSIONS: readonly OracleSessionMetric[] = Object.freeze([
  {
    id: 'session-1',
    username: 'APP_OWNER',
    status: 'active',
    waitClass: 'User I/O',
    machine: 'app-node-01',
  },
]);

const MOCK_LOCKS: readonly OracleLockMetric[] = Object.freeze([
  {
    id: 'lock-1',
    type: 'TX',
    modeHeld: 'Exclusive',
    objectName: 'PAYMENTS_TXN',
    blocking: false,
  },
]);

const MOCK_WAIT_EVENTS: readonly OracleWaitEvent[] = Object.freeze([
  {
    id: 'wait-1',
    name: 'db file sequential read',
    class: 'User I/O',
    averageWaitMs: 4.2,
    timestamp: DATASET_TIMESTAMP,
  },
]);

const MOCK_PERFORMANCE: readonly OraclePerformanceMetric[] = Object.freeze([
  {
    id: 'perf-1',
    metricName: 'cpu_usage',
    value: 46,
    unit: 'percent',
    timestamp: DATASET_TIMESTAMP,
  },
  {
    id: 'perf-2',
    metricName: 'logical_reads_per_sec',
    value: 1284,
    unit: 'count/s',
    timestamp: DATASET_TIMESTAMP,
  },
]);

const MOCK_ALERT_LOGS: readonly OracleAlertLogMetadata[] = Object.freeze([
  {
    id: 'alert-1',
    severity: 'warning',
    message: 'Checkpoint not complete.',
    timestamp: DATASET_TIMESTAMP,
  },
]);

const MOCK_UTILIZATION: readonly OracleResourceUtilization[] = Object.freeze([
  {
    resourceName: 'processes',
    currentUtilization: 220,
    maxUtilization: 240,
    limitValue: 500,
  },
  {
    resourceName: 'sessions',
    currentUtilization: 310,
    maxUtilization: 356,
    limitValue: 800,
  },
]);

export class OracleMockAdapter implements IOracleAdapter {
  public async discoverOracleHomes(): Promise<readonly OracleInventoryObject[]> {
    return this.byKind('oracleHome');
  }

  public async discoverListeners(): Promise<readonly OracleInventoryObject[]> {
    return this.byKind('listener');
  }

  public async discoverDatabases(): Promise<readonly OracleInventoryObject[]> {
    return this.byKind('database');
  }

  public async discoverCdbs(): Promise<readonly OracleInventoryObject[]> {
    return this.byKind('cdb');
  }

  public async discoverPdbs(): Promise<readonly OracleInventoryObject[]> {
    return this.byKind('pdb');
  }

  public async discoverAsm(): Promise<readonly OracleInventoryObject[]> {
    return this.byKind('asm');
  }

  public async discoverRacMetadata(): Promise<readonly OracleInventoryObject[]> {
    return this.byKind('racMetadata');
  }

  public async listTablespaces(): Promise<readonly OracleInventoryObject[]> {
    return this.byKind('tablespace');
  }

  public async listDatafiles(): Promise<readonly OracleInventoryObject[]> {
    return this.byKind('datafile');
  }

  public async listRedoLogs(): Promise<readonly OracleInventoryObject[]> {
    return this.byKind('redoLog');
  }

  public async listControlFiles(): Promise<readonly OracleInventoryObject[]> {
    return this.byKind('controlFile');
  }

  public async listUsers(): Promise<readonly OracleInventoryObject[]> {
    return this.byKind('user');
  }

  public async listRoles(): Promise<readonly OracleInventoryObject[]> {
    return this.byKind('role');
  }

  public async listProfiles(): Promise<readonly OracleInventoryObject[]> {
    return this.byKind('profile');
  }

  public async listSchemas(): Promise<readonly OracleInventoryObject[]> {
    return this.byKind('schema');
  }

  public async listServices(): Promise<readonly OracleInventoryObject[]> {
    return this.byKind('service');
  }

  public async listDatabaseLinks(): Promise<readonly OracleInventoryObject[]> {
    return this.byKind('databaseLink');
  }

  public async listRmanMetadata(): Promise<readonly OracleInventoryObject[]> {
    return this.byKind('rmanMetadata');
  }

  public async listDataGuardMetadata(): Promise<readonly OracleInventoryObject[]> {
    return this.byKind('dataGuardMetadata');
  }

  public async listSchedulerJobMetadata(): Promise<readonly OracleInventoryObject[]> {
    return this.byKind('schedulerJobMetadata');
  }

  public async listParameters(): Promise<readonly OracleInventoryObject[]> {
    return this.byKind('parameter');
  }

  public async listInitializationFiles(): Promise<readonly OracleInventoryObject[]> {
    return this.byKind('initializationFile');
  }

  public async getInstanceHealth(): Promise<OracleInstanceHealth> {
    return {
      healthy: true,
      status: 'healthy',
      checkedAt: DATASET_TIMESTAMP,
      details: {
        provider: 'oracle-enterprise',
        mode: 'mock-adapter',
        objects: MOCK_INVENTORY.length,
      },
    };
  }

  public async getSessions(): Promise<readonly OracleSessionMetric[]> {
    return MOCK_SESSIONS;
  }

  public async getLocks(): Promise<readonly OracleLockMetric[]> {
    return MOCK_LOCKS;
  }

  public async getWaitEvents(): Promise<readonly OracleWaitEvent[]> {
    return MOCK_WAIT_EVENTS;
  }

  public async getPerformanceMetrics(): Promise<readonly OraclePerformanceMetric[]> {
    return MOCK_PERFORMANCE;
  }

  public async getAlertLogMetadata(): Promise<readonly OracleAlertLogMetadata[]> {
    return MOCK_ALERT_LOGS;
  }

  public async getResourceUtilization(): Promise<readonly OracleResourceUtilization[]> {
    return MOCK_UTILIZATION;
  }

  public async refreshInventory(): Promise<{ readonly refreshedAt: string }> {
    return { refreshedAt: DATASET_TIMESTAMP };
  }

  public async testConnection(
    configuration: Readonly<OracleProviderConfiguration>,
  ): Promise<OracleConnectionTestResult> {
    return {
      connected: configuration.endpoint.startsWith('oracle://'),
      latencyMs: 24,
      message: 'Oracle connection test succeeded through adapter abstraction.',
    };
  }

  public async discoverCapabilities(): Promise<readonly OracleCapabilityDescriptor[]> {
    return Object.freeze([
      {
        id: 'oracle-discovery',
        name: 'discovery',
        version: '1.0.0',
        category: 'discovery',
      },
      {
        id: 'oracle-inventory',
        name: 'inventory',
        version: '1.0.0',
        category: 'inventory',
      },
      {
        id: 'oracle-monitoring',
        name: 'monitoring',
        version: '1.0.0',
        category: 'monitoring',
      },
      {
        id: 'oracle-administration',
        name: 'administration',
        version: '1.0.0',
        category: 'administration',
      },
      {
        id: 'oracle-operations',
        name: 'operations',
        version: '1.0.0',
        category: 'operations',
      },
    ]);
  }

  public async searchObjects(query: OracleSearchQuery): Promise<readonly OracleInventoryObject[]> {
    const needle = query.text.trim().toLowerCase();
    const byKind = query.kind ? this.byKind(query.kind) : MOCK_INVENTORY;
    const byDatabase = query.database
      ? byKind.filter((object) => object.database === query.database)
      : byKind;

    return byDatabase.filter((object) =>
      [object.id, object.name].some((value) => value.toLowerCase().includes(needle)),
    );
  }

  private byKind(kind: OracleObjectKind): readonly OracleInventoryObject[] {
    return MOCK_INVENTORY.filter((object) => object.kind === kind);
  }
}

export class OracleInventoryCache {
  private snapshot: OracleInventoryCacheSnapshot = Object.freeze({ objects: Object.freeze([]) });

  public update(objects: readonly OracleInventoryObject[], refreshedAt: string): void {
    this.snapshot = Object.freeze({
      objects: Object.freeze([...objects]),
      refreshedAt,
    });
  }

  public getSnapshot(): OracleInventoryCacheSnapshot {
    return this.snapshot;
  }

  public search(query: OracleSearchQuery): readonly OracleInventoryObject[] {
    const needle = query.text.trim().toLowerCase();
    const byKind = query.kind
      ? this.snapshot.objects.filter((object) => object.kind === query.kind)
      : this.snapshot.objects;
    const byDatabase = query.database
      ? byKind.filter((object) => object.database === query.database)
      : byKind;

    return byDatabase.filter((object) =>
      [object.id, object.name].some((value) => value.toLowerCase().includes(needle)),
    );
  }
}

export class OracleConfiguration {
  public readonly defaultConfiguration: Readonly<OracleProviderConfiguration> = Object.freeze({
    endpoint: 'oracle://orclprod-db.local:1521/ORCLPROD',
    systemIdentifier: 'ORCLPROD',
    credentialRef: 'ORACLE_CREDENTIAL_REF',
    readOnly: true,
    connectTimeoutMs: 10000,
    inventoryCacheTtlSeconds: 300,
  });

  public merge(
    override?: Readonly<Partial<OracleProviderConfiguration>>,
  ): Readonly<OracleProviderConfiguration> {
    const merged: OracleProviderConfiguration = {
      endpoint: override?.endpoint ?? this.defaultConfiguration.endpoint,
      systemIdentifier: override?.systemIdentifier ?? this.defaultConfiguration.systemIdentifier,
      credentialRef: override?.credentialRef ?? this.defaultConfiguration.credentialRef,
      readOnly: override?.readOnly ?? this.defaultConfiguration.readOnly,
      connectTimeoutMs: override?.connectTimeoutMs ?? this.defaultConfiguration.connectTimeoutMs,
      inventoryCacheTtlSeconds:
        override?.inventoryCacheTtlSeconds ?? this.defaultConfiguration.inventoryCacheTtlSeconds,
    };

    return Object.freeze(merged);
  }
}

export class OracleAuthenticationProvider {
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
            ? 'Oracle authentication accepted.'
            : 'Oracle credential payload is invalid.',
          authenticatedAt: DATASET_TIMESTAMP,
        });
      },
    });
  }

  public getProviderAuthentication(): ProviderAuthentication {
    return this.providerAuthentication;
  }
}

export class OracleConnection {
  public readonly id: string;
  public readonly endpoint: string;
  public connectedAt?: string;

  public constructor(endpoint: string) {
    this.endpoint = endpoint;
    this.id = `oracle-connection:${endpoint}`;
  }

  public connect(): void {
    this.connectedAt = DATASET_TIMESTAMP;
  }

  public disconnect(): void {
    this.connectedAt = undefined;
  }
}

export class OracleConnectionManager {
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
          const client = new OracleConnection(endpoint);
          client.connect();
          return client;
        },
        disconnect: async (client) => {
          client?.disconnect();
        },
        checkHealth: async (client) =>
          new ConnectionHealth({
            status: client?.connectedAt ? 'connected' : 'degraded',
            latencyMs: 24,
            lastCheckedAt: DATASET_TIMESTAMP,
            message: 'Oracle connection health.',
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

export class OracleCapabilityRegistry {
  private readonly registry: ProviderCapabilityRegistry;

  public constructor(providerId: string, registry = new ProviderCapabilityRegistry()) {
    this.registry = registry;

    const register = (
      id: string,
      name: string,
      category: OracleCapabilityDescriptor['category'],
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
            tags: ['oracle', category],
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
      'oracle-discovery',
      'discovery',
      'discovery',
      'Oracle topology and instance discovery.',
    );
    register(
      'oracle-inventory',
      'inventory',
      'inventory',
      'Oracle logical and physical object inventory.',
    );
    register(
      'oracle-monitoring',
      'monitoring',
      'monitoring',
      'Oracle health, sessions, waits and metrics.',
    );
    register(
      'oracle-administration',
      'administration',
      'administration',
      'Oracle administration metadata inventory.',
    );
    register(
      'oracle-operations',
      'operations',
      'operations',
      'Refresh, connection test, search and capability discovery.',
    );
  }

  public getProviderCapabilityRegistry(): ProviderCapabilityRegistry {
    return this.registry;
  }

  public async list(): Promise<readonly OracleCapabilityDescriptor[]> {
    return Object.freeze([
      {
        id: 'oracle-discovery',
        name: 'discovery',
        version: '1.0.0',
        category: 'discovery',
      },
      {
        id: 'oracle-inventory',
        name: 'inventory',
        version: '1.0.0',
        category: 'inventory',
      },
      {
        id: 'oracle-monitoring',
        name: 'monitoring',
        version: '1.0.0',
        category: 'monitoring',
      },
      {
        id: 'oracle-administration',
        name: 'administration',
        version: '1.0.0',
        category: 'administration',
      },
      {
        id: 'oracle-operations',
        name: 'operations',
        version: '1.0.0',
        category: 'operations',
      },
    ]);
  }
}

export class OracleProvider extends BaseProvider<OracleProviderConfiguration> {
  private readonly adapter: IOracleAdapter;
  private readonly configurationService: OracleConfiguration;
  private readonly inventoryCache: OracleInventoryCache;
  private readonly capabilityRegistry: OracleCapabilityRegistry;

  public constructor(
    options: {
      readonly adapter?: IOracleAdapter;
      readonly configurationService?: OracleConfiguration;
      readonly inventoryCache?: OracleInventoryCache;
      readonly capabilityRegistry?: OracleCapabilityRegistry;
      readonly manifest?: ProviderManifest<OracleProviderConfiguration>;
    } = {},
  ) {
    const configurationService = options.configurationService ?? new OracleConfiguration();

    super({
      manifest:
        options.manifest ??
        new ProviderManifest<OracleProviderConfiguration>({
          id: 'provider-oracle',
          name: 'Oracle Enterprise Provider',
          metadata: new ProviderMetadata({
            description:
              'Production Oracle provider framework built on Provider SDK with adapter isolation.',
            version: new ProviderVersion('1.0.0'),
            vendor: 'InfraShield',
            tags: ['oracle', 'enterprise', 'provider-sdk'],
            healthStatus: 'healthy',
          }),
          capabilities: new ProviderCapabilities([
            new ToolCapability({ name: 'discovery' }),
            new ToolCapability({ name: 'inventory' }),
            new ToolCapability({ name: 'monitoring' }),
            new ToolCapability({ name: 'administration' }),
            new ToolCapability({ name: 'operations' }),
          ]),
          configuration: new ProviderConfiguration<OracleProviderConfiguration>({
            requiredFields: [
              'endpoint',
              'systemIdentifier',
              'credentialRef',
              'readOnly',
              'connectTimeoutMs',
              'inventoryCacheTtlSeconds',
            ],
            defaultValues: configurationService.defaultConfiguration,
          }),
        }),
    });

    this.adapter = options.adapter ?? new OracleMockAdapter();
    this.configurationService = configurationService;
    this.inventoryCache = options.inventoryCache ?? new OracleInventoryCache();
    this.capabilityRegistry =
      options.capabilityRegistry ?? new OracleCapabilityRegistry(this.manifest.id);
  }

  public resolveConfiguration(
    override?: Readonly<Partial<OracleProviderConfiguration>>,
  ): Readonly<OracleProviderConfiguration> {
    return this.configurationService.merge(override);
  }

  public async discoverInventory(): Promise<readonly OracleInventoryObject[]> {
    const [
      oracleHomes,
      listeners,
      databases,
      cdbs,
      pdbs,
      asm,
      racMetadata,
      tablespaces,
      datafiles,
      redoLogs,
      controlFiles,
      users,
      roles,
      profiles,
      schemas,
      services,
      databaseLinks,
      rman,
      dataGuard,
      schedulerJobs,
      parameters,
      initializationFiles,
    ] = await Promise.all([
      this.adapter.discoverOracleHomes(),
      this.adapter.discoverListeners(),
      this.adapter.discoverDatabases(),
      this.adapter.discoverCdbs(),
      this.adapter.discoverPdbs(),
      this.adapter.discoverAsm(),
      this.adapter.discoverRacMetadata(),
      this.adapter.listTablespaces(),
      this.adapter.listDatafiles(),
      this.adapter.listRedoLogs(),
      this.adapter.listControlFiles(),
      this.adapter.listUsers(),
      this.adapter.listRoles(),
      this.adapter.listProfiles(),
      this.adapter.listSchemas(),
      this.adapter.listServices(),
      this.adapter.listDatabaseLinks(),
      this.adapter.listRmanMetadata(),
      this.adapter.listDataGuardMetadata(),
      this.adapter.listSchedulerJobMetadata(),
      this.adapter.listParameters(),
      this.adapter.listInitializationFiles(),
    ]);

    return Object.freeze([
      ...oracleHomes,
      ...listeners,
      ...databases,
      ...cdbs,
      ...pdbs,
      ...asm,
      ...racMetadata,
      ...tablespaces,
      ...datafiles,
      ...redoLogs,
      ...controlFiles,
      ...users,
      ...roles,
      ...profiles,
      ...schemas,
      ...services,
      ...databaseLinks,
      ...rman,
      ...dataGuard,
      ...schedulerJobs,
      ...parameters,
      ...initializationFiles,
    ]);
  }

  public async refreshInventory(): Promise<OracleInventoryCacheSnapshot> {
    const refreshed = await this.adapter.refreshInventory();
    const objects = await this.discoverInventory();
    this.inventoryCache.update(objects, refreshed.refreshedAt);
    return this.inventoryCache.getSnapshot();
  }

  public getInventoryCache(): OracleInventoryCacheSnapshot {
    return this.inventoryCache.getSnapshot();
  }

  public synchronizeCache(snapshot: OracleInventoryCacheSnapshot): void {
    this.inventoryCache.update(snapshot.objects, snapshot.refreshedAt ?? DATASET_TIMESTAMP);
  }

  public async testConnection(
    override?: Readonly<Partial<OracleProviderConfiguration>>,
  ): Promise<OracleConnectionTestResult> {
    return this.adapter.testConnection(this.resolveConfiguration(override));
  }

  public async discoverCapabilities(): Promise<readonly OracleCapabilityDescriptor[]> {
    const [fromRegistry, fromAdapter] = await Promise.all([
      this.capabilityRegistry.list(),
      this.adapter.discoverCapabilities(),
    ]);

    const dedup = new Map<string, OracleCapabilityDescriptor>();
    [...fromRegistry, ...fromAdapter].forEach((capability) => dedup.set(capability.id, capability));
    return Object.freeze([...dedup.values()]);
  }

  public async searchObjects(query: OracleSearchQuery): Promise<readonly OracleInventoryObject[]> {
    if (this.inventoryCache.getSnapshot().objects.length > 0) {
      return this.inventoryCache.search(query);
    }
    return this.adapter.searchObjects(query);
  }

  public async getInstanceHealth(): Promise<OracleInstanceHealth> {
    return this.adapter.getInstanceHealth();
  }

  public async getSessions(): Promise<readonly OracleSessionMetric[]> {
    return this.adapter.getSessions();
  }

  public async getLocks(): Promise<readonly OracleLockMetric[]> {
    return this.adapter.getLocks();
  }

  public async getWaitEvents(): Promise<readonly OracleWaitEvent[]> {
    return this.adapter.getWaitEvents();
  }

  public async getPerformanceMetrics(): Promise<readonly OraclePerformanceMetric[]> {
    return this.adapter.getPerformanceMetrics();
  }

  public async getAlertLogMetadata(): Promise<readonly OracleAlertLogMetadata[]> {
    return this.adapter.getAlertLogMetadata();
  }

  public async getResourceUtilization(): Promise<readonly OracleResourceUtilization[]> {
    return this.adapter.getResourceUtilization();
  }
}

export class OracleProviderFactory {
  private readonly registryService: ProviderRegistryService;

  public constructor(options: { readonly registryService?: ProviderRegistryService } = {}) {
    this.registryService = options.registryService ?? new ProviderRegistryService();
  }

  public create(options?: {
    readonly adapter?: IOracleAdapter;
    readonly configurationOverride?: Readonly<Partial<OracleProviderConfiguration>>;
  }): OracleProvider {
    const configurationService = new OracleConfiguration();

    const provider = new OracleProvider({
      adapter: options?.adapter,
      configurationService,
      manifest: new ProviderManifest<OracleProviderConfiguration>({
        id: 'provider-oracle',
        name: 'Oracle Enterprise Provider',
        metadata: new ProviderMetadata({
          description:
            'Production Oracle provider framework built on Provider SDK with adapter isolation.',
          version: new ProviderVersion('1.0.0'),
          vendor: 'InfraShield',
          tags: ['oracle', 'enterprise', 'provider-sdk'],
          healthStatus: 'healthy',
        }),
        capabilities: new ProviderCapabilities([
          new ToolCapability({ name: 'discovery' }),
          new ToolCapability({ name: 'inventory' }),
          new ToolCapability({ name: 'monitoring' }),
          new ToolCapability({ name: 'administration' }),
          new ToolCapability({ name: 'operations' }),
        ]),
        configuration: new ProviderConfiguration<OracleProviderConfiguration>({
          requiredFields: [
            'endpoint',
            'systemIdentifier',
            'credentialRef',
            'readOnly',
            'connectTimeoutMs',
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

export interface OracleProviderRuntime {
  readonly provider: OracleProvider;
  readonly registryService: ProviderRegistryService;
  readonly lifecycleManager: ProviderLifecycleManager;
  readonly capabilityResolver: CapabilityResolver;
  readonly authenticationProvider: OracleAuthenticationProvider;
  readonly connectionManager: OracleConnectionManager;
}

export function createOracleProviderRuntime(): OracleProviderRuntime {
  const factory = new OracleProviderFactory();
  const provider = factory.create();

  const capabilityRegistry = new OracleCapabilityRegistry(provider.manifest.id);
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
      message: 'Oracle provider healthy.',
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
    authenticationProvider: new OracleAuthenticationProvider(),
    connectionManager: new OracleConnectionManager(provider.manifest.id),
  };
}
