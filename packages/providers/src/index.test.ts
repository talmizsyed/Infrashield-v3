import { describe, expect, it } from 'vitest';
import {
  AuthenticationPolicy,
  AuthenticationResult,
  AuthenticationValidator,
  BaseProvider,
  CapabilityDefinition,
  CapabilityMetadata,
  CapabilityResolver,
  CapabilityValidator,
  CapabilityVersion,
  CredentialStore,
  ConnectionFactory,
  ConnectionHealth,
  ConnectionPool,
  ConnectionRetryPolicy,
  ConnectionValidator,
  type ProviderCredential,
  ProviderAuthentication,
  ProviderCapabilityRegistry,
  ProviderConnection,
  ProviderConnectionManager,
  ProviderCapabilities,
  ProviderConfiguration,
  ProviderFactory,
  ProviderHealthMonitor,
  ProviderLifecycleManager,
  ProviderRecovery,
  ProviderShutdown,
  ProviderStartup,
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

class UsernamePasswordAuthenticationProvider {
  public readonly method = 'username-password' as const;

  public async authenticate(
    context: { readonly provider: { readonly manifest: { readonly id: string } } },
    credential: ProviderCredential,
  ): Promise<AuthenticationResult> {
    if (credential.method !== 'username-password') {
      return new AuthenticationResult({
        success: false,
        method: this.method,
        providerId: context.provider.manifest.id,
        message: 'Unsupported credential type for username-password provider.',
      });
    }

    if (credential.password !== 'valid-password') {
      return new AuthenticationResult({
        success: false,
        method: this.method,
        providerId: context.provider.manifest.id,
        principalId: credential.username,
        message: 'Invalid username or password.',
      });
    }

    return new AuthenticationResult({
      success: true,
      method: this.method,
      providerId: context.provider.manifest.id,
      principalId: credential.username,
      message: 'Authenticated.',
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

  it('validates supported authentication credential types', () => {
    const validator = new AuthenticationValidator();

    expect(() =>
      validator.validateCredential({
        method: 'username-password',
        username: 'alice',
        password: 'valid-password',
      }),
    ).not.toThrow();

    expect(() =>
      validator.validateCredential({
        method: 'api-key',
        apiKey: 'key-1',
      }),
    ).not.toThrow();

    expect(() =>
      validator.validateCredential({
        method: 'token',
        token: 'token-1',
      }),
    ).not.toThrow();

    expect(() =>
      validator.validateCredential({
        method: 'oauth2',
        accessToken: 'access-1',
        scopes: ['read:models'],
      }),
    ).not.toThrow();

    expect(() =>
      validator.validateCredential({
        method: 'client-certificate',
        certificatePem: 'cert-pem',
        privateKeyPem: 'private-key-pem',
      }),
    ).not.toThrow();

    expect(() =>
      validator.validateCredential({
        method: 'ssh-key',
        privateKey: 'ssh-private-key',
      }),
    ).not.toThrow();
  });

  it('enforces authentication policy restrictions', () => {
    const validator = new AuthenticationValidator();
    const policy = new AuthenticationPolicy({
      allowedMethods: ['oauth2'],
      requiredScopesByMethod: { oauth2: ['read:models'] },
    });

    expect(() =>
      validator.validatePolicy(
        policy,
        'oauth2',
        {
          method: 'oauth2',
          accessToken: 'access-1',
          scopes: ['read:models'],
        },
        ['read:models'],
      ),
    ).not.toThrow();

    expect(() =>
      validator.validatePolicy(
        policy,
        'api-key',
        {
          method: 'api-key',
          apiKey: 'key-1',
        },
        [],
      ),
    ).toThrow('Authentication method is not allowed: api-key');
  });

  it('authenticates through provider authentication and credential store abstraction', async () => {
    const provider = new TestProvider();
    const context = await provider.createContext({ apiKey: 'secret-key' }, { actorId: 'alice' });
    const store = new CredentialStore();
    const authentication = new ProviderAuthentication({
      credentialStore: store,
    });
    authentication.registerProvider(new UsernamePasswordAuthenticationProvider());

    const authenticationContext = {
      provider,
      providerContext: context,
      actorId: 'alice',
      requestedMethod: 'username-password' as const,
      requestedAt: new Date().toISOString(),
    };

    store.setCredential(authenticationContext, {
      method: 'username-password',
      username: 'alice',
      password: 'valid-password',
    });

    const result = await authentication.authenticate({
      provider,
      context,
      actorId: 'alice',
      method: 'username-password',
    });

    expect(result.success).toBe(true);
    expect(result.principalId).toBe('alice');
    expect(authentication.listMethods()).toContain('username-password');
    expect(store.removeCredential(authenticationContext, 'username-password')).toBe(true);
  });

  it('registers, discovers, queries, and versions provider capabilities', () => {
    const registry = new ProviderCapabilityRegistry();

    const chatV1 = new CapabilityDefinition({
      id: 'chat-completion',
      providerId: 'provider-test',
      name: 'chat',
      version: new CapabilityVersion('1.0.0'),
      metadata: new CapabilityMetadata({
        description: 'Chat completion capability.',
        tags: ['chat', 'text'],
        stability: 'stable',
        featureFlags: { stream: true },
      }),
      requiresCapabilities: ['chat'],
      requiredFeatureFlags: ['stream'],
    });

    const chatV2 = new CapabilityDefinition({
      id: 'chat-completion',
      providerId: 'provider-test',
      name: 'chat',
      version: new CapabilityVersion('2.0.0'),
      metadata: new CapabilityMetadata({
        description: 'Chat completion capability v2.',
        tags: ['chat', 'text'],
        stability: 'stable',
        featureFlags: { stream: true, tools: true },
      }),
      requiresCapabilities: ['chat'],
      requiredFeatureFlags: ['stream'],
    });

    const embeddingsExperimental = new CapabilityDefinition({
      id: 'embeddings-next',
      providerId: 'provider-test',
      name: 'embeddings',
      version: new CapabilityVersion('0.9.0'),
      metadata: new CapabilityMetadata({
        description: 'Next generation embeddings capability.',
        tags: ['embeddings'],
        stability: 'experimental',
        featureFlags: { vector64: true },
      }),
      requiresCapabilities: ['embeddings'],
    });

    registry.register(chatV1);
    registry.register(chatV2);
    registry.register(embeddingsExperimental);

    expect(registry.list()).toHaveLength(3);
    expect(
      registry.query({ providerId: 'provider-test', capabilityId: 'chat-completion' }),
    ).toHaveLength(2);
    expect(registry.discover({ providerId: 'provider-test', name: 'chat' })).toHaveLength(2);
    expect(registry.discover({ name: 'embeddings' })).toHaveLength(0);
    expect(registry.discover({ name: 'embeddings', includeExperimental: true })).toHaveLength(1);
    expect(registry.getLatest('provider-test', 'chat')?.version.toString()).toBe('2.0.0');
  });

  it('validates capability compatibility and resolves latest compatible capability', () => {
    const provider = new TestProvider();
    const registry = new ProviderCapabilityRegistry();
    const validator = new CapabilityValidator();
    const resolver = new CapabilityResolver(registry, validator);

    const compatible = new CapabilityDefinition({
      id: 'chat-completion',
      providerId: provider.manifest.id,
      name: 'chat',
      version: new CapabilityVersion('1.2.0'),
      metadata: new CapabilityMetadata({
        description: 'Compatible chat capability.',
        featureFlags: { stream: true },
      }),
      requiresCapabilities: ['chat'],
      requiredFeatureFlags: ['stream'],
    });

    const incompatible = new CapabilityDefinition({
      id: 'chat-completion',
      providerId: provider.manifest.id,
      name: 'chat',
      version: new CapabilityVersion('2.0.0'),
      metadata: new CapabilityMetadata({
        description: 'Incompatible chat capability.',
        featureFlags: { stream: false },
      }),
      requiresCapabilities: ['chat'],
      requiredFeatureFlags: ['stream'],
    });

    registry.register(compatible);
    registry.register(incompatible);

    const resolved = resolver.resolve(provider, {
      name: 'chat',
      version: new CapabilityVersion('1.2.0'),
      requiredFeatureFlags: ['stream'],
    });

    expect(resolved.version.toString()).toBe('1.2.0');
    expect(() =>
      resolver.resolve(provider, {
        name: 'chat',
        version: new CapabilityVersion('2.0.0'),
        requiredFeatureFlags: ['stream'],
      }),
    ).toThrow('Capability feature flag is disabled: stream');
  });

  it('manages provider lifecycle transitions and emits lifecycle events', async () => {
    const provider = new TestProvider();
    const events: string[] = [];
    const manager = new ProviderLifecycleManager({
      startup: new ProviderStartup(async () => undefined),
      shutdown: new ProviderShutdown(async () => undefined),
    });

    manager.on('initialized', () => events.push('initialized'));
    manager.on('started', () => events.push('started'));
    manager.on('suspended', () => events.push('suspended'));
    manager.on('resumed', () => events.push('resumed'));
    manager.on('stopped', () => events.push('stopped'));
    manager.on('restarted', () => events.push('restarted'));

    expect(manager.initialize(provider)).toBe('initialized');
    expect(await manager.start(provider)).toBe('running');
    expect(manager.suspend(provider.manifest.id)).toBe('suspended');
    expect(manager.resume(provider.manifest.id)).toBe('running');
    expect(await manager.restart(provider)).toBe('running');
    expect(await manager.stop(provider)).toBe('stopped');
    expect(manager.getState(provider.manifest.id)).toBe('stopped');

    expect(events).toEqual([
      'initialized',
      'started',
      'suspended',
      'resumed',
      'stopped',
      'initialized',
      'started',
      'restarted',
      'stopped',
    ]);
  });

  it('monitors health and recovers failed providers', async () => {
    const provider = new TestProvider();
    let recoverAttempts = 0;
    const manager = new ProviderLifecycleManager({
      startup: new ProviderStartup(async () => undefined),
      shutdown: new ProviderShutdown(async () => undefined),
      healthMonitor: new ProviderHealthMonitor(async (currentProvider) => ({
        providerId: currentProvider.manifest.id,
        status: 'degraded',
        healthy: false,
        checkedAt: new Date().toISOString(),
        message: 'latency high',
      })),
      recovery: new ProviderRecovery({
        maxAttempts: 2,
        recover: async () => {
          recoverAttempts += 1;
          return recoverAttempts >= 2;
        },
      }),
    });

    await manager.start(provider);
    const health = await manager.monitorHealth(provider);
    expect(health.healthy).toBe(false);
    expect(manager.getState(provider.manifest.id)).toBe('failed');

    const recovered = await manager.recover(provider, new Error('health degraded'));
    expect(recovered.recovered).toBe(true);
    expect(recovered.attempts).toBe(2);
    expect(manager.getState(provider.manifest.id)).toBe('running');
  });
});
