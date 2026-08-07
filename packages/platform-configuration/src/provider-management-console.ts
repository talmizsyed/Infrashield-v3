import type { VersionString } from '@infrashield/contracts';
import { ToolCapability } from '@infrashield/ai-tools';
import {
  CapabilityMetadata,
  ProviderCapabilities,
  ProviderManifest,
  ProviderMetadata,
  ProviderRegistryService,
  ProviderVersion,
  type ProviderHealthStatus,
} from '@infrashield/providers';

import { createPlatformConfigurationService, type PlatformConfigurationService } from './service';
import type {
  AiProviderConfiguration,
  PlatformConfiguration,
  ProviderConfiguration,
  ProviderKind,
} from './types';

export type ProviderConsoleCategory = 'infrastructure' | 'ai' | 'custom';

export type ProviderSource = 'infrastructureProviders' | 'aiProviders';

export interface ProviderCapabilityInput {
  id: string;
  name: string;
  description?: string;
  version?: VersionString;
  tags?: readonly string[];
  stability?: 'experimental' | 'beta' | 'stable' | 'deprecated';
  featureFlags?: Readonly<Record<string, boolean>>;
}

export interface ProviderMetadataInput {
  description: string;
  vendor?: string;
  version?: VersionString;
  tags?: readonly string[];
  healthStatus?: ProviderHealthStatus;
}

export interface ProviderConsoleRegistrationInput {
  id: string;
  name: string;
  label?: string;
  category?: ProviderConsoleCategory;
  enabled?: boolean;
  configuration?: Readonly<Record<string, unknown>>;
  metadata: ProviderMetadataInput;
  capabilities?: readonly ProviderCapabilityInput[];
}

export interface ProviderConsoleUpdateInput {
  name?: string;
  label?: string;
  category?: ProviderConsoleCategory;
  enabled?: boolean;
  metadata?: Partial<ProviderMetadataInput>;
  capabilities?: readonly ProviderCapabilityInput[];
}

export interface ProviderConsoleSearchFilters {
  search?: string;
  category?: ProviderConsoleCategory;
  enabled?: boolean;
  healthStatus?: ProviderHealthStatus;
  capability?: string;
  tags?: readonly string[];
}

export interface ProviderConnectionTestResult {
  providerId: string;
  success: boolean;
  checkedAt: string;
  latencyMs: number;
  message: string;
}

export interface ProviderCapabilityView {
  id: string;
  name: string;
  description?: string;
  version: VersionString;
  tags: readonly string[];
  stability: 'experimental' | 'beta' | 'stable' | 'deprecated';
  featureFlags: Readonly<Record<string, boolean>>;
}

export interface ProviderMetadataView {
  description: string;
  vendor?: string;
  version: VersionString;
  tags: readonly string[];
  healthStatus: ProviderHealthStatus;
}

export interface ProviderConsoleEntry {
  id: string;
  name: string;
  label: string;
  category: ProviderConsoleCategory;
  source: ProviderSource;
  enabled: boolean;
  registeredAt: string;
  updatedAt: string;
  metadata: ProviderMetadataView;
  configuration: Readonly<Record<string, unknown>>;
  capabilities: readonly ProviderCapabilityView[];
  lastConnectionTest?: ProviderConnectionTestResult;
}

export interface ProviderHealthSnapshot {
  providerId: string;
  status: ProviderHealthStatus;
  checkedAt: string;
  enabled: boolean;
}

interface ProviderConsoleRecord extends ProviderConsoleEntry {}

const PROVIDER_KINDS = new Set<ProviderKind>([
  'vmware',
  'openshift',
  'oracle',
  'linux',
  'windows',
  'azure',
  'aws',
]);

function isProviderKind(value: string): value is ProviderKind {
  return PROVIDER_KINDS.has(value as ProviderKind);
}

export class ProviderManagementConsole {
  private readonly records = new Map<string, ProviderConsoleRecord>();
  private readonly registryService: ProviderRegistryService;
  private readonly configurationService: PlatformConfigurationService;

  public constructor(
    options: {
      configurationService?: PlatformConfigurationService;
      registryService?: ProviderRegistryService;
    } = {},
  ) {
    this.configurationService =
      options.configurationService ?? createPlatformConfigurationService();
    this.registryService = options.registryService ?? new ProviderRegistryService();
    this.bootstrapFromConfiguration(this.configurationService.getConfiguration());
  }

  public listProviders(
    filters: ProviderConsoleSearchFilters = {},
  ): readonly ProviderConsoleEntry[] {
    const normalizedSearch = filters.search?.toLowerCase().trim();
    return Object.freeze(
      [...this.records.values()]
        .filter((record) => {
          if (normalizedSearch) {
            const searchable = [
              record.id,
              record.name,
              record.label,
              record.metadata.vendor ?? '',
              ...record.metadata.tags,
              ...record.capabilities.map((capability) => capability.name),
            ]
              .join(' ')
              .toLowerCase();
            if (!searchable.includes(normalizedSearch)) {
              return false;
            }
          }

          if (filters.category && record.category !== filters.category) {
            return false;
          }

          if (filters.enabled !== undefined && record.enabled !== filters.enabled) {
            return false;
          }

          if (filters.healthStatus && record.metadata.healthStatus !== filters.healthStatus) {
            return false;
          }

          if (
            filters.capability &&
            !record.capabilities.some((capability) => capability.name === filters.capability)
          ) {
            return false;
          }

          if (filters.tags && !filters.tags.every((tag) => record.metadata.tags.includes(tag))) {
            return false;
          }

          return true;
        })
        .sort((left, right) => left.label.localeCompare(right.label)),
    );
  }

  public getProvider(providerId: string): ProviderConsoleEntry | undefined {
    return this.records.get(providerId);
  }

  public registerProvider(input: ProviderConsoleRegistrationInput): ProviderConsoleEntry {
    if (this.records.has(input.id)) {
      throw new Error(`Provider ${input.id} is already registered.`);
    }

    const now = new Date().toISOString();
    const category = input.category ?? 'custom';
    const source = this.resolveSource(input.id, category);
    const record: ProviderConsoleRecord = {
      id: input.id,
      name: input.name,
      label: input.label ?? input.name,
      category,
      source,
      enabled: input.enabled ?? true,
      registeredAt: now,
      updatedAt: now,
      metadata: {
        description: input.metadata.description,
        vendor: input.metadata.vendor,
        version: input.metadata.version ?? '1.0.0',
        tags: Object.freeze([...(input.metadata.tags ?? [])]),
        healthStatus: input.metadata.healthStatus ?? 'unknown',
      },
      configuration: Object.freeze({ ...(input.configuration ?? {}) }),
      capabilities: Object.freeze(
        (input.capabilities ?? []).map((capability) => this.normalizeCapability(capability)),
      ),
    };

    this.records.set(record.id, record);
    this.registryService.register(this.toManifest(record));
    if (record.enabled) {
      this.registryService.enable(record.id);
    } else {
      this.registryService.disable(record.id);
    }
    this.syncConfiguration('register', record);
    return record;
  }

  public editConfiguration(
    providerId: string,
    configuration: Readonly<Record<string, unknown>>,
  ): ProviderConsoleEntry {
    const current = this.requireRecord(providerId);
    const updated: ProviderConsoleRecord = {
      ...current,
      configuration: Object.freeze({ ...current.configuration, ...configuration }),
      updatedAt: new Date().toISOString(),
    };
    this.records.set(providerId, updated);
    return updated;
  }

  public updateProvider(
    providerId: string,
    input: ProviderConsoleUpdateInput,
  ): ProviderConsoleEntry {
    const current = this.requireRecord(providerId);
    const nextCategory = input.category ?? current.category;
    const nextSource = this.resolveSource(current.id, nextCategory);

    const updated: ProviderConsoleRecord = {
      ...current,
      name: input.name ?? current.name,
      label: input.label ?? current.label,
      category: nextCategory,
      source: nextSource,
      enabled: input.enabled ?? current.enabled,
      metadata: {
        description: input.metadata?.description ?? current.metadata.description,
        vendor: input.metadata?.vendor ?? current.metadata.vendor,
        version: input.metadata?.version ?? current.metadata.version,
        tags: Object.freeze([...(input.metadata?.tags ?? current.metadata.tags)]),
        healthStatus: input.metadata?.healthStatus ?? current.metadata.healthStatus,
      },
      capabilities:
        input.capabilities === undefined
          ? current.capabilities
          : Object.freeze(
              input.capabilities.map((capability) => this.normalizeCapability(capability)),
            ),
      updatedAt: new Date().toISOString(),
    };

    this.records.set(providerId, updated);
    this.registryService.getRegistry().upgrade(this.toManifest(updated));
    if (updated.enabled) {
      this.registryService.enable(updated.id);
    } else {
      this.registryService.disable(updated.id);
    }
    this.syncConfiguration('update', updated, current);
    return updated;
  }

  public deleteProvider(providerId: string): boolean {
    const existing = this.records.get(providerId);
    if (!existing) {
      return false;
    }

    this.registryService.uninstall(providerId);
    this.records.delete(providerId);
    this.syncConfiguration('delete', existing);
    return true;
  }

  public testConnection(providerId: string): ProviderConnectionTestResult {
    const record = this.requireRecord(providerId);
    const success = record.enabled && record.metadata.healthStatus !== 'unavailable';
    const checkedAt = new Date().toISOString();
    const latencyMs = this.simulatedLatency(providerId);
    const result: ProviderConnectionTestResult = {
      providerId,
      success,
      checkedAt,
      latencyMs,
      message: success
        ? 'Connection test passed in simulated mode.'
        : 'Connection test failed in simulated mode.',
    };

    const updated: ProviderConsoleRecord = {
      ...record,
      lastConnectionTest: result,
      metadata: {
        ...record.metadata,
        healthStatus: success ? record.metadata.healthStatus : 'degraded',
      },
      updatedAt: checkedAt,
    };

    this.records.set(providerId, updated);
    return result;
  }

  public enableProvider(providerId: string): ProviderConsoleEntry {
    const current = this.requireRecord(providerId);
    const updated: ProviderConsoleRecord = {
      ...current,
      enabled: true,
      updatedAt: new Date().toISOString(),
    };
    this.records.set(providerId, updated);
    this.registryService.enable(providerId);
    this.syncConfiguration('update', updated, current);
    return updated;
  }

  public disableProvider(providerId: string): ProviderConsoleEntry {
    const current = this.requireRecord(providerId);
    const updated: ProviderConsoleRecord = {
      ...current,
      enabled: false,
      updatedAt: new Date().toISOString(),
    };
    this.records.set(providerId, updated);
    this.registryService.disable(providerId);
    this.syncConfiguration('update', updated, current);
    return updated;
  }

  public getHealthStatus(providerId: string): ProviderHealthStatus {
    return this.requireRecord(providerId).metadata.healthStatus;
  }

  public monitorHealth(): readonly ProviderHealthSnapshot[] {
    return Object.freeze(
      [...this.records.values()].map((record) => ({
        providerId: record.id,
        status: record.metadata.healthStatus,
        checkedAt: new Date().toISOString(),
        enabled: record.enabled,
      })),
    );
  }

  public viewCapabilities(providerId: string): readonly ProviderCapabilityView[] {
    return this.requireRecord(providerId).capabilities;
  }

  private bootstrapFromConfiguration(configuration: PlatformConfiguration): void {
    const now = new Date().toISOString();
    for (const provider of configuration.providers) {
      const record: ProviderConsoleRecord = {
        id: provider.id,
        name: provider.label,
        label: provider.label,
        category: 'infrastructure',
        source: 'infrastructureProviders',
        enabled: provider.enabled,
        registeredAt: now,
        updatedAt: now,
        metadata: {
          description: `${provider.label} infrastructure provider`,
          version: '1.0.0',
          tags: Object.freeze(['infrastructure', provider.id]),
          healthStatus: provider.enabled ? 'healthy' : 'unavailable',
        },
        configuration: Object.freeze({}),
        capabilities: Object.freeze([]),
      };
      this.records.set(record.id, record);
      this.registryService.register(this.toManifest(record));
      if (record.enabled) {
        this.registryService.enable(record.id);
      } else {
        this.registryService.disable(record.id);
      }
    }

    for (const provider of configuration.aiProviders) {
      const record: ProviderConsoleRecord = {
        id: provider.id,
        name: provider.label,
        label: provider.label,
        category: 'ai',
        source: 'aiProviders',
        enabled: provider.enabled,
        registeredAt: now,
        updatedAt: now,
        metadata: {
          description: `${provider.label} AI provider`,
          version: '1.0.0',
          tags: Object.freeze(['ai', provider.id]),
          healthStatus: provider.enabled ? 'healthy' : 'unavailable',
        },
        configuration: Object.freeze({}),
        capabilities: Object.freeze([]),
      };
      this.records.set(record.id, record);
      this.registryService.register(this.toManifest(record));
      if (record.enabled) {
        this.registryService.enable(record.id);
      } else {
        this.registryService.disable(record.id);
      }
    }
  }

  private normalizeCapability(capability: ProviderCapabilityInput): ProviderCapabilityView {
    const metadata = new CapabilityMetadata({
      description: capability.description ?? capability.name,
      tags: capability.tags,
      stability: capability.stability,
      featureFlags: capability.featureFlags,
    });

    return {
      id: capability.id,
      name: capability.name,
      description: metadata.description,
      version: capability.version ?? '1.0.0',
      tags: metadata.tags,
      stability: metadata.stability,
      featureFlags: metadata.featureFlags,
    };
  }

  private toManifest(record: ProviderConsoleRecord): ProviderManifest {
    return new ProviderManifest({
      id: record.id,
      name: record.name,
      metadata: new ProviderMetadata({
        description: record.metadata.description,
        vendor: record.metadata.vendor,
        version: new ProviderVersion(record.metadata.version),
        tags: record.metadata.tags,
        healthStatus: record.metadata.healthStatus,
      }),
      capabilities: new ProviderCapabilities(
        record.capabilities.map(
          (capability) =>
            new ToolCapability({
              name: capability.name,
              description: capability.description,
            }),
        ),
      ),
    });
  }

  private requireRecord(providerId: string): ProviderConsoleRecord {
    const record = this.records.get(providerId);
    if (!record) {
      throw new Error(`Provider ${providerId} was not found.`);
    }
    return record;
  }

  private resolveSource(providerId: string, category: ProviderConsoleCategory): ProviderSource {
    if (category === 'infrastructure' && isProviderKind(providerId)) {
      return 'infrastructureProviders';
    }

    return 'aiProviders';
  }

  private syncConfiguration(
    operation: 'register' | 'update' | 'delete',
    record: ProviderConsoleRecord,
    previous?: ProviderConsoleRecord,
  ): void {
    const configuration = this.configurationService.getConfiguration();

    if (operation === 'delete') {
      this.removeFromConfiguration(configuration, record.id);
      return;
    }

    if (operation === 'update' && previous && previous.source !== record.source) {
      this.removeFromConfiguration(configuration, previous.id);
    }

    if (record.source === 'infrastructureProviders' && isProviderKind(record.id)) {
      this.upsertInfrastructureProvider(configuration, {
        id: record.id,
        label: record.label,
        enabled: record.enabled,
      });
      return;
    }

    this.upsertAiProvider(configuration, {
      id: record.id,
      label: record.label,
      enabled: record.enabled,
    });
  }

  private upsertInfrastructureProvider(
    configuration: PlatformConfiguration,
    provider: ProviderConfiguration,
  ): void {
    const providers = configuration.providers;
    const index = providers.findIndex((candidate) => candidate.id === provider.id);
    if (index >= 0) {
      providers[index] = provider;
    } else {
      providers.push(provider);
    }
  }

  private upsertAiProvider(
    configuration: PlatformConfiguration,
    provider: AiProviderConfiguration,
  ): void {
    const providers = configuration.aiProviders;
    const index = providers.findIndex((candidate) => candidate.id === provider.id);
    if (index >= 0) {
      providers[index] = provider;
    } else {
      providers.push(provider);
    }
  }

  private removeFromConfiguration(configuration: PlatformConfiguration, providerId: string): void {
    configuration.providers = configuration.providers.filter(
      (provider) => provider.id !== providerId,
    );
    configuration.aiProviders = configuration.aiProviders.filter(
      (provider) => provider.id !== providerId,
    );
  }

  private simulatedLatency(providerId: string): number {
    const hash = [...providerId].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return 50 + (hash % 120);
  }
}
