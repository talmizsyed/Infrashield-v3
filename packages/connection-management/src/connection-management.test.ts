import { describe, expect, it } from 'vitest';
import type { SerializableValueObject } from '@infrashield/contracts';
import {
  ApiKeyProvider,
  AuthenticationManager,
  BackoffStrategy,
  BasicAuthProvider,
  CertificateManager,
  CertificateValidator,
  CircuitBreaker,
  ClientCertificateProvider,
  ConnectionManagementConfiguration,
  ConnectionManager,
  CredentialRotator,
  CredentialStore,
  CredentialValidator,
  OAuthProvider,
  RetryPolicy,
  SecretProvider,
  SecretResolver,
  SessionManager,
  SessionRefresher,
  TimeoutPolicy,
  TokenProvider,
  TrustStore,
  type ConnectionDefinition,
  type ConnectionRequest,
  type ManagedCredential,
  type ManagedSession,
} from './connection-management';

describe('connection-management', () => {
  it('resolves secrets and authenticates across supported methods', async () => {
    const secretProvider = new SecretProvider([
      {
        reference: { provider: 'vault', key: 'password' },
        value: 'masked-password',
      },
      {
        reference: { provider: 'vault', key: 'api-key' },
        value: 'api-key-value',
      },
      {
        reference: { provider: 'vault', key: 'token' },
        value: 'token-value',
      },
      {
        reference: { provider: 'vault', key: 'oauth-client-secret' },
        value: 'oauth-secret',
      },
      {
        reference: { provider: 'vault', key: 'oauth-access-token' },
        value: 'oauth-access',
      },
      {
        reference: { provider: 'vault', key: 'cert' },
        value: '-----BEGIN CERTIFICATE-----fixture-----END CERTIFICATE-----',
      },
      {
        reference: { provider: 'vault', key: 'key' },
        value: '-----BEGIN PRIVATE KEY-----fixture-----END PRIVATE KEY-----',
      },
    ]);
    const resolver = new SecretResolver([{ id: 'vault', provider: secretProvider }]);
    const certificateManager = new CertificateManager(resolver);
    const authenticationManager = new AuthenticationManager(resolver, new CredentialValidator(), [
      new BasicAuthProvider(),
      new ApiKeyProvider(),
      new TokenProvider(),
      new OAuthProvider(),
      new ClientCertificateProvider(certificateManager),
    ]);

    const materials = await Promise.all([
      authenticationManager.authenticate({
        method: 'basic',
        username: 'svc-user',
        passwordRef: { provider: 'vault', key: 'password' },
      }),
      authenticationManager.authenticate({
        method: 'api-key',
        headerName: 'x-api-key',
        secretRef: { provider: 'vault', key: 'api-key' },
      }),
      authenticationManager.authenticate({
        method: 'token',
        headerName: 'authorization',
        prefix: 'Bearer',
        tokenRef: { provider: 'vault', key: 'token' },
      }),
      authenticationManager.authenticate({
        method: 'oauth2',
        clientId: 'client-1',
        clientSecretRef: { provider: 'vault', key: 'oauth-client-secret' },
        accessTokenRef: { provider: 'vault', key: 'oauth-access-token' },
        scopes: ['read:inventory'],
      }),
      authenticationManager.authenticate({
        method: 'client-certificate',
        certificateRef: { provider: 'vault', key: 'cert' },
        privateKeyRef: { provider: 'vault', key: 'key' },
      }),
    ]);

    expect(materials[0].headers.authorization.startsWith('Basic ')).toBe(true);
    expect(materials[1].headers['x-api-key']).toBe('api-key-value');
    expect(materials[2].headers.authorization).toBe('Bearer token-value');
    expect(materials[3].headers.authorization).toBe('Bearer oauth-access');
    expect(materials[4].certificate?.fingerprint).toBeDefined();
  });

  it('manages certificates, trust, rotation, and session refresh', async () => {
    const secretProvider = new SecretProvider([
      {
        reference: { provider: 'vault', key: 'cert' },
        value: '-----BEGIN CERTIFICATE-----fixture-----END CERTIFICATE-----',
      },
      {
        reference: { provider: 'vault', key: 'key' },
        value: '-----BEGIN PRIVATE KEY-----fixture-----END PRIVATE KEY-----',
      },
    ]);
    const resolver = new SecretResolver([{ id: 'vault', provider: secretProvider }]);
    const certificateManager = new CertificateManager(resolver);
    const certificate = await certificateManager.loadCertificate({
      alias: 'client-cert',
      certificateRef: { provider: 'vault', key: 'cert' },
      privateKeyRef: { provider: 'vault', key: 'key' },
      expiresAt: '2026-12-01T00:00:00.000Z',
    });
    const trustStore = new TrustStore();
    trustStore.add(certificate);
    const validator = new CertificateValidator();
    validator.validateTrusted(certificate, trustStore);

    const credentialStore = new CredentialStore();
    const rotator = new CredentialRotator();
    const original: ManagedCredential = {
      method: 'token',
      headerName: 'authorization',
      prefix: 'Bearer',
      tokenRef: { provider: 'vault', key: 'token-a' },
    };
    const replacement: ManagedCredential = {
      method: 'token',
      headerName: 'authorization',
      prefix: 'Bearer',
      tokenRef: { provider: 'vault', key: 'token-b' },
    };
    credentialStore.set('conn-1', original);
    rotator.rotate('conn-1', original, replacement, credentialStore);

    const sessionManager = new SessionManager();
    const currentSession: ManagedSession = {
      sessionId: 'session-1',
      connectionId: 'conn-1',
      token: 'session-token-1',
      expiresAt: '2026-01-01T00:00:30.000Z',
      refreshedAt: '2026-01-01T00:00:00.000Z',
      metadata: Object.freeze({ source: 'test' }),
    };
    sessionManager.set(currentSession);
    const refresher = new SessionRefresher(sessionManager, 60_000);
    const refreshed = await refresher.refreshIfNeeded(
      'conn-1',
      async (session) => ({
        ...session,
        sessionId: 'session-2',
        token: 'session-token-2',
        refreshedAt: '2026-01-01T00:00:20.000Z',
        expiresAt: '2026-01-01T01:00:00.000Z',
      }),
      new Date('2026-01-01T00:00:10.000Z'),
    );

    expect(credentialStore.get('conn-1')).toEqual(replacement);
    expect(rotator.getHistory('conn-1')).toHaveLength(1);
    expect(refreshed?.sessionId).toBe('session-2');
  });

  it('applies retry, backoff, timeout, and circuit breaking', async () => {
    const retryPolicy = new RetryPolicy({
      maxAttempts: 3,
      baseDelayMs: 1,
      maxDelayMs: 10,
      multiplier: 2,
      kind: 'exponential',
    });
    const backoff = new BackoffStrategy({
      maxAttempts: 3,
      baseDelayMs: 5,
      maxDelayMs: 20,
      multiplier: 2,
      kind: 'exponential',
    });
    let attempts = 0;
    const result = await retryPolicy.execute(async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error('temporary failure');
      }
      return 'ok';
    });

    const timeoutPolicy = new TimeoutPolicy(100);
    const timeoutResult = await timeoutPolicy.execute(async () => 'timely');

    const breaker = new CircuitBreaker(2, 1_000);
    await expect(
      breaker.execute(async () => {
        throw new Error('first failure');
      }),
    ).rejects.toThrow('first failure');
    await expect(
      breaker.execute(async () => {
        throw new Error('second failure');
      }),
    ).rejects.toThrow('second failure');
    await expect(breaker.execute(async () => 'never')).rejects.toThrow('Circuit breaker is open.');

    expect(result).toBe('ok');
    expect(timeoutResult).toBe('timely');
    expect(backoff.delayMs(2)).toBeGreaterThan(0);
  });

  it('manages generic connections, pooling, health, metrics, and audit logging', async () => {
    interface TestConfiguration extends SerializableValueObject {
      readonly endpoint: string;
      readonly region: string;
    }

    interface TestClient {
      readonly endpoint: string;
      readonly authorization: string;
    }

    const secretProvider = new SecretProvider([
      {
        reference: { provider: 'vault', key: 'password' },
        value: 'test-password',
      },
    ]);
    const resolver = new SecretResolver([{ id: 'vault', provider: secretProvider }]);
    const manager = new ConnectionManager(new ConnectionManagementConfiguration(), {
      secretResolver: resolver,
    });

    const definition: ConnectionDefinition<TestConfiguration, TestClient> = {
      kind: 'test-live-provider',
      async connect(input) {
        return {
          client: {
            endpoint: input.request.configuration.endpoint,
            authorization: input.authentication.headers.authorization,
          },
          session: {
            sessionId: 'session-1',
            connectionId: input.request.connectionId,
            token: 'session-token',
            expiresAt: '2026-12-01T00:00:00.000Z',
            refreshedAt: '2026-01-01T00:00:00.000Z',
            metadata: Object.freeze({ kind: input.request.kind }),
          },
        };
      },
      async disconnect() {
        return undefined;
      },
      async checkHealth(input) {
        return {
          connectionId: input.connection.id,
          status: 'connected',
          healthy: true,
          latencyMs: 12,
          message: 'healthy',
          checkedAt: '2026-01-01T00:00:00.000Z',
        };
      },
      async refreshSession(input) {
        return {
          ...input.session,
          refreshedAt: '2026-01-01T00:01:00.000Z',
        };
      },
    };
    manager.register(definition);
    manager.storeCredential('credential-1', {
      method: 'basic',
      username: 'svc-user',
      passwordRef: { provider: 'vault', key: 'password' },
    });

    const request: ConnectionRequest<TestConfiguration> = {
      connectionId: 'conn-1',
      kind: 'test-live-provider',
      credentialId: 'credential-1',
      configuration: Object.freeze({
        endpoint: 'https://example.local',
        region: 'us-east-1',
      }),
      metadata: Object.freeze({ area: 'tests' }),
    };

    const connection = await manager.connect<TestConfiguration, TestClient>(request);
    const cached = await manager.connect<TestConfiguration, TestClient>(request);
    const health = await manager.checkHealth('conn-1');
    const disconnected = await manager.disconnect('conn-1');

    expect(connection.client.endpoint).toBe('https://example.local');
    expect(connection.client.authorization.startsWith('Basic ')).toBe(true);
    expect(cached.id).toBe(connection.id);
    expect(manager.listRegisteredKinds()).toContain('test-live-provider');
    expect(health?.healthy).toBe(true);
    expect(manager.getMetrics()[0]?.connectCount).toBeGreaterThan(0);
    expect(manager.getHealthSnapshots()[0]?.status).toBeDefined();
    expect(manager.getAuditEntries().length).toBeGreaterThan(0);
    expect(disconnected).toBe(true);
  });
});
