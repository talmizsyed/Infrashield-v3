import type { Identifier, SerializableValueObject, TimestampString } from '@infrashield/contracts';

import type { Provider, ProviderContext } from './provider-core.js';
import { ProviderMetadata } from './provider-core.js';
import { ToolRegistryException } from '@infrashield/ai-tools';

export type ProviderConnectionStatus =
  'disconnected' | 'connecting' | 'connected' | 'degraded' | 'reconnecting' | 'failed';

export class ConnectionHealth {
  public readonly status: ProviderConnectionStatus;
  public readonly latencyMs?: number;
  public readonly lastCheckedAt: TimestampString;
  public readonly message?: string;

  public constructor(options: {
    readonly status: ProviderConnectionStatus;
    readonly latencyMs?: number;
    readonly message?: string;
    readonly lastCheckedAt?: TimestampString;
  }) {
    this.status = options.status;
    this.latencyMs = options.latencyMs;
    this.message = options.message;
    this.lastCheckedAt = options.lastCheckedAt ?? new Date().toISOString();
  }
}

export class ConnectionRetryPolicy {
  public readonly maxAttempts: number;
  public readonly baseDelayMs: number;
  public readonly backoffMultiplier: number;

  public constructor(
    options: {
      readonly maxAttempts?: number;
      readonly baseDelayMs?: number;
      readonly backoffMultiplier?: number;
    } = {},
  ) {
    this.maxAttempts = options.maxAttempts ?? 1;
    this.baseDelayMs = options.baseDelayMs ?? 10;
    this.backoffMultiplier = options.backoffMultiplier ?? 2;
  }

  public shouldRetry(attempt: number): boolean {
    return attempt < this.maxAttempts;
  }

  public getDelayMs(attempt: number): number {
    return this.baseDelayMs * this.backoffMultiplier ** Math.max(0, attempt - 1);
  }
}

export class ConnectionValidator<
  TConfiguration extends SerializableValueObject = SerializableValueObject,
> {
  public constructor(
    private readonly validateConfiguration?: (
      configuration: Readonly<TConfiguration>,
      provider: Provider<TConfiguration>,
    ) => void | Promise<void>,
  ) {}

  public async validate(
    provider: Provider<TConfiguration>,
    context: ProviderContext<TConfiguration>,
  ): Promise<void> {
    if (!context.configuration) {
      throw new ToolRegistryException('Provider connection configuration is required.');
    }

    const configuration = context.configuration as Readonly<TConfiguration>;
    await this.validateConfiguration?.(configuration, provider);
  }
}

type ResolvedProviderContext<
  TConfiguration extends SerializableValueObject = SerializableValueObject,
> = ProviderContext<TConfiguration> & {
  readonly configuration: Readonly<TConfiguration>;
};

export interface ProviderConnectionMetrics {
  readonly connectCount: number;
  readonly disconnectCount: number;
  readonly reconnectCount: number;
  readonly failureCount: number;
  readonly lastConnectedAt?: TimestampString;
  readonly lastDisconnectedAt?: TimestampString;
}

export class ProviderConnection<
  TConfiguration extends SerializableValueObject = SerializableValueObject,
  TClient = unknown,
> {
  public readonly id: Identifier;
  public readonly providerId: Identifier;
  public readonly providerMetadata: ProviderMetadata;
  public readonly configuration: Readonly<TConfiguration>;
  public status: ProviderConnectionStatus = 'disconnected';
  public health: ConnectionHealth = new ConnectionHealth({ status: 'disconnected' });
  public readonly createdAt: TimestampString;
  public updatedAt: TimestampString;
  public client?: TClient;
  private readonly metricsState = {
    connectCount: 0,
    disconnectCount: 0,
    reconnectCount: 0,
    failureCount: 0,
    lastConnectedAt: undefined as TimestampString | undefined,
    lastDisconnectedAt: undefined as TimestampString | undefined,
  };

  public constructor(options: {
    readonly provider: Provider<TConfiguration>;
    readonly context: ResolvedProviderContext<TConfiguration>;
    readonly connect: (
      provider: Provider<TConfiguration>,
      context: ResolvedProviderContext<TConfiguration>,
    ) => Promise<TClient>;
    readonly disconnect?: (
      client: TClient | undefined,
      provider: Provider<TConfiguration>,
      context: ResolvedProviderContext<TConfiguration>,
    ) => Promise<void>;
    readonly checkHealth?: (
      client: TClient | undefined,
      provider: Provider<TConfiguration>,
      context: ResolvedProviderContext<TConfiguration>,
    ) => Promise<ConnectionHealth>;
  }) {
    this.id = `${options.provider.manifest.id}:${JSON.stringify(options.context.configuration)}`;
    this.providerId = options.provider.manifest.id;
    this.providerMetadata = options.provider.providerMetadata;
    this.configuration = options.context.configuration;
    this.createdAt = new Date().toISOString();
    this.updatedAt = this.createdAt;
    this.connectHandler = options.connect;
    this.disconnectHandler = options.disconnect;
    this.checkHealthHandler = options.checkHealth;
    this.provider = options.provider;
    this.context = options.context;
  }

  private readonly connectHandler: (
    provider: Provider<TConfiguration>,
    context: ResolvedProviderContext<TConfiguration>,
  ) => Promise<TClient>;
  private readonly disconnectHandler?: (
    client: TClient | undefined,
    provider: Provider<TConfiguration>,
    context: ResolvedProviderContext<TConfiguration>,
  ) => Promise<void>;
  private readonly checkHealthHandler?: (
    client: TClient | undefined,
    provider: Provider<TConfiguration>,
    context: ResolvedProviderContext<TConfiguration>,
  ) => Promise<ConnectionHealth>;
  private readonly provider: Provider<TConfiguration>;
  private readonly context: ResolvedProviderContext<TConfiguration>;

  public async connect(): Promise<TClient> {
    this.status = this.status === 'connected' ? 'connected' : 'connecting';
    this.updatedAt = new Date().toISOString();

    try {
      this.client = await this.connectHandler(this.provider, this.context);
      this.status = 'connected';
      this.health = new ConnectionHealth({ status: 'connected' });
      this.metricsState.connectCount += 1;
      this.metricsState.lastConnectedAt = new Date().toISOString();
      this.updatedAt = this.metricsState.lastConnectedAt;
      return this.client;
    } catch (error) {
      this.status = 'failed';
      this.metricsState.failureCount += 1;
      this.updatedAt = new Date().toISOString();
      this.health = new ConnectionHealth({
        status: 'failed',
        message: error instanceof Error ? error.message : 'Connection failed.',
      });
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    await this.disconnectHandler?.(this.client, this.provider, this.context);
    this.status = 'disconnected';
    this.client = undefined;
    this.metricsState.disconnectCount += 1;
    this.metricsState.lastDisconnectedAt = new Date().toISOString();
    this.updatedAt = this.metricsState.lastDisconnectedAt;
    this.health = new ConnectionHealth({ status: 'disconnected' });
  }

  public async reconnect(): Promise<TClient> {
    this.status = 'reconnecting';
    this.metricsState.reconnectCount += 1;
    await this.disconnect();
    return this.connect();
  }

  public async checkHealth(): Promise<ConnectionHealth> {
    if (!this.checkHealthHandler) {
      this.health = new ConnectionHealth({ status: this.status });
      return this.health;
    }

    this.health = await this.checkHealthHandler(this.client, this.provider, this.context);
    this.status = this.health.status;
    this.updatedAt = this.health.lastCheckedAt;
    return this.health;
  }

  public getMetrics(): ProviderConnectionMetrics {
    return Object.freeze({ ...this.metricsState });
  }
}

export class ConnectionFactory {
  private readonly factories = new Map<
    Identifier,
    (
      provider: Provider<SerializableValueObject>,
      context: ResolvedProviderContext<SerializableValueObject>,
    ) => ProviderConnection<SerializableValueObject>
  >();

  public register<TConfiguration extends SerializableValueObject>(
    providerId: Identifier,
    factory: (
      provider: Provider<TConfiguration>,
      context: ResolvedProviderContext<TConfiguration>,
    ) => ProviderConnection<TConfiguration>,
  ): void {
    this.factories.set(
      providerId,
      factory as unknown as (
        provider: Provider<SerializableValueObject>,
        context: ResolvedProviderContext<SerializableValueObject>,
      ) => ProviderConnection<SerializableValueObject>,
    );
  }

  public create<TConfiguration extends SerializableValueObject>(
    provider: Provider<TConfiguration>,
    context: ResolvedProviderContext<TConfiguration>,
  ): ProviderConnection<TConfiguration> {
    const factory = this.factories.get(provider.manifest.id) as
      | ((
          provider: Provider<TConfiguration>,
          context: ResolvedProviderContext<TConfiguration>,
        ) => ProviderConnection<TConfiguration>)
      | undefined;
    if (!factory) {
      throw new ToolRegistryException(
        `Connection factory for provider ${provider.manifest.id} is not registered.`,
      );
    }

    return factory(provider, context);
  }
}

type PooledConnection = ProviderConnection<SerializableValueObject, unknown>;

export class ConnectionPool {
  private readonly connections = new Map<Identifier, PooledConnection>();

  public get<TConfiguration extends SerializableValueObject>(
    connectionId: Identifier,
  ): ProviderConnection<TConfiguration> | undefined {
    return this.connections.get(connectionId) as ProviderConnection<TConfiguration> | undefined;
  }

  public set<TConfiguration extends SerializableValueObject>(
    connection: ProviderConnection<TConfiguration>,
  ): void {
    this.connections.set(connection.id, connection as unknown as PooledConnection);
  }

  public remove(connectionId: Identifier): boolean {
    return this.connections.delete(connectionId);
  }

  public list(): readonly ProviderConnection[] {
    return Object.freeze([...this.connections.values()]);
  }
}

export class ProviderConnectionManager {
  public constructor(
    private readonly options: {
      readonly factory?: ConnectionFactory;
      readonly pool?: ConnectionPool;
      readonly validator?: ConnectionValidator;
      readonly retryPolicy?: ConnectionRetryPolicy;
    } = {},
  ) {}

  public async connect<TConfiguration extends SerializableValueObject>(
    provider: Provider<TConfiguration>,
    context: ProviderContext<TConfiguration>,
  ): Promise<ProviderConnection<TConfiguration>> {
    const validator =
      (this.options.validator as ConnectionValidator<TConfiguration> | undefined) ??
      new ConnectionValidator<TConfiguration>();
    await validator.validate(provider, context);
    if (!context.configuration) {
      throw new ToolRegistryException('Provider connection configuration is required.');
    }
    const resolvedContext = context as ResolvedProviderContext<TConfiguration>;

    const pool = this.options.pool ?? new ConnectionPool();
    const factory = this.options.factory ?? new ConnectionFactory();
    const connectionId = `${provider.manifest.id}:${JSON.stringify(resolvedContext.configuration)}`;
    const pooled = pool.get<TConfiguration>(connectionId);
    if (pooled && pooled.status !== 'disconnected') {
      return pooled;
    }

    const connection = pooled ?? factory.create(provider, resolvedContext);
    pool.set(connection);

    const retryPolicy = this.options.retryPolicy ?? new ConnectionRetryPolicy();
    for (let attempt = 1; ; attempt += 1) {
      try {
        await connection.connect();
        return connection;
      } catch (error) {
        if (!retryPolicy.shouldRetry(attempt)) {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, retryPolicy.getDelayMs(attempt)));
      }
    }
  }

  public async disconnect(connectionId: Identifier): Promise<boolean> {
    const pool = this.options.pool ?? new ConnectionPool();
    const connection = pool.get(connectionId);
    if (!connection) {
      return false;
    }

    await connection.disconnect();
    return pool.remove(connectionId);
  }

  public async reconnect(connectionId: Identifier): Promise<ProviderConnection | undefined> {
    const pool = this.options.pool ?? new ConnectionPool();
    const connection = pool.get(connectionId);
    if (!connection) {
      return undefined;
    }

    await connection.reconnect();
    return connection;
  }

  public async checkHealth(connectionId: Identifier): Promise<ConnectionHealth | undefined> {
    const pool = this.options.pool ?? new ConnectionPool();
    const connection = pool.get(connectionId);
    if (!connection) {
      return undefined;
    }

    return connection.checkHealth();
  }

  public listConnections(): readonly ProviderConnection[] {
    return (this.options.pool ?? new ConnectionPool()).list();
  }
}
