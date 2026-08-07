import { describe, expect, it } from 'vitest';
import { CapabilityVersion } from '@infrashield/providers';
import {
  BMCRemedyAdapter,
  createITSMProviderRuntime,
  FreshserviceAdapter,
  ITSMAuthenticationProvider,
  ITSMCapabilityRegistry,
  ITSMConfiguration,
  ITSMConnectionManager,
  ITSMInventoryCache,
  ITSMMockAdapter,
  ITSMProvider,
  ITSMProviderFactory,
  JiraAdapter,
  ServiceNowAdapter,
} from './itsm';

describe('enterprise itsm provider framework', () => {
  it('discovers platform abstractions and required discovery objects', async () => {
    const provider = new ITSMProvider({ adapter: new ITSMMockAdapter() });

    const platforms = await provider.discoverPlatformAbstractions();
    const inventory = await provider.discoverInventory();

    expect(platforms).toHaveLength(4);
    expect(platforms.some((item) => item.platform === 'serviceNow')).toBe(true);
    expect(platforms.some((item) => item.platform === 'jira')).toBe(true);
    expect(platforms.some((item) => item.platform === 'bmcRemedy')).toBe(true);
    expect(platforms.some((item) => item.platform === 'freshservice')).toBe(true);

    expect(inventory).toHaveLength(13);
    expect(inventory.some((item) => item.kind === 'cmdb')).toBe(true);
    expect(inventory.some((item) => item.kind === 'configurationItem')).toBe(true);
    expect(inventory.some((item) => item.kind === 'service')).toBe(true);
    expect(inventory.some((item) => item.kind === 'businessApplication')).toBe(true);
    expect(inventory.some((item) => item.kind === 'supportGroup')).toBe(true);
    expect(inventory.some((item) => item.kind === 'user')).toBe(true);
    expect(inventory.some((item) => item.kind === 'incident')).toBe(true);
    expect(inventory.some((item) => item.kind === 'problem')).toBe(true);
    expect(inventory.some((item) => item.kind === 'change')).toBe(true);
    expect(inventory.some((item) => item.kind === 'request')).toBe(true);
    expect(inventory.some((item) => item.kind === 'task')).toBe(true);
    expect(inventory.some((item) => item.kind === 'approval')).toBe(true);
    expect(inventory.some((item) => item.kind === 'knowledgeArticle')).toBe(true);
  });

  it('supports operations and deterministic health metadata', async () => {
    const provider = new ITSMProvider({ adapter: new ITSMMockAdapter() });

    const refreshed = await provider.refreshInventory();
    provider.synchronizeCache(refreshed);

    const search = await provider.search({ text: 'latency', kind: 'incident' });
    const capabilities = await provider.discoverCapabilities();
    const connection = await provider.testConnection({
      endpoint: 'itsm://enterprise.service-management.example.local',
    });
    const health = await provider.getHealth();

    expect(refreshed.objects).toHaveLength(13);
    expect(provider.getInventoryCache().objects).toHaveLength(13);
    expect(search.length).toBeGreaterThan(0);
    expect(capabilities.some((item) => item.category === 'operations')).toBe(true);
    expect(connection.connected).toBe(true);
    expect(health).toHaveLength(4);
    expect(health[0]?.status).toBe('healthy');
  });

  it('registers provider manifest through factory', () => {
    const factory = new ITSMProviderFactory();
    factory.create();

    const discovered = factory
      .getRegistryService()
      .discover({ capability: 'operations', tags: ['itsm'] });
    expect(discovered).toHaveLength(1);
  });

  it('runtime reuses lifecycle, authentication, connection, and capability frameworks', async () => {
    const runtime = createITSMProviderRuntime();
    expect(runtime.lifecycleManager.initialize(runtime.provider)).toBe('initialized');
    await runtime.lifecycleManager.start(runtime.provider);

    const context = await runtime.provider.createContext({
      organizationId: 'enterprise-service-management',
      credentialRef: 'ITSM_CREDENTIAL_REF',
    });

    const auth = await runtime.authenticationProvider.getProviderAuthentication().authenticate({
      provider: runtime.provider,
      context,
      method: 'api-key',
      actorId: 'itsm-admin',
      credential: {
        method: 'api-key',
        apiKey: 'masked-api-key',
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
    expect(resolved.id).toBe('itsm-operations');

    await runtime.lifecycleManager.stop(runtime.provider);
    expect(runtime.lifecycleManager.getState(runtime.provider.manifest.id)).toBe('stopped');
  });

  it('exposes strongly typed core components and platform adapter classes', async () => {
    const configuration = new ITSMConfiguration();
    const merged = configuration.merge({
      connectionTimeoutMs: 14000,
      enabledPlatforms: ['serviceNow', 'jira'],
    });
    const authProvider = new ITSMAuthenticationProvider();
    const capabilityRegistry = new ITSMCapabilityRegistry('provider-itsm');
    const connectionManager = new ITSMConnectionManager('provider-itsm');
    const capabilities = await capabilityRegistry.list();

    const adapters = [
      new ServiceNowAdapter(),
      new JiraAdapter(),
      new BMCRemedyAdapter(),
      new FreshserviceAdapter(),
    ];
    const adapterPlatforms = await Promise.all(
      adapters.map((adapter) => adapter.discoverPlatforms()),
    );

    expect(merged.connectionTimeoutMs).toBe(14000);
    expect(merged.enabledPlatforms).toEqual(['serviceNow', 'jira']);
    expect(authProvider.getProviderAuthentication()).toBeDefined();
    expect(connectionManager.getSdkConnectionManager()).toBeDefined();
    expect(capabilities.length).toBe(8);
    expect(adapterPlatforms.every((platforms) => platforms.length === 1)).toBe(true);
  });

  it('searches via cache when available and via adapter otherwise', async () => {
    const provider = new ITSMProvider({ inventoryCache: new ITSMInventoryCache() });

    const fromAdapter = await provider.search({
      text: 'latency',
      kind: 'knowledgeArticle',
    });
    await provider.refreshInventory();
    const fromCache = await provider.search({
      text: 'latency',
      kind: 'knowledgeArticle',
    });

    expect(fromAdapter.length).toBeGreaterThan(0);
    expect(fromCache.length).toBeGreaterThan(0);
  });
});
