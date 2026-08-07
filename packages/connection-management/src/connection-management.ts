import type { SerializableValueObject } from '@infrashield/contracts';
import {
  StructuredLogger,
  createMemoryLogSink,
  toIdentifier,
  type ILogger,
} from '@infrashield/core-infrastructure';

export type ConnectionStatus =
  'idle' | 'connecting' | 'connected' | 'refreshing' | 'degraded' | 'disconnected' | 'failed';

export type AuthenticationMethod = 'oauth2' | 'basic' | 'api-key' | 'token' | 'client-certificate';

export type BackoffKind = 'fixed' | 'exponential';
export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export interface SecretReference {
  readonly provider: string;
  readonly key: string;
  readonly version?: string;
}

export interface ProxyConfiguration {
  readonly url: string;
  readonly usernameRef?: SecretReference;
  readonly passwordRef?: SecretReference;
  readonly bypassHosts: readonly string[];
}

export interface TlsConfiguration {
  readonly enabled: boolean;
  readonly insecureSkipVerify: boolean;
  readonly minVersion: 'TLSv1.2' | 'TLSv1.3';
  readonly certificateRefs: readonly SecretReference[];
  readonly trustStoreRefs: readonly SecretReference[];
}

export interface RetryConfiguration {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly multiplier: number;
  readonly kind: BackoffKind;
}

export interface TimeoutConfiguration {
  readonly connectTimeoutMs: number;
  readonly requestTimeoutMs: number;
  readonly idleTimeoutMs: number;
}

export interface PoolConfiguration {
  readonly maxSize: number;
  readonly minSize: number;
  readonly maxIdleMs: number;
}

export interface ConnectionManagementOptions {
  readonly timeouts: TimeoutConfiguration;
  readonly retry: RetryConfiguration;
  readonly pool: PoolConfiguration;
  readonly tls: TlsConfiguration;
  readonly proxy?: ProxyConfiguration;
  readonly certificateRotationIntervalMs: number;
  readonly sessionRefreshWindowMs: number;
}

export interface BasicCredential {
  readonly method: 'basic';
  readonly username: string;
  readonly passwordRef: SecretReference;
}

export interface ApiKeyCredential {
  readonly method: 'api-key';
  readonly headerName: string;
  readonly prefix?: string;
  readonly secretRef: SecretReference;
}

export interface TokenCredential {
  readonly method: 'token';
  readonly headerName: string;
  readonly prefix?: string;
  readonly tokenRef: SecretReference;
}

export interface OAuthCredential {
  readonly method: 'oauth2';
  readonly tokenType?: string;
  readonly clientId: string;
  readonly clientSecretRef: SecretReference;
  readonly accessTokenRef: SecretReference;
  readonly refreshTokenRef?: SecretReference;
  readonly scopes: readonly string[];
}

export interface ClientCertificateCredential {
  readonly method: 'client-certificate';
  readonly certificateRef: SecretReference;
  readonly privateKeyRef: SecretReference;
  readonly passphraseRef?: SecretReference;
}

export type ManagedCredential =
  | BasicCredential
  | ApiKeyCredential
  | TokenCredential
  | OAuthCredential
  | ClientCertificateCredential;

export interface ManagedCertificate {
  readonly alias: string;
  readonly certificatePem: string;
  readonly privateKeyPem?: string;
  readonly passphrase?: string;
  readonly fingerprint: string;
  readonly expiresAt?: string;
}

export interface AuthenticationMaterial {
  readonly method: AuthenticationMethod;
  readonly headers: Readonly<Record<string, string>>;
  readonly query: Readonly<Record<string, string>>;
  readonly certificate?: ManagedCertificate;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface ManagedSession {
  readonly sessionId: string;
  readonly connectionId: string;
  readonly token: string;
  readonly expiresAt: string;
  readonly refreshedAt: string;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface ConnectionRequest<TConfiguration extends SerializableValueObject> {
  readonly connectionId: string;
  readonly kind: string;
  readonly configuration: Readonly<TConfiguration>;
  readonly credentialId: string;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface ConnectionHealthSnapshot {
  readonly connectionId: string;
  readonly status: ConnectionStatus;
  readonly healthy: boolean;
  readonly latencyMs?: number;
  readonly message?: string;
  readonly checkedAt: string;
}

export interface ConnectionMetricSnapshot {
  readonly connectionId: string;
  readonly connectCount: number;
  readonly disconnectCount: number;
  readonly refreshCount: number;
  readonly failureCount: number;
  readonly lastConnectedAt?: string;
  readonly lastDisconnectedAt?: string;
  readonly averageLatencyMs?: number;
}

export interface ConnectionAuditEntry {
  readonly id: string;
  readonly connectionId: string;
  readonly action: string;
  readonly outcome: 'success' | 'failure';
  readonly details?: Readonly<Record<string, string>>;
  readonly timestamp: string;
}

export interface ConnectionRecord<TConfiguration extends SerializableValueObject, TClient> {
  readonly id: string;
  readonly kind: string;
  readonly configuration: Readonly<TConfiguration>;
  readonly client: TClient;
  readonly status: ConnectionStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly session?: ManagedSession;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface ConnectionDefinition<TConfiguration extends SerializableValueObject, TClient> {
  readonly kind: string;
  connect(input: {
    readonly request: ConnectionRequest<TConfiguration>;
    readonly authentication: AuthenticationMaterial;
    readonly session?: ManagedSession;
    readonly signal: AbortSignal;
  }): Promise<{ readonly client: TClient; readonly session?: ManagedSession }>;
  disconnect?(input: {
    readonly connection: ConnectionRecord<TConfiguration, TClient>;
    readonly signal: AbortSignal;
  }): Promise<void>;
  checkHealth?(input: {
    readonly connection: ConnectionRecord<TConfiguration, TClient>;
    readonly signal: AbortSignal;
  }): Promise<ConnectionHealthSnapshot>;
  refreshSession?(input: {
    readonly request: ConnectionRequest<TConfiguration>;
    readonly session: ManagedSession;
    readonly authentication: AuthenticationMaterial;
    readonly signal: AbortSignal;
  }): Promise<ManagedSession>;
}

function freezeRecord<T extends Record<string, string>>(value: T): Readonly<T> {
  return Object.freeze({ ...value });
}

function freezeObject<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function defaultLogger(loggerId: string): ILogger {
  return new StructuredLogger({
    loggerId: toIdentifier(loggerId),
    sink: createMemoryLogSink(),
    minLevel: 'info',
  });
}

function hashFingerprint(value: string): string {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export class ConnectionManagementConfiguration {
  public readonly options: Readonly<ConnectionManagementOptions>;

  public constructor(options: Partial<ConnectionManagementOptions> = {}) {
    this.options = freezeObject({
      timeouts: freezeObject({
        connectTimeoutMs: options.timeouts?.connectTimeoutMs ?? 10_000,
        requestTimeoutMs: options.timeouts?.requestTimeoutMs ?? 30_000,
        idleTimeoutMs: options.timeouts?.idleTimeoutMs ?? 300_000,
      }),
      retry: freezeObject({
        maxAttempts: options.retry?.maxAttempts ?? 2,
        baseDelayMs: options.retry?.baseDelayMs ?? 100,
        maxDelayMs: options.retry?.maxDelayMs ?? 5_000,
        multiplier: options.retry?.multiplier ?? 2,
        kind: options.retry?.kind ?? 'exponential',
      }),
      pool: freezeObject({
        maxSize: options.pool?.maxSize ?? 32,
        minSize: options.pool?.minSize ?? 0,
        maxIdleMs: options.pool?.maxIdleMs ?? 300_000,
      }),
      tls: freezeObject({
        enabled: options.tls?.enabled ?? true,
        insecureSkipVerify: options.tls?.insecureSkipVerify ?? false,
        minVersion: options.tls?.minVersion ?? 'TLSv1.2',
        certificateRefs: freezeObject([...(options.tls?.certificateRefs ?? [])]),
        trustStoreRefs: freezeObject([...(options.tls?.trustStoreRefs ?? [])]),
      }),
      proxy: options.proxy
        ? freezeObject({
            url: options.proxy.url,
            usernameRef: options.proxy.usernameRef,
            passwordRef: options.proxy.passwordRef,
            bypassHosts: freezeObject([...(options.proxy.bypassHosts ?? [])]),
          })
        : undefined,
      certificateRotationIntervalMs: options.certificateRotationIntervalMs ?? 86_400_000,
      sessionRefreshWindowMs: options.sessionRefreshWindowMs ?? 60_000,
    });
  }

  public merge(options: Partial<ConnectionManagementOptions>): ConnectionManagementConfiguration {
    return new ConnectionManagementConfiguration({
      ...this.options,
      ...options,
      timeouts: { ...this.options.timeouts, ...(options.timeouts ?? {}) },
      retry: { ...this.options.retry, ...(options.retry ?? {}) },
      pool: { ...this.options.pool, ...(options.pool ?? {}) },
      tls: { ...this.options.tls, ...(options.tls ?? {}) },
      proxy: options.proxy ?? this.options.proxy,
    });
  }
}

export class SecretProvider {
  private readonly secrets = new Map<string, string>();

  public constructor(
    entries: readonly { readonly reference: SecretReference; readonly value: string }[] = [],
  ) {
    for (const entry of entries) {
      this.secrets.set(this.resolveKey(entry.reference), entry.value);
    }
  }

  public set(reference: SecretReference, value: string): void {
    this.secrets.set(this.resolveKey(reference), value);
  }

  public async get(reference: SecretReference): Promise<string | undefined> {
    return this.secrets.get(this.resolveKey(reference));
  }

  private resolveKey(reference: SecretReference): string {
    return `${reference.provider}:${reference.key}:${reference.version ?? 'latest'}`;
  }
}

export class SecretResolver {
  private readonly providers = new Map<string, SecretProvider>();

  public constructor(
    providers: readonly { readonly id: string; readonly provider: SecretProvider }[] = [],
  ) {
    for (const provider of providers) {
      this.providers.set(provider.id, provider.provider);
    }
  }

  public register(id: string, provider: SecretProvider): void {
    this.providers.set(id, provider);
  }

  public async resolve(reference: SecretReference): Promise<string | undefined> {
    return this.providers.get(reference.provider)?.get(reference);
  }

  public async resolveRequired(reference: SecretReference): Promise<string> {
    const value = await this.resolve(reference);
    if (!value) {
      throw new Error(`Missing secret for ${reference.provider}:${reference.key}.`);
    }
    return value;
  }
}

export class CredentialStore {
  private readonly credentials = new Map<string, ManagedCredential>();

  public set(connectionId: string, credential: ManagedCredential): void {
    this.credentials.set(connectionId, credential);
  }

  public get(connectionId: string): ManagedCredential | undefined {
    return this.credentials.get(connectionId);
  }

  public list(): readonly ManagedCredential[] {
    return freezeObject([...this.credentials.values()]);
  }
}

export class CredentialValidator {
  public validate(credential: ManagedCredential): void {
    switch (credential.method) {
      case 'basic':
        this.ensure(credential.username.trim().length > 0, 'Basic auth username is required.');
        break;
      case 'api-key':
        this.ensure(credential.headerName.trim().length > 0, 'API key header name is required.');
        break;
      case 'token':
        this.ensure(credential.headerName.trim().length > 0, 'Token header name is required.');
        break;
      case 'oauth2':
        this.ensure(credential.clientId.trim().length > 0, 'OAuth client ID is required.');
        break;
      case 'client-certificate':
        break;
      default:
        this.assertNever(credential);
    }
  }

  private ensure(condition: boolean, message: string): void {
    if (!condition) {
      throw new Error(message);
    }
  }

  private assertNever(value: never): never {
    throw new Error(`Unsupported credential: ${JSON.stringify(value)}`);
  }
}

export class CredentialRotator {
  private readonly history = new Map<string, readonly ManagedCredential[]>();

  public rotate(
    connectionId: string,
    current: ManagedCredential,
    replacement: ManagedCredential,
    store: CredentialStore,
  ): void {
    const previous = this.history.get(connectionId) ?? [];
    this.history.set(connectionId, freezeObject([...previous, current]));
    store.set(connectionId, replacement);
  }

  public getHistory(connectionId: string): readonly ManagedCredential[] {
    return this.history.get(connectionId) ?? freezeObject([] as ManagedCredential[]);
  }
}

export class TrustStore {
  private readonly certificates = new Map<string, ManagedCertificate>();

  public add(certificate: ManagedCertificate): void {
    this.certificates.set(certificate.alias, freezeObject({ ...certificate }));
  }

  public get(alias: string): ManagedCertificate | undefined {
    return this.certificates.get(alias);
  }

  public list(): readonly ManagedCertificate[] {
    return freezeObject([...this.certificates.values()]);
  }
}

export class CertificateValidator {
  public validatePem(pem: string): void {
    if (!pem.includes('BEGIN')) {
      throw new Error('Certificate PEM is invalid.');
    }
  }

  public validateNotExpired(certificate: ManagedCertificate, now = new Date()): void {
    if (!certificate.expiresAt) {
      return;
    }

    if (new Date(certificate.expiresAt).getTime() <= now.getTime()) {
      throw new Error(`Certificate ${certificate.alias} has expired.`);
    }
  }

  public validateTrusted(certificate: ManagedCertificate, trustStore: TrustStore): void {
    const trusted = trustStore
      .list()
      .some((entry) => entry.fingerprint === certificate.fingerprint);
    if (!trusted) {
      throw new Error(`Certificate ${certificate.alias} is not trusted.`);
    }
  }
}

export class CertificateManager {
  public constructor(
    private readonly resolver: SecretResolver,
    private readonly validator: CertificateValidator = new CertificateValidator(),
  ) {}

  public async loadCertificate(options: {
    readonly alias: string;
    readonly certificateRef: SecretReference;
    readonly privateKeyRef?: SecretReference;
    readonly passphraseRef?: SecretReference;
    readonly expiresAt?: string;
  }): Promise<ManagedCertificate> {
    const certificatePem = await this.resolver.resolveRequired(options.certificateRef);
    this.validator.validatePem(certificatePem);
    const privateKeyPem = options.privateKeyRef
      ? await this.resolver.resolveRequired(options.privateKeyRef)
      : undefined;
    const passphrase = options.passphraseRef
      ? await this.resolver.resolveRequired(options.passphraseRef)
      : undefined;

    const certificate = freezeObject({
      alias: options.alias,
      certificatePem,
      privateKeyPem,
      passphrase,
      fingerprint: hashFingerprint(certificatePem),
      expiresAt: options.expiresAt,
    });
    this.validator.validateNotExpired(certificate);
    return certificate;
  }
}

export interface AuthenticationProviderContract {
  readonly method: AuthenticationMethod;
  authenticate(
    credential: ManagedCredential,
    resolver: SecretResolver,
  ): Promise<AuthenticationMaterial>;
}

export class BasicAuthProvider implements AuthenticationProviderContract {
  public readonly method = 'basic' as const;

  public async authenticate(
    credential: ManagedCredential,
    resolver: SecretResolver,
  ): Promise<AuthenticationMaterial> {
    if (credential.method !== 'basic') {
      throw new Error('BasicAuthProvider requires a basic credential.');
    }
    const password = await resolver.resolveRequired(credential.passwordRef);
    const authorization = Buffer.from(`${credential.username}:${password}`, 'utf8').toString(
      'base64',
    );
    return freezeObject({
      method: 'basic',
      headers: freezeRecord({ authorization: `Basic ${authorization}` }),
      query: freezeRecord({}),
    });
  }
}

export class ApiKeyProvider implements AuthenticationProviderContract {
  public readonly method = 'api-key' as const;

  public async authenticate(
    credential: ManagedCredential,
    resolver: SecretResolver,
  ): Promise<AuthenticationMaterial> {
    if (credential.method !== 'api-key') {
      throw new Error('ApiKeyProvider requires an api-key credential.');
    }
    const secret = await resolver.resolveRequired(credential.secretRef);
    return freezeObject({
      method: 'api-key',
      headers: freezeRecord({
        [credential.headerName]: `${credential.prefix ? `${credential.prefix} ` : ''}${secret}`,
      }),
      query: freezeRecord({}),
    });
  }
}

export class TokenProvider implements AuthenticationProviderContract {
  public readonly method = 'token' as const;

  public async authenticate(
    credential: ManagedCredential,
    resolver: SecretResolver,
  ): Promise<AuthenticationMaterial> {
    if (credential.method !== 'token') {
      throw new Error('TokenProvider requires a token credential.');
    }
    const token = await resolver.resolveRequired(credential.tokenRef);
    return freezeObject({
      method: 'token',
      headers: freezeRecord({
        [credential.headerName]: `${credential.prefix ? `${credential.prefix} ` : ''}${token}`,
      }),
      query: freezeRecord({}),
    });
  }
}

export class OAuthProvider implements AuthenticationProviderContract {
  public readonly method = 'oauth2' as const;

  public async authenticate(
    credential: ManagedCredential,
    resolver: SecretResolver,
  ): Promise<AuthenticationMaterial> {
    if (credential.method !== 'oauth2') {
      throw new Error('OAuthProvider requires an oauth2 credential.');
    }
    const accessToken = await resolver.resolveRequired(credential.accessTokenRef);
    const clientSecret = await resolver.resolveRequired(credential.clientSecretRef);
    return freezeObject({
      method: 'oauth2',
      headers: freezeRecord({ authorization: `Bearer ${accessToken}` }),
      query: freezeRecord({}),
      metadata: freezeRecord({
        clientId: credential.clientId,
        scopes: credential.scopes.join(','),
        tokenType: credential.tokenType ?? 'Bearer',
        clientSecretLength: String(clientSecret.length),
      }),
    });
  }
}

export class ClientCertificateProvider implements AuthenticationProviderContract {
  public readonly method = 'client-certificate' as const;

  public constructor(private readonly certificateManager: CertificateManager) {}

  public async authenticate(
    credential: ManagedCredential,
    _resolver: SecretResolver,
  ): Promise<AuthenticationMaterial> {
    if (credential.method !== 'client-certificate') {
      throw new Error('ClientCertificateProvider requires a client-certificate credential.');
    }
    const certificate = await this.certificateManager.loadCertificate({
      alias: 'client-certificate',
      certificateRef: credential.certificateRef,
      privateKeyRef: credential.privateKeyRef,
      passphraseRef: credential.passphraseRef,
    });
    return freezeObject({
      method: 'client-certificate',
      headers: freezeRecord({}),
      query: freezeRecord({}),
      certificate,
    });
  }
}

export class AuthenticationManager {
  private readonly providers = new Map<AuthenticationMethod, AuthenticationProviderContract>();

  public constructor(
    private readonly resolver: SecretResolver,
    private readonly validator: CredentialValidator = new CredentialValidator(),
    providers: readonly AuthenticationProviderContract[] = [],
  ) {
    for (const provider of providers) {
      this.providers.set(provider.method, provider);
    }
  }

  public register(provider: AuthenticationProviderContract): void {
    this.providers.set(provider.method, provider);
  }

  public async authenticate(credential: ManagedCredential): Promise<AuthenticationMaterial> {
    this.validator.validate(credential);
    const provider = this.providers.get(credential.method);
    if (!provider) {
      throw new Error(`No authentication provider registered for ${credential.method}.`);
    }
    return provider.authenticate(credential, this.resolver);
  }
}

export class SessionCache {
  private readonly sessions = new Map<string, ManagedSession>();

  public set(session: ManagedSession): void {
    this.sessions.set(session.connectionId, freezeObject({ ...session }));
  }

  public get(connectionId: string): ManagedSession | undefined {
    return this.sessions.get(connectionId);
  }

  public delete(connectionId: string): boolean {
    return this.sessions.delete(connectionId);
  }

  public list(): readonly ManagedSession[] {
    return freezeObject([...this.sessions.values()]);
  }
}

export class SessionManager {
  public constructor(private readonly cache: SessionCache = new SessionCache()) {}

  public get(connectionId: string): ManagedSession | undefined {
    return this.cache.get(connectionId);
  }

  public set(session: ManagedSession): void {
    this.cache.set(session);
  }

  public invalidate(connectionId: string): void {
    this.cache.delete(connectionId);
  }

  public list(): readonly ManagedSession[] {
    return this.cache.list();
  }
}

export class SessionRefresher {
  public constructor(
    private readonly manager: SessionManager,
    private readonly refreshWindowMs: number,
  ) {}

  public async refreshIfNeeded(
    connectionId: string,
    refresh: (session: ManagedSession) => Promise<ManagedSession>,
    now = new Date(),
  ): Promise<ManagedSession | undefined> {
    const session = this.manager.get(connectionId);
    if (!session) {
      return undefined;
    }
    const expiresAt = new Date(session.expiresAt).getTime();
    if (expiresAt - now.getTime() > this.refreshWindowMs) {
      return session;
    }
    const refreshed = await refresh(session);
    this.manager.set(refreshed);
    return refreshed;
  }
}

export class BackoffStrategy {
  public constructor(private readonly configuration: RetryConfiguration) {}

  public delayMs(attempt: number): number {
    if (attempt <= 1) {
      return 0;
    }
    if (this.configuration.kind === 'fixed') {
      return Math.min(this.configuration.baseDelayMs, this.configuration.maxDelayMs);
    }
    const computed = Math.floor(
      this.configuration.baseDelayMs * this.configuration.multiplier ** Math.max(0, attempt - 2),
    );
    return Math.min(computed, this.configuration.maxDelayMs);
  }
}

export class RetryPolicy {
  private readonly strategy: BackoffStrategy;

  public constructor(private readonly configuration: RetryConfiguration) {
    this.strategy = new BackoffStrategy(configuration);
  }

  public shouldRetry(attempt: number, error?: Error): boolean {
    if (attempt >= this.configuration.maxAttempts) {
      return false;
    }
    if (!error) {
      return true;
    }
    const message = error.message.toLowerCase();
    return message.includes('timeout') || message.includes('tempor') || message.includes('retry');
  }

  public getDelayMs(attempt: number): number {
    return this.strategy.delayMs(attempt);
  }

  public async execute<T>(operation: (attempt: number) => Promise<T>): Promise<T> {
    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= this.configuration.maxAttempts; attempt += 1) {
      try {
        return await operation(attempt);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (!this.shouldRetry(attempt, lastError)) {
          throw lastError;
        }
        const delayMs = this.getDelayMs(attempt + 1);
        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }
    throw lastError ?? new Error('Retry operation failed.');
  }
}

export class CircuitBreaker {
  private state: CircuitBreakerState = 'closed';
  private failureCount = 0;
  private openedAtMs?: number;

  public constructor(
    private readonly failureThreshold = 3,
    private readonly resetTimeoutMs = 30_000,
  ) {}

  public getState(now = Date.now()): CircuitBreakerState {
    if (
      this.state === 'open' &&
      this.openedAtMs !== undefined &&
      now - this.openedAtMs >= this.resetTimeoutMs
    ) {
      this.state = 'half-open';
    }
    return this.state;
  }

  public async execute<T>(operation: () => Promise<T>, now = Date.now()): Promise<T> {
    const state = this.getState(now);
    if (state === 'open') {
      throw new Error('Circuit breaker is open.');
    }

    try {
      const result = await operation();
      this.state = 'closed';
      this.failureCount = 0;
      this.openedAtMs = undefined;
      return result;
    } catch (error) {
      this.failureCount += 1;
      if (this.failureCount >= this.failureThreshold) {
        this.state = 'open';
        this.openedAtMs = now;
      }
      throw error;
    }
  }
}

export class TimeoutPolicy {
  public constructor(private readonly timeoutMs: number) {}

  public async execute<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort('timeout'), this.timeoutMs);
    try {
      return await operation(controller.signal);
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class ConnectionMetrics {
  private readonly metrics = new Map<string, ConnectionMetricSnapshot>();

  public recordConnected(connectionId: string, latencyMs?: number): void {
    const current = this.metrics.get(connectionId);
    const connectCount = (current?.connectCount ?? 0) + 1;
    const previousAverage = current?.averageLatencyMs ?? latencyMs;
    const averageLatencyMs =
      latencyMs === undefined
        ? previousAverage
        : previousAverage === undefined
          ? latencyMs
          : Math.round((previousAverage * (connectCount - 1) + latencyMs) / connectCount);
    this.metrics.set(
      connectionId,
      freezeObject({
        connectionId,
        connectCount,
        disconnectCount: current?.disconnectCount ?? 0,
        refreshCount: current?.refreshCount ?? 0,
        failureCount: current?.failureCount ?? 0,
        lastConnectedAt: new Date().toISOString(),
        lastDisconnectedAt: current?.lastDisconnectedAt,
        averageLatencyMs,
      }),
    );
  }

  public recordDisconnected(connectionId: string): void {
    const current = this.metrics.get(connectionId);
    this.metrics.set(
      connectionId,
      freezeObject({
        connectionId,
        connectCount: current?.connectCount ?? 0,
        disconnectCount: (current?.disconnectCount ?? 0) + 1,
        refreshCount: current?.refreshCount ?? 0,
        failureCount: current?.failureCount ?? 0,
        lastConnectedAt: current?.lastConnectedAt,
        lastDisconnectedAt: new Date().toISOString(),
        averageLatencyMs: current?.averageLatencyMs,
      }),
    );
  }

  public recordRefreshed(connectionId: string): void {
    const current = this.metrics.get(connectionId);
    this.metrics.set(
      connectionId,
      freezeObject({
        connectionId,
        connectCount: current?.connectCount ?? 0,
        disconnectCount: current?.disconnectCount ?? 0,
        refreshCount: (current?.refreshCount ?? 0) + 1,
        failureCount: current?.failureCount ?? 0,
        lastConnectedAt: current?.lastConnectedAt,
        lastDisconnectedAt: current?.lastDisconnectedAt,
        averageLatencyMs: current?.averageLatencyMs,
      }),
    );
  }

  public recordFailure(connectionId: string): void {
    const current = this.metrics.get(connectionId);
    this.metrics.set(
      connectionId,
      freezeObject({
        connectionId,
        connectCount: current?.connectCount ?? 0,
        disconnectCount: current?.disconnectCount ?? 0,
        refreshCount: current?.refreshCount ?? 0,
        failureCount: (current?.failureCount ?? 0) + 1,
        lastConnectedAt: current?.lastConnectedAt,
        lastDisconnectedAt: current?.lastDisconnectedAt,
        averageLatencyMs: current?.averageLatencyMs,
      }),
    );
  }

  public get(connectionId: string): ConnectionMetricSnapshot | undefined {
    return this.metrics.get(connectionId);
  }

  public list(): readonly ConnectionMetricSnapshot[] {
    return freezeObject([...this.metrics.values()]);
  }
}

export class AuditLogger {
  private readonly entries: ConnectionAuditEntry[] = [];

  public constructor(
    private readonly logger: ILogger = defaultLogger('connection-management-audit'),
  ) {}

  public async record(
    entry: Omit<ConnectionAuditEntry, 'id' | 'timestamp'>,
  ): Promise<ConnectionAuditEntry> {
    const auditEntry = freezeObject({
      id: `audit-${this.entries.length + 1}`,
      timestamp: new Date().toISOString(),
      ...entry,
    });
    this.entries.push(auditEntry);
    await this.logger.info(`connection.${entry.action}`, {
      connectionId: entry.connectionId,
      outcome: entry.outcome,
      ...(entry.details ?? {}),
    });
    return auditEntry;
  }

  public list(): readonly ConnectionAuditEntry[] {
    return freezeObject([...this.entries]);
  }
}

export class ConnectionHealthMonitor {
  private readonly snapshots = new Map<string, ConnectionHealthSnapshot>();

  public update(snapshot: ConnectionHealthSnapshot): void {
    this.snapshots.set(snapshot.connectionId, freezeObject({ ...snapshot }));
  }

  public get(connectionId: string): ConnectionHealthSnapshot | undefined {
    return this.snapshots.get(connectionId);
  }

  public list(): readonly ConnectionHealthSnapshot[] {
    return freezeObject([...this.snapshots.values()]);
  }
}

export class ConnectionRegistry {
  private readonly definitions = new Map<
    string,
    ConnectionDefinition<SerializableValueObject, unknown>
  >();

  public register<TConfiguration extends SerializableValueObject, TClient>(
    definition: ConnectionDefinition<TConfiguration, TClient>,
  ): void {
    this.definitions.set(
      definition.kind,
      definition as unknown as ConnectionDefinition<SerializableValueObject, unknown>,
    );
  }

  public get<TConfiguration extends SerializableValueObject, TClient>(
    kind: string,
  ): ConnectionDefinition<TConfiguration, TClient> | undefined {
    return this.definitions.get(kind) as ConnectionDefinition<TConfiguration, TClient> | undefined;
  }

  public listKinds(): readonly string[] {
    return freezeObject([...this.definitions.keys()]);
  }
}

export class ConnectionFactory {
  public constructor(private readonly registry: ConnectionRegistry) {}

  public getDefinition<TConfiguration extends SerializableValueObject, TClient>(
    kind: string,
  ): ConnectionDefinition<TConfiguration, TClient> {
    const definition = this.registry.get<TConfiguration, TClient>(kind);
    if (!definition) {
      throw new Error(`Connection definition ${kind} is not registered.`);
    }
    return definition;
  }
}

export class ConnectionPool {
  private readonly connections = new Map<
    string,
    ConnectionRecord<SerializableValueObject, unknown>
  >();
  private readonly lastTouchedAt = new Map<string, number>();

  public constructor(private readonly configuration: PoolConfiguration) {}

  public get<TConfiguration extends SerializableValueObject, TClient>(
    connectionId: string,
  ): ConnectionRecord<TConfiguration, TClient> | undefined {
    const connection = this.connections.get(connectionId) as
      ConnectionRecord<TConfiguration, TClient> | undefined;
    if (connection) {
      this.lastTouchedAt.set(connectionId, Date.now());
    }
    return connection;
  }

  public set<TConfiguration extends SerializableValueObject, TClient>(
    connection: ConnectionRecord<TConfiguration, TClient>,
  ): void {
    if (
      !this.connections.has(connection.id) &&
      this.connections.size >= this.configuration.maxSize
    ) {
      this.evictOldest();
    }
    this.connections.set(
      connection.id,
      connection as unknown as ConnectionRecord<SerializableValueObject, unknown>,
    );
    this.lastTouchedAt.set(connection.id, Date.now());
  }

  public delete(connectionId: string): boolean {
    this.lastTouchedAt.delete(connectionId);
    return this.connections.delete(connectionId);
  }

  public list(): readonly ConnectionRecord<SerializableValueObject, unknown>[] {
    return freezeObject([...this.connections.values()]);
  }

  private evictOldest(): void {
    const oldest = [...this.lastTouchedAt.entries()].sort((left, right) => left[1] - right[1])[0];
    if (!oldest) {
      return;
    }
    this.delete(oldest[0]);
  }
}

export class ConnectionLifecycleManager {
  public constructor(
    private readonly authenticationManager: AuthenticationManager,
    private readonly credentialStore: CredentialStore,
    private readonly factory: ConnectionFactory,
    private readonly pool: ConnectionPool,
    private readonly sessionManager: SessionManager,
    private readonly sessionRefresher: SessionRefresher,
    private readonly retryPolicy: RetryPolicy,
    private readonly circuitBreaker: CircuitBreaker,
    private readonly timeoutPolicy: TimeoutPolicy,
    private readonly metrics: ConnectionMetrics,
    private readonly healthMonitor: ConnectionHealthMonitor,
    private readonly auditLogger: AuditLogger,
  ) {}

  public async connect<TConfiguration extends SerializableValueObject, TClient>(
    request: ConnectionRequest<TConfiguration>,
  ): Promise<ConnectionRecord<TConfiguration, TClient>> {
    const existing = this.pool.get<TConfiguration, TClient>(request.connectionId);
    if (existing && existing.status === 'connected') {
      return existing;
    }

    const credential = this.credentialStore.get(request.credentialId);
    if (!credential) {
      throw new Error(`Credential ${request.credentialId} is not registered.`);
    }

    const authentication = await this.authenticationManager.authenticate(credential);
    const definition = this.factory.getDefinition<TConfiguration, TClient>(request.kind);
    const startedAt = Date.now();

    return this.circuitBreaker
      .execute(async () =>
        this.retryPolicy.execute(async () =>
          this.timeoutPolicy.execute(async (signal) => {
            const refreshedSession = await this.sessionRefresher.refreshIfNeeded(
              request.connectionId,
              async (session) => {
                if (!definition.refreshSession) {
                  return session;
                }
                const next = await definition.refreshSession({
                  request,
                  session,
                  authentication,
                  signal,
                });
                this.metrics.recordRefreshed(request.connectionId);
                return next;
              },
            );

            const result = await definition.connect({
              request,
              authentication,
              session: refreshedSession,
              signal,
            });
            if (result.session) {
              this.sessionManager.set(result.session);
            }
            const now = new Date().toISOString();
            const connection = freezeObject({
              id: request.connectionId,
              kind: request.kind,
              configuration: request.configuration,
              client: result.client,
              status: 'connected' as const,
              createdAt: existing?.createdAt ?? now,
              updatedAt: now,
              session: result.session ?? refreshedSession,
              metadata: freezeRecord({ ...(request.metadata ?? {}) }),
            });
            this.pool.set(connection);
            const latencyMs = Date.now() - startedAt;
            this.metrics.recordConnected(request.connectionId, latencyMs);
            this.healthMonitor.update({
              connectionId: request.connectionId,
              status: 'connected',
              healthy: true,
              latencyMs,
              checkedAt: now,
              message: 'Connection established.',
            });
            await this.auditLogger.record({
              connectionId: request.connectionId,
              action: 'connect',
              outcome: 'success',
              details: { kind: request.kind },
            });
            return connection;
          }),
        ),
      )
      .catch(async (error: unknown) => {
        this.metrics.recordFailure(request.connectionId);
        this.healthMonitor.update({
          connectionId: request.connectionId,
          status: 'failed',
          healthy: false,
          checkedAt: new Date().toISOString(),
          message: error instanceof Error ? error.message : String(error),
        });
        await this.auditLogger.record({
          connectionId: request.connectionId,
          action: 'connect',
          outcome: 'failure',
          details: { message: error instanceof Error ? error.message : String(error) },
        });
        throw error;
      });
  }

  public async disconnect<TConfiguration extends SerializableValueObject, TClient>(
    connectionId: string,
  ): Promise<boolean> {
    const connection = this.pool.get<TConfiguration, TClient>(connectionId);
    if (!connection) {
      return false;
    }
    const definition = this.factory.getDefinition<TConfiguration, TClient>(connection.kind);
    if (definition.disconnect) {
      await this.timeoutPolicy.execute(
        (signal) => definition.disconnect?.({ connection, signal }) ?? Promise.resolve(),
      );
    }
    this.pool.delete(connectionId);
    this.sessionManager.invalidate(connectionId);
    this.metrics.recordDisconnected(connectionId);
    this.healthMonitor.update({
      connectionId,
      status: 'disconnected',
      healthy: true,
      checkedAt: new Date().toISOString(),
      message: 'Connection disconnected.',
    });
    await this.auditLogger.record({ connectionId, action: 'disconnect', outcome: 'success' });
    return true;
  }

  public async checkHealth<TConfiguration extends SerializableValueObject, TClient>(
    connectionId: string,
  ): Promise<ConnectionHealthSnapshot | undefined> {
    const connection = this.pool.get<TConfiguration, TClient>(connectionId);
    if (!connection) {
      return undefined;
    }
    const definition = this.factory.getDefinition<TConfiguration, TClient>(connection.kind);
    if (!definition.checkHealth) {
      return this.healthMonitor.get(connectionId);
    }
    const snapshot = await this.timeoutPolicy.execute(
      (signal) =>
        definition.checkHealth?.({ connection, signal }) ??
        Promise.resolve({
          connectionId,
          status: connection.status,
          healthy: connection.status === 'connected',
          checkedAt: new Date().toISOString(),
        }),
    );
    this.healthMonitor.update(snapshot);
    return snapshot;
  }
}

export class ConnectionManager {
  private readonly registry: ConnectionRegistry;
  private readonly factory: ConnectionFactory;
  private readonly lifecycle: ConnectionLifecycleManager;
  private readonly pool: ConnectionPool;
  private readonly credentialStore: CredentialStore;
  private readonly secretResolver: SecretResolver;
  private readonly trustStore: TrustStore;
  private readonly certificateManager: CertificateManager;
  private readonly authenticationManager: AuthenticationManager;
  private readonly metrics: ConnectionMetrics;
  private readonly healthMonitor: ConnectionHealthMonitor;
  private readonly auditLogger: AuditLogger;
  private readonly sessionManager: SessionManager;

  public constructor(
    configuration = new ConnectionManagementConfiguration(),
    options: {
      readonly secretResolver?: SecretResolver;
      readonly credentialStore?: CredentialStore;
      readonly trustStore?: TrustStore;
      readonly logger?: ILogger;
    } = {},
  ) {
    this.secretResolver = options.secretResolver ?? new SecretResolver();
    this.credentialStore = options.credentialStore ?? new CredentialStore();
    this.trustStore = options.trustStore ?? new TrustStore();
    this.certificateManager = new CertificateManager(this.secretResolver);
    this.authenticationManager = new AuthenticationManager(
      this.secretResolver,
      new CredentialValidator(),
      [
        new BasicAuthProvider(),
        new ApiKeyProvider(),
        new TokenProvider(),
        new OAuthProvider(),
        new ClientCertificateProvider(this.certificateManager),
      ],
    );
    this.metrics = new ConnectionMetrics();
    this.healthMonitor = new ConnectionHealthMonitor();
    this.auditLogger = new AuditLogger(options.logger ?? defaultLogger('connection-management'));
    this.registry = new ConnectionRegistry();
    this.factory = new ConnectionFactory(this.registry);
    this.pool = new ConnectionPool(configuration.options.pool);
    this.sessionManager = new SessionManager();
    this.lifecycle = new ConnectionLifecycleManager(
      this.authenticationManager,
      this.credentialStore,
      this.factory,
      this.pool,
      this.sessionManager,
      new SessionRefresher(this.sessionManager, configuration.options.sessionRefreshWindowMs),
      new RetryPolicy(configuration.options.retry),
      new CircuitBreaker(),
      new TimeoutPolicy(configuration.options.timeouts.requestTimeoutMs),
      this.metrics,
      this.healthMonitor,
      this.auditLogger,
    );
  }

  public register<TConfiguration extends SerializableValueObject, TClient>(
    definition: ConnectionDefinition<TConfiguration, TClient>,
  ): void {
    this.registry.register(definition);
  }

  public storeCredential(connectionId: string, credential: ManagedCredential): void {
    this.credentialStore.set(connectionId, credential);
  }

  public addTrustedCertificate(certificate: ManagedCertificate): void {
    this.trustStore.add(certificate);
  }

  public async connect<TConfiguration extends SerializableValueObject, TClient>(
    request: ConnectionRequest<TConfiguration>,
  ): Promise<ConnectionRecord<TConfiguration, TClient>> {
    return this.lifecycle.connect(request);
  }

  public async disconnect(connectionId: string): Promise<boolean> {
    return this.lifecycle.disconnect(connectionId);
  }

  public async checkHealth(connectionId: string): Promise<ConnectionHealthSnapshot | undefined> {
    return this.lifecycle.checkHealth(connectionId);
  }

  public listConnections(): readonly ConnectionRecord<SerializableValueObject, unknown>[] {
    return this.pool.list();
  }

  public listRegisteredKinds(): readonly string[] {
    return this.registry.listKinds();
  }

  public getMetrics(): readonly ConnectionMetricSnapshot[] {
    return this.metrics.list();
  }

  public getHealthSnapshots(): readonly ConnectionHealthSnapshot[] {
    return this.healthMonitor.list();
  }

  public getAuditEntries(): readonly ConnectionAuditEntry[] {
    return this.auditLogger.list();
  }

  public getCredentialStore(): CredentialStore {
    return this.credentialStore;
  }

  public getSecretResolver(): SecretResolver {
    return this.secretResolver;
  }

  public getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  public getCertificateManager(): CertificateManager {
    return this.certificateManager;
  }
}
