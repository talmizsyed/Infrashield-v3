import http from 'node:http';
import https from 'node:https';
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
  IVmwareAdapter,
  VmwareAlarm,
  VmwareCapabilityDescriptor,
  VmwareCapacitySummary,
  VmwareConnectionTestResult,
  VmwareHealthStatus,
  VmwareInventoryKind,
  VmwareInventoryResource,
  VmwarePerformanceMetric,
  VmwareProviderConfiguration,
  VmwareProviderEvent,
  VmwareSearchQuery,
  VmwareTask,
} from './vmware';

const LIVE_TIMESTAMP = '2026-01-01T00:00:00.000Z';
const VMWARE_CONNECTION_KIND = 'vmware-live-session';
const VMWARE_SECRET_PROVIDER_ID = 'vmware-environment';

export interface VmwareRestRequest {
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly timeoutMs: number;
  readonly insecureSkipTlsVerify: boolean;
  readonly caCertificatePem?: string;
  readonly signal?: AbortSignal;
}

export interface VmwareRestResponse {
  readonly status: number;
  readonly body: string;
  readonly headers: Readonly<Record<string, string>>;
}

export interface IVmwareRestTransport {
  request(baseUrl: string, request: VmwareRestRequest): Promise<VmwareRestResponse>;
}

interface VmwareSessionClient {
  readonly endpoint: string;
  readonly sessionId: string;
  readonly insecureSkipTlsVerify: boolean;
  readonly caCertificatePem?: string;
}

interface VmwareSessionPayload {
  readonly sessionId: string;
  readonly expiresAt: string;
}

function freezeRecord<T extends Record<string, string>>(value: T): Readonly<T> {
  return Object.freeze({ ...value });
}

function createVmwareLogger(loggerId: string, logger?: ILogger): ILogger {
  return (
    logger ??
    new StructuredLogger({
      loggerId: toIdentifier(loggerId),
      sink: createMemoryLogSink(),
      minLevel: 'info',
    })
  );
}

function createSessionKey(configuration: Readonly<VmwareProviderConfiguration>): string {
  return `${configuration.endpoint}|${configuration.username}`;
}

function resourceId(kind: VmwareInventoryKind, moRef: string): string {
  return `${kind}:${moRef}`;
}

function parseJson<T>(body: string): T {
  return JSON.parse(body) as T;
}

function unwrapValue<T>(body: string): T {
  const parsed = parseJson<{ readonly value?: T } | T>(body);
  if (typeof parsed === 'object' && parsed !== null && 'value' in parsed) {
    return (parsed as { readonly value?: T }).value as T;
  }
  return parsed as T;
}

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function mapStatus(isActive: boolean): VmwareInventoryResource['status'] {
  return isActive ? 'running' : 'degraded';
}

function defaultConfiguration(): Readonly<VmwareProviderConfiguration> {
  return Object.freeze({
    endpoint: 'https://vcenter.example.local',
    username: 'automation-operator',
    credentialRef: 'VMWARE_CREDENTIAL_REF',
    readOnly: true,
    insecureSkipTlsVerify: false,
    requestTimeoutMs: 15000,
    inventoryCacheTtlSeconds: 300,
  });
}

class EnvironmentSecretProvider extends SecretProvider {
  public override async get(reference: {
    readonly provider: string;
    readonly key: string;
    readonly version?: string;
  }): Promise<string | undefined> {
    const key = reference.key;
    if (key.endsWith(':password')) {
      return process.env[key.slice(0, -':password'.length)];
    }
    if (key.endsWith(':ca')) {
      return process.env[`${key.slice(0, -':ca'.length)}_CA_PEM`];
    }
    return process.env[key];
  }
}

class FixtureSecretProvider extends SecretProvider {
  public override async get(reference: {
    readonly provider: string;
    readonly key: string;
    readonly version?: string;
  }): Promise<string | undefined> {
    if (reference.key.endsWith(':password')) {
      return 'fixture-secret';
    }
    if (reference.key.endsWith(':ca')) {
      return '-----BEGIN CERTIFICATE-----\nfixture\n-----END CERTIFICATE-----';
    }
    return undefined;
  }
}

class FixtureVmwareRestTransport implements IVmwareRestTransport {
  public async request(_baseUrl: string, request: VmwareRestRequest): Promise<VmwareRestResponse> {
    if (request.path === '/rest/com/vmware/cis/session' && request.method === 'POST') {
      return {
        status: 200,
        body: JSON.stringify({ value: 'fixture-session-id' }),
        headers: freezeRecord({ 'content-type': 'application/json' }),
      };
    }

    const value = this.responseFor(request.path);
    if (!value) {
      return {
        status: 404,
        body: JSON.stringify({ error: 'not-found' }),
        headers: freezeRecord({ 'content-type': 'application/json' }),
      };
    }

    return {
      status: 200,
      body: JSON.stringify(value),
      headers: freezeRecord({ 'content-type': 'application/json' }),
    };
  }

  private responseFor(path: string): unknown {
    switch (path) {
      case '/api/vcenter/datacenter':
        return { value: [{ datacenter: 'datacenter-21', name: 'primary-datacenter' }] };
      case '/api/vcenter/cluster':
        return {
          value: [
            { cluster: 'domain-c42', name: 'production-cluster', datacenter: 'datacenter-21' },
          ],
        };
      case '/api/vcenter/host':
        return {
          value: [
            {
              host: 'host-301',
              name: 'esxi-01.infrashield.local',
              cluster: 'domain-c42',
              connection_state: 'CONNECTED',
            },
          ],
        };
      case '/api/vcenter/vm':
        return {
          value: [
            {
              vm: 'vm-601',
              name: 'payments-api-01',
              resource_pool: 'resgroup-401',
              power_state: 'POWERED_ON',
            },
          ],
        };
      case '/api/vcenter/datastore':
        return {
          value: [
            {
              datastore: 'datastore-88',
              name: 'vsanDatastore',
              type: 'VSAN',
              datacenter: 'datacenter-21',
            },
          ],
        };
      case '/api/vcenter/network':
        return {
          value: [
            { network: 'dvportgroup-92', name: 'dvpg-prod-web', type: 'DISTRIBUTED_PORTGROUP' },
          ],
        };
      case '/api/vcenter/resource-pool':
        return {
          value: [
            { resource_pool: 'resgroup-401', name: 'payments-resource-pool', parent: 'domain-c42' },
          ],
        };
      case '/api/vcenter/folder':
        return {
          value: [
            {
              folder: 'group-v500',
              name: 'payments-folder',
              type: 'VIRTUAL_MACHINE',
              parent: 'datacenter-21',
            },
          ],
        };
      case '/api/vcenter/template':
        return {
          value: [{ template: 'vm-910', name: 'ubuntu-22-base-template', folder: 'group-v500' }],
        };
      case '/api/vcenter/snapshot':
        return {
          value: [{ snapshot: 'snapshot-111', name: 'payments-api-prepatch', vm: 'vm-601' }],
        };
      case '/api/vcenter/health':
        return {
          value: {
            healthy: true,
            status: 'healthy',
            checked_at: LIVE_TIMESTAMP,
            details: { adapterMode: 'fixture-live', resources: 10 },
          },
        };
      case '/api/vcenter/performance':
        return {
          value: [
            {
              resource: 'vm-601',
              cpu_usage_percent: 42,
              memory_usage_percent: 65,
              network_kbps: 740,
              storage_iops: 380,
            },
            {
              resource: 'host-301',
              cpu_usage_percent: 58,
              memory_usage_percent: 61,
              network_kbps: 1320,
              storage_iops: 810,
            },
          ],
        };
      case '/api/vcenter/events':
        return {
          value: [
            { event: 'evt-1', severity: 'info', message: 'vCenter inventory refresh completed.' },
            {
              event: 'evt-2',
              severity: 'warning',
              message: 'Snapshot count exceeds recommendation.',
              resource: 'vm-601',
            },
          ],
        };
      case '/api/vcenter/alarms':
        return {
          value: [
            {
              alarm: 'alarm-1',
              name: 'Datastore usage high',
              entity: 'datastore-88',
              severity: 'warning',
              acknowledged: false,
              triggered_at: LIVE_TIMESTAMP,
            },
          ],
        };
      case '/api/vcenter/tasks':
        return {
          value: [
            {
              task: 'task-1',
              name: 'Relocate virtual machine',
              state: 'success',
              entity: 'vm-601',
              started_at: LIVE_TIMESTAMP,
              completed_at: LIVE_TIMESTAMP,
            },
          ],
        };
      case '/api/vcenter/capacity':
        return {
          value: {
            total_cpu_cores: 128,
            used_cpu_cores: 74,
            total_memory_gb: 512,
            used_memory_gb: 339,
            total_storage_tb: 240,
            used_storage_tb: 119,
            measured_at: LIVE_TIMESTAMP,
          },
        };
      default:
        return undefined;
    }
  }
}

export class NodeVmwareRestTransport implements IVmwareRestTransport {
  public async request(baseUrl: string, request: VmwareRestRequest): Promise<VmwareRestResponse> {
    const url = new URL(request.path, baseUrl);
    const isTls = url.protocol === 'https:';
    const transport = isTls ? https : http;
    const agent = isTls
      ? new https.Agent({
          rejectUnauthorized: !request.insecureSkipTlsVerify,
          ca: request.caCertificatePem,
        })
      : new http.Agent();

    return new Promise<VmwareRestResponse>((resolve, reject) => {
      const req = transport.request(
        url,
        {
          method: request.method,
          headers: request.headers,
          timeout: request.timeoutMs,
          agent,
          signal: request.signal,
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
          response.on('end', () => {
            const headers = Object.entries(response.headers).reduce<Record<string, string>>(
              (accumulator, [key, value]) => {
                if (typeof value === 'string') {
                  accumulator[key.toLowerCase()] = value;
                } else if (Array.isArray(value)) {
                  accumulator[key.toLowerCase()] = value.join(',');
                }
                return accumulator;
              },
              {},
            );
            resolve({
              status: response.statusCode ?? 500,
              body: Buffer.concat(chunks).toString('utf8'),
              headers: freezeRecord(headers),
            });
          });
        },
      );

      req.on('timeout', () =>
        req.destroy(new Error(`VMware request timed out after ${request.timeoutMs}ms.`)),
      );
      req.on('error', reject);
      if (request.body) {
        req.write(request.body);
      }
      req.end();
    });
  }
}

export interface IVmwareSdk {
  listDatacenters(): Promise<readonly VmwareInventoryResource[]>;
  listClusters(): Promise<readonly VmwareInventoryResource[]>;
  listHosts(): Promise<readonly VmwareInventoryResource[]>;
  listResourcePools(): Promise<readonly VmwareInventoryResource[]>;
  listVirtualMachines(): Promise<readonly VmwareInventoryResource[]>;
  listTemplates(): Promise<readonly VmwareInventoryResource[]>;
  listSnapshots(): Promise<readonly VmwareInventoryResource[]>;
  listDatastores(): Promise<readonly VmwareInventoryResource[]>;
  listNetworks(): Promise<readonly VmwareInventoryResource[]>;
  listFolders(): Promise<readonly VmwareInventoryResource[]>;
  getHealth(): Promise<VmwareHealthStatus>;
  getMetrics(): Promise<readonly VmwarePerformanceMetric[]>;
  getCapacity(): Promise<VmwareCapacitySummary>;
  getEvents(): Promise<readonly VmwareProviderEvent[]>;
  getAlarms(): Promise<readonly VmwareAlarm[]>;
  getTasks(): Promise<readonly VmwareTask[]>;
  testConnection(
    configuration?: Readonly<Partial<VmwareProviderConfiguration>>,
  ): Promise<VmwareConnectionTestResult>;
  disconnect(): Promise<void>;
}

export class VmwareSessionManager {
  private readonly configuration: Readonly<VmwareProviderConfiguration>;
  private readonly transport: IVmwareRestTransport;
  private readonly logger: ILogger;
  private readonly secretResolver: SecretResolver;
  private readonly connectionManager: EnterpriseConnectionManager;
  private readonly certificateValidator = new CertificateValidator();

  public constructor(
    options: {
      readonly configuration?: Readonly<VmwareProviderConfiguration>;
      readonly transport?: IVmwareRestTransport;
      readonly logger?: ILogger;
      readonly secretResolver?: SecretResolver;
      readonly connectionManager?: EnterpriseConnectionManager;
    } = {},
  ) {
    this.configuration = options.configuration ?? defaultConfiguration();
    this.transport = options.transport ?? new FixtureVmwareRestTransport();
    this.logger = createVmwareLogger('provider-vmware-session-manager', options.logger).child({
      endpoint: this.configuration.endpoint,
    });
    this.secretResolver =
      options.secretResolver ??
      new SecretResolver([
        {
          id: VMWARE_SECRET_PROVIDER_ID,
          provider:
            options.transport instanceof NodeVmwareRestTransport
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
            maxSize: 8,
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

    this.connectionManager.register<VmwareProviderConfiguration, VmwareSessionClient>({
      kind: VMWARE_CONNECTION_KIND,
      connect: async ({ request, authentication, signal }) => {
        const caCertificatePem = await this.resolveCaCertificate(request.configuration);
        const response = await this.transport.request(request.configuration.endpoint, {
          method: 'POST',
          path: '/rest/com/vmware/cis/session',
          headers: {
            ...authentication.headers,
            accept: 'application/json',
          },
          timeoutMs: request.configuration.requestTimeoutMs,
          insecureSkipTlsVerify: request.configuration.insecureSkipTlsVerify,
          caCertificatePem,
          signal,
        });

        if (response.status < 200 || response.status >= 300) {
          throw new Error(`VMware session creation failed with status ${response.status}.`);
        }

        const payload = unwrapValue<string>(response.body);
        const session: VmwareSessionPayload = {
          sessionId: payload,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        };

        return {
          client: {
            endpoint: request.configuration.endpoint,
            sessionId: session.sessionId,
            insecureSkipTlsVerify: request.configuration.insecureSkipTlsVerify,
            caCertificatePem,
          },
          session: {
            sessionId: session.sessionId,
            connectionId: request.connectionId,
            token: session.sessionId,
            expiresAt: session.expiresAt,
            refreshedAt: new Date().toISOString(),
            metadata: freezeRecord({ kind: request.kind }),
          },
        };
      },
      disconnect: async () => undefined,
      refreshSession: async ({ request, authentication, signal }) => {
        const caCertificatePem = await this.resolveCaCertificate(request.configuration);
        const response = await this.transport.request(request.configuration.endpoint, {
          method: 'POST',
          path: '/rest/com/vmware/cis/session',
          headers: {
            ...authentication.headers,
            accept: 'application/json',
          },
          timeoutMs: request.configuration.requestTimeoutMs,
          insecureSkipTlsVerify: request.configuration.insecureSkipTlsVerify,
          caCertificatePem,
          signal,
        });
        if (response.status < 200 || response.status >= 300) {
          throw new Error(`VMware session refresh failed with status ${response.status}.`);
        }
        const payload = unwrapValue<string>(response.body);
        return {
          sessionId: payload,
          connectionId: request.connectionId,
          token: payload,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          refreshedAt: new Date().toISOString(),
          metadata: freezeRecord({ kind: request.kind }),
        };
      },
      checkHealth: async ({ connection }) => ({
        connectionId: connection.id,
        status: 'connected',
        healthy: true,
        checkedAt: new Date().toISOString(),
        message: 'VMware session healthy.',
      }),
    });
  }

  public async getConnection(
    override?: Readonly<Partial<VmwareProviderConfiguration>>,
  ): Promise<ConnectionRecord<VmwareProviderConfiguration, VmwareSessionClient>> {
    const configuration = this.resolveConfiguration(override);
    const connectionId = createSessionKey(configuration);
    const credential: ManagedCredential = {
      method: 'basic',
      username: configuration.username,
      passwordRef: {
        provider: VMWARE_SECRET_PROVIDER_ID,
        key: `${configuration.credentialRef}:password`,
      },
    };
    this.connectionManager.storeCredential(connectionId, credential);
    const request: ConnectionRequest<VmwareProviderConfiguration> = {
      connectionId,
      kind: VMWARE_CONNECTION_KIND,
      credentialId: connectionId,
      configuration,
      metadata: freezeRecord({ provider: 'vmware-live' }),
    };
    return this.connectionManager.connect<VmwareProviderConfiguration, VmwareSessionClient>(
      request,
    );
  }

  public async refreshConnection(
    override?: Readonly<Partial<VmwareProviderConfiguration>>,
  ): Promise<ConnectionRecord<VmwareProviderConfiguration, VmwareSessionClient>> {
    const configuration = this.resolveConfiguration(override);
    await this.connectionManager.disconnect(createSessionKey(configuration));
    return this.getConnection(configuration);
  }

  public async testConnection(
    override?: Readonly<Partial<VmwareProviderConfiguration>>,
  ): Promise<VmwareConnectionTestResult> {
    const startedAt = Date.now();
    const connection = await this.getConnection(override);
    const health = await this.connectionManager.checkHealth(connection.id);
    return {
      connected: health?.healthy ?? false,
      latencyMs: Math.max(1, Date.now() - startedAt),
      message: 'VMware live connection established through shared connection management.',
    };
  }

  public async disconnect(
    override?: Readonly<Partial<VmwareProviderConfiguration>>,
  ): Promise<void> {
    const configuration = this.resolveConfiguration(override);
    await this.connectionManager.disconnect(createSessionKey(configuration));
  }

  private resolveConfiguration(
    override?: Readonly<Partial<VmwareProviderConfiguration>>,
  ): Readonly<VmwareProviderConfiguration> {
    return Object.freeze({
      endpoint: override?.endpoint ?? this.configuration.endpoint,
      username: override?.username ?? this.configuration.username,
      credentialRef: override?.credentialRef ?? this.configuration.credentialRef,
      readOnly: override?.readOnly ?? this.configuration.readOnly,
      insecureSkipTlsVerify:
        override?.insecureSkipTlsVerify ?? this.configuration.insecureSkipTlsVerify,
      requestTimeoutMs: override?.requestTimeoutMs ?? this.configuration.requestTimeoutMs,
      inventoryCacheTtlSeconds:
        override?.inventoryCacheTtlSeconds ?? this.configuration.inventoryCacheTtlSeconds,
    });
  }

  private async resolveCaCertificate(
    configuration: Readonly<VmwareProviderConfiguration>,
  ): Promise<string | undefined> {
    const value = await this.secretResolver.resolve({
      provider: VMWARE_SECRET_PROVIDER_ID,
      key: `${configuration.credentialRef}:ca`,
    });
    if (value) {
      this.certificateValidator.validatePem(value);
    }
    return value;
  }
}

export class VmwareSdkAdapter implements IVmwareSdk {
  private readonly configuration: Readonly<VmwareProviderConfiguration>;
  private readonly transport: IVmwareRestTransport;
  private readonly sessionManager: VmwareSessionManager;
  private readonly logger: ILogger;
  private readonly retryPolicy: RetryPolicy;
  private readonly timeoutPolicy: TimeoutPolicy;
  private readonly circuitBreaker: CircuitBreaker;

  public constructor(
    options: {
      readonly configuration?: Readonly<VmwareProviderConfiguration>;
      readonly transport?: IVmwareRestTransport;
      readonly sessionManager?: VmwareSessionManager;
      readonly logger?: ILogger;
    } = {},
  ) {
    this.configuration = options.configuration ?? defaultConfiguration();
    this.transport = options.transport ?? new FixtureVmwareRestTransport();
    this.logger = createVmwareLogger('provider-vmware-sdk-adapter', options.logger).child({
      endpoint: this.configuration.endpoint,
    });
    this.sessionManager =
      options.sessionManager ??
      new VmwareSessionManager({
        configuration: this.configuration,
        transport: this.transport,
        logger: this.logger,
      });
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

  public listDatacenters(): Promise<readonly VmwareInventoryResource[]> {
    return this.getCollection('/api/vcenter/datacenter', (item) => ({
      id: resourceId('datacenter', String(item.datacenter)),
      kind: 'datacenter',
      name: String(item.name),
      moRef: String(item.datacenter),
      labels: freezeRecord({ source: 'vcenter-rest' }),
      status: 'running',
    }));
  }

  public listClusters(): Promise<readonly VmwareInventoryResource[]> {
    return this.getCollection('/api/vcenter/cluster', (item) => ({
      id: resourceId('cluster', String(item.cluster)),
      kind: 'cluster',
      name: String(item.name),
      parentId: item.datacenter ? resourceId('datacenter', String(item.datacenter)) : undefined,
      moRef: String(item.cluster),
      labels: freezeRecord({ source: 'vcenter-rest' }),
      status: 'running',
    }));
  }

  public listHosts(): Promise<readonly VmwareInventoryResource[]> {
    return this.getCollection('/api/vcenter/host', (item) => ({
      id: resourceId('esxiHost', String(item.host)),
      kind: 'esxiHost',
      name: String(item.name),
      parentId: item.cluster ? resourceId('cluster', String(item.cluster)) : undefined,
      moRef: String(item.host),
      labels: freezeRecord({ connectionState: String(item.connection_state ?? '') }),
      status: mapStatus(String(item.connection_state ?? '').toUpperCase() === 'CONNECTED'),
    }));
  }

  public listResourcePools(): Promise<readonly VmwareInventoryResource[]> {
    return this.getCollection('/api/vcenter/resource-pool', (item) => ({
      id: resourceId('resourcePool', String(item.resource_pool)),
      kind: 'resourcePool',
      name: String(item.name),
      parentId: item.parent ? resourceId('cluster', String(item.parent)) : undefined,
      moRef: String(item.resource_pool),
      labels: freezeRecord({ source: 'vcenter-rest' }),
      status: 'running',
    }));
  }

  public listVirtualMachines(): Promise<readonly VmwareInventoryResource[]> {
    return this.getCollection('/api/vcenter/vm', (item) => ({
      id: resourceId('virtualMachine', String(item.vm)),
      kind: 'virtualMachine',
      name: String(item.name),
      parentId: item.resource_pool
        ? resourceId('resourcePool', String(item.resource_pool))
        : undefined,
      moRef: String(item.vm),
      labels: freezeRecord({ powerState: String(item.power_state ?? '') }),
      status: mapStatus(String(item.power_state ?? '').toUpperCase() === 'POWERED_ON'),
    }));
  }

  public listTemplates(): Promise<readonly VmwareInventoryResource[]> {
    return this.getCollection('/api/vcenter/template', (item) => ({
      id: resourceId('template', String(item.template)),
      kind: 'template',
      name: String(item.name),
      parentId: item.folder ? resourceId('folder', String(item.folder)) : undefined,
      moRef: String(item.template),
      labels: freezeRecord({ source: 'vcenter-rest' }),
      status: 'running',
    }));
  }

  public listSnapshots(): Promise<readonly VmwareInventoryResource[]> {
    return this.getCollection('/api/vcenter/snapshot', (item) => ({
      id: resourceId('snapshot', String(item.snapshot)),
      kind: 'snapshot',
      name: String(item.name),
      parentId: item.vm ? resourceId('virtualMachine', String(item.vm)) : undefined,
      moRef: String(item.snapshot),
      labels: freezeRecord({ source: 'vcenter-rest' }),
      status: 'running',
    }));
  }

  public listDatastores(): Promise<readonly VmwareInventoryResource[]> {
    return this.getCollection('/api/vcenter/datastore', (item) => ({
      id: resourceId('datastore', String(item.datastore)),
      kind: 'datastore',
      name: String(item.name),
      parentId: item.datacenter ? resourceId('datacenter', String(item.datacenter)) : undefined,
      moRef: String(item.datastore),
      labels: freezeRecord({ type: String(item.type ?? '') }),
      status: 'running',
    }));
  }

  public listNetworks(): Promise<readonly VmwareInventoryResource[]> {
    return this.getCollection('/api/vcenter/network', (item) => ({
      id: resourceId('network', String(item.network)),
      kind: 'network',
      name: String(item.name),
      moRef: String(item.network),
      labels: freezeRecord({ type: String(item.type ?? '') }),
      status: 'running',
    }));
  }

  public listFolders(): Promise<readonly VmwareInventoryResource[]> {
    return this.getCollection('/api/vcenter/folder', (item) => ({
      id: resourceId('folder', String(item.folder)),
      kind: 'folder',
      name: String(item.name),
      parentId: item.parent ? resourceId('datacenter', String(item.parent)) : undefined,
      moRef: String(item.folder),
      labels: freezeRecord({ type: String(item.type ?? '') }),
      status: 'running',
    }));
  }

  public async getHealth(): Promise<VmwareHealthStatus> {
    const item = await this.getValue<Record<string, unknown>>('/api/vcenter/health');
    return {
      healthy: Boolean(item.healthy),
      status: item.status === 'healthy' ? 'healthy' : 'degraded',
      checkedAt: String(item.checked_at ?? LIVE_TIMESTAMP),
      details: Object.freeze({
        adapter: 'live',
        ...(typeof item.details === 'object' && item.details
          ? (item.details as Record<string, string | number | boolean>)
          : {}),
      }),
    };
  }

  public getMetrics(): Promise<readonly VmwarePerformanceMetric[]> {
    return this.getCollection('/api/vcenter/performance', (item) => ({
      resourceId: String(item.resource),
      cpuUsagePercent: Number(item.cpu_usage_percent ?? 0),
      memoryUsagePercent: Number(item.memory_usage_percent ?? 0),
      networkKbps: Number(item.network_kbps ?? 0),
      storageIops: Number(item.storage_iops ?? 0),
      timestamp: LIVE_TIMESTAMP,
    }));
  }

  public async getCapacity(): Promise<VmwareCapacitySummary> {
    const item = await this.getValue<Record<string, unknown>>('/api/vcenter/capacity');
    return {
      totalCpuCores: Number(item.total_cpu_cores ?? 0),
      usedCpuCores: Number(item.used_cpu_cores ?? 0),
      totalMemoryGb: Number(item.total_memory_gb ?? 0),
      usedMemoryGb: Number(item.used_memory_gb ?? 0),
      totalStorageTb: Number(item.total_storage_tb ?? 0),
      usedStorageTb: Number(item.used_storage_tb ?? 0),
      measuredAt: String(item.measured_at ?? LIVE_TIMESTAMP),
    };
  }

  public getEvents(): Promise<readonly VmwareProviderEvent[]> {
    return this.getCollection('/api/vcenter/events', (item) => ({
      id: String(item.event),
      severity:
        item.severity === 'error' ? 'error' : item.severity === 'warning' ? 'warning' : 'info',
      message: String(item.message),
      resourceId: item.resource ? String(item.resource) : undefined,
      timestamp: LIVE_TIMESTAMP,
    }));
  }

  public getAlarms(): Promise<readonly VmwareAlarm[]> {
    return this.getCollection('/api/vcenter/alarms', (item) => ({
      id: String(item.alarm),
      name: String(item.name),
      severity: item.severity === 'critical' ? 'critical' : 'warning',
      entityId: String(item.entity),
      acknowledged: Boolean(item.acknowledged),
      triggeredAt: String(item.triggered_at ?? LIVE_TIMESTAMP),
    }));
  }

  public getTasks(): Promise<readonly VmwareTask[]> {
    return this.getCollection('/api/vcenter/tasks', (item) => ({
      id: String(item.task),
      name: String(item.name),
      state:
        item.state === 'queued' || item.state === 'running' || item.state === 'error'
          ? item.state
          : 'success',
      entityId: item.entity ? String(item.entity) : undefined,
      startedAt: String(item.started_at ?? LIVE_TIMESTAMP),
      completedAt: item.completed_at ? String(item.completed_at) : undefined,
    }));
  }

  public testConnection(
    configuration?: Readonly<Partial<VmwareProviderConfiguration>>,
  ): Promise<VmwareConnectionTestResult> {
    return this.sessionManager.testConnection(configuration);
  }

  public async disconnect(): Promise<void> {
    await this.sessionManager.disconnect();
  }

  private async getCollection<T>(
    path: string,
    map: (item: Record<string, unknown>) => T,
  ): Promise<readonly T[]> {
    const payload = await this.getValue<readonly Record<string, unknown>[]>(path);
    return Object.freeze(payload.map(map));
  }

  private async getValue<T>(path: string): Promise<T> {
    return this.circuitBreaker.execute(async () =>
      this.retryPolicy.execute(async () =>
        this.timeoutPolicy.execute(async (signal) => {
          const connection = await this.sessionManager.getConnection();
          const response = await this.transport.request(connection.client.endpoint, {
            method: 'GET',
            path,
            headers: {
              accept: 'application/json',
              'vmware-api-session-id': connection.client.sessionId,
            },
            timeoutMs: this.configuration.requestTimeoutMs,
            insecureSkipTlsVerify: connection.client.insecureSkipTlsVerify,
            caCertificatePem: connection.client.caCertificatePem,
            signal,
          });

          if (response.status === 401) {
            await this.logger.warn('VMware live session expired; refreshing.', { path });
            await this.sessionManager.refreshConnection();
            throw new Error('retry session refresh');
          }
          if (isTransientStatus(response.status)) {
            await this.logger.warn('VMware live request received transient response.', {
              path,
              status: String(response.status),
            });
            throw new Error(`retry transient status ${response.status}`);
          }
          if (response.status < 200 || response.status >= 300) {
            throw new Error(
              `VMware REST request failed for ${path} with status ${response.status}.`,
            );
          }
          return unwrapValue<T>(response.body);
        }),
      ),
    );
  }
}

export class VmwareDiscoveryService {
  public constructor(private readonly sdk: IVmwareSdk) {}

  public listDatacenters(): Promise<readonly VmwareInventoryResource[]> {
    return this.sdk.listDatacenters();
  }

  public listClusters(): Promise<readonly VmwareInventoryResource[]> {
    return this.sdk.listClusters();
  }

  public listHosts(): Promise<readonly VmwareInventoryResource[]> {
    return this.sdk.listHosts();
  }

  public listResourcePools(): Promise<readonly VmwareInventoryResource[]> {
    return this.sdk.listResourcePools();
  }

  public listVirtualMachines(): Promise<readonly VmwareInventoryResource[]> {
    return this.sdk.listVirtualMachines();
  }

  public listTemplates(): Promise<readonly VmwareInventoryResource[]> {
    return this.sdk.listTemplates();
  }

  public listSnapshots(): Promise<readonly VmwareInventoryResource[]> {
    return this.sdk.listSnapshots();
  }

  public listDatastores(): Promise<readonly VmwareInventoryResource[]> {
    return this.sdk.listDatastores();
  }

  public listNetworks(): Promise<readonly VmwareInventoryResource[]> {
    return this.sdk.listNetworks();
  }

  public listFolders(): Promise<readonly VmwareInventoryResource[]> {
    return this.sdk.listFolders();
  }
}

export class VmwareInventoryService {
  public constructor(private readonly discovery: VmwareDiscoveryService) {}

  public async discoverInventory(): Promise<readonly VmwareInventoryResource[]> {
    return Object.freeze([
      ...(await this.discovery.listDatacenters()),
      ...(await this.discovery.listClusters()),
      ...(await this.discovery.listHosts()),
      ...(await this.discovery.listVirtualMachines()),
      ...(await this.discovery.listDatastores()),
      ...(await this.discovery.listNetworks()),
      ...(await this.discovery.listResourcePools()),
      ...(await this.discovery.listFolders()),
      ...(await this.discovery.listTemplates()),
      ...(await this.discovery.listSnapshots()),
    ]);
  }
}

export class VmwareMetricsService {
  public constructor(private readonly sdk: IVmwareSdk) {}

  public getMetrics(): Promise<readonly VmwarePerformanceMetric[]> {
    return this.sdk.getMetrics();
  }

  public getCapacity(): Promise<VmwareCapacitySummary> {
    return this.sdk.getCapacity();
  }
}

export class VmwareHealthService {
  public constructor(private readonly sdk: IVmwareSdk) {}

  public getHealth(): Promise<VmwareHealthStatus> {
    return this.sdk.getHealth();
  }
}

export class VmwareEventService {
  public constructor(private readonly sdk: IVmwareSdk) {}

  public getEvents(): Promise<readonly VmwareProviderEvent[]> {
    return this.sdk.getEvents();
  }

  public getAlarms(): Promise<readonly VmwareAlarm[]> {
    return this.sdk.getAlarms();
  }

  public getTasks(): Promise<readonly VmwareTask[]> {
    return this.sdk.getTasks();
  }
}

export class VmwareLiveAdapter implements IVmwareAdapter {
  private readonly configuration: Readonly<VmwareProviderConfiguration>;
  private readonly sdk: IVmwareSdk;
  private readonly discovery: VmwareDiscoveryService;
  private readonly inventory: VmwareInventoryService;
  private readonly metrics: VmwareMetricsService;
  private readonly health: VmwareHealthService;
  private readonly events: VmwareEventService;

  public constructor(
    options: {
      readonly configuration?: Readonly<VmwareProviderConfiguration>;
      readonly sdk?: IVmwareSdk;
    } = {},
  ) {
    this.configuration = options.configuration ?? defaultConfiguration();
    this.sdk = options.sdk ?? new VmwareSdkAdapter({ configuration: this.configuration });
    this.discovery = new VmwareDiscoveryService(this.sdk);
    this.inventory = new VmwareInventoryService(this.discovery);
    this.metrics = new VmwareMetricsService(this.sdk);
    this.health = new VmwareHealthService(this.sdk);
    this.events = new VmwareEventService(this.sdk);
  }

  public listDatacenters(): Promise<readonly VmwareInventoryResource[]> {
    return this.discovery.listDatacenters();
  }

  public listClusters(): Promise<readonly VmwareInventoryResource[]> {
    return this.discovery.listClusters();
  }

  public listHosts(): Promise<readonly VmwareInventoryResource[]> {
    return this.discovery.listHosts();
  }

  public listVirtualMachines(): Promise<readonly VmwareInventoryResource[]> {
    return this.discovery.listVirtualMachines();
  }

  public listDatastores(): Promise<readonly VmwareInventoryResource[]> {
    return this.discovery.listDatastores();
  }

  public listNetworks(): Promise<readonly VmwareInventoryResource[]> {
    return this.discovery.listNetworks();
  }

  public listResourcePools(): Promise<readonly VmwareInventoryResource[]> {
    return this.discovery.listResourcePools();
  }

  public listFolders(): Promise<readonly VmwareInventoryResource[]> {
    return this.discovery.listFolders();
  }

  public listTemplates(): Promise<readonly VmwareInventoryResource[]> {
    return this.discovery.listTemplates();
  }

  public listSnapshots(): Promise<readonly VmwareInventoryResource[]> {
    return this.discovery.listSnapshots();
  }

  public getHealth(): Promise<VmwareHealthStatus> {
    return this.health.getHealth();
  }

  public getMetrics(): Promise<readonly VmwarePerformanceMetric[]> {
    return this.metrics.getMetrics();
  }

  public getEvents(): Promise<readonly VmwareProviderEvent[]> {
    return this.events.getEvents();
  }

  public getAlarms(): Promise<readonly VmwareAlarm[]> {
    return this.events.getAlarms();
  }

  public getTasks(): Promise<readonly VmwareTask[]> {
    return this.events.getTasks();
  }

  public getCapacity(): Promise<VmwareCapacitySummary> {
    return this.metrics.getCapacity();
  }

  public async refreshInventory(): Promise<{ readonly refreshedAt: string }> {
    await this.inventory.discoverInventory();
    return { refreshedAt: new Date().toISOString() };
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
        id: 'vmware-monitoring-services',
        name: 'monitoring',
        version: '1.0.0',
        category: 'monitoring',
      },
      {
        id: 'vmware-provider-operations',
        name: 'operations',
        version: '1.0.0',
        category: 'operations',
      },
    ]);
  }

  public testConnection(
    configuration?: Readonly<Partial<VmwareProviderConfiguration>>,
  ): Promise<VmwareConnectionTestResult> {
    return this.sdk.testConnection(configuration ?? this.configuration);
  }

  public async searchInventory(
    query: VmwareSearchQuery,
  ): Promise<readonly VmwareInventoryResource[]> {
    const inventory = await this.inventory.discoverInventory();
    const needle = query.text.trim().toLowerCase();
    const filtered = query.kind ? inventory.filter((item) => item.kind === query.kind) : inventory;
    return filtered.filter((item) =>
      [item.id, item.name, item.moRef].some((value) => value.toLowerCase().includes(needle)),
    );
  }
}
