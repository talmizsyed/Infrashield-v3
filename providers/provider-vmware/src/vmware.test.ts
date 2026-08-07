import { describe, expect, it } from 'vitest';
import { StructuredLogger, createMemoryLogSink } from '@infrashield/core-infrastructure';
import { CapabilityVersion } from '@infrashield/providers';
import {
  createVmwareProviderRuntime,
  type IVmwareRestTransport,
  type IVmwareSdk,
  VmwareLiveAdapter,
  VmwareSdkAdapter,
  VmwareSessionManager,
  VmwareAuthenticationProvider,
  VmwareCapabilityRegistry,
  VmwareConfiguration,
  VmwareConnectionManager,
  VmwareInventoryCache,
  VmwareMockAdapter,
  VmwareProvider,
  VmwareProviderFactory,
} from './vmware';

class FakeVmwareTransport implements IVmwareRestTransport {
  public readonly requests: VmwareTransportRequestSnapshot[] = [];

  public constructor(
    private readonly responders: Readonly<
      Record<string, readonly VmwareTransportFixtureResponse[]>
    >,
  ) {}

  public async request(
    _baseUrl: string,
    request: {
      readonly method: 'GET' | 'POST';
      readonly path: string;
      readonly insecureSkipTlsVerify: boolean;
      readonly caCertificatePem?: string;
    },
  ): Promise<{
    readonly status: number;
    readonly body: string;
    readonly headers: Readonly<Record<string, string>>;
  }> {
    this.requests.push({
      method: request.method,
      path: request.path,
      insecureSkipTlsVerify: request.insecureSkipTlsVerify,
      hasCaCertificate: Boolean(request.caCertificatePem),
    });
    const queue = this.responders[`${request.method} ${request.path}`] ?? [];
    const next =
      queue[
        this.requests.filter((item) => item.method === request.method && item.path === request.path)
          .length - 1
      ] ?? queue[queue.length - 1];
    if (!next) {
      return {
        status: 404,
        body: JSON.stringify({ error: 'not-found' }),
        headers: Object.freeze({}),
      };
    }
    return { status: next.status, body: JSON.stringify(next.body), headers: Object.freeze({}) };
  }
}

interface VmwareTransportFixtureResponse {
  readonly status: number;
  readonly body: unknown;
}

interface VmwareTransportRequestSnapshot {
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly insecureSkipTlsVerify: boolean;
  readonly hasCaCertificate: boolean;
}

describe('vmware enterprise provider framework', () => {
  it('implements deterministic inventory services across all required domains', async () => {
    const provider = new VmwareProvider({ adapter: new VmwareMockAdapter() });
    const inventory = await provider.discoverInventory();

    expect(inventory).toHaveLength(10);
    expect(inventory.some((resource) => resource.kind === 'datacenter')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'cluster')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'esxiHost')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'virtualMachine')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'datastore')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'network')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'resourcePool')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'folder')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'template')).toBe(true);
    expect(inventory.some((resource) => resource.kind === 'snapshot')).toBe(true);
  });

  it('implements monitoring services with deterministic responses', async () => {
    const provider = new VmwareProvider({ adapter: new VmwareMockAdapter() });

    const [health, metrics, events, alarms, tasks, capacity] = await Promise.all([
      provider.getProviderHealth(),
      provider.getMetrics(),
      provider.getEvents(),
      provider.getAlarms(),
      provider.getTasks(),
      provider.getCapacity(),
    ]);

    expect(health.healthy).toBe(true);
    expect(metrics.length).toBeGreaterThan(0);
    expect(events[0]?.severity).toBe('info');
    expect(alarms[0]?.severity).toBe('warning');
    expect(tasks[0]?.state).toBe('success');
    expect(capacity.totalCpuCores).toBeGreaterThan(capacity.usedCpuCores);
  });

  it('supports inventory refresh, search, and cache synchronization operations', async () => {
    const cache = new VmwareInventoryCache();
    const provider = new VmwareProvider({ inventoryCache: cache });

    const refreshed = await provider.refreshInventory();
    const searchFromCache = await provider.searchInventory({ text: 'payments' });

    provider.synchronizeCache({
      resources: refreshed.resources,
      refreshedAt: refreshed.refreshedAt,
    });

    expect(refreshed.resources.length).toBe(10);
    expect(refreshed.refreshedAt).toBeDefined();
    expect(searchFromCache[0]?.kind).toBe('virtualMachine');
    expect(provider.getInventoryCache().resources.length).toBe(10);
  });

  it('supports capability discovery and connection tests', async () => {
    const provider = new VmwareProvider();
    const capabilities = await provider.discoverCapabilities();
    const connectionResult = await provider.testConnection({
      endpoint: 'https://vcenter.enterprise.local',
    });

    expect(capabilities.some((capability) => capability.name === 'inventory')).toBe(true);
    expect(capabilities.some((capability) => capability.name === 'monitoring')).toBe(true);
    expect(capabilities.some((capability) => capability.name === 'operations')).toBe(true);
    expect(connectionResult.connected).toBe(true);
  });

  it('auto-registers provider manifests in provider registry through the factory', () => {
    const factory = new VmwareProviderFactory();
    factory.create({
      configurationOverride: {
        endpoint: 'https://vcenter.enterprise.local',
      },
    });

    const discovered = factory.getRegistry().discover({
      capability: 'operations',
      tags: ['vmware'],
    });

    expect(discovered).toHaveLength(1);
  });

  it('reuses authentication and connection frameworks through dedicated wrappers', async () => {
    const runtime = createVmwareProviderRuntime();

    const context = await runtime.provider.createContext({
      username: 'automation-operator',
      credentialRef: 'VMWARE_CREDENTIAL_REF',
    });

    const authResult = await runtime.authenticationProvider
      .getProviderAuthentication()
      .authenticate({
        provider: runtime.provider,
        context,
        method: 'username-password',
        actorId: 'vmware-admin',
        credential: {
          method: 'username-password',
          username: 'automation-operator',
          password: 'masked-secret',
        },
      });

    const connection = await runtime.connectionManager
      .getSdkConnectionManager()
      .connect(runtime.provider, context);
    const health = await runtime.connectionManager
      .getSdkConnectionManager()
      .checkHealth(connection.id);

    expect(authResult.success).toBe(true);
    expect(connection.status).toBe('connected');
    expect(health?.status).toBe('connected');
  });

  it('supports lifecycle and capability resolution in runtime wiring', async () => {
    const runtime = createVmwareProviderRuntime();

    expect(runtime.lifecycleManager.initialize(runtime.provider)).toBe('initialized');
    await runtime.lifecycleManager.start(runtime.provider);

    const resolved = runtime.capabilityResolver.resolve(runtime.provider, {
      name: 'inventory',
      version: new CapabilityVersion('1.0.0'),
      requiredFeatureFlags: ['configurationDriven'],
    });

    expect(resolved.id).toBe('vmware-inventory-discovery');

    await runtime.lifecycleManager.stop(runtime.provider);
    expect(runtime.lifecycleManager.getState(runtime.provider.manifest.id)).toBe('stopped');
  });

  it('exposes strongly typed framework components', async () => {
    const configuration = new VmwareConfiguration();
    const authProvider = new VmwareAuthenticationProvider();
    const capabilityRegistry = new VmwareCapabilityRegistry('provider-vmware');
    const connectionManager = new VmwareConnectionManager('provider-vmware');

    const merged = configuration.merge({ requestTimeoutMs: 20000 });
    const capabilities = await capabilityRegistry.list();

    expect(merged.requestTimeoutMs).toBe(20000);
    expect(authProvider.getProviderAuthentication()).toBeDefined();
    expect(connectionManager.getSdkConnectionManager()).toBeDefined();
    expect(capabilities.length).toBe(3);
  });

  it('uses GovmomiAdapter by default without changing the provider contract', async () => {
    const provider = new VmwareProvider();
    const inventory = await provider.discoverInventory();

    expect(inventory).toHaveLength(10);
    expect(inventory.some((resource) => resource.kind === 'datacenter')).toBe(true);
  });

  it('uses VmwareLiveAdapter services and sdk-backed live discovery', async () => {
    const sdk: IVmwareSdk = {
      listDatacenters: async () => [
        {
          id: 'datacenter:dc-1',
          kind: 'datacenter',
          name: 'dc-1',
          moRef: 'dc-1',
          labels: Object.freeze({ source: 'sdk' }),
          status: 'running',
        },
      ],
      listClusters: async () => [],
      listHosts: async () => [],
      listResourcePools: async () => [],
      listVirtualMachines: async () => [],
      listTemplates: async () => [],
      listSnapshots: async () => [],
      listDatastores: async () => [],
      listNetworks: async () => [],
      listFolders: async () => [],
      getHealth: async () => ({
        healthy: true,
        status: 'healthy',
        checkedAt: '2026-01-01T00:00:00.000Z',
        details: Object.freeze({ mode: 'sdk' }),
      }),
      getMetrics: async () => [],
      getCapacity: async () => ({
        totalCpuCores: 1,
        usedCpuCores: 0,
        totalMemoryGb: 1,
        usedMemoryGb: 0,
        totalStorageTb: 1,
        usedStorageTb: 0,
        measuredAt: '2026-01-01T00:00:00.000Z',
      }),
      getEvents: async () => [],
      getAlarms: async () => [],
      getTasks: async () => [],
      testConnection: async () => ({ connected: true, latencyMs: 5, message: 'ok' }),
      disconnect: async () => undefined,
    };
    const adapter = new VmwareLiveAdapter({ sdk });

    const inventory = await adapter.searchInventory({ text: 'dc-1' });
    const health = await adapter.getHealth();

    expect(inventory).toHaveLength(1);
    expect(health.healthy).toBe(true);
  });

  it('refreshes sessions, applies retry behavior, and captures secure transport settings', async () => {
    const sink = createMemoryLogSink();
    const logger = new StructuredLogger({
      loggerId: 'vmware-live-test' as never,
      sink,
      minLevel: 'debug',
    });
    const transport = new FakeVmwareTransport({
      'POST /rest/com/vmware/cis/session': [
        { status: 200, body: { value: 'session-1' } },
        { status: 200, body: { value: 'session-2' } },
      ],
      'GET /api/vcenter/datacenter': [
        { status: 401, body: { error: 'expired' } },
        {
          status: 200,
          body: { value: [{ datacenter: 'datacenter-21', name: 'primary-datacenter' }] },
        },
      ],
      'GET /api/vcenter/cluster': [{ status: 200, body: { value: [] } }],
      'GET /api/vcenter/host': [{ status: 200, body: { value: [] } }],
      'GET /api/vcenter/vm': [
        { status: 500, body: { error: 'retry-me' } },
        {
          status: 200,
          body: {
            value: [
              {
                vm: 'vm-601',
                name: 'payments-api-01',
                resource_pool: 'resgroup-401',
                power_state: 'POWERED_ON',
              },
            ],
          },
        },
      ],
      'GET /api/vcenter/datastore': [{ status: 200, body: { value: [] } }],
      'GET /api/vcenter/network': [{ status: 200, body: { value: [] } }],
      'GET /api/vcenter/resource-pool': [{ status: 200, body: { value: [] } }],
      'GET /api/vcenter/folder': [{ status: 200, body: { value: [] } }],
      'GET /api/vcenter/template': [{ status: 200, body: { value: [] } }],
      'GET /api/vcenter/snapshot': [{ status: 200, body: { value: [] } }],
    });
    const sessionManager = new VmwareSessionManager({
      configuration: new VmwareConfiguration().merge({
        endpoint: 'https://vcenter.enterprise.local',
        credentialRef: 'VMWARE_CREDENTIAL_REF',
        insecureSkipTlsVerify: true,
      }),
      transport,
      logger,
    });
    const adapter = new VmwareSdkAdapter({
      configuration: new VmwareConfiguration().merge({
        endpoint: 'https://vcenter.enterprise.local',
        credentialRef: 'VMWARE_CREDENTIAL_REF',
        insecureSkipTlsVerify: true,
      }),
      transport,
      sessionManager,
      logger,
    });

    const inventory = await adapter.listVirtualMachines();

    expect(inventory).toHaveLength(1);
    expect(
      transport.requests.some(
        (request) => request.path === '/api/vcenter/vm' && request.insecureSkipTlsVerify,
      ),
    ).toBe(true);
    expect(transport.requests.some((request) => request.hasCaCertificate)).toBe(true);
    expect(sink.records.some((record) => record.level === 'warn')).toBe(true);
  });

  it('reuses the vmware session manager through shared connection management', async () => {
    const transport = new FakeVmwareTransport({
      'POST /rest/com/vmware/cis/session': [
        { status: 200, body: { value: 'session-a' } },
        { status: 200, body: { value: 'session-b' } },
      ],
    });
    const sessionManager = new VmwareSessionManager({
      configuration: new VmwareConfiguration().defaultConfiguration,
      transport,
    });

    const first = await sessionManager.getConnection();
    const second = await sessionManager.getConnection();
    await sessionManager.refreshConnection();
    const refreshed = await sessionManager.getConnection();

    expect(first.client.sessionId).toBe('session-a');
    expect(second.client.sessionId).toBe('session-a');
    expect(refreshed.client.sessionId).toBe('session-b');
  });
});
