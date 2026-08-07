import { describe, expect, it } from 'vitest';
import { CapabilityVersion } from '@infrashield/providers';
import {
  createOracleProviderRuntime,
  OracleAuthenticationProvider,
  OracleCapabilityRegistry,
  OracleConfiguration,
  OracleConnectionManager,
  OracleInventoryCache,
  OracleMockAdapter,
  OracleProvider,
  OracleProviderFactory,
} from './oracle';

describe('oracle enterprise provider framework', () => {
  it('discovers oracle topology and core object inventory', async () => {
    const provider = new OracleProvider({ adapter: new OracleMockAdapter() });
    const inventory = await provider.discoverInventory();

    expect(inventory).toHaveLength(22);
    expect(inventory.some((object) => object.kind === 'oracleHome')).toBe(true);
    expect(inventory.some((object) => object.kind === 'listener')).toBe(true);
    expect(inventory.some((object) => object.kind === 'database')).toBe(true);
    expect(inventory.some((object) => object.kind === 'cdb')).toBe(true);
    expect(inventory.some((object) => object.kind === 'pdb')).toBe(true);
    expect(inventory.some((object) => object.kind === 'asm')).toBe(true);
    expect(inventory.some((object) => object.kind === 'racMetadata')).toBe(true);
    expect(inventory.some((object) => object.kind === 'tablespace')).toBe(true);
    expect(inventory.some((object) => object.kind === 'datafile')).toBe(true);
    expect(inventory.some((object) => object.kind === 'redoLog')).toBe(true);
    expect(inventory.some((object) => object.kind === 'controlFile')).toBe(true);
    expect(inventory.some((object) => object.kind === 'user')).toBe(true);
    expect(inventory.some((object) => object.kind === 'role')).toBe(true);
    expect(inventory.some((object) => object.kind === 'profile')).toBe(true);
    expect(inventory.some((object) => object.kind === 'schema')).toBe(true);
    expect(inventory.some((object) => object.kind === 'service')).toBe(true);
    expect(inventory.some((object) => object.kind === 'databaseLink')).toBe(true);
  });

  it('discovers administration metadata', async () => {
    const provider = new OracleProvider({ adapter: new OracleMockAdapter() });
    const inventory = await provider.discoverInventory();

    expect(inventory.some((object) => object.kind === 'rmanMetadata')).toBe(true);
    expect(inventory.some((object) => object.kind === 'dataGuardMetadata')).toBe(true);
    expect(inventory.some((object) => object.kind === 'schedulerJobMetadata')).toBe(true);
    expect(inventory.some((object) => object.kind === 'parameter')).toBe(true);
    expect(inventory.some((object) => object.kind === 'initializationFile')).toBe(true);
  });

  it('supports monitoring data retrieval', async () => {
    const provider = new OracleProvider({ adapter: new OracleMockAdapter() });
    const [health, sessions, locks, waits, performance, alertLogs, utilization] = await Promise.all(
      [
        provider.getInstanceHealth(),
        provider.getSessions(),
        provider.getLocks(),
        provider.getWaitEvents(),
        provider.getPerformanceMetrics(),
        provider.getAlertLogMetadata(),
        provider.getResourceUtilization(),
      ],
    );

    expect(health.healthy).toBe(true);
    expect(sessions[0]?.status).toBe('active');
    expect(locks[0]?.blocking).toBe(false);
    expect(waits[0]?.name).toBe('db file sequential read');
    expect(performance.length).toBeGreaterThan(0);
    expect(alertLogs[0]?.severity).toBe('warning');
    expect(utilization[0]?.resourceName).toBe('processes');
  });

  it('supports refresh, test, capability discovery, search, and cache synchronization', async () => {
    const cache = new OracleInventoryCache();
    const provider = new OracleProvider({ inventoryCache: cache });

    const refreshed = await provider.refreshInventory();
    provider.synchronizeCache(refreshed);
    const search = await provider.searchObjects({ text: 'APP_OWNER' });
    const capabilities = await provider.discoverCapabilities();
    const connection = await provider.testConnection({
      endpoint: 'oracle://prod-db.local:1521/ORCLPROD',
    });

    expect(refreshed.objects.length).toBe(22);
    expect(provider.getInventoryCache().objects.length).toBe(22);
    expect(search.length).toBeGreaterThan(0);
    expect(capabilities.some((capability) => capability.category === 'operations')).toBe(true);
    expect(connection.connected).toBe(true);
  });

  it('auto-registers provider in provider registry via factory', () => {
    const factory = new OracleProviderFactory();
    factory.create();

    const discovered = factory.getRegistryService().discover({
      capability: 'operations',
      tags: ['oracle'],
    });

    expect(discovered).toHaveLength(1);
  });

  it('runtime reuses lifecycle, authentication, connection, and capability frameworks', async () => {
    const runtime = createOracleProviderRuntime();
    expect(runtime.lifecycleManager.initialize(runtime.provider)).toBe('initialized');
    await runtime.lifecycleManager.start(runtime.provider);

    const context = await runtime.provider.createContext({
      systemIdentifier: 'ORCLPROD',
      credentialRef: 'ORACLE_CREDENTIAL_REF',
    });

    const auth = await runtime.authenticationProvider.getProviderAuthentication().authenticate({
      provider: runtime.provider,
      context,
      method: 'username-password',
      actorId: 'oracle-admin',
      credential: {
        method: 'username-password',
        username: 'sysadmin',
        password: 'masked-password',
      },
    });

    const connection = await runtime.connectionManager
      .getSdkConnectionManager()
      .connect(runtime.provider, context);
    const health = await runtime.connectionManager
      .getSdkConnectionManager()
      .checkHealth(connection.id);

    const resolved = runtime.capabilityResolver.resolve(runtime.provider, {
      name: 'operations',
      version: new CapabilityVersion('1.0.0'),
      requiredFeatureFlags: ['configurationDriven'],
    });

    expect(auth.success).toBe(true);
    expect(connection.status).toBe('connected');
    expect(health?.status).toBe('connected');
    expect(resolved.id).toBe('oracle-operations');

    await runtime.lifecycleManager.stop(runtime.provider);
    expect(runtime.lifecycleManager.getState(runtime.provider.manifest.id)).toBe('stopped');
  });

  it('exposes strongly typed configuration, auth, connection, and capability components', async () => {
    const configuration = new OracleConfiguration();
    const merged = configuration.merge({ connectTimeoutMs: 12000 });
    const authProvider = new OracleAuthenticationProvider();
    const capabilityRegistry = new OracleCapabilityRegistry('provider-oracle');
    const connectionManager = new OracleConnectionManager('provider-oracle');
    const capabilities = await capabilityRegistry.list();

    expect(merged.connectTimeoutMs).toBe(12000);
    expect(authProvider.getProviderAuthentication()).toBeDefined();
    expect(connectionManager.getSdkConnectionManager()).toBeDefined();
    expect(capabilities.length).toBe(5);
  });
});
