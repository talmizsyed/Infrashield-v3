import type { Identifier, SerializableValueObject, VersionString } from '@infrashield/contracts';

import { ToolRegistryException } from '@infrashield/ai-tools';

import type { Provider, ProviderManifest } from './provider-core.js';

export class CapabilityVersion {
  public readonly value: VersionString;

  public constructor(value: VersionString) {
    if (!value.trim()) {
      throw new ToolRegistryException('Capability version is required.');
    }

    this.value = value;
  }

  public toString(): string {
    return this.value;
  }

  public compare(other: CapabilityVersion): number {
    const left = this.value.split('.').map((part) => Number.parseInt(part, 10) || 0);
    const right = other.value.split('.').map((part) => Number.parseInt(part, 10) || 0);
    const max = Math.max(left.length, right.length);

    for (let index = 0; index < max; index += 1) {
      const leftPart = left[index] ?? 0;
      const rightPart = right[index] ?? 0;
      if (leftPart > rightPart) {
        return 1;
      }
      if (leftPart < rightPart) {
        return -1;
      }
    }

    return 0;
  }
}

export type CapabilityStability = 'experimental' | 'beta' | 'stable' | 'deprecated';

export class CapabilityMetadata {
  public readonly description: string;
  public readonly tags: readonly string[];
  public readonly stability: CapabilityStability;
  public readonly featureFlags: Readonly<Record<string, boolean>>;

  public constructor(options: {
    readonly description: string;
    readonly tags?: readonly string[];
    readonly stability?: CapabilityStability;
    readonly featureFlags?: Readonly<Record<string, boolean>>;
  }) {
    if (!options.description.trim()) {
      throw new ToolRegistryException('Capability description is required.');
    }

    this.description = options.description;
    this.tags = Object.freeze([...(options.tags ?? [])]);
    this.stability = options.stability ?? 'stable';
    this.featureFlags = Object.freeze({ ...(options.featureFlags ?? {}) });
  }

  public isFeatureEnabled(flag: string): boolean {
    return this.featureFlags[flag] === true;
  }
}

export class CapabilityDefinition<
  TConfiguration extends SerializableValueObject = SerializableValueObject,
> {
  public readonly id: Identifier;
  public readonly providerId: Identifier;
  public readonly name: string;
  public readonly version: CapabilityVersion;
  public readonly metadata: CapabilityMetadata;
  public readonly configuration?: Readonly<Partial<TConfiguration>>;
  public readonly requiresProviderVersion?: CapabilityVersion;
  public readonly requiresCapabilities: readonly string[];
  public readonly requiredFeatureFlags: readonly string[];

  public constructor(options: {
    readonly id: Identifier;
    readonly providerId: Identifier;
    readonly name: string;
    readonly version: CapabilityVersion;
    readonly metadata: CapabilityMetadata;
    readonly configuration?: Readonly<Partial<TConfiguration>>;
    readonly requiresProviderVersion?: CapabilityVersion;
    readonly requiresCapabilities?: readonly string[];
    readonly requiredFeatureFlags?: readonly string[];
  }) {
    if (!options.id.trim()) {
      throw new ToolRegistryException('Capability id is required.');
    }
    if (!options.providerId.trim()) {
      throw new ToolRegistryException('Capability providerId is required.');
    }
    if (!options.name.trim()) {
      throw new ToolRegistryException('Capability name is required.');
    }

    this.id = options.id;
    this.providerId = options.providerId;
    this.name = options.name;
    this.version = options.version;
    this.metadata = options.metadata;
    this.configuration = options.configuration;
    this.requiresProviderVersion = options.requiresProviderVersion;
    this.requiresCapabilities = Object.freeze([...(options.requiresCapabilities ?? [])]);
    this.requiredFeatureFlags = Object.freeze([...(options.requiredFeatureFlags ?? [])]);
  }
}

export interface CapabilityDiscovery {
  readonly providerId?: Identifier;
  readonly name?: string;
  readonly id?: Identifier;
  readonly tags?: readonly string[];
  readonly minVersion?: CapabilityVersion;
  readonly maxVersion?: CapabilityVersion;
  readonly includeExperimental?: boolean;
  readonly requiredFeatureFlags?: readonly string[];
}

export class ProviderCapabilityRegistry {
  private readonly capabilities = new Map<Identifier, CapabilityDefinition>();

  public register<TConfiguration extends SerializableValueObject>(
    definition: CapabilityDefinition<TConfiguration>,
  ): void {
    const key = this.resolveKey(definition.providerId, definition.id, definition.version);
    if (this.capabilities.has(key)) {
      throw new ToolRegistryException(
        `Capability ${definition.id}@${definition.version.toString()} is already registered for provider ${definition.providerId}.`,
      );
    }

    this.capabilities.set(key, definition as unknown as CapabilityDefinition);
  }

  public unregister(
    providerId: Identifier,
    capabilityId: Identifier,
    version: CapabilityVersion,
  ): boolean {
    return this.capabilities.delete(this.resolveKey(providerId, capabilityId, version));
  }

  public list(): readonly CapabilityDefinition[] {
    return Object.freeze([...this.capabilities.values()]);
  }

  public query(options: {
    readonly providerId: Identifier;
    readonly capabilityId: Identifier;
  }): readonly CapabilityDefinition[] {
    return Object.freeze(
      this.list().filter(
        (capability) =>
          capability.providerId === options.providerId && capability.id === options.capabilityId,
      ),
    );
  }

  public discover(discovery: CapabilityDiscovery = {}): readonly CapabilityDefinition[] {
    return Object.freeze(
      this.list().filter((capability) => {
        const providerMatches =
          discovery.providerId === undefined || capability.providerId === discovery.providerId;
        const idMatches = discovery.id === undefined || capability.id === discovery.id;
        const nameMatches = discovery.name === undefined || capability.name === discovery.name;
        const versionMinMatches =
          discovery.minVersion === undefined ||
          capability.version.compare(discovery.minVersion) >= 0;
        const versionMaxMatches =
          discovery.maxVersion === undefined ||
          capability.version.compare(discovery.maxVersion) <= 0;
        const tagMatches =
          discovery.tags === undefined ||
          discovery.tags.every((tag) => capability.metadata.tags.includes(tag));
        const stabilityMatches =
          discovery.includeExperimental === true ||
          capability.metadata.stability !== 'experimental';
        const featureFlagMatches =
          discovery.requiredFeatureFlags === undefined ||
          discovery.requiredFeatureFlags.every((flag) =>
            capability.metadata.isFeatureEnabled(flag),
          );

        return (
          providerMatches &&
          idMatches &&
          nameMatches &&
          versionMinMatches &&
          versionMaxMatches &&
          tagMatches &&
          stabilityMatches &&
          featureFlagMatches
        );
      }),
    );
  }

  public getLatest(
    providerId: Identifier,
    name: string,
    includeExperimental = false,
  ): CapabilityDefinition | undefined {
    const candidates = this.discover({ providerId, name, includeExperimental });
    return [...candidates].sort((left, right) => right.version.compare(left.version))[0];
  }

  private resolveKey(
    providerId: Identifier,
    capabilityId: Identifier,
    version: CapabilityVersion,
  ): Identifier {
    return `${providerId}:${capabilityId}:${version.toString()}`;
  }
}

export class CapabilityValidator {
  public validateDefinition(definition: CapabilityDefinition): void {
    if (!definition.id.trim()) {
      throw new ToolRegistryException('Capability id is required.');
    }

    if (!definition.providerId.trim()) {
      throw new ToolRegistryException('Capability providerId is required.');
    }
  }

  public validateCompatibility(
    providerManifest: ProviderManifest,
    definition: CapabilityDefinition,
  ): void {
    if (providerManifest.id !== definition.providerId) {
      throw new ToolRegistryException(
        `Capability provider mismatch. Expected ${providerManifest.id}, got ${definition.providerId}.`,
      );
    }

    for (const requiredCapability of definition.requiresCapabilities) {
      if (!providerManifest.capabilities.supports(requiredCapability)) {
        throw new ToolRegistryException(
          `Provider ${providerManifest.id} does not support required capability: ${requiredCapability}`,
        );
      }
    }

    if (
      definition.requiresProviderVersion &&
      definition.requiresProviderVersion.toString() !== providerManifest.metadata.version.toString()
    ) {
      throw new ToolRegistryException(
        `Provider version ${providerManifest.metadata.version.toString()} is not compatible with required ${definition.requiresProviderVersion.toString()}.`,
      );
    }
  }

  public validateFeatureFlags(
    definition: CapabilityDefinition,
    requestedFlags: readonly string[] = [],
  ): void {
    for (const flag of requestedFlags) {
      if (!definition.metadata.isFeatureEnabled(flag)) {
        throw new ToolRegistryException(`Capability feature flag is disabled: ${flag}`);
      }
    }

    for (const requiredFlag of definition.requiredFeatureFlags) {
      if (!definition.metadata.isFeatureEnabled(requiredFlag)) {
        throw new ToolRegistryException(
          `Capability required feature flag is disabled: ${requiredFlag}`,
        );
      }
    }
  }
}

export class CapabilityResolver {
  public constructor(
    private readonly registry: ProviderCapabilityRegistry,
    private readonly validator: CapabilityValidator = new CapabilityValidator(),
  ) {}

  public resolve<TConfiguration extends SerializableValueObject>(
    provider: Provider<TConfiguration>,
    options: {
      readonly name: string;
      readonly version?: CapabilityVersion;
      readonly capabilityId?: Identifier;
      readonly requiredFeatureFlags?: readonly string[];
      readonly includeExperimental?: boolean;
    },
  ): CapabilityDefinition {
    const candidates = this.registry.discover({
      providerId: provider.manifest.id,
      name: options.name,
      id: options.capabilityId,
      includeExperimental: options.includeExperimental,
    });

    if (candidates.length === 0) {
      throw new ToolRegistryException(
        `No capabilities found for provider ${provider.manifest.id} and name ${options.name}.`,
      );
    }

    const resolved =
      options.version === undefined
        ? [...candidates].sort((left, right) => right.version.compare(left.version))[0]
        : candidates.find((candidate) => candidate.version.compare(options.version!) === 0);

    if (!resolved) {
      throw new ToolRegistryException(
        `Capability ${options.name}@${options.version?.toString() ?? 'latest'} not found for provider ${provider.manifest.id}.`,
      );
    }

    this.validator.validateDefinition(resolved);
    this.validator.validateCompatibility(provider.manifest, resolved);
    this.validator.validateFeatureFlags(resolved, options.requiredFeatureFlags);

    return resolved;
  }
}
