import { describe, expect, it } from 'vitest';
import {
  BaseProvider,
  ConnectionFactory,
  ConnectionHealth,
  ConnectionPool,
  ConnectionRetryPolicy,
  ConnectionValidator,
  ProviderConnection,
  ProviderConnectionManager,
  ProviderCapabilities,
  ProviderConfiguration,
  ProviderFactory,
  ProviderManifest,
  ProviderMetadata,
  ProviderRegistry,
  ProviderVersion,
} from './index.js';
import { ToolCapability } from '@infrashield/ai-tools';

class TestProvider extends BaseProvider<{ region: string; apiKey: string }> {
  public constructor(manifest?: ProviderManifest<{ region: string; apiKey: string }>) {
    super({
      manifest:
        manifest ??
        new ProviderManifest({
          id: 'provider-test',
          name: 'Test Provider',
          metadata: new ProviderMetadata({
            description: 'Provider test fixture.',
            version: new ProviderVersion('1.2.3'),
            vendor: 'InfraShield',
            tags: ['test'],
            healthStatus: 'healthy',
          }),
          capabilities: new ProviderCapabilities([
            new ToolCapability({ name: 'chat' }),
            new ToolCapability({ name: 'embeddings' }),
          ]),
          configuration: new ProviderConfiguration<{ region: string; apiKey: string }>({
            requiredFields: ['region', 'apiKey'],
            defaultValues: { region: 'us-east-1' },
          }),
        }),
    });
  }
}

describe('providers sdk core', () => {
  it('registers and discovers providers by capability, vendor, version, and health', () => {
    const registry = new ProviderRegistry();
    const provider = new TestProvider();

    registry.register(provider.manifest);
    registry.enable(provider.manifest.id);

    expect(registry.list()).toHaveLength(1);
    expect(registry.discover({ capability: 'chat' })).toHaveLength(1);
    expect(registry.discover({ vendor: 'InfraShield' })).toHaveLength(1);
    expect(registry.discover({ version: '1.2.3' })).toHaveLength(1);
    expect(registry.discover({ healthStatus: 'healthy', enabledOnly: true })).toHaveLength(1);
  });

  it('creates provider instances through the factory and resolves provider context', async () => {
    const factory = new ProviderFactory();
    const provider = new TestProvider();

    factory.registerProvider(provider.manifest, () => new TestProvider(provider.manifest));
    const instance = factory.create<TestProvider>(provider.manifest.id);
    const context = await instance.createContext({ apiKey: 'secret-key' }, { actorId: 'alice' });

    expect(instance.providerMetadata.version.toString()).toBe('1.2.3');
    expect(instance.providerCapabilities.supports('embeddings')).toBe(true);
    expect(context.providerId).toBe(provider.manifest.id);
    expect(context.configuration).toEqual({ region: 'us-east-1', apiKey: 'secret-key' });
  });

  it('supports install, uninstall, enable, disable, upgrade, and downgrade states', () => {
    const registry = new ProviderRegistry();
    const provider = new TestProvider();

    registry.register(provider.manifest);
    expect(registry.getState(provider.manifest.id)).toBe('installed');

    registry.enable(provider.manifest.id);
    expect(registry.getState(provider.manifest.id)).toBe('enabled');

    registry.disable(provider.manifest.id);
    expect(registry.getState(provider.manifest.id)).toBe('disabled');

    const upgradedManifest = new ProviderManifest({
      ...provider.manifest,
      metadata: new ProviderMetadata({
        description: provider.providerMetadata.description,
        version: new ProviderVersion('2.0.0'),
        vendor: provider.providerMetadata.vendor,
        tags: provider.providerMetadata.tags,
        healthStatus: provider.providerMetadata.healthStatus,
      }),
      capabilities: provider.providerCapabilities,
      configuration: provider.providerConfiguration,
    });

    registry.upgrade(upgradedManifest);
    expect(registry.get(provider.manifest.id)?.metadata.version.toString()).toBe('2.0.0');

    registry.downgrade(provider.manifest);
    expect(registry.get(provider.manifest.id)?.metadata.version.toString()).toBe('1.2.3');

    expect(registry.unregister(provider.manifest.id)).toBe(true);
    expect(registry.getState(provider.manifest.id)).toBe('uninstalled');
  });

  it('validates required provider metadata and configuration schema', async () => {
    expect(() => new ProviderVersion('')).toThrow('Provider version is required.');
    expect(
      () =>
        new ProviderMetadata({
          description: '',
          version: new ProviderVersion('1.0.0'),
        }),
    ).toThrow('Provider description is required.');

    const provider = new TestProvider();
    await expect(provider.createContext({} as { region: string; apiKey: string })).rejects.toThrow(
      'Missing required configuration field: apiKey',
    );
  });

  it('creates pooled provider connections and reuses them', async () => {
    const provider = new TestProvider();
    const context = await provider.createContext({ apiKey: 'secret-key' });
    const pool = new ConnectionPool();
    const factory = new ConnectionFactory();
    const manager = new ProviderConnectionManager({ pool, factory });

    factory.register(provider.manifest.id, (registeredProvider, registeredContext) => {
      return new ProviderConnection({
        provider: registeredProvider,
        context: registeredContext,
        connect: async () => ({ clientId: 'client-1' }),
        disconnect: async () => undefined,
        checkHealth: async () =>
          new ConnectionHealth({ status: 'healthy', latencyMs: 12, message: 'ok' }),
      });
    });

    const first = await manager.connect(provider, context);
    const second = await manager.connect(provider, context);

    expect(first).toBe(second);
    expect(first.status).toBe('connected');
    expect(first.getMetrics().connectCount).toBe(1);
    expect(manager.listConnections()).toHaveLength(1);
  });

  it('validates connections, checks health, reconnects, and disconnects gracefully', async () => {
    const provider = new TestProvider();
    const context = await provider.createContext({ apiKey: 'secret-key' });
    const pool = new ConnectionPool();
    const factory = new ConnectionFactory();
    let connectAttempts = 0;

    factory.register(provider.manifest.id, (registeredProvider, registeredContext) => {
      return new ProviderConnection({
        provider: registeredProvider,
        context: registeredContext,
        connect: async () => {
          connectAttempts += 1;
          return { clientId: `client-${connectAttempts}` };
        },
        disconnect: async () => undefined,
        checkHealth: async () => new ConnectionHealth({ status: 'healthy', latencyMs: 8 }),
      });
    });

    const manager = new ProviderConnectionManager({
      pool,
      factory,
      validator: new ConnectionValidator((configuration) => {
        if (!configuration.apiKey) {
          throw new Error('Missing apiKey.');
        }
      }),
    });

    const connection = await manager.connect(provider, context);
    const health = await manager.checkHealth(connection.id);
    const reconnected = await manager.reconnect(connection.id);
    const disconnected = await manager.disconnect(connection.id);

    expect(health?.status).toBe('healthy');
    expect(reconnected?.getMetrics().reconnectCount).toBe(1);
    expect(disconnected).toBe(true);
    expect(manager.listConnections()).toHaveLength(0);
  });

  it('retries failed connections and exposes connection metrics', async () => {
    const provider = new TestProvider();
    const context = await provider.createContext({ apiKey: 'secret-key' });
    const factory = new ConnectionFactory();
    let attempts = 0;

    factory.register(provider.manifest.id, (registeredProvider, registeredContext) => {
      return new ProviderConnection({
        provider: registeredProvider,
        context: registeredContext,
        connect: async () => {
          attempts += 1;
          if (attempts === 1) {
            throw new Error('Temporary network failure');
          }
          return { clientId: 'client-retry' };
        },
        disconnect: async () => undefined,
      });
    });

    const manager = new ProviderConnectionManager({
      factory,
      pool: new ConnectionPool(),
      retryPolicy: new ConnectionRetryPolicy({ maxAttempts: 2, baseDelayMs: 1 }),
    });

    const connection = await manager.connect(provider, context);

    expect(connection.status).toBe('connected');
    expect(connection.getMetrics().failureCount).toBe(1);
    expect(connection.getMetrics().connectCount).toBe(1);
  });
});
