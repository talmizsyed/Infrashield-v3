import { AIModelCapability, AIModelDescriptor, AIModelRegistry } from '@infrashield/ai-core';
import type { SerializableValueObject } from '@infrashield/contracts';

import { createPlatformConfigurationService, type PlatformConfigurationService } from './service';
import { type AdminFormSchema } from './admin-form-schema';
import type {
  AIModelConfiguration,
  AIModelConnectivityStatus,
  AIModelRoutingStrategy,
  PlatformConfiguration,
} from './types';

export interface AIModelManagementFilters {
  search?: string;
  providerId?: string;
  enabled?: boolean;
  isDefault?: boolean;
  connectivity?: AIModelConnectivityStatus;
}

export interface AIModelManagementInput {
  id: string;
  providerId: string;
  family: string;
  name: string;
  version: string;
  enabled?: boolean;
  isDefault?: boolean;
  capabilities: readonly string[];
  routingPolicy?: Partial<AIModelConfiguration['routingPolicy']> & {
    strategy?: AIModelRoutingStrategy;
  };
  costLimits?: Partial<AIModelConfiguration['costLimits']>;
  guardrails?: readonly AIModelConfiguration['guardrails'][number][];
  promptTemplates?: readonly AIModelConfiguration['promptTemplates'][number][];
  connectivity?: Partial<AIModelConfiguration['connectivity']>;
  metadata?: SerializableValueObject;
}

export interface AIModelManagementUpdateInput extends Partial<AIModelManagementInput> {}

export interface AIModelManagementEntry extends AIModelConfiguration {
  registeredAt: string;
  updatedAt: string;
  descriptor: AIModelDescriptor;
  mockConnectivity: {
    checkedAt: string;
    success: boolean;
    latencyMs: number;
    message: string;
  };
}

export class AIModelManagementConsole {
  private readonly configurationService: PlatformConfigurationService;
  private readonly registry = new AIModelRegistry();
  private readonly records = new Map<string, AIModelManagementEntry>();

  public constructor(
    options: {
      configurationService?: PlatformConfigurationService;
    } = {},
  ) {
    this.configurationService =
      options.configurationService ?? createPlatformConfigurationService();
    this.bootstrapFromConfiguration(this.configurationService.getConfiguration());
  }

  public listModels(filters: AIModelManagementFilters = {}): readonly AIModelManagementEntry[] {
    const search = filters.search?.toLowerCase().trim();

    return Object.freeze(
      [...this.records.values()]
        .filter((model) => {
          if (search) {
            const searchable = [
              model.id,
              model.providerId,
              model.family,
              model.name,
              model.version,
              ...model.capabilities,
              ...model.guardrails.map((guardrail) => guardrail.name),
              ...model.promptTemplates.map((template) => template.name),
            ]
              .join(' ')
              .toLowerCase();
            if (!searchable.includes(search)) {
              return false;
            }
          }

          if (filters.providerId && model.providerId !== filters.providerId) {
            return false;
          }

          if (filters.enabled !== undefined && model.enabled !== filters.enabled) {
            return false;
          }

          if (filters.isDefault !== undefined && model.isDefault !== filters.isDefault) {
            return false;
          }

          if (filters.connectivity && model.connectivity.status !== filters.connectivity) {
            return false;
          }

          return true;
        })
        .sort((left, right) => left.name.localeCompare(right.name)),
    );
  }

  public getModel(modelId: string): AIModelManagementEntry | undefined {
    return this.records.get(modelId);
  }

  public registerModel(input: AIModelManagementInput): AIModelManagementEntry {
    if (this.records.has(input.id)) {
      throw new Error(`Model ${input.id} already exists.`);
    }

    const now = new Date().toISOString();
    const entry = this.createEntry(input, now, now);
    this.records.set(entry.id, entry);
    this.registry.register(entry.descriptor);
    this.syncConfiguration();
    return entry;
  }

  public updateModel(modelId: string, input: AIModelManagementUpdateInput): AIModelManagementEntry {
    const current = this.requireModel(modelId);
    const updated = this.createEntry(
      {
        id: current.id,
        providerId: input.providerId ?? current.providerId,
        family: input.family ?? current.family,
        name: input.name ?? current.name,
        version: input.version ?? current.version,
        enabled: input.enabled ?? current.enabled,
        isDefault: input.isDefault ?? current.isDefault,
        capabilities: input.capabilities ?? current.capabilities,
        routingPolicy: input.routingPolicy ?? current.routingPolicy,
        costLimits: input.costLimits ?? current.costLimits,
        guardrails: input.guardrails ?? current.guardrails,
        promptTemplates: input.promptTemplates ?? current.promptTemplates,
        connectivity: input.connectivity ?? current.connectivity,
        metadata: input.metadata ?? current.metadata,
      },
      current.registeredAt,
      new Date().toISOString(),
    );

    this.records.set(modelId, updated);
    this.registry.update(updated.descriptor);
    if (updated.isDefault) {
      this.setDefaultModel(updated.id);
    }
    this.syncConfiguration();
    return updated;
  }

  public setDefaultModel(modelId: string): AIModelManagementEntry {
    const selected = this.requireModel(modelId);
    for (const model of this.records.values()) {
      if (model.id === selected.id) {
        continue;
      }
      if (model.providerId === selected.providerId || model.family === selected.family) {
        this.records.set(model.id, {
          ...model,
          isDefault: false,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    const updated = { ...selected, isDefault: true, updatedAt: new Date().toISOString() };
    this.records.set(modelId, updated);
    this.registry.update(updated.descriptor);
    this.syncConfiguration();
    return updated;
  }

  public configureRoutingPolicy(
    modelId: string,
    routingPolicy: AIModelManagementInput['routingPolicy'],
  ): AIModelManagementEntry {
    return this.updateModel(modelId, { routingPolicy });
  }

  public configureCostLimits(
    modelId: string,
    costLimits: AIModelManagementInput['costLimits'],
  ): AIModelManagementEntry {
    return this.updateModel(modelId, { costLimits });
  }

  public configureGuardrails(
    modelId: string,
    guardrails: AIModelManagementInput['guardrails'],
  ): AIModelManagementEntry {
    return this.updateModel(modelId, { guardrails });
  }

  public configurePromptTemplates(
    modelId: string,
    promptTemplates: AIModelManagementInput['promptTemplates'],
  ): AIModelManagementEntry {
    return this.updateModel(modelId, { promptTemplates });
  }

  public enableModel(modelId: string): AIModelManagementEntry {
    return this.updateModel(modelId, { enabled: true });
  }

  public disableModel(modelId: string): AIModelManagementEntry {
    return this.updateModel(modelId, { enabled: false });
  }

  public deleteModel(modelId: string): boolean {
    if (!this.records.has(modelId)) {
      return false;
    }

    this.records.delete(modelId);
    this.registry.unregister(modelId);
    this.syncConfiguration();
    return true;
  }

  public mockConnectivity(modelId: string): AIModelManagementEntry['mockConnectivity'] {
    const current = this.requireModel(modelId);
    const checkedAt = new Date().toISOString();
    const success = current.enabled && current.connectivity.status !== 'disconnected';
    const result = {
      checkedAt,
      success,
      latencyMs: this.simulatedLatency(modelId),
      message: success ? 'Mock connectivity test passed.' : 'Mock connectivity test failed.',
    };

    const updated = { ...current, mockConnectivity: result, updatedAt: checkedAt };
    this.records.set(modelId, updated);
    this.syncConfiguration();
    return result;
  }

  public describeFormSchema(): AdminFormSchema {
    return {
      id: 'ai-model-management',
      title: 'AI Model Management',
      description: 'Configure AI providers, models, and routing policies.',
      sections: [
        {
          id: 'model-core',
          title: 'Core',
          fields: [
            { id: 'providerId', label: 'Provider', type: 'text', required: true },
            { id: 'family', label: 'Family', type: 'text', required: true },
            { id: 'name', label: 'Name', type: 'text', required: true },
            { id: 'version', label: 'Version', type: 'text', required: true },
            { id: 'enabled', label: 'Enabled', type: 'boolean' },
            { id: 'isDefault', label: 'Default Model', type: 'boolean' },
          ],
        },
        {
          id: 'model-routing',
          title: 'Routing and Safety',
          fields: [
            { id: 'routingPolicy', label: 'Routing Policy', type: 'json' },
            { id: 'costLimits', label: 'Cost Limits', type: 'json' },
            { id: 'guardrails', label: 'Guardrails', type: 'json' },
            { id: 'promptTemplates', label: 'Prompt Templates', type: 'json' },
          ],
        },
        {
          id: 'model-connectivity',
          title: 'Connectivity',
          fields: [
            { id: 'capabilities', label: 'Capabilities', type: 'multiselect' },
            { id: 'connectivity', label: 'Connectivity', type: 'json' },
            { id: 'metadata', label: 'Metadata', type: 'json' },
          ],
        },
      ],
    };
  }

  private bootstrapFromConfiguration(configuration: PlatformConfiguration): void {
    for (const model of configuration.aiModels) {
      const entry = this.createEntry(model, new Date().toISOString(), new Date().toISOString());
      this.records.set(entry.id, entry);
      this.registry.register(entry.descriptor);
    }
  }

  private createEntry(
    input: AIModelManagementInput | AIModelConfiguration,
    registeredAt: string,
    updatedAt: string,
  ): AIModelManagementEntry {
    const capabilities = (input.capabilities ?? []).map(
      (capability) =>
        new AIModelCapability({
          kind: capability,
          supported: true,
        }),
    );

    const descriptor = new AIModelDescriptor({
      id: input.id,
      providerId: input.providerId,
      family: input.family,
      name: input.name,
      version: input.version,
      status: input.connectivity?.status ?? 'stable',
      deprecated: false,
      capabilities,
      aliases: [],
      metadata: input.metadata,
    });

    return {
      id: input.id,
      providerId: input.providerId,
      family: input.family,
      name: input.name,
      version: input.version,
      enabled: input.enabled ?? true,
      isDefault: input.isDefault ?? false,
      capabilities: [...input.capabilities],
      routingPolicy: {
        strategy: input.routingPolicy?.strategy ?? 'priority',
        fallbackModelIds: Object.freeze([...(input.routingPolicy?.fallbackModelIds ?? [])]),
        preferDefault: input.routingPolicy?.preferDefault ?? false,
      },
      costLimits: {
        maxTokensPerRequest: input.costLimits?.maxTokensPerRequest ?? 4096,
        maxCostPerMonth: input.costLimits?.maxCostPerMonth ?? 0,
        currency: input.costLimits?.currency ?? 'USD',
      },
      guardrails: Object.freeze([...(input.guardrails ?? [])]),
      promptTemplates: Object.freeze([...(input.promptTemplates ?? [])]),
      connectivity: {
        status: input.connectivity?.status ?? 'unknown',
        lastCheckedAt: input.connectivity?.lastCheckedAt,
        message: input.connectivity?.message,
      },
      metadata: Object.freeze({ ...(input.metadata ?? {}) }),
      registeredAt,
      updatedAt,
      descriptor,
      mockConnectivity: {
        checkedAt: updatedAt,
        success: input.enabled ?? true,
        latencyMs: this.simulatedLatency(input.id),
        message: 'Mock connectivity initialized.',
      },
    };
  }

  private requireModel(modelId: string): AIModelManagementEntry {
    const model = this.records.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} was not found.`);
    }
    return model;
  }

  private simulatedLatency(modelId: string): number {
    let latency = 0;
    for (const character of modelId) {
      latency = (latency + character.charCodeAt(0)) % 300;
    }
    return 50 + latency;
  }

  private syncConfiguration(): void {
    const configuration = this.configurationService.getConfiguration();
    configuration.aiModels = [...this.records.values()].map((model) => ({
      id: model.id,
      providerId: model.providerId,
      family: model.family,
      name: model.name,
      version: model.version,
      enabled: model.enabled,
      isDefault: model.isDefault,
      capabilities: [...model.capabilities],
      routingPolicy: {
        strategy: model.routingPolicy.strategy,
        fallbackModelIds: [...model.routingPolicy.fallbackModelIds],
        preferDefault: model.routingPolicy.preferDefault,
      },
      costLimits: { ...model.costLimits },
      guardrails: model.guardrails.map((guardrail) => ({
        ...guardrail,
        rules: [...guardrail.rules],
      })),
      promptTemplates: model.promptTemplates.map((template) => ({
        ...template,
        variables: [...template.variables],
      })),
      connectivity: { ...model.connectivity },
      metadata: { ...model.metadata },
    }));
  }
}
