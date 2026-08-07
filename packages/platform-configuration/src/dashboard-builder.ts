import { WidgetRegistry } from './registry';
import { PlatformConfigurationService, createPlatformConfigurationService } from './service';

export interface DashboardMetadata {
  id: string;
  name: string;
  description?: string;
  tags: readonly string[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  templateId?: string;
}

export interface DashboardRoleAssignment {
  roleIds: readonly string[];
}

export interface DashboardLayoutWidget {
  widgetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DashboardLayoutModel {
  columns: number;
  rowHeight: number;
  widgets: readonly DashboardLayoutWidget[];
}

export interface DashboardDefinition {
  metadata: DashboardMetadata;
  layout: DashboardLayoutModel;
  roles: DashboardRoleAssignment;
}

export interface DashboardTemplate {
  id: string;
  name: string;
  description?: string;
  tags: readonly string[];
  layout: DashboardLayoutModel;
}

export interface DashboardImportExportModel {
  dashboards: readonly DashboardDefinition[];
  templates: readonly DashboardTemplate[];
}

export interface CreateDashboardInput {
  id: string;
  name: string;
  description?: string;
  tags?: readonly string[];
  isDefault?: boolean;
  roleIds?: readonly string[];
  layout: DashboardLayoutModel;
  templateId?: string;
}

export interface UpdateDashboardInput {
  name?: string;
  description?: string;
  tags?: readonly string[];
  isDefault?: boolean;
  roleIds?: readonly string[];
  layout?: DashboardLayoutModel;
}

export class DashboardBuilder {
  private readonly dashboards = new Map<string, DashboardDefinition>();
  private readonly templates = new Map<string, DashboardTemplate>();
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
    this.bootstrapDefaultDashboard(configurationService);
  }

  public listDashboards(): readonly DashboardDefinition[] {
    return Object.freeze([...this.dashboards.values()]);
  }

  public listTemplates(): readonly DashboardTemplate[] {
    return Object.freeze([...this.templates.values()]);
  }

  public getDashboard(dashboardId: string): DashboardDefinition | undefined {
    return this.dashboards.get(dashboardId);
  }

  public createDashboard(input: CreateDashboardInput): DashboardDefinition {
    if (this.dashboards.has(input.id)) {
      throw new Error(`Dashboard ${input.id} already exists.`);
    }

    this.validateLayout(input.layout);
    const now = new Date().toISOString();
    const dashboard: DashboardDefinition = {
      metadata: {
        id: input.id,
        name: input.name,
        description: input.description,
        tags: Object.freeze([...(input.tags ?? [])]),
        isDefault: input.isDefault ?? false,
        createdAt: now,
        updatedAt: now,
        templateId: input.templateId,
      },
      layout: this.cloneLayout(input.layout),
      roles: {
        roleIds: Object.freeze([...(input.roleIds ?? [])]),
      },
    };

    this.dashboards.set(dashboard.metadata.id, dashboard);
    if (dashboard.metadata.isDefault) {
      this.setDefaultDashboard(dashboard.metadata.id);
    }
    return dashboard;
  }

  public editDashboard(dashboardId: string, input: UpdateDashboardInput): DashboardDefinition {
    const dashboard = this.requireDashboard(dashboardId);
    if (input.layout) {
      this.validateLayout(input.layout);
    }

    const updated: DashboardDefinition = {
      metadata: {
        ...dashboard.metadata,
        name: input.name ?? dashboard.metadata.name,
        description: input.description ?? dashboard.metadata.description,
        tags: Object.freeze([...(input.tags ?? dashboard.metadata.tags)]),
        isDefault: input.isDefault ?? dashboard.metadata.isDefault,
        updatedAt: new Date().toISOString(),
      },
      layout: input.layout ? this.cloneLayout(input.layout) : dashboard.layout,
      roles: {
        roleIds: Object.freeze([...(input.roleIds ?? dashboard.roles.roleIds)]),
      },
    };

    this.dashboards.set(dashboardId, updated);
    if (updated.metadata.isDefault) {
      this.setDefaultDashboard(dashboardId);
    }
    return updated;
  }

  public deleteDashboard(dashboardId: string): boolean {
    const dashboard = this.requireDashboard(dashboardId);
    if (dashboard.metadata.isDefault) {
      throw new Error('Default dashboard cannot be deleted.');
    }

    return this.dashboards.delete(dashboardId);
  }

  public cloneDashboard(
    sourceDashboardId: string,
    cloneId: string,
    cloneName?: string,
  ): DashboardDefinition {
    const source = this.requireDashboard(sourceDashboardId);
    if (this.dashboards.has(cloneId)) {
      throw new Error(`Dashboard ${cloneId} already exists.`);
    }

    return this.createDashboard({
      id: cloneId,
      name: cloneName ?? `${source.metadata.name} Copy`,
      description: source.metadata.description,
      tags: source.metadata.tags,
      roleIds: source.roles.roleIds,
      layout: source.layout,
      templateId: source.metadata.templateId,
    });
  }

  public setDefaultDashboard(dashboardId: string): void {
    for (const dashboard of this.dashboards.values()) {
      const isDefault = dashboard.metadata.id === dashboardId;
      this.dashboards.set(dashboard.metadata.id, {
        ...dashboard,
        metadata: {
          ...dashboard.metadata,
          isDefault,
          updatedAt: new Date().toISOString(),
        },
      });
    }
  }

  public assignRoles(dashboardId: string, roleIds: readonly string[]): DashboardDefinition {
    return this.editDashboard(dashboardId, { roleIds });
  }

  public createTemplate(template: DashboardTemplate): DashboardTemplate {
    this.validateLayout(template.layout);
    this.templates.set(template.id, {
      ...template,
      tags: Object.freeze([...(template.tags ?? [])]),
      layout: this.cloneLayout(template.layout),
    });
    return this.templates.get(template.id)!;
  }

  public createDashboardFromTemplate(
    templateId: string,
    input: Omit<CreateDashboardInput, 'layout' | 'templateId'>,
  ): DashboardDefinition {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Dashboard template ${templateId} was not found.`);
    }

    return this.createDashboard({
      ...input,
      layout: template.layout,
      templateId: template.id,
      tags: input.tags ?? template.tags,
    });
  }

  public importJson(json: string): DashboardImportExportModel {
    const payload = JSON.parse(json) as DashboardImportExportModel;
    const dashboards = payload.dashboards ?? [];
    const templates = payload.templates ?? [];

    for (const template of templates) {
      this.createTemplate(template);
    }

    for (const dashboard of dashboards) {
      this.validateLayout(dashboard.layout);
      this.dashboards.set(dashboard.metadata.id, {
        metadata: {
          ...dashboard.metadata,
          tags: Object.freeze([...(dashboard.metadata.tags ?? [])]),
        },
        layout: this.cloneLayout(dashboard.layout),
        roles: {
          roleIds: Object.freeze([...(dashboard.roles.roleIds ?? [])]),
        },
      });
    }

    if (!this.listDashboards().some((dashboard) => dashboard.metadata.isDefault)) {
      const first = this.listDashboards()[0];
      if (first) {
        this.setDefaultDashboard(first.metadata.id);
      }
    }

    return {
      dashboards: this.listDashboards(),
      templates: this.listTemplates(),
    };
  }

  public exportJson(): string {
    return JSON.stringify(
      {
        dashboards: this.listDashboards(),
        templates: this.listTemplates(),
      } satisfies DashboardImportExportModel,
      null,
      2,
    );
  }

  public dashboardsForRole(roleId: string): readonly DashboardDefinition[] {
    return Object.freeze(
      this.listDashboards().filter((dashboard) => {
        if (dashboard.roles.roleIds.length === 0) {
          return true;
        }

        return dashboard.roles.roleIds.includes(roleId);
      }),
    );
  }

  private bootstrapDefaultDashboard(configurationService: PlatformConfigurationService): void {
    const configuration = configurationService.getConfiguration();
    const defaultLayout: DashboardLayoutModel = {
      columns: 12,
      rowHeight: 1,
      widgets: configuration.dashboard.widgets.map((widget, index) => ({
        widgetId: widget.id,
        x: 0,
        y: index,
        width: 12,
        height: 1,
      })),
    };

    this.createDashboard({
      id: 'default-dashboard',
      name: configuration.dashboard.title,
      description: 'Default configuration-derived dashboard.',
      tags: ['default', 'configuration'],
      isDefault: true,
      layout: defaultLayout,
    });
  }

  private requireDashboard(dashboardId: string): DashboardDefinition {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard ${dashboardId} was not found.`);
    }

    return dashboard;
  }

  private validateLayout(layout: DashboardLayoutModel): void {
    if (layout.columns <= 0) {
      throw new Error('Dashboard layout columns must be greater than zero.');
    }
    if (layout.rowHeight <= 0) {
      throw new Error('Dashboard layout rowHeight must be greater than zero.');
    }

    for (const widget of layout.widgets) {
      if (!this.widgetRegistry.get(widget.widgetId)) {
        throw new Error(`Unknown widget in dashboard layout: ${widget.widgetId}`);
      }
      if (widget.width <= 0 || widget.height <= 0) {
        throw new Error(`Invalid widget dimensions for ${widget.widgetId}.`);
      }
      if (widget.x < 0 || widget.y < 0) {
        throw new Error(`Invalid widget coordinates for ${widget.widgetId}.`);
      }
    }
  }

  private cloneLayout(layout: DashboardLayoutModel): DashboardLayoutModel {
    return {
      columns: layout.columns,
      rowHeight: layout.rowHeight,
      widgets: Object.freeze(layout.widgets.map((widget) => ({ ...widget }))),
    };
  }
}
