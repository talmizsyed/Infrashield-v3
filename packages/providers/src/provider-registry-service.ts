import type { Identifier, VersionString } from '@infrashield/contracts';

import { ToolRegistryException } from '@infrashield/ai-tools';

import {
  type ProviderHealthStatus,
  ProviderManifest,
  ProviderMetadata,
  ProviderRegistry,
  ProviderVersion,
} from './provider-core.js';

export interface ProviderDependency {
  readonly providerId: Identifier;
  readonly minVersion?: VersionString;
  readonly optional?: boolean;
}

export interface ProviderCatalogEntry {
  readonly manifest: ProviderManifest;
  readonly dependencies: readonly ProviderDependency[];
}

export interface ProviderDiscovery {
  readonly capability?: string;
  readonly vendor?: string;
  readonly version?: VersionString;
  readonly healthStatus?: ProviderHealthStatus;
  readonly enabledOnly?: boolean;
  readonly tags?: readonly string[];
}

export class ProviderCatalog {
  private readonly entries = new Map<Identifier, ProviderCatalogEntry>();

  public add(manifest: ProviderManifest, dependencies: readonly ProviderDependency[] = []): void {
    this.entries.set(manifest.id, {
      manifest,
      dependencies: Object.freeze([...dependencies]),
    });
  }

  public remove(providerId: Identifier): boolean {
    return this.entries.delete(providerId);
  }

  public get(providerId: Identifier): ProviderCatalogEntry | undefined {
    return this.entries.get(providerId);
  }

  public list(): readonly ProviderCatalogEntry[] {
    return Object.freeze([...this.entries.values()]);
  }

  public dependenciesOf(providerId: Identifier): readonly ProviderDependency[] {
    return this.entries.get(providerId)?.dependencies ?? [];
  }
}

export class ProviderDependencyResolver {
  public constructor(private readonly catalog: ProviderCatalog) {}

  public resolve(providerId: Identifier): readonly ProviderCatalogEntry[] {
    const resolved: ProviderCatalogEntry[] = [];
    const visited = new Set<Identifier>();
    const resolving = new Set<Identifier>();

    const visit = (id: Identifier): void => {
      if (visited.has(id)) {
        return;
      }
      if (resolving.has(id)) {
        throw new ToolRegistryException(`Circular provider dependency detected at ${id}.`);
      }

      const entry = this.catalog.get(id);
      if (!entry) {
        throw new ToolRegistryException(`Provider ${id} is not present in catalog.`);
      }

      resolving.add(id);
      for (const dependency of entry.dependencies) {
        const dependencyEntry = this.catalog.get(dependency.providerId);
        if (!dependencyEntry) {
          if (dependency.optional) {
            continue;
          }

          throw new ToolRegistryException(
            `Missing required dependency ${dependency.providerId} for provider ${id}.`,
          );
        }

        if (
          dependency.minVersion &&
          this.compareVersion(
            dependencyEntry.manifest.metadata.version.toString(),
            dependency.minVersion,
          ) < 0
        ) {
          throw new ToolRegistryException(
            `Dependency ${dependency.providerId} version ${dependencyEntry.manifest.metadata.version.toString()} does not satisfy minimum ${dependency.minVersion}.`,
          );
        }

        visit(dependency.providerId);
      }

      resolving.delete(id);
      visited.add(id);
      resolved.push(entry);
    };

    visit(providerId);
    return Object.freeze(resolved);
  }

  private compareVersion(left: string, right: string): number {
    const leftParts = left.split('.').map((part) => Number.parseInt(part, 10) || 0);
    const rightParts = right.split('.').map((part) => Number.parseInt(part, 10) || 0);
    const max = Math.max(leftParts.length, rightParts.length);

    for (let index = 0; index < max; index += 1) {
      const leftPart = leftParts[index] ?? 0;
      const rightPart = rightParts[index] ?? 0;
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

export class ProviderVersionManager {
  public upgrade(
    registry: ProviderRegistry,
    manifest: ProviderManifest,
    metadata?: ProviderMetadata,
  ): ProviderManifest {
    const current = registry.get(manifest.id);
    if (!current) {
      throw new ToolRegistryException(`Provider ${manifest.id} is not registered.`);
    }

    const nextVersion = metadata?.version ?? manifest.metadata.version;
    if (this.compare(current.metadata.version.toString(), nextVersion.toString()) >= 0) {
      throw new ToolRegistryException(
        `Upgrade requires a higher version than ${current.metadata.version.toString()}.`,
      );
    }

    const upgraded = new ProviderManifest({
      ...manifest,
      metadata:
        metadata ??
        new ProviderMetadata({
          description: manifest.metadata.description,
          version: nextVersion,
          vendor: manifest.metadata.vendor,
          tags: manifest.metadata.tags,
          healthStatus: manifest.metadata.healthStatus,
        }),
      capabilities: manifest.capabilities,
      configuration: manifest.configuration,
    });
    registry.upgrade(upgraded);
    return upgraded;
  }

  public downgrade(
    registry: ProviderRegistry,
    manifest: ProviderManifest,
    version: ProviderVersion,
  ): ProviderManifest {
    const current = registry.get(manifest.id);
    if (!current) {
      throw new ToolRegistryException(`Provider ${manifest.id} is not registered.`);
    }

    if (this.compare(current.metadata.version.toString(), version.toString()) <= 0) {
      throw new ToolRegistryException(
        `Downgrade requires a lower version than ${current.metadata.version.toString()}.`,
      );
    }

    const downgraded = new ProviderManifest({
      ...manifest,
      metadata: new ProviderMetadata({
        description: manifest.metadata.description,
        version,
        vendor: manifest.metadata.vendor,
        tags: manifest.metadata.tags,
        healthStatus: manifest.metadata.healthStatus,
      }),
      capabilities: manifest.capabilities,
      configuration: manifest.configuration,
    });
    registry.downgrade(downgraded);
    return downgraded;
  }

  private compare(left: string, right: string): number {
    const leftParts = left.split('.').map((part) => Number.parseInt(part, 10) || 0);
    const rightParts = right.split('.').map((part) => Number.parseInt(part, 10) || 0);
    const max = Math.max(leftParts.length, rightParts.length);

    for (let index = 0; index < max; index += 1) {
      const leftPart = leftParts[index] ?? 0;
      const rightPart = rightParts[index] ?? 0;
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

export class ProviderInstaller {
  public constructor(
    private readonly registry: ProviderRegistry,
    private readonly catalog: ProviderCatalog,
    private readonly resolver: ProviderDependencyResolver,
  ) {}

  public install(providerId: Identifier): readonly ProviderManifest[] {
    const installPlan = this.resolver.resolve(providerId);
    const installed: ProviderManifest[] = [];

    for (const entry of installPlan) {
      if (!this.registry.get(entry.manifest.id)) {
        this.registry.register(entry.manifest);
      }
      this.registry.install(entry.manifest.id);
      installed.push(entry.manifest);
    }

    return Object.freeze(installed);
  }

  public uninstall(providerId: Identifier): boolean {
    const dependedBy = this.catalog
      .list()
      .filter((entry) =>
        entry.dependencies.some((dependency) => dependency.providerId === providerId),
      )
      .map((entry) => entry.manifest.id);

    if (dependedBy.length > 0) {
      throw new ToolRegistryException(
        `Provider ${providerId} cannot be uninstalled because dependents exist: ${dependedBy.join(', ')}.`,
      );
    }

    return this.registry.unregister(providerId);
  }
}

export class ProviderRegistryService {
  private readonly registry: ProviderRegistry;
  private readonly catalog: ProviderCatalog;
  private readonly resolver: ProviderDependencyResolver;
  private readonly installer: ProviderInstaller;
  private readonly versions: ProviderVersionManager;

  public constructor(
    options: {
      readonly registry?: ProviderRegistry;
      readonly catalog?: ProviderCatalog;
      readonly resolver?: ProviderDependencyResolver;
      readonly installer?: ProviderInstaller;
      readonly versions?: ProviderVersionManager;
    } = {},
  ) {
    this.registry = options.registry ?? new ProviderRegistry();
    this.catalog = options.catalog ?? new ProviderCatalog();
    this.resolver = options.resolver ?? new ProviderDependencyResolver(this.catalog);
    this.installer =
      options.installer ?? new ProviderInstaller(this.registry, this.catalog, this.resolver);
    this.versions = options.versions ?? new ProviderVersionManager();
  }

  public register(
    manifest: ProviderManifest,
    dependencies: readonly ProviderDependency[] = [],
  ): void {
    this.catalog.add(manifest, dependencies);
    if (!this.registry.get(manifest.id)) {
      this.registry.register(manifest);
    }
  }

  public discover(options: ProviderDiscovery = {}): readonly ProviderManifest[] {
    const discovered = this.registry.discover(options);
    return Object.freeze(
      discovered.filter((manifest) => {
        if (!options.tags || options.tags.length === 0) {
          return true;
        }

        return options.tags.every((tag) => manifest.metadata.tags.includes(tag));
      }),
    );
  }

  public enable(providerId: Identifier): void {
    this.registry.enable(providerId);
  }

  public disable(providerId: Identifier): void {
    this.registry.disable(providerId);
  }

  public install(providerId: Identifier): readonly ProviderManifest[] {
    return this.installer.install(providerId);
  }

  public uninstall(providerId: Identifier): boolean {
    const removed = this.installer.uninstall(providerId);
    if (removed) {
      this.catalog.remove(providerId);
    }
    return removed;
  }

  public upgrade(manifest: ProviderManifest, metadata?: ProviderMetadata): ProviderManifest {
    const upgraded = this.versions.upgrade(this.registry, manifest, metadata);
    this.catalog.add(upgraded, this.catalog.dependenciesOf(upgraded.id));
    return upgraded;
  }

  public downgrade(manifest: ProviderManifest, version: ProviderVersion): ProviderManifest {
    const downgraded = this.versions.downgrade(this.registry, manifest, version);
    this.catalog.add(downgraded, this.catalog.dependenciesOf(downgraded.id));
    return downgraded;
  }

  public resolveDependencies(providerId: Identifier): readonly ProviderCatalogEntry[] {
    return this.resolver.resolve(providerId);
  }

  public getHealthStatus(providerId: Identifier): ProviderHealthStatus | undefined {
    return this.registry.get(providerId)?.metadata.healthStatus;
  }

  public getRegistry(): ProviderRegistry {
    return this.registry;
  }

  public getCatalog(): ProviderCatalog {
    return this.catalog;
  }
}
