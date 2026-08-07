import http from 'node:http';
import https from 'node:https';
import type { SerializableValueObject } from '@infrashield/contracts';
import {
  StructuredLogger,
  createMemoryLogSink,
  type ILogger,
} from '@infrashield/core-infrastructure';
import { VmwareLiveAdapter } from './vmware-live';
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
  | 'datastore'
  | 'network'
  | 'resourcePool'
  | 'folder'
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

export interface VmwareCapacitySummary {
  readonly totalCpuCores: number;
  readonly usedCpuCores: number;
  readonly totalMemoryGb: number;
  readonly usedMemoryGb: number;
  readonly totalStorageTb: number;
  readonly usedStorageTb: number;
  readonly measuredAt: string;
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

export interface VmwareSearchQuery {
  readonly text: string;
  readonly kind?: VmwareInventoryKind;
}

export interface VmwareInventoryCacheSnapshot {
  readonly resources: readonly VmwareInventoryResource[];
  readonly refreshedAt?: string;
}

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
    id: 'vm-1',
    kind: 'virtualMachine',
    name: 'payments-api-01',
    parentId: 'rp-1',
    moRef: 'vm-601',
    labels: createLabels({ app: 'payments-api', role: 'primary' }),
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

interface VmwareTransportRequest {
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly timeoutMs: number;
  readonly insecureSkipTlsVerify: boolean;
  readonly caCertificatePem?: string;
}

interface VmwareTransportResponse {
  readonly status: number;
  readonly body: string;
  readonly headers: Readonly<Record<string, string>>;
}

export interface IVmwareTransport {
  request(baseUrl: string, request: VmwareTransportRequest): Promise<VmwareTransportResponse>;
}

export interface IVmwareCredentialResolver {
  resolvePassword(credentialRef: string): Promise<string>;
  resolveCaCertificate?(credentialRef: string): Promise<string | undefined>;
}

interface VCenterSession {
  readonly id: string;
  readonly expiresAtMs: number;
}

interface VCenterPoolEntry {
  readonly key: string;
  readonly sessionId: string;
  readonly endpoint: string;
  readonly username: string;
  readonly acquiredAt: string;
}

function toJsonBody(value: unknown): string {
  return JSON.stringify({ value });
}

function parseJson<T>(body: string): T {
  return JSON.parse(body) as T;
}

function createVmwareLogger(logger?: ILogger): ILogger {
  return (
    logger ??
    new StructuredLogger({
      loggerId: 'provider-vmware-govmomi-adapter' as never,
      minLevel: 'info',
      sink: createMemoryLogSink(),
    })
  );
}

function resolveValueEnvelope<T>(body: string): T {
  const parsed = parseJson<{ readonly value?: T } | T>(body);
  if (typeof parsed === 'object' && parsed !== null && 'value' in parsed) {
    return (parsed as { readonly value?: T }).value as T;
  }
  return parsed as T;
}

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function createSessionKey(configuration: Readonly<VmwareProviderConfiguration>): string {
  return [
    configuration.endpoint,
    configuration.username,
    String(configuration.insecureSkipTlsVerify),
  ].join('|');
}

function mapStatus(active: boolean): VmwareInventoryResource['status'] {
  return active ? 'running' : 'degraded';
}

function resourceId(kind: VmwareInventoryKind, moRef: string): string {
  return `${kind}:${moRef}`;
}

function labelRecord(
  values: Record<string, string | number | boolean | undefined>,
): Readonly<Record<string, string>> {
  return Object.freeze(
    Object.entries(values).reduce<Record<string, string>>((accumulator, [key, value]) => {
      if (value !== undefined) {
        accumulator[key] = String(value);
      }
      return accumulator;
    }, {}),
  );
}

export class EnvironmentVmwareCredentialResolver implements IVmwareCredentialResolver {
  public async resolvePassword(credentialRef: string): Promise<string> {
    const value = process.env[credentialRef];
    if (!value) {
      throw new Error(`Missing VMware credential value for reference ${credentialRef}.`);
    }
    return value;
  }

  public async resolveCaCertificate(credentialRef: string): Promise<string | undefined> {
    return process.env[`${credentialRef}_CA_PEM`];
  }
}

class FixtureVmwareCredentialResolver implements IVmwareCredentialResolver {
  public async resolvePassword(): Promise<string> {
    return 'fixture-secret';
  }

  public async resolveCaCertificate(): Promise<string | undefined> {
    return undefined;
  }
}

export class NodeVmwareTransport implements IVmwareTransport {
  public async request(
    baseUrl: string,
    request: VmwareTransportRequest,
  ): Promise<VmwareTransportResponse> {
    const targetUrl = new URL(request.path, baseUrl);
    const isHttps = targetUrl.protocol === 'https:';
    const transport = isHttps ? https : http;
    const agent = isHttps
      ? new https.Agent({
          rejectUnauthorized: !request.insecureSkipTlsVerify,
          ca: request.caCertificatePem,
        })
      : new http.Agent();

    return new Promise<VmwareTransportResponse>((resolve, reject) => {
      const req = transport.request(
        targetUrl,
        {
          method: request.method,
          headers: request.headers,
          agent,
          timeout: request.timeoutMs,
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
              headers: Object.freeze(headers),
            });
          });
        },
      );

      req.on('timeout', () => {
        req.destroy(new Error(`VMware request timed out after ${request.timeoutMs}ms.`));
      });
      req.on('error', reject);

      if (request.body) {
        req.write(request.body);
      }

      req.end();
    });
  }
}

class VmwareFixtureTransport implements IVmwareTransport {
  public async request(
    _baseUrl: string,
    request: VmwareTransportRequest,
  ): Promise<VmwareTransportResponse> {
    if (request.path === '/rest/com/vmware/cis/session' && request.method === 'POST') {
      return {
        status: 200,
        body: toJsonBody('fixture-session-id'),
        headers: Object.freeze({ 'content-type': 'application/json' }),
      };
    }

    const fixture = this.fixtureResponse(request.path);
    if (!fixture) {
      return {
        status: 404,
        body: JSON.stringify({ error: 'not-found' }),
        headers: Object.freeze({ 'content-type': 'application/json' }),
      };
    }

    return {
      status: 200,
      body: JSON.stringify(fixture),
      headers: Object.freeze({ 'content-type': 'application/json' }),
    };
  }

  private fixtureResponse(path: string): unknown {
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
      case '/api/vcenter/alarms':
        return {
          value: [
            {
              alarm: 'alarm-1',
              name: 'Datastore usage high',
              entity: 'datastore-88',
              severity: 'warning',
              acknowledged: false,
              triggered_at: DATASET_TIMESTAMP,
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
      case '/api/vcenter/health':
        return {
          value: {
            healthy: true,
            status: 'healthy',
            checked_at: DATASET_TIMESTAMP,
            details: {
              provider: 'vmware-enterprise',
              adapterMode: 'live-fixture',
              resources: MOCK_INVENTORY.length,
            },
          },
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
            measured_at: DATASET_TIMESTAMP,
          },
        };
      case '/api/vcenter/tasks':
        return {
          value: [
            {
              task: 'task-1',
              name: 'Relocate virtual machine',
              state: 'success',
              entity: 'vm-601',
              started_at: DATASET_TIMESTAMP,
              completed_at: DATASET_TIMESTAMP,
            },
          ],
        };
      default:
        return undefined;
    }
  }
}

export class VCenterConnectionPool {
  private readonly entries = new Map<string, VCenterPoolEntry>();

  public acquire(
    configuration: Readonly<VmwareProviderConfiguration>,
    sessionId: string,
  ): VCenterPoolEntry {
    const key = createSessionKey(configuration);
    const entry: VCenterPoolEntry = Object.freeze({
      key,
      sessionId,
      endpoint: configuration.endpoint,
      username: configuration.username,
      acquiredAt: new Date().toISOString(),
    });
    this.entries.set(key, entry);
    return entry;
  }

  public get(configuration: Readonly<VmwareProviderConfiguration>): VCenterPoolEntry | undefined {
    return this.entries.get(createSessionKey(configuration));
  }

  public release(configuration: Readonly<VmwareProviderConfiguration>): void {
    this.entries.delete(createSessionKey(configuration));
  }

  public list(): readonly VCenterPoolEntry[] {
    return Object.freeze([...this.entries.values()]);
  }
}

export class VCenterSessionManager {
  private readonly sessions = new Map<string, VCenterSession>();
  private readonly logger: ILogger;
  private readonly now: () => number;
  private readonly sessionTtlMs: number;
  private readonly refreshWindowMs: number;
  private readonly retryAttempts: number;

  public constructor(
    private readonly transport: IVmwareTransport,
    private readonly credentialResolver: IVmwareCredentialResolver,
    options: {
      readonly logger?: ILogger;
      readonly now?: () => number;
      readonly sessionTtlMs?: number;
      readonly refreshWindowMs?: number;
      readonly retryAttempts?: number;
    } = {},
  ) {
    this.logger = createVmwareLogger(options.logger);
    this.now = options.now ?? (() => Date.now());
    this.sessionTtlMs = options.sessionTtlMs ?? 15 * 60 * 1000;
    this.refreshWindowMs = options.refreshWindowMs ?? 60 * 1000;
    this.retryAttempts = options.retryAttempts ?? 2;
  }

  public async getSession(
    configuration: Readonly<VmwareProviderConfiguration>,
  ): Promise<VCenterSession> {
    const key = createSessionKey(configuration);
    const existing = this.sessions.get(key);
    if (existing && existing.expiresAtMs - this.refreshWindowMs > this.now()) {
      return existing;
    }

    const session = await this.createSession(configuration);
    this.sessions.set(key, session);
    return session;
  }

  public async refreshSession(
    configuration: Readonly<VmwareProviderConfiguration>,
  ): Promise<VCenterSession> {
    this.invalidateSession(configuration);
    return this.getSession(configuration);
  }

  public invalidateSession(configuration: Readonly<VmwareProviderConfiguration>): void {
    this.sessions.delete(createSessionKey(configuration));
  }

  private async createSession(
    configuration: Readonly<VmwareProviderConfiguration>,
  ): Promise<VCenterSession> {
    const password = await this.credentialResolver.resolvePassword(configuration.credentialRef);
    const caCertificatePem = await this.credentialResolver.resolveCaCertificate?.(
      configuration.credentialRef,
    );
    const authorization = Buffer.from(`${configuration.username}:${password}`, 'utf8').toString(
      'base64',
    );

    const response = await this.requestWithRetry(configuration, {
      method: 'POST',
      path: '/rest/com/vmware/cis/session',
      headers: {
        authorization: `Basic ${authorization}`,
        accept: 'application/json',
      },
      timeoutMs: configuration.requestTimeoutMs,
      insecureSkipTlsVerify: configuration.insecureSkipTlsVerify,
      caCertificatePem,
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`VMware session creation failed with status ${response.status}.`);
    }

    const sessionId = resolveValueEnvelope<string>(response.body);
    await this.logger.info('VMware vCenter session established.', {
      endpoint: configuration.endpoint,
      username: configuration.username,
    });

    return Object.freeze({
      id: sessionId,
      expiresAtMs: this.now() + this.sessionTtlMs,
    });
  }

  private async requestWithRetry(
    configuration: Readonly<VmwareProviderConfiguration>,
    request: VmwareTransportRequest,
  ): Promise<VmwareTransportResponse> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt += 1) {
      try {
        const response = await this.transport.request(configuration.endpoint, request);
        if (attempt < this.retryAttempts && isTransientStatus(response.status)) {
          await this.logger.warn('Transient VMware session request failed; retrying.', {
            endpoint: configuration.endpoint,
            attempt,
            status: response.status,
          });
          continue;
        }
        return response;
      } catch (error) {
        lastError = error;
        if (attempt >= this.retryAttempts) {
          break;
        }
        await this.logger.warn('VMware session request errored; retrying.', {
          endpoint: configuration.endpoint,
          attempt,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('VMware session request failed after retries.');
  }
}

export class GovmomiAdapter implements IVmwareAdapter {
  private readonly configuration: Readonly<VmwareProviderConfiguration>;
  private readonly transport: IVmwareTransport;
  private readonly credentialResolver: IVmwareCredentialResolver;
  private readonly logger: ILogger;
  private readonly sessionManager: VCenterSessionManager;
  private readonly connectionPool: VCenterConnectionPool;
  private readonly retryAttempts: number;

  public constructor(
    options: {
      readonly configuration?: Readonly<VmwareProviderConfiguration>;
      readonly transport?: IVmwareTransport;
      readonly credentialResolver?: IVmwareCredentialResolver;
      readonly logger?: ILogger;
      readonly sessionManager?: VCenterSessionManager;
      readonly connectionPool?: VCenterConnectionPool;
      readonly retryAttempts?: number;
    } = {},
  ) {
    this.configuration = options.configuration ?? new VmwareConfiguration().defaultConfiguration;
    this.transport = options.transport ?? new VmwareFixtureTransport();
    this.credentialResolver =
      options.credentialResolver ??
      (options.transport
        ? new EnvironmentVmwareCredentialResolver()
        : new FixtureVmwareCredentialResolver());
    this.logger = createVmwareLogger(options.logger).child({
      adapter: 'govmomi',
      endpoint: this.configuration.endpoint,
    });
    this.connectionPool = options.connectionPool ?? new VCenterConnectionPool();
    this.retryAttempts = options.retryAttempts ?? 2;
    this.sessionManager =
      options.sessionManager ??
      new VCenterSessionManager(this.transport, this.credentialResolver, {
        logger: this.logger,
        retryAttempts: this.retryAttempts,
      });
  }

  public async listDatacenters(): Promise<readonly VmwareInventoryResource[]> {
    return this.loadCollection('/api/vcenter/datacenter', (item) => ({
      id: resourceId('datacenter', String(item.datacenter)),
      kind: 'datacenter',
      name: String(item.name),
      moRef: String(item.datacenter),
      labels: labelRecord({ source: 'vcenter' }),
      status: 'running',
    }));
  }

  public async listClusters(): Promise<readonly VmwareInventoryResource[]> {
    return this.loadCollection('/api/vcenter/cluster', (item) => ({
      id: resourceId('cluster', String(item.cluster)),
      kind: 'cluster',
      name: String(item.name),
      parentId: item.datacenter ? resourceId('datacenter', String(item.datacenter)) : undefined,
      moRef: String(item.cluster),
      labels: labelRecord({ source: 'vcenter' }),
      status: 'running',
    }));
  }

  public async listHosts(): Promise<readonly VmwareInventoryResource[]> {
    return this.loadCollection('/api/vcenter/host', (item) => ({
      id: resourceId('esxiHost', String(item.host)),
      kind: 'esxiHost',
      name: String(item.name),
      parentId: item.cluster ? resourceId('cluster', String(item.cluster)) : undefined,
      moRef: String(item.host),
      labels: labelRecord({ connectionState: String(item.connection_state ?? '') }),
      status: mapStatus(String(item.connection_state).toUpperCase() === 'CONNECTED'),
    }));
  }

  public async listVirtualMachines(): Promise<readonly VmwareInventoryResource[]> {
    return this.loadCollection('/api/vcenter/vm', (item) => ({
      id: resourceId('virtualMachine', String(item.vm)),
      kind: 'virtualMachine',
      name: String(item.name),
      parentId: item.resource_pool
        ? resourceId('resourcePool', String(item.resource_pool))
        : undefined,
      moRef: String(item.vm),
      labels: labelRecord({ powerState: String(item.power_state ?? '') }),
      status: mapStatus(String(item.power_state).toUpperCase() === 'POWERED_ON'),
    }));
  }

  public async listDatastores(): Promise<readonly VmwareInventoryResource[]> {
    return this.loadCollection('/api/vcenter/datastore', (item) => ({
      id: resourceId('datastore', String(item.datastore)),
      kind: 'datastore',
      name: String(item.name),
      parentId: item.datacenter ? resourceId('datacenter', String(item.datacenter)) : undefined,
      moRef: String(item.datastore),
      labels: labelRecord({ type: String(item.type ?? '') }),
      status: 'running',
    }));
  }

  public async listNetworks(): Promise<readonly VmwareInventoryResource[]> {
    return this.loadCollection('/api/vcenter/network', (item) => ({
      id: resourceId('network', String(item.network)),
      kind: 'network',
      name: String(item.name),
      moRef: String(item.network),
      labels: labelRecord({ type: String(item.type ?? '') }),
      status: 'running',
    }));
  }

  public async listResourcePools(): Promise<readonly VmwareInventoryResource[]> {
    return this.loadCollection('/api/vcenter/resource-pool', (item) => ({
      id: resourceId('resourcePool', String(item.resource_pool)),
      kind: 'resourcePool',
      name: String(item.name),
      parentId: item.parent ? resourceId('cluster', String(item.parent)) : undefined,
      moRef: String(item.resource_pool),
      labels: labelRecord({ source: 'vcenter' }),
      status: 'running',
    }));
  }

  public async listFolders(): Promise<readonly VmwareInventoryResource[]> {
    return this.loadCollection('/api/vcenter/folder', (item) => ({
      id: resourceId('folder', String(item.folder)),
      kind: 'folder',
      name: String(item.name),
      parentId: item.parent ? resourceId('datacenter', String(item.parent)) : undefined,
      moRef: String(item.folder),
      labels: labelRecord({ type: String(item.type ?? '') }),
      status: 'running',
    }));
  }

  public async listTemplates(): Promise<readonly VmwareInventoryResource[]> {
    return this.loadCollection('/api/vcenter/template', (item) => ({
      id: resourceId('template', String(item.template)),
      kind: 'template',
      name: String(item.name),
      parentId: item.folder ? resourceId('folder', String(item.folder)) : undefined,
      moRef: String(item.template),
      labels: labelRecord({ source: 'vcenter' }),
      status: 'running',
    }));
  }

  public async listSnapshots(): Promise<readonly VmwareInventoryResource[]> {
    return this.loadCollection('/api/vcenter/snapshot', (item) => ({
      id: resourceId('snapshot', String(item.snapshot)),
      kind: 'snapshot',
      name: String(item.name),
      parentId: item.vm ? resourceId('virtualMachine', String(item.vm)) : undefined,
      moRef: String(item.snapshot),
      labels: labelRecord({ source: 'vcenter' }),
      status: 'running',
    }));
  }

  public async getHealth(): Promise<VmwareHealthStatus> {
    const response = await this.getValue<Record<string, unknown>>('/api/vcenter/health');
    return {
      healthy: Boolean(response.healthy),
      status: response.status === 'healthy' ? 'healthy' : 'degraded',
      checkedAt: String(response.checked_at ?? DATASET_TIMESTAMP),
      details: Object.freeze({
        mode: 'live',
        ...(typeof response.details === 'object' && response.details ? response.details : {}),
      }) as Readonly<Record<string, string | number | boolean>>,
    };
  }

  public async getMetrics(): Promise<readonly VmwarePerformanceMetric[]> {
    return this.loadCollection('/api/vcenter/performance', (item) => ({
      resourceId: String(item.resource),
      cpuUsagePercent: Number(item.cpu_usage_percent ?? 0),
      memoryUsagePercent: Number(item.memory_usage_percent ?? 0),
      networkKbps: Number(item.network_kbps ?? 0),
      storageIops: Number(item.storage_iops ?? 0),
      timestamp: DATASET_TIMESTAMP,
    }));
  }

  public async getEvents(): Promise<readonly VmwareProviderEvent[]> {
    return this.loadCollection('/api/vcenter/events', (item) => ({
      id: String(item.event),
      severity:
        item.severity === 'error' ? 'error' : item.severity === 'warning' ? 'warning' : 'info',
      message: String(item.message),
      resourceId: item.resource ? String(item.resource) : undefined,
      timestamp: DATASET_TIMESTAMP,
    }));
  }

  public async getAlarms(): Promise<readonly VmwareAlarm[]> {
    return this.loadCollection('/api/vcenter/alarms', (item) => ({
      id: String(item.alarm),
      name: String(item.name),
      severity: item.severity === 'critical' ? 'critical' : 'warning',
      entityId: String(item.entity),
      acknowledged: Boolean(item.acknowledged),
      triggeredAt: String(item.triggered_at ?? DATASET_TIMESTAMP),
    }));
  }

  public async getTasks(): Promise<readonly VmwareTask[]> {
    return this.loadCollection('/api/vcenter/tasks', (item) => ({
      id: String(item.task),
      name: String(item.name),
      state:
        item.state === 'queued' || item.state === 'running' || item.state === 'error'
          ? item.state
          : 'success',
      entityId: item.entity ? String(item.entity) : undefined,
      startedAt: String(item.started_at ?? DATASET_TIMESTAMP),
      completedAt: item.completed_at ? String(item.completed_at) : undefined,
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
      measuredAt: String(item.measured_at ?? DATASET_TIMESTAMP),
    };
  }

  public async refreshInventory(): Promise<{ readonly refreshedAt: string }> {
    await this.discoverInventorySnapshot();
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

  public async testConnection(
    configuration: Readonly<VmwareProviderConfiguration>,
  ): Promise<VmwareConnectionTestResult> {
    const startedAt = Date.now();
    const session = await this.sessionManager.getSession(configuration);
    this.connectionPool.acquire(configuration, session.id);
    return {
      connected: session.id.length > 0,
      latencyMs: Math.max(1, Date.now() - startedAt),
      message: 'VMware connection test succeeded through GovmomiAdapter session flow.',
    };
  }

  public async searchInventory(
    query: VmwareSearchQuery,
  ): Promise<readonly VmwareInventoryResource[]> {
    const inventory = await this.discoverInventorySnapshot();
    const needle = query.text.trim().toLowerCase();
    const filteredByKind = query.kind
      ? inventory.filter((resource) => resource.kind === query.kind)
      : inventory;

    return filteredByKind.filter((resource) =>
      [resource.id, resource.name, resource.moRef].some((value) =>
        value.toLowerCase().includes(needle),
      ),
    );
  }

  public getConnectionPool(): VCenterConnectionPool {
    return this.connectionPool;
  }

  private async discoverInventorySnapshot(): Promise<readonly VmwareInventoryResource[]> {
    return Object.freeze([
      ...(await this.listDatacenters()),
      ...(await this.listClusters()),
      ...(await this.listHosts()),
      ...(await this.listVirtualMachines()),
      ...(await this.listDatastores()),
      ...(await this.listNetworks()),
      ...(await this.listResourcePools()),
      ...(await this.listFolders()),
      ...(await this.listTemplates()),
      ...(await this.listSnapshots()),
    ]);
  }

  private async loadCollection<T>(
    path: string,
    map: (item: Record<string, unknown>) => T,
  ): Promise<readonly T[]> {
    const payload = await this.getValue<readonly Record<string, unknown>[]>(path);
    return Object.freeze(payload.map(map));
  }

  private async getValue<T>(path: string): Promise<T> {
    const configuration = this.configuration;
    let session = await this.sessionManager.getSession(configuration);
    this.connectionPool.acquire(configuration, session.id);

    const execute = async (): Promise<VmwareTransportResponse> => {
      const caCertificatePem = await this.credentialResolver.resolveCaCertificate?.(
        configuration.credentialRef,
      );
      return this.transport.request(configuration.endpoint, {
        method: 'GET',
        path,
        headers: {
          accept: 'application/json',
          'vmware-api-session-id': session.id,
        },
        timeoutMs: configuration.requestTimeoutMs,
        insecureSkipTlsVerify: configuration.insecureSkipTlsVerify,
        caCertificatePem,
      });
    };

    for (let attempt = 1; attempt <= this.retryAttempts; attempt += 1) {
      const response = await execute();
      if (response.status === 401 && attempt < this.retryAttempts) {
        await this.logger.warn('VMware session expired; refreshing.', {
          endpoint: configuration.endpoint,
          attempt,
        });
        session = await this.sessionManager.refreshSession(configuration);
        continue;
      }
      if (isTransientStatus(response.status) && attempt < this.retryAttempts) {
        await this.logger.warn('Transient VMware API response; retrying.', {
          endpoint: configuration.endpoint,
          path,
          attempt,
          status: response.status,
        });
        continue;
      }
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`VMware API request failed for ${path} with status ${response.status}.`);
      }
      return resolveValueEnvelope<T>(response.body);
    }

    throw new Error(`VMware API request failed after retries for ${path}.`);
  }
}

export interface IVmwareAdapter {
  listDatacenters(): Promise<readonly VmwareInventoryResource[]>;
  listClusters(): Promise<readonly VmwareInventoryResource[]>;
  listHosts(): Promise<readonly VmwareInventoryResource[]>;
  listVirtualMachines(): Promise<readonly VmwareInventoryResource[]>;
  listDatastores(): Promise<readonly VmwareInventoryResource[]>;
  listNetworks(): Promise<readonly VmwareInventoryResource[]>;
  listResourcePools(): Promise<readonly VmwareInventoryResource[]>;
  listFolders(): Promise<readonly VmwareInventoryResource[]>;
  listTemplates(): Promise<readonly VmwareInventoryResource[]>;
  listSnapshots(): Promise<readonly VmwareInventoryResource[]>;
  getHealth(): Promise<VmwareHealthStatus>;
  getMetrics(): Promise<readonly VmwarePerformanceMetric[]>;
  getEvents(): Promise<readonly VmwareProviderEvent[]>;
  getAlarms(): Promise<readonly VmwareAlarm[]>;
  getTasks(): Promise<readonly VmwareTask[]>;
  getCapacity(): Promise<VmwareCapacitySummary>;
  refreshInventory(): Promise<{ readonly refreshedAt: string }>;
  discoverCapabilities(): Promise<readonly VmwareCapabilityDescriptor[]>;
  testConnection(
    configuration: Readonly<VmwareProviderConfiguration>,
  ): Promise<VmwareConnectionTestResult>;
  searchInventory(query: VmwareSearchQuery): Promise<readonly VmwareInventoryResource[]>;
}

export class VmwareMockAdapter implements IVmwareAdapter {
  public async listDatacenters(): Promise<readonly VmwareInventoryResource[]> {
    return this.byKind('datacenter');
  }

  public async listClusters(): Promise<readonly VmwareInventoryResource[]> {
    return this.byKind('cluster');
  }

  public async listHosts(): Promise<readonly VmwareInventoryResource[]> {
    return this.byKind('esxiHost');
  }

  public async listVirtualMachines(): Promise<readonly VmwareInventoryResource[]> {
    return this.byKind('virtualMachine');
  }

  public async listDatastores(): Promise<readonly VmwareInventoryResource[]> {
    return this.byKind('datastore');
  }

  public async listNetworks(): Promise<readonly VmwareInventoryResource[]> {
    return this.byKind('network');
  }

  public async listResourcePools(): Promise<readonly VmwareInventoryResource[]> {
    return this.byKind('resourcePool');
  }

  public async listFolders(): Promise<readonly VmwareInventoryResource[]> {
    return this.byKind('folder');
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
        adapterMode: 'mock',
        resources: MOCK_INVENTORY.length,
      },
    };
  }

  public async getMetrics(): Promise<readonly VmwarePerformanceMetric[]> {
    return MOCK_PERFORMANCE;
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

  public async refreshInventory(): Promise<{ readonly refreshedAt: string }> {
    return { refreshedAt: DATASET_TIMESTAMP };
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

  public async testConnection(
    configuration: Readonly<VmwareProviderConfiguration>,
  ): Promise<VmwareConnectionTestResult> {
    return {
      connected: configuration.endpoint.startsWith('https://'),
      latencyMs: 22,
      message: 'VMware connection test succeeded through adapter abstraction.',
    };
  }

  public async searchInventory(
    query: VmwareSearchQuery,
  ): Promise<readonly VmwareInventoryResource[]> {
    const needle = query.text.trim().toLowerCase();
    const filteredByKind = query.kind ? this.byKind(query.kind) : MOCK_INVENTORY;

    return filteredByKind.filter((resource) =>
      [resource.id, resource.name, resource.moRef].some((value) =>
        value.toLowerCase().includes(needle),
      ),
    );
  }

  private byKind(kind: VmwareInventoryKind): readonly VmwareInventoryResource[] {
    return MOCK_INVENTORY.filter((resource) => resource.kind === kind);
  }
}

export class DatacenterInventory {
  public constructor(private readonly adapter: IVmwareAdapter) {}

  public async list(): Promise<readonly VmwareInventoryResource[]> {
    return this.adapter.listDatacenters();
  }
}

export class ClusterInventory {
  public constructor(private readonly adapter: IVmwareAdapter) {}

  public async list(): Promise<readonly VmwareInventoryResource[]> {
    return this.adapter.listClusters();
  }
}

export class HostInventory {
  public constructor(private readonly adapter: IVmwareAdapter) {}

  public async list(): Promise<readonly VmwareInventoryResource[]> {
    return this.adapter.listHosts();
  }
}

export class VirtualMachineInventory {
  public constructor(private readonly adapter: IVmwareAdapter) {}

  public async list(): Promise<readonly VmwareInventoryResource[]> {
    return this.adapter.listVirtualMachines();
  }
}

export class DatastoreInventory {
  public constructor(private readonly adapter: IVmwareAdapter) {}

  public async list(): Promise<readonly VmwareInventoryResource[]> {
    return this.adapter.listDatastores();
  }
}

export class NetworkInventory {
  public constructor(private readonly adapter: IVmwareAdapter) {}

  public async list(): Promise<readonly VmwareInventoryResource[]> {
    return this.adapter.listNetworks();
  }
}

export class ResourcePoolInventory {
  public constructor(private readonly adapter: IVmwareAdapter) {}

  public async list(): Promise<readonly VmwareInventoryResource[]> {
    return this.adapter.listResourcePools();
  }
}

export class FolderInventory {
  public constructor(private readonly adapter: IVmwareAdapter) {}

  public async list(): Promise<readonly VmwareInventoryResource[]> {
    return this.adapter.listFolders();
  }
}

export class TemplateInventory {
  public constructor(private readonly adapter: IVmwareAdapter) {}

  public async list(): Promise<readonly VmwareInventoryResource[]> {
    return this.adapter.listTemplates();
  }
}

export class SnapshotInventory {
  public constructor(private readonly adapter: IVmwareAdapter) {}

  public async list(): Promise<readonly VmwareInventoryResource[]> {
    return this.adapter.listSnapshots();
  }
}

export class HealthService {
  public constructor(private readonly adapter: IVmwareAdapter) {}

  public async get(): Promise<VmwareHealthStatus> {
    return this.adapter.getHealth();
  }
}

export class MetricsService {
  public constructor(private readonly adapter: IVmwareAdapter) {}

  public async getPerformanceMetrics(): Promise<readonly VmwarePerformanceMetric[]> {
    return this.adapter.getMetrics();
  }

  public async getCapacity(): Promise<VmwareCapacitySummary> {
    return this.adapter.getCapacity();
  }
}

export class EventService {
  public constructor(private readonly adapter: IVmwareAdapter) {}

  public async list(): Promise<readonly VmwareProviderEvent[]> {
    return this.adapter.getEvents();
  }
}

export class AlarmService {
  public constructor(private readonly adapter: IVmwareAdapter) {}

  public async list(): Promise<readonly VmwareAlarm[]> {
    return this.adapter.getAlarms();
  }
}

export class TaskService {
  public constructor(private readonly adapter: IVmwareAdapter) {}

  public async list(): Promise<readonly VmwareTask[]> {
    return this.adapter.getTasks();
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

export class VmwareAuthenticationProvider {
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
            ? 'VMware authentication accepted.'
            : 'VMware credential payload is invalid.',
          authenticatedAt: DATASET_TIMESTAMP,
        });
      },
    });
  }

  public getProviderAuthentication(): ProviderAuthentication {
    return this.providerAuthentication;
  }
}

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

export class VmwareConnectionManager {
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

    this.sdkConnectionManager = new ProviderConnectionManager({
      factory,
      pool,
    });
  }

  public getSdkConnectionManager(): ProviderConnectionManager {
    return this.sdkConnectionManager;
  }
}

export class VmwareCapabilityRegistry {
  private readonly registry: ProviderCapabilityRegistry;

  public constructor(providerId: string, registry = new ProviderCapabilityRegistry()) {
    this.registry = registry;

    this.registry.register(
      new CapabilityDefinition({
        id: 'vmware-inventory-discovery',
        providerId,
        name: 'inventory',
        version: new CapabilityVersion('1.0.0'),
        metadata: new CapabilityMetadata({
          description: 'Discovery coverage across VMware inventory objects.',
          tags: ['vmware', 'discovery'],
          featureFlags: {
            configurationDriven: true,
            adapterBacked: true,
          },
        }),
        requiresCapabilities: ['inventory'],
        requiredFeatureFlags: ['configurationDriven', 'adapterBacked'],
      }),
    );

    this.registry.register(
      new CapabilityDefinition({
        id: 'vmware-monitoring-services',
        providerId,
        name: 'monitoring',
        version: new CapabilityVersion('1.0.0'),
        metadata: new CapabilityMetadata({
          description: 'Health, metrics, events, alarms, tasks and capacity monitoring.',
          tags: ['vmware', 'monitoring'],
          featureFlags: {
            configurationDriven: true,
            adapterBacked: true,
          },
        }),
        requiresCapabilities: ['monitoring'],
        requiredFeatureFlags: ['configurationDriven', 'adapterBacked'],
      }),
    );

    this.registry.register(
      new CapabilityDefinition({
        id: 'vmware-provider-operations',
        providerId,
        name: 'operations',
        version: new CapabilityVersion('1.0.0'),
        metadata: new CapabilityMetadata({
          description: 'Inventory refresh, capability discovery, connection test and search.',
          tags: ['vmware', 'operations'],
          featureFlags: {
            configurationDriven: true,
            adapterBacked: true,
          },
        }),
        requiresCapabilities: ['operations'],
        requiredFeatureFlags: ['configurationDriven', 'adapterBacked'],
      }),
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
}

export class VmwareProvider extends BaseProvider<VmwareProviderConfiguration> {
  private readonly adapter: IVmwareAdapter;
  private readonly configurationService: VmwareConfiguration;
  private readonly inventoryCache: VmwareInventoryCache;
  private readonly capabilityRegistry: VmwareCapabilityRegistry;

  private readonly datacenterInventory: DatacenterInventory;
  private readonly clusterInventory: ClusterInventory;
  private readonly hostInventory: HostInventory;
  private readonly virtualMachineInventory: VirtualMachineInventory;
  private readonly datastoreInventory: DatastoreInventory;
  private readonly networkInventory: NetworkInventory;
  private readonly resourcePoolInventory: ResourcePoolInventory;
  private readonly folderInventory: FolderInventory;
  private readonly templateInventory: TemplateInventory;
  private readonly snapshotInventory: SnapshotInventory;

  private readonly healthService: HealthService;
  private readonly metricsService: MetricsService;
  private readonly eventService: EventService;
  private readonly alarmService: AlarmService;
  private readonly taskService: TaskService;

  public constructor(
    options: {
      readonly adapter?: IVmwareAdapter;
      readonly configuration?: VmwareConfiguration;
      readonly inventoryCache?: VmwareInventoryCache;
      readonly capabilityRegistry?: VmwareCapabilityRegistry;
      readonly manifest?: ProviderManifest<VmwareProviderConfiguration>;
    } = {},
  ) {
    const configuration = options.configuration ?? new VmwareConfiguration();

    super({
      manifest:
        options.manifest ??
        new ProviderManifest<VmwareProviderConfiguration>({
          id: 'provider-vmware',
          name: 'VMware Enterprise Provider',
          metadata: new ProviderMetadata({
            description:
              'Production VMware provider framework built on Provider SDK with adapter isolation.',
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
            defaultValues: configuration.defaultConfiguration,
          }),
        }),
    });

    this.adapter =
      options.adapter ??
      new VmwareLiveAdapter({ configuration: configuration.defaultConfiguration });
    this.configurationService = configuration;
    this.inventoryCache = options.inventoryCache ?? new VmwareInventoryCache();
    this.capabilityRegistry =
      options.capabilityRegistry ?? new VmwareCapabilityRegistry(this.manifest.id);

    this.datacenterInventory = new DatacenterInventory(this.adapter);
    this.clusterInventory = new ClusterInventory(this.adapter);
    this.hostInventory = new HostInventory(this.adapter);
    this.virtualMachineInventory = new VirtualMachineInventory(this.adapter);
    this.datastoreInventory = new DatastoreInventory(this.adapter);
    this.networkInventory = new NetworkInventory(this.adapter);
    this.resourcePoolInventory = new ResourcePoolInventory(this.adapter);
    this.folderInventory = new FolderInventory(this.adapter);
    this.templateInventory = new TemplateInventory(this.adapter);
    this.snapshotInventory = new SnapshotInventory(this.adapter);

    this.healthService = new HealthService(this.adapter);
    this.metricsService = new MetricsService(this.adapter);
    this.eventService = new EventService(this.adapter);
    this.alarmService = new AlarmService(this.adapter);
    this.taskService = new TaskService(this.adapter);
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
      datastores,
      networks,
      resourcePools,
      folders,
      templates,
      snapshots,
    ] = await Promise.all([
      this.datacenterInventory.list(),
      this.clusterInventory.list(),
      this.hostInventory.list(),
      this.virtualMachineInventory.list(),
      this.datastoreInventory.list(),
      this.networkInventory.list(),
      this.resourcePoolInventory.list(),
      this.folderInventory.list(),
      this.templateInventory.list(),
      this.snapshotInventory.list(),
    ]);

    return Object.freeze([
      ...datacenters,
      ...clusters,
      ...hosts,
      ...virtualMachines,
      ...datastores,
      ...networks,
      ...resourcePools,
      ...folders,
      ...templates,
      ...snapshots,
    ]);
  }

  public async refreshInventory(): Promise<VmwareInventoryCacheSnapshot> {
    const refreshed = await this.adapter.refreshInventory();
    const inventory = await this.discoverInventory();
    this.inventoryCache.update(inventory, refreshed.refreshedAt);
    return this.inventoryCache.getSnapshot();
  }

  public synchronizeCache(snapshot: VmwareInventoryCacheSnapshot): void {
    this.inventoryCache.update(snapshot.resources, snapshot.refreshedAt ?? DATASET_TIMESTAMP);
  }

  public getInventoryCache(): VmwareInventoryCacheSnapshot {
    return this.inventoryCache.getSnapshot();
  }

  public async discoverCapabilities(): Promise<readonly VmwareCapabilityDescriptor[]> {
    const [fromRegistry, fromAdapter] = await Promise.all([
      this.capabilityRegistry.list(),
      this.adapter.discoverCapabilities(),
    ]);

    const dedup = new Map<string, VmwareCapabilityDescriptor>();
    [...fromRegistry, ...fromAdapter].forEach((capability) => {
      dedup.set(capability.id, capability);
    });

    return Object.freeze([...dedup.values()]);
  }

  public async testConnection(
    override?: Readonly<Partial<VmwareProviderConfiguration>>,
  ): Promise<VmwareConnectionTestResult> {
    return this.adapter.testConnection(this.resolveConfiguration(override));
  }

  public async searchInventory(
    query: VmwareSearchQuery,
  ): Promise<readonly VmwareInventoryResource[]> {
    if (this.inventoryCache.getSnapshot().resources.length > 0) {
      return this.inventoryCache.search(query);
    }
    return this.adapter.searchInventory(query);
  }

  public async getProviderHealth(): Promise<VmwareHealthStatus> {
    return this.healthService.get();
  }

  public async getMetrics(): Promise<readonly VmwarePerformanceMetric[]> {
    return this.metricsService.getPerformanceMetrics();
  }

  public async getEvents(): Promise<readonly VmwareProviderEvent[]> {
    return this.eventService.list();
  }

  public async getAlarms(): Promise<readonly VmwareAlarm[]> {
    return this.alarmService.list();
  }

  public async getTasks(): Promise<readonly VmwareTask[]> {
    return this.taskService.list();
  }

  public async getCapacity(): Promise<VmwareCapacitySummary> {
    return this.metricsService.getCapacity();
  }
}

export class VmwareProviderFactory {
  private readonly registry: ProviderRegistryService;

  public constructor(options: { readonly registry?: ProviderRegistryService } = {}) {
    this.registry = options.registry ?? new ProviderRegistryService();
  }

  public create(options?: {
    readonly adapter?: IVmwareAdapter;
    readonly configurationOverride?: Readonly<Partial<VmwareProviderConfiguration>>;
  }): VmwareProvider {
    const configuration = new VmwareConfiguration();

    const provider = new VmwareProvider({
      adapter:
        options?.adapter ??
        new VmwareLiveAdapter({
          configuration: configuration.merge(options?.configurationOverride),
        }),
      configuration,
      manifest: new ProviderManifest<VmwareProviderConfiguration>({
        id: 'provider-vmware',
        name: 'VMware Enterprise Provider',
        metadata: new ProviderMetadata({
          description:
            'Production VMware provider framework built on Provider SDK with adapter isolation.',
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
          defaultValues: configuration.merge(options?.configurationOverride),
        }),
      }),
    });

    this.registry.register(provider.manifest);
    return provider;
  }

  public getRegistry(): ProviderRegistryService {
    return this.registry;
  }
}

export interface VmwareProviderRuntime {
  readonly provider: VmwareProvider;
  readonly registry: ProviderRegistryService;
  readonly lifecycleManager: ProviderLifecycleManager;
  readonly capabilityResolver: CapabilityResolver;
  readonly authenticationProvider: VmwareAuthenticationProvider;
  readonly connectionManager: VmwareConnectionManager;
}

export function createVmwareProviderRuntime(): VmwareProviderRuntime {
  const factory = new VmwareProviderFactory();
  const provider = factory.create();

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

  const authenticationProvider = new VmwareAuthenticationProvider();
  const connectionManager = new VmwareConnectionManager(provider.manifest.id);

  return {
    provider,
    registry: factory.getRegistry(),
    lifecycleManager,
    capabilityResolver,
    authenticationProvider,
    connectionManager,
  };
}

export {
  IVmwareSdk,
  IVmwareRestTransport,
  VmwareDiscoveryService,
  VmwareEventService,
  VmwareHealthService,
  VmwareInventoryService,
  VmwareLiveAdapter,
  VmwareMetricsService,
  VmwareSdkAdapter,
  VmwareSessionManager,
} from './vmware-live';
