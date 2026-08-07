import { describe, expect, it } from 'vitest';
import {
  AdminNavigation,
  AdminPermissions,
  AdminRegistry,
  createDefaultPlatformConfiguration,
  DashboardBuilder,
  createPlatformConfigurationService,
  InMemoryConfigurationRepository,
  PlatformConfigurationService,
  WidgetManagementService,
  validatePlatformConfiguration,
} from './index';

describe('platform configuration', () => {
  it('provides enabled navigation, widgets, providers, themes, and features', () => {
    const service = createPlatformConfigurationService();

    expect(service.getNavigation()).toHaveLength(12);
    expect(service.getWidgets().map((widget) => widget.id)).toContain('InfrastructureHealth');
    expect(service.getProviders().map((provider) => provider.id)).toEqual(
      expect.arrayContaining(['vmware', 'aws']),
    );
    expect(service.getThemes().map((theme) => theme.id)).toContain('corporate');
    expect(service.getFeatures()).toHaveLength(1);
  });

  it('rejects duplicate navigation paths', () => {
    const configuration = createDefaultPlatformConfiguration();
    configuration.navigation.push({ ...configuration.navigation[0]!, id: 'duplicate' });

    expect(() => validatePlatformConfiguration(configuration)).toThrow('duplicated');
  });

  it('bootstraps and persists default configuration when storage is empty', () => {
    const repository = new InMemoryConfigurationRepository();
    const service = new PlatformConfigurationService(repository);

    expect(service.getConfiguration()).toBeDefined();
    expect(repository.get()).toBeDefined();
    expect(service.getDashboard().widgets).not.toHaveLength(0);
    expect(service.getWidgets().map((widget) => widget.id)).toEqual(
      expect.arrayContaining(['InfrastructureHealth', 'KnowledgeGraph']),
    );
  });

  it('registers admin modules and builds dynamic permission-aware navigation', () => {
    const configuration = createDefaultPlatformConfiguration();
    configuration.featureFlags.push({
      id: 'admin-advanced',
      enabled: true,
      description: 'Enable advanced admin sections.',
    });

    const registry = new AdminRegistry();
    registry.register({
      id: 'platform-admin',
      metadata: {
        id: 'platform-admin',
        title: 'Platform Administration',
        description: 'Administration surfaces for platform operators.',
        category: 'admin',
      },
      sections: [
        {
          id: 'admin-overview',
          title: 'Admin Overview',
          href: '/admin',
          description: 'Administration home',
          enabled: true,
          order: 500,
          requiredPermissions: ['configuration.read'],
        },
        {
          id: 'admin-advanced',
          title: 'Advanced Controls',
          href: '/admin/advanced',
          description: 'Advanced controls',
          enabled: true,
          order: 510,
          featureFlag: 'admin-advanced',
          requiredRoles: ['platform-operator'],
          requiredPermissions: ['configuration.read'],
          metadata: {
            id: 'admin-advanced',
            title: 'Advanced Controls',
            description: 'Feature-flagged controls.',
            tags: ['admin', 'advanced'],
          },
        },
      ],
    });

    const navigation = new AdminNavigation(registry).build(configuration, {
      roleIds: ['platform-operator'],
    });

    expect(navigation.some((section) => section.id === 'admin-overview')).toBe(true);
    expect(navigation.some((section) => section.id === 'admin-advanced')).toBe(true);
    expect(navigation.some((section) => section.id === 'dashboard')).toBe(true);
  });

  it('hides admin sections without required permissions or feature flags', () => {
    const configuration = createDefaultPlatformConfiguration();
    const registry = new AdminRegistry();
    const permissions = new AdminPermissions();
    registry.register({
      id: 'security-admin',
      metadata: {
        id: 'security-admin',
        title: 'Security Administration',
      },
      sections: [
        {
          id: 'security-rules',
          title: 'Security Rules',
          href: '/admin/security-rules',
          enabled: true,
          order: 520,
          requiredPermissions: ['security.rules.manage'],
          featureFlag: 'security-admin-enabled',
        },
      ],
    });

    const navigation = new AdminNavigation(registry, permissions).build(configuration, {
      roleIds: ['platform-operator'],
    });

    expect(navigation.some((section) => section.id === 'security-rules')).toBe(false);
  });

  it('supports dashboard CRUD, clone, and role assignment', () => {
    const builder = new DashboardBuilder();

    const created = builder.createDashboard({
      id: 'ops-dashboard',
      name: 'Operations Dashboard',
      layout: {
        columns: 12,
        rowHeight: 1,
        widgets: [
          {
            widgetId: 'InfrastructureHealth',
            x: 0,
            y: 0,
            width: 12,
            height: 1,
          },
        ],
      },
      roleIds: ['platform-operator'],
      tags: ['operations'],
    });

    expect(created.metadata.id).toBe('ops-dashboard');

    const edited = builder.editDashboard('ops-dashboard', {
      name: 'Ops Dashboard v2',
      description: 'Operational controls.',
      roleIds: ['platform-operator', 'audit-reader'],
    });
    expect(edited.metadata.name).toBe('Ops Dashboard v2');
    expect(edited.roles.roleIds).toContain('audit-reader');

    const clone = builder.cloneDashboard('ops-dashboard', 'ops-dashboard-clone');
    expect(clone.metadata.id).toBe('ops-dashboard-clone');

    const assigned = builder.assignRoles('ops-dashboard-clone', ['security-admin']);
    expect(assigned.roles.roleIds).toEqual(['security-admin']);

    expect(
      builder.dashboardsForRole('security-admin').map((dashboard) => dashboard.metadata.id),
    ).toContain('ops-dashboard-clone');

    expect(builder.deleteDashboard('ops-dashboard')).toBe(true);
  });

  it('supports templates and import/export json with default dashboard handling', () => {
    const builder = new DashboardBuilder();

    builder.createTemplate({
      id: 'template-exec',
      name: 'Executive Template',
      tags: ['executive'],
      description: 'Executive view',
      layout: {
        columns: 12,
        rowHeight: 1,
        widgets: [
          {
            widgetId: 'RuntimeHealth',
            x: 0,
            y: 0,
            width: 12,
            height: 1,
          },
        ],
      },
    });

    const fromTemplate = builder.createDashboardFromTemplate('template-exec', {
      id: 'exec-dashboard',
      name: 'Executive Dashboard',
      roleIds: ['platform-operator'],
      isDefault: true,
    });

    expect(fromTemplate.metadata.templateId).toBe('template-exec');
    expect(builder.getDashboard('default-dashboard')?.metadata.isDefault).toBe(false);
    expect(builder.getDashboard('exec-dashboard')?.metadata.isDefault).toBe(true);

    const exported = builder.exportJson();
    const imported = new DashboardBuilder().importJson(exported);
    expect(imported.templates.some((template) => template.id === 'template-exec')).toBe(true);
    expect(
      imported.dashboards.some((dashboard) => dashboard.metadata.id === 'exec-dashboard'),
    ).toBe(true);
  });

  it('supports widget CRUD, configuration, enable-disable, layout metadata, thresholds, and roles', () => {
    const widgets = new WidgetManagementService();

    const added = widgets.addWidget({
      id: 'cpu-hotspot',
      title: 'CPU Hotspot',
      category: 'observability',
      description: 'CPU usage hotspot tracker.',
      refreshIntervalSeconds: 30,
      thresholds: { warning: 75, critical: 90 },
      layout: {
        minWidth: 2,
        minHeight: 1,
        maxWidth: 8,
        maxHeight: 6,
        resizable: true,
      },
      permissions: { requiredPermissions: ['widgets.read'] },
      roles: ['platform-operator'],
    });

    expect(added.metadata.id).toBe('cpu-hotspot');
    expect(added.configuration.refreshIntervalSeconds).toBe(30);

    const configured = widgets.configureWidget('cpu-hotspot', {
      refreshIntervalSeconds: 45,
      thresholds: { warning: 70, critical: 95 },
      layout: { maxWidth: 10 },
    });
    expect(configured.configuration.refreshIntervalSeconds).toBe(45);
    expect(configured.configuration.thresholds.critical).toBe(95);
    expect(configured.configuration.layout.maxWidth).toBe(10);

    const disabled = widgets.disableWidget('cpu-hotspot');
    expect(disabled.metadata.enabled).toBe(false);
    const enabled = widgets.enableWidget('cpu-hotspot');
    expect(enabled.metadata.enabled).toBe(true);

    const assigned = widgets.assignRoles('cpu-hotspot', ['security-admin']);
    expect(assigned.roles).toEqual(['security-admin']);

    expect(widgets.removeWidget('cpu-hotspot')).toBe(true);
    expect(widgets.getWidget('cpu-hotspot')).toBeUndefined();
  });

  it('supports widget templates and permission-aware registry ui visibility', () => {
    const widgets = new WidgetManagementService();

    widgets.addTemplate({
      id: 'template-latency',
      name: 'Latency Widget Template',
      category: 'observability',
      description: 'Template for latency telemetry.',
      tags: ['latency', 'observability'],
      widget: {
        metadata: {
          description: 'Latency card',
          category: 'observability',
          tags: ['template'],
          enabled: true,
        },
        configuration: {
          refreshIntervalSeconds: 20,
          thresholds: { warning: 250, critical: 500 },
          layout: {
            minWidth: 2,
            minHeight: 1,
            maxWidth: 12,
            maxHeight: 8,
            resizable: true,
          },
        },
        visibility: {
          visibleForRoles: ['platform-operator'],
          hiddenForRoles: [],
        },
        permissions: {
          requiredPermissions: ['widgets.read'],
        },
        roles: ['platform-operator'],
      },
    });

    const fromTemplate = widgets.addWidgetFromTemplate('template-latency', {
      id: 'latency-map',
      title: 'Latency Map',
      order: 999,
    });
    expect(fromTemplate.configuration.thresholds.warning).toBe(250);

    const denied = widgets.getRegistryUI({ roleIds: ['audit-reader'], permissions: [] });
    expect(
      denied.sections.some((section) =>
        section.widgets.some((widget) => widget.metadata.id === 'latency-map'),
      ),
    ).toBe(false);

    const allowed = widgets.getRegistryUI({
      roleIds: ['platform-operator'],
      permissions: ['widgets.read'],
    });
    expect(
      allowed.sections.some((section) =>
        section.widgets.some((widget) => widget.metadata.id === 'latency-map'),
      ),
    ).toBe(true);
  });
});
