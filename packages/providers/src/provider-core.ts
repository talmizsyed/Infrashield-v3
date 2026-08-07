import type { Identifier, SerializableValueObject, VersionString } from '@infrashield/contracts';
import {
  BaseTool,
  ToolCapability,
  ToolCategory,
  ToolConfiguration,
  ToolExecutionContext,
  ToolFactory,
  ToolMetadata,
  ToolRegistryException,
} from '@infrashield/ai-tools';

export type ProviderHealthStatus = 'unknown' | 'healthy' | 'degraded' | 'unavailable';
export type ProviderLifecycleState = 'installed' | 'enabled' | 'disabled' | 'uninstalled';

export class ProviderVersion {
  public readonly value: VersionString;

  public constructor(value: VersionString) {
    if (!value.trim()) {
      throw new ToolRegistryException('Provider version is required.');
    }

    this.value = value;
  }

  public toString(): string {
    return this.value;
  }
}

export class ProviderMetadata {
  public readonly description: string;
  public readonly vendor?: string;
  public readonly version: ProviderVersion;
  public readonly tags: readonly string[];
  public readonly healthStatus: ProviderHealthStatus;

  public constructor(options: {
    readonly description: string;
    readonly version: ProviderVersion;
    readonly vendor?: string;
    readonly tags?: readonly string[];
    readonly healthStatus?: ProviderHealthStatus;
  }) {
    if (!options.description.trim()) {
      throw new ToolRegistryException('Provider description is required.');
    }

    this.description = options.description;
    this.vendor = options.vendor;
    this.version = options.version;
    this.tags = Object.freeze([...(options.tags ?? [])]);
    this.healthStatus = options.healthStatus ?? 'unknown';
  }
}

export class ProviderCapabilities {
  private readonly capabilities: readonly ToolCapability[];

  public constructor(capabilities: readonly ToolCapability[]) {
    this.capabilities = Object.freeze([...capabilities]);
  }

  public supports(capabilityName: string): boolean {
    return this.capabilities.some((capability) => capability.name === capabilityName);
  }

  public list(): readonly ToolCapability[] {
    return Object.freeze([...this.capabilities]);
  }
}

export class ProviderConfiguration<
  TConfiguration extends SerializableValueObject = SerializableValueObject,
> extends ToolConfiguration<TConfiguration> {}

export interface ProviderContext<
  TConfiguration extends SerializableValueObject = SerializableValueObject,
> extends ToolExecutionContext<TConfiguration> {
  readonly providerId: Identifier;
}

export class ProviderManifest<
  TConfiguration extends SerializableValueObject = SerializableValueObject,
> {
  public readonly id: Identifier;
  public readonly name: string;
  public readonly metadata: ProviderMetadata;
  public readonly capabilities: ProviderCapabilities;
  public readonly configuration: ProviderConfiguration<TConfiguration>;

  public constructor(options: {
    readonly id: Identifier;
    readonly name: string;
    readonly metadata: ProviderMetadata;
    readonly capabilities: ProviderCapabilities;
    readonly configuration?: ProviderConfiguration<TConfiguration>;
  }) {
    if (!options.id.trim()) {
      throw new ToolRegistryException('Provider id is required.');
    }
    if (!options.name.trim()) {
      throw new ToolRegistryException('Provider name is required.');
    }

    this.id = options.id;
    this.name = options.name;
    this.metadata = options.metadata;
    this.capabilities = options.capabilities;
    this.configuration = options.configuration ?? new ProviderConfiguration<TConfiguration>();
  }
}

export interface Provider<
  TConfiguration extends SerializableValueObject = SerializableValueObject,
> {
  readonly manifest: ProviderManifest<TConfiguration>;
  readonly providerMetadata: ProviderMetadata;
  readonly providerCapabilities: ProviderCapabilities;
  readonly providerConfiguration: ProviderConfiguration<TConfiguration>;
  createContext(
    configuration?: Readonly<Partial<TConfiguration>>,
    context?: Omit<ProviderContext<TConfiguration>, 'providerId' | 'configuration'>,
  ): Promise<ProviderContext<TConfiguration>>;
  getHealthStatus(): ProviderHealthStatus;
}

export abstract class BaseProvider<
  TConfiguration extends SerializableValueObject = SerializableValueObject,
>
  extends BaseTool<{ action: string }, { accepted: boolean }, TConfiguration>
  implements Provider<TConfiguration>
{
  public readonly manifest: ProviderManifest<TConfiguration>;

  protected constructor(options: { readonly manifest: ProviderManifest<TConfiguration> }) {
    super({
      id: options.manifest.id,
      name: options.manifest.name,
      metadata: new ToolMetadata({
        description: options.manifest.metadata.description,
        version: options.manifest.metadata.version.toString(),
        categories: [ToolCategory.Provider],
        tags: options.manifest.metadata.tags,
      }),
      configuration: options.manifest.configuration,
      capabilities: options.manifest.capabilities.list(),
    });
    this.manifest = options.manifest;
  }

  public get providerMetadata(): ProviderMetadata {
    return this.manifest.metadata;
  }

  public get providerCapabilities(): ProviderCapabilities {
    return this.manifest.capabilities;
  }

  public get providerConfiguration(): ProviderConfiguration<TConfiguration> {
    return this.manifest.configuration;
  }

  public async createContext(
    configuration?: Readonly<Partial<TConfiguration>>,
    context: Omit<ProviderContext<TConfiguration>, 'providerId' | 'configuration'> = {},
  ): Promise<ProviderContext<TConfiguration>> {
    const resolvedConfiguration = await this.providerConfiguration.resolve(configuration);
    return Object.freeze({
      ...context,
      providerId: this.manifest.id,
      configuration: resolvedConfiguration,
    });
  }

  public getHealthStatus(): ProviderHealthStatus {
    return this.providerMetadata.healthStatus;
  }

  public async execute(): Promise<{ accepted: boolean }> {
    return { accepted: true };
  }
}

export class ProviderRegistry {
  private readonly providers = new Map<Identifier, ProviderManifest>();
  private readonly states = new Map<Identifier, ProviderLifecycleState>();

  public register<TConfiguration extends SerializableValueObject>(
    provider: ProviderManifest<TConfiguration>,
  ): void {
    if (this.providers.has(provider.id)) {
      throw new ToolRegistryException(`Provider ${provider.id} is already registered.`);
    }

    this.providers.set(provider.id, provider);
    this.states.set(provider.id, 'installed');
  }

  public unregister(providerId: Identifier): boolean {
    this.states.set(providerId, 'uninstalled');
    return this.providers.delete(providerId);
  }

  public get<TConfiguration extends SerializableValueObject = SerializableValueObject>(
    providerId: Identifier,
  ): ProviderManifest<TConfiguration> | undefined {
    return this.providers.get(providerId) as ProviderManifest<TConfiguration> | undefined;
  }

  public list(): readonly ProviderManifest[] {
    return Object.freeze([...this.providers.values()]);
  }

  public discover(
    options: {
      readonly capability?: string;
      readonly vendor?: string;
      readonly version?: VersionString;
      readonly healthStatus?: ProviderHealthStatus;
      readonly enabledOnly?: boolean;
    } = {},
  ): readonly ProviderManifest[] {
    return Object.freeze(
      this.list().filter((provider) => {
        const capabilityMatches =
          options.capability === undefined || provider.capabilities.supports(options.capability);
        const vendorMatches =
          options.vendor === undefined || provider.metadata.vendor === options.vendor;
        const versionMatches =
          options.version === undefined || provider.metadata.version.toString() === options.version;
        const healthMatches =
          options.healthStatus === undefined ||
          provider.metadata.healthStatus === options.healthStatus;
        const enabledMatches =
          options.enabledOnly !== true || this.states.get(provider.id) === 'enabled';

        return (
          capabilityMatches && vendorMatches && versionMatches && healthMatches && enabledMatches
        );
      }),
    );
  }

  public install(providerId: Identifier): void {
    this.require(providerId);
    this.states.set(providerId, 'installed');
  }

  public enable(providerId: Identifier): void {
    this.require(providerId);
    this.states.set(providerId, 'enabled');
  }

  public disable(providerId: Identifier): void {
    this.require(providerId);
    this.states.set(providerId, 'disabled');
  }

  public upgrade<TConfiguration extends SerializableValueObject>(
    provider: ProviderManifest<TConfiguration>,
  ): void {
    this.providers.set(provider.id, provider);
  }

  public downgrade<TConfiguration extends SerializableValueObject>(
    provider: ProviderManifest<TConfiguration>,
  ): void {
    this.providers.set(provider.id, provider);
  }

  public getState(providerId: Identifier): ProviderLifecycleState | undefined {
    return this.states.get(providerId);
  }

  private require(providerId: Identifier): ProviderManifest {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new ToolRegistryException(`Provider ${providerId} is not registered.`);
    }

    return provider;
  }
}

export class ProviderFactory {
  private readonly providers = new Map<Identifier, () => Provider>();
  private readonly toolFactory: ToolFactory;

  public constructor(
    private readonly registry: ProviderRegistry = new ProviderRegistry(),
    toolFactory: ToolFactory = new ToolFactory(),
  ) {
    this.toolFactory = toolFactory;
  }

  public registerProvider<TProvider extends Provider>(
    manifest: ProviderManifest,
    factory: () => TProvider,
  ): void {
    this.registry.register(manifest);
    this.providers.set(manifest.id, factory);
  }

  public create<TProvider extends Provider = Provider>(providerId: Identifier): TProvider {
    const factory = this.providers.get(providerId);
    if (!factory) {
      throw new ToolRegistryException(`Provider ${providerId} is not registered.`);
    }

    return factory() as TProvider;
  }

  public registerAsTool<TProvider extends BaseProvider>(provider: TProvider): void {
    void this.toolFactory.register(provider);
  }

  public getRegistry(): ProviderRegistry {
    return this.registry;
  }
}
