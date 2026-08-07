import type { DashboardWidgetConfiguration, PlatformConfiguration } from './types';
import { WidgetRegistry } from './registry';
import { PlatformConfigurationService, createPlatformConfigurationService } from './service';

export type WidgetCategory =
  'infrastructure' | 'runtime' | 'workflow' | 'security' | 'observability' | 'custom';

export interface WidgetMetadata {
  id: string;
  title: string;
  description?: string;
  category: WidgetCategory;
  tags: readonly string[];
  enabled: boolean;
  order: number;
}

export interface WidgetLayoutSettings {
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  resizable: boolean;
}

export interface WidgetVisibility {
  visibleForRoles: readonly string[];
  hiddenForRoles: readonly string[];
}

export interface WidgetPermissions {
  requiredPermissions: readonly string[];
}

export interface WidgetConfiguration {
  refreshIntervalSeconds: number;
  thresholds: Readonly<Record<string, number>>;
  layout: WidgetLayoutSettings;
}

export interface WidgetDefinition {
  metadata: WidgetMetadata;
  configuration: WidgetConfiguration;
  visibility: WidgetVisibility;
  permissions: WidgetPermissions;
  roles: readonly string[];
}

export interface WidgetTemplate {
  id: string;
  name: string;
  description?: string;
  tags: readonly string[];
  category: WidgetCategory;
  widget: Omit<WidgetDefinition, 'metadata'> & {
    metadata: Omit<WidgetMetadata, 'id' | 'title' | 'order'>;
  };
}

export interface WidgetContext {
  roleIds?: readonly string[];
  permissions?: readonly string[];
}

export interface WidgetRegistryUISection {
  category: WidgetCategory;
  title: string;
  widgets: readonly WidgetDefinition[];
}

export interface WidgetRegistryUIView {
  sections: readonly WidgetRegistryUISection[];
}

export interface AddWidgetInput {
  id: string;
  title: string;
  description?: string;
  category?: WidgetCategory;
  tags?: readonly string[];
  order?: number;
  enabled?: boolean;
  refreshIntervalSeconds?: number;
  thresholds?: Readonly<Record<string, number>>;
  layout?: Partial<WidgetLayoutSettings>;
  visibility?: Partial<WidgetVisibility>;
  permissions?: Partial<WidgetPermissions>;
  roles?: readonly string[];
}

export interface ConfigureWidgetInput {
  title?: string;
  description?: string;
  tags?: readonly string[];
  category?: WidgetCategory;
  enabled?: boolean;
  order?: number;
  refreshIntervalSeconds?: number;
  thresholds?: Readonly<Record<string, number>>;
  layout?: Partial<WidgetLayoutSettings>;
  visibility?: Partial<WidgetVisibility>;
  permissions?: Partial<WidgetPermissions>;
}

export class WidgetRegistryUI {
  public constructor(private readonly service: WidgetManagementService) {}

  public build(context: WidgetContext = {}): WidgetRegistryUIView {
    const widgets = this.service.listWidgets(context);
    const buckets = new Map<WidgetCategory, WidgetDefinition[]>();

    for (const widget of widgets) {
      const list = buckets.get(widget.metadata.category) ?? [];
      list.push(widget);
      buckets.set(widget.metadata.category, list);
    }

    const sections: WidgetRegistryUISection[] = [...buckets.entries()]
      .map(([category, grouped]) => ({
        category,
        title: this.categoryLabel(category),
        widgets: Object.freeze(
          [...grouped].sort((left, right) => left.metadata.order - right.metadata.order),
        ),
      }))
      .sort((left, right) => left.title.localeCompare(right.title));

    return {
      sections: Object.freeze(sections),
    };
  }

  private categoryLabel(category: WidgetCategory): string {
    const labels: Record<WidgetCategory, string> = {
      infrastructure: 'Infrastructure',
      runtime: 'Runtime',
      workflow: 'Workflow',
      security: 'Security',
      observability: 'Observability',
      custom: 'Custom',
    };
    return labels[category];
  }
}

export class WidgetManagementService {
  private readonly widgets = new Map<string, WidgetDefinition>();
  private readonly templates = new Map<string, WidgetTemplate>();
  private readonly widgetRegistry: WidgetRegistry;

  public constructor(
    options: {
      configurationService?: PlatformConfigurationService;
      widgetRegistry?: WidgetRegistry;
    } = {},
  ) {
    const configurationService =
      options.configurationService ?? createPlatformConfigurationService();
    this.widgetRegistry = options.widgetRegistry ?? configurationService.widgetRegistry;
    this.bootstrapFromConfiguration(configurationService.getConfiguration());
  }

  public listWidgets(context: WidgetContext = {}): readonly WidgetDefinition[] {
    return Object.freeze(
      [...this.widgets.values()]
        .filter((widget) => this.canViewWidget(widget, context))
        .sort((left, right) => left.metadata.order - right.metadata.order),
    );
  }

  public listTemplates(): readonly WidgetTemplate[] {
    return Object.freeze([...this.templates.values()]);
  }

  public getWidget(widgetId: string): WidgetDefinition | undefined {
    return this.widgets.get(widgetId);
  }

  public addWidget(input: AddWidgetInput): WidgetDefinition {
    if (this.widgets.has(input.id)) {
      throw new Error(`Widget ${input.id} already exists.`);
    }

    const widget: WidgetDefinition = {
      metadata: {
        id: input.id,
        title: input.title,
        description: input.description,
        category: input.category ?? 'custom',
        tags: Object.freeze([...(input.tags ?? [])]),
        enabled: input.enabled ?? true,
        order: input.order ?? this.widgets.size + 1,
      },
      configuration: {
        refreshIntervalSeconds: input.refreshIntervalSeconds ?? 60,
        thresholds: Object.freeze({ ...(input.thresholds ?? {}) }),
        layout: {
          minWidth: input.layout?.minWidth ?? 1,
          minHeight: input.layout?.minHeight ?? 1,
          maxWidth: input.layout?.maxWidth ?? 12,
          maxHeight: input.layout?.maxHeight ?? 12,
          resizable: input.layout?.resizable ?? true,
        },
      },
      visibility: {
        visibleForRoles: Object.freeze([...(input.visibility?.visibleForRoles ?? [])]),
        hiddenForRoles: Object.freeze([...(input.visibility?.hiddenForRoles ?? [])]),
      },
      permissions: {
        requiredPermissions: Object.freeze([...(input.permissions?.requiredPermissions ?? [])]),
      },
      roles: Object.freeze([...(input.roles ?? [])]),
    };

    this.validateWidget(widget);
    this.widgets.set(widget.metadata.id, widget);
    this.widgetRegistry.register({
      id: widget.metadata.id,
      title: widget.metadata.title,
      enabled: widget.metadata.enabled,
      order: widget.metadata.order,
    });
    return widget;
  }

  public removeWidget(widgetId: string): boolean {
    const widget = this.widgets.get(widgetId);
    if (!widget) {
      return false;
    }

    return this.widgets.delete(widgetId);
  }

  public configureWidget(widgetId: string, input: ConfigureWidgetInput): WidgetDefinition {
    const widget = this.requireWidget(widgetId);
    const updated: WidgetDefinition = {
      metadata: {
        ...widget.metadata,
        title: input.title ?? widget.metadata.title,
        description: input.description ?? widget.metadata.description,
        category: input.category ?? widget.metadata.category,
        tags: Object.freeze([...(input.tags ?? widget.metadata.tags)]),
        enabled: input.enabled ?? widget.metadata.enabled,
        order: input.order ?? widget.metadata.order,
      },
      configuration: {
        refreshIntervalSeconds:
          input.refreshIntervalSeconds ?? widget.configuration.refreshIntervalSeconds,
        thresholds: Object.freeze({ ...(input.thresholds ?? widget.configuration.thresholds) }),
        layout: {
          minWidth: input.layout?.minWidth ?? widget.configuration.layout.minWidth,
          minHeight: input.layout?.minHeight ?? widget.configuration.layout.minHeight,
          maxWidth: input.layout?.maxWidth ?? widget.configuration.layout.maxWidth,
          maxHeight: input.layout?.maxHeight ?? widget.configuration.layout.maxHeight,
          resizable: input.layout?.resizable ?? widget.configuration.layout.resizable,
        },
      },
      visibility: {
        visibleForRoles: Object.freeze([
          ...(input.visibility?.visibleForRoles ?? widget.visibility.visibleForRoles),
        ]),
        hiddenForRoles: Object.freeze([
          ...(input.visibility?.hiddenForRoles ?? widget.visibility.hiddenForRoles),
        ]),
      },
      permissions: {
        requiredPermissions: Object.freeze([
          ...(input.permissions?.requiredPermissions ?? widget.permissions.requiredPermissions),
        ]),
      },
      roles: widget.roles,
    };

    this.validateWidget(updated);
    this.widgets.set(widgetId, updated);
    this.widgetRegistry.register({
      id: updated.metadata.id,
      title: updated.metadata.title,
      enabled: updated.metadata.enabled,
      order: updated.metadata.order,
    });
    return updated;
  }

  public enableWidget(widgetId: string): WidgetDefinition {
    return this.configureWidget(widgetId, { enabled: true });
  }

  public disableWidget(widgetId: string): WidgetDefinition {
    return this.configureWidget(widgetId, { enabled: false });
  }

  public assignRoles(widgetId: string, roleIds: readonly string[]): WidgetDefinition {
    const widget = this.requireWidget(widgetId);
    const updated: WidgetDefinition = {
      ...widget,
      roles: Object.freeze([...roleIds]),
    };
    this.widgets.set(widgetId, updated);
    return updated;
  }

  public addTemplate(template: WidgetTemplate): WidgetTemplate {
    this.templates.set(template.id, {
      ...template,
      tags: Object.freeze([...(template.tags ?? [])]),
    });
    return this.templates.get(template.id)!;
  }

  public addWidgetFromTemplate(
    templateId: string,
    input: Omit<AddWidgetInput, 'category' | 'tags' | 'description'>,
  ): WidgetDefinition {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Widget template ${templateId} was not found.`);
    }

    return this.addWidget({
      ...input,
      category: template.category,
      description: template.description,
      tags: template.tags,
      refreshIntervalSeconds:
        input.refreshIntervalSeconds ?? template.widget.configuration.refreshIntervalSeconds,
      thresholds: input.thresholds ?? template.widget.configuration.thresholds,
      layout: input.layout ?? template.widget.configuration.layout,
      visibility: input.visibility ?? template.widget.visibility,
      permissions: input.permissions ?? template.widget.permissions,
      roles: input.roles ?? template.widget.roles,
    });
  }

  public getRegistryUI(context: WidgetContext = {}): WidgetRegistryUIView {
    return new WidgetRegistryUI(this).build(context);
  }

  private bootstrapFromConfiguration(configuration: PlatformConfiguration): void {
    for (const widget of configuration.widgets) {
      this.widgets.set(widget.id, this.fromDashboardWidget(widget));
    }
  }

  private fromDashboardWidget(widget: DashboardWidgetConfiguration): WidgetDefinition {
    return {
      metadata: {
        id: widget.id,
        title: widget.title,
        category: this.inferCategory(widget.id),
        tags: Object.freeze(['default']),
        enabled: widget.enabled,
        order: widget.order,
      },
      configuration: {
        refreshIntervalSeconds: 60,
        thresholds: Object.freeze({}),
        layout: {
          minWidth: 1,
          minHeight: 1,
          maxWidth: 12,
          maxHeight: 12,
          resizable: true,
        },
      },
      visibility: {
        visibleForRoles: Object.freeze([]),
        hiddenForRoles: Object.freeze([]),
      },
      permissions: {
        requiredPermissions: Object.freeze([]),
      },
      roles: Object.freeze([]),
    };
  }

  private inferCategory(widgetId: string): WidgetCategory {
    const normalized = widgetId.toLowerCase();
    if (normalized.includes('security')) {
      return 'security';
    }
    if (normalized.includes('workflow')) {
      return 'workflow';
    }
    if (normalized.includes('runtime') || normalized.includes('agent')) {
      return 'runtime';
    }
    if (normalized.includes('observability') || normalized.includes('knowledge')) {
      return 'observability';
    }
    if (normalized.includes('infrastructure')) {
      return 'infrastructure';
    }
    return 'custom';
  }

  private canViewWidget(widget: WidgetDefinition, context: WidgetContext): boolean {
    if (!widget.metadata.enabled) {
      return false;
    }

    const roles = new Set(context.roleIds ?? []);
    if (widget.visibility.hiddenForRoles.some((role) => roles.has(role))) {
      return false;
    }

    if (widget.visibility.visibleForRoles.length > 0) {
      const visible = widget.visibility.visibleForRoles.some((role) => roles.has(role));
      if (!visible) {
        return false;
      }
    }

    if (widget.roles.length > 0) {
      const assigned = widget.roles.some((role) => roles.has(role));
      if (!assigned) {
        return false;
      }
    }

    const permissions = new Set(context.permissions ?? []);
    return widget.permissions.requiredPermissions.every((permission) =>
      permissions.has(permission),
    );
  }

  private requireWidget(widgetId: string): WidgetDefinition {
    const widget = this.widgets.get(widgetId);
    if (!widget) {
      throw new Error(`Widget ${widgetId} was not found.`);
    }
    return widget;
  }

  private validateWidget(widget: WidgetDefinition): void {
    if (widget.configuration.refreshIntervalSeconds <= 0) {
      throw new Error('Widget refresh interval must be greater than zero.');
    }

    const layout = widget.configuration.layout;
    if (
      layout.minWidth <= 0 ||
      layout.minHeight <= 0 ||
      layout.maxWidth <= 0 ||
      layout.maxHeight <= 0
    ) {
      throw new Error(`Widget ${widget.metadata.id} has invalid layout dimensions.`);
    }
    if (layout.minWidth > layout.maxWidth || layout.minHeight > layout.maxHeight) {
      throw new Error(`Widget ${widget.metadata.id} has invalid layout bounds.`);
    }
  }
}
