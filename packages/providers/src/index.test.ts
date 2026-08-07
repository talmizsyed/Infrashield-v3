import { describe, expect, it } from 'vitest';
import {
  BaseProvider,
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
});
