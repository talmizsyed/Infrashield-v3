import {
  ToolCategory,
  ToolDefinition,
  ToolExecutor,
  ToolMetadata,
  ToolRegistry,
} from '@infrashield/ai-tools';

import { createPlatformConfigurationService, type PlatformConfigurationService } from './service';
import { type AdminFormSchema } from './admin-form-schema';
import type {
  ToolCategoryName,
  ToolDefinitionConfiguration,
  ToolPermissionConfiguration,
  ToolMetadataConfiguration,
  PlatformConfiguration,
} from './types';

export interface ToolManagementFilters {
  search?: string;
  category?: ToolCategoryName;
  enabled?: boolean;
  tag?: string;
  permission?: string;
}

export interface ToolManagementInput {
  id: string;
  name: string;
  description?: string;
  enabled?: boolean;
  category: ToolCategoryName;
  categories?: readonly ToolCategoryName[];
  metadata: ToolMetadataConfiguration;
  permissions: ToolPermissionConfiguration;
  configuration?: Readonly<Record<string, unknown>>;
}

export interface ToolManagementUpdateInput {
  name?: string;
  description?: string;
  enabled?: boolean;
  category?: ToolCategoryName;
  categories?: readonly ToolCategoryName[];
  metadata?: Partial<ToolMetadataConfiguration>;
  permissions?: Partial<ToolPermissionConfiguration>;
  configuration?: Readonly<Record<string, unknown>>;
}

export interface ToolManagementEntry extends ToolDefinitionConfiguration {
  registeredAt: string;
  updatedAt: string;
  lastConnectionTest?: {
    checkedAt: string;
    success: boolean;
    latencyMs: number;
    message: string;
  };
}

export interface ToolPermissionsView {
  toolId: string;
  permissions: ToolPermissionConfiguration;
  configuration: Readonly<Record<string, unknown>>;
  metadata: ToolMetadataConfiguration;
}

export class ToolManagementConsole {
  private readonly configurationService: PlatformConfigurationService;
  private readonly registry = new ToolRegistry();
  private readonly records = new Map<string, ToolManagementEntry>();

  public constructor(
    options: {
      configurationService?: PlatformConfigurationService;
    } = {},
  ) {
    this.configurationService =
      options.configurationService ?? createPlatformConfigurationService();
    this.bootstrapFromConfiguration(this.configurationService.getConfiguration());
  }

  public listTools(filters: ToolManagementFilters = {}): readonly ToolManagementEntry[] {
    const search = filters.search?.toLowerCase().trim();

    return Object.freeze(
      [...this.records.values()]
        .filter((tool) => {
          if (search) {
            const searchable = [
              tool.id,
              tool.name,
              tool.description ?? '',
              tool.category,
              ...tool.categories,
              ...tool.metadata.tags,
              ...tool.metadata.capabilities,
              ...tool.permissions.requiredPermissions,
              ...tool.permissions.scopes,
            ]
              .join(' ')
              .toLowerCase();

            if (!searchable.includes(search)) {
              return false;
            }
          }

          if (filters.category && tool.category !== filters.category) {
            return false;
          }

          if (filters.enabled !== undefined && tool.enabled !== filters.enabled) {
            return false;
          }

          if (filters.tag && !tool.metadata.tags.includes(filters.tag)) {
            return false;
          }

          if (
            filters.permission &&
            !tool.permissions.requiredPermissions.includes(filters.permission) &&
            !tool.permissions.scopes.includes(filters.permission)
          ) {
            return false;
          }

          return true;
        })
        .sort((left, right) => left.name.localeCompare(right.name)),
    );
  }

  public listCategories(): readonly ToolCategoryName[] {
    return Object.freeze([
      ...new Set([...this.records.values()].flatMap((tool) => [tool.category, ...tool.categories])),
    ]);
  }

  public getTool(toolId: string): ToolManagementEntry | undefined {
    return this.records.get(toolId);
  }

  public registerTool(input: ToolManagementInput): ToolManagementEntry {
    if (this.records.has(input.id)) {
      throw new Error(`Tool ${input.id} is already registered.`);
    }

    const now = new Date().toISOString();
    const entry = this.createEntry(input, now, now);
    this.records.set(entry.id, entry);
    this.registry.register(this.createDefinition(entry));
    this.syncConfiguration();
    return entry;
  }

  public updateTool(toolId: string, input: ToolManagementUpdateInput): ToolManagementEntry {
    const current = this.requireTool(toolId);
    const updated: ToolManagementEntry = {
      ...current,
      name: input.name ?? current.name,
      description: input.description ?? current.description,
      enabled: input.enabled ?? current.enabled,
      category: input.category ?? current.category,
      categories: Object.freeze([...(input.categories ?? current.categories)]),
      metadata: {
        version: input.metadata?.version ?? current.metadata.version,
        vendor: input.metadata?.vendor ?? current.metadata.vendor,
        description: input.metadata?.description ?? current.metadata.description,
        tags: Object.freeze([...(input.metadata?.tags ?? current.metadata.tags)]),
        capabilities: Object.freeze(
          [...(input.metadata?.capabilities ?? current.metadata.capabilities)].map((item) => item),
        ),
      },
      permissions: {
        requiredPermissions: Object.freeze([
          ...(input.permissions?.requiredPermissions ?? current.permissions.requiredPermissions),
        ]),
        scopes: Object.freeze([...(input.permissions?.scopes ?? current.permissions.scopes)]),
      },
      configuration: Object.freeze({ ...(input.configuration ?? current.configuration) }),
      updatedAt: new Date().toISOString(),
    };

    this.records.set(toolId, updated);
    this.registry.unregister(toolId);
    this.registry.register(this.createDefinition(updated));
    this.syncConfiguration();
    return updated;
  }

  public configureTool(
    toolId: string,
    configuration: Readonly<Record<string, unknown>>,
  ): ToolManagementEntry {
    const current = this.requireTool(toolId);
    const updated: ToolManagementEntry = {
      ...current,
      configuration: Object.freeze({ ...current.configuration, ...configuration }),
      updatedAt: new Date().toISOString(),
    };

    this.records.set(toolId, updated);
    this.syncConfiguration();
    return updated;
  }

  public enableTool(toolId: string): ToolManagementEntry {
    return this.updateTool(toolId, { enabled: true });
  }

  public disableTool(toolId: string): ToolManagementEntry {
    return this.updateTool(toolId, { enabled: false });
  }

  public deleteTool(toolId: string): boolean {
    const existing = this.records.get(toolId);
    if (!existing) {
      return false;
    }

    this.registry.unregister(toolId);
    this.records.delete(toolId);
    this.syncConfiguration();
    return true;
  }

  public getPermissionsView(toolId: string): ToolPermissionsView {
    const tool = this.requireTool(toolId);
    return {
      toolId: tool.id,
      permissions: tool.permissions,
      configuration: tool.configuration,
      metadata: tool.metadata,
    };
  }

  public testConnection(toolId: string): ToolManagementEntry['lastConnectionTest'] {
    const current = this.requireTool(toolId);
    const checkedAt = new Date().toISOString();
    const success = current.enabled;
    const result = {
      checkedAt,
      success,
      latencyMs: this.simulatedLatency(toolId),
      message: success
        ? 'Connection test passed in simulated mode.'
        : 'Connection test failed in simulated mode.',
    };

    const updated: ToolManagementEntry = {
      ...current,
      lastConnectionTest: result,
      updatedAt: checkedAt,
    };
    this.records.set(toolId, updated);
    this.syncConfiguration();
    return result;
  }

  public describeFormSchema(): AdminFormSchema {
    return {
      id: 'tool-management',
      title: 'Tool Management',
      description: 'Register and configure platform tools.',
      sections: [
        {
          id: 'tool-core',
          title: 'Core',
          fields: [
            { id: 'id', label: 'Tool ID', type: 'text', required: true },
            { id: 'name', label: 'Tool Name', type: 'text', required: true },
            { id: 'description', label: 'Description', type: 'textarea' },
            { id: 'enabled', label: 'Enabled', type: 'boolean' },
          ],
        },
        {
          id: 'tool-classification',
          title: 'Classification',
          fields: [
            {
              id: 'category',
              label: 'Category',
              type: 'select',
              required: true,
              options: this.listCategories(),
            },
            { id: 'categories', label: 'Categories', type: 'multiselect' },
            { id: 'metadata', label: 'Metadata', type: 'json' },
          ],
        },
        {
          id: 'tool-access',
          title: 'Access',
          fields: [
            { id: 'permissions', label: 'Permissions', type: 'json' },
            { id: 'configuration', label: 'Configuration', type: 'json' },
          ],
        },
      ],
    };
  }

  private bootstrapFromConfiguration(configuration: PlatformConfiguration): void {
    for (const tool of configuration.toolDefinitions) {
      const entry = this.createEntry(tool, new Date().toISOString(), new Date().toISOString());
      this.records.set(entry.id, entry);
      this.registry.register(this.createDefinition(entry));
    }
  }

  private createEntry(
    input: ToolManagementInput | ToolDefinitionConfiguration,
    registeredAt: string,
    updatedAt: string,
  ): ToolManagementEntry {
    const categories = Object.freeze([...(input.categories ?? [input.category])]);
    return {
      id: input.id,
      name: input.name,
      description: input.description,
      enabled: input.enabled ?? true,
      category: input.category,
      categories,
      metadata: {
        version: input.metadata.version,
        vendor: input.metadata.vendor,
        description: input.metadata.description,
        tags: Object.freeze([...(input.metadata.tags ?? [])]),
        capabilities: Object.freeze([...(input.metadata.capabilities ?? [])]),
      },
      permissions: {
        requiredPermissions: Object.freeze([...(input.permissions.requiredPermissions ?? [])]),
        scopes: Object.freeze([...(input.permissions.scopes ?? [])]),
      },
      configuration: Object.freeze({ ...(input.configuration ?? {}) }),
      registeredAt,
      updatedAt,
    };
  }

  private createDefinition(tool: ToolManagementEntry): ToolDefinition {
    return new ToolDefinition({
      id: tool.id,
      name: tool.name,
      metadata: new ToolMetadata({
        description: tool.description ?? tool.metadata.description ?? tool.name,
        version: tool.metadata.version,
        categories: tool.categories.map((category) => category as ToolCategory),
        tags: tool.metadata.tags,
      }),
      executor: new ToolExecutor(async () => ({
        toolId: tool.id,
        name: tool.name,
        enabled: tool.enabled,
      })),
    });
  }

  private requireTool(toolId: string): ToolManagementEntry {
    const tool = this.records.get(toolId);
    if (!tool) {
      throw new Error(`Tool ${toolId} was not found.`);
    }
    return tool;
  }

  private simulatedLatency(toolId: string): number {
    let latency = 0;
    for (const character of toolId) {
      latency = (latency + character.charCodeAt(0)) % 250;
    }
    return 40 + latency;
  }

  private syncConfiguration(): void {
    const configuration = this.configurationService.getConfiguration();
    configuration.toolDefinitions = [...this.records.values()].map((tool) => ({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      enabled: tool.enabled,
      category: tool.category,
      categories: [...tool.categories],
      metadata: {
        version: tool.metadata.version,
        vendor: tool.metadata.vendor,
        description: tool.metadata.description,
        tags: [...tool.metadata.tags],
        capabilities: [...tool.metadata.capabilities],
      },
      permissions: {
        requiredPermissions: [...tool.permissions.requiredPermissions],
        scopes: [...tool.permissions.scopes],
      },
      configuration: { ...tool.configuration },
    }));
  }
}
