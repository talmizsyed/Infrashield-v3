import { describe, expect, it } from 'vitest';
import {
  AdminNavigation,
  AdminPermissions,
  AdminRegistry,
  AIModelManagementConsole,
  createDefaultPlatformConfiguration,
  DashboardBuilder,
  AgentManagementConsole,
  createPlatformConfigurationService,
  InMemoryConfigurationRepository,
  PlatformConfigurationService,
  PlatformSettingsConsole,
  ProviderManagementConsole,
  ToolManagementConsole,
  WorkflowManagementConsole,
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

  it('supports provider registration, CRUD, capability view, health, search/filter, and connection tests', () => {
    const consoleService = new ProviderManagementConsole({
      configurationService: createPlatformConfigurationService(),
    });

    const registered = consoleService.registerProvider({
      id: 'acme-llm',
      name: 'Acme LLM',
      label: 'Acme Large Language Model',
      category: 'ai',
      enabled: true,
      metadata: {
        description: 'Acme managed model provider.',
        vendor: 'Acme',
        version: '2.1.0',
        tags: ['enterprise', 'llm'],
        healthStatus: 'healthy',
      },
      configuration: {
        endpoint: 'https://api.acme.example',
        timeoutMs: 10_000,
      },
      capabilities: [
        {
          id: 'cap-chat',
          name: 'chat.completions',
          description: 'Chat completion API',
          version: '1.0.0',
          tags: ['chat', 'text'],
          stability: 'stable',
          featureFlags: { streaming: true },
        },
      ],
    });

    expect(registered.id).toBe('acme-llm');
    expect(consoleService.getProvider('acme-llm')?.metadata.vendor).toBe('Acme');

    const editedConfiguration = consoleService.editConfiguration('acme-llm', {
      timeoutMs: 15_000,
      region: 'us-east-1',
    });
    expect(editedConfiguration.configuration.timeoutMs).toBe(15_000);
    expect(editedConfiguration.configuration.region).toBe('us-east-1');

    const updated = consoleService.updateProvider('acme-llm', {
      label: 'Acme LLM Production',
      metadata: {
        healthStatus: 'degraded',
        tags: ['enterprise', 'production'],
      },
      capabilities: [
        {
          id: 'cap-chat',
          name: 'chat.completions',
          description: 'Chat completion API',
          version: '1.1.0',
          tags: ['chat', 'text'],
          stability: 'stable',
        },
        {
          id: 'cap-embed',
          name: 'embeddings',
          description: 'Embeddings API',
          version: '1.0.0',
          tags: ['vectors'],
          stability: 'beta',
        },
      ],
    });

    expect(updated.label).toBe('Acme LLM Production');
    expect(updated.metadata.healthStatus).toBe('degraded');

    const capabilities = consoleService.viewCapabilities('acme-llm');
    expect(capabilities.map((capability) => capability.name)).toEqual(
      expect.arrayContaining(['chat.completions', 'embeddings']),
    );

    const healthSnapshots = consoleService.monitorHealth();
    expect(healthSnapshots.some((snapshot) => snapshot.providerId === 'acme-llm')).toBe(true);
    expect(consoleService.getHealthStatus('acme-llm')).toBe('degraded');

    const searchResults = consoleService.listProviders({
      search: 'acme',
      category: 'ai',
      enabled: true,
      healthStatus: 'degraded',
      capability: 'embeddings',
      tags: ['enterprise'],
    });
    expect(searchResults.some((provider) => provider.id === 'acme-llm')).toBe(true);

    const disabled = consoleService.disableProvider('acme-llm');
    expect(disabled.enabled).toBe(false);
    const enabled = consoleService.enableProvider('acme-llm');
    expect(enabled.enabled).toBe(true);

    const testResult = consoleService.testConnection('acme-llm');
    expect(testResult.providerId).toBe('acme-llm');
    expect(typeof testResult.latencyMs).toBe('number');

    expect(consoleService.deleteProvider('acme-llm')).toBe(true);
    expect(consoleService.getProvider('acme-llm')).toBeUndefined();
  });

  it('supports tool registration, enable-disable, metadata, permissions, categories, and configuration', () => {
    const consoleService = new ToolManagementConsole({
      configurationService: createPlatformConfigurationService(),
    });

    const registered = consoleService.registerTool({
      id: 'incident-evidence-tool',
      name: 'Incident Evidence',
      description: 'Collects evidence for incident reviews.',
      enabled: true,
      category: 'Security',
      categories: ['Security', 'Utility'],
      metadata: {
        version: '1.0.0',
        vendor: 'Infrashield',
        description: 'Evidence collection tool.',
        tags: ['incident', 'evidence'],
        capabilities: ['collection', 'audit'],
      },
      permissions: {
        requiredPermissions: ['tools.read', 'tools.execute'],
        scopes: ['read', 'execute'],
      },
      configuration: { retentionDays: 30 },
    });

    expect(registered.id).toBe('incident-evidence-tool');
    expect(consoleService.listCategories()).toEqual(
      expect.arrayContaining(['Security', 'Utility']),
    );

    const configured = consoleService.configureTool('incident-evidence-tool', {
      retentionDays: 60,
      exportFormat: 'json',
    });
    expect(configured.configuration.retentionDays).toBe(60);
    expect(configured.configuration.exportFormat).toBe('json');

    const permissionsView = consoleService.getPermissionsView('incident-evidence-tool');
    expect(permissionsView.permissions.requiredPermissions).toContain('tools.execute');

    const disabled = consoleService.disableTool('incident-evidence-tool');
    expect(disabled.enabled).toBe(false);
    const enabled = consoleService.enableTool('incident-evidence-tool');
    expect(enabled.enabled).toBe(true);

    const connection = consoleService.testConnection('incident-evidence-tool');
    expect(connection.success).toBe(true);

    expect(consoleService.deleteTool('incident-evidence-tool')).toBe(true);
  });

  it('supports agent creation, tool and provider assignment, enable-disable, and runtime status', () => {
    const consoleService = new AgentManagementConsole({
      configurationService: createPlatformConfigurationService(),
    });

    const created = consoleService.createAgent({
      id: 'incident-agent',
      name: 'Incident Agent',
      description: 'Handles incident response flows.',
      type: 'OperationsAgent',
      enabled: true,
      tools: ['incident-summary-tool'],
      providers: ['openai'],
      policy: {
        executionLimit: 5,
        timeoutMs: 45_000,
        approvalRequired: true,
      },
      runtime: {
        status: 'registered',
        mode: 'scheduled',
      },
      configuration: { owner: 'sre-team' },
    });

    expect(created.id).toBe('incident-agent');
    expect(consoleService.assignTools('incident-agent', ['policy-lint-tool']).tools).toContain(
      'policy-lint-tool',
    );
    expect(consoleService.assignProviders('incident-agent', ['anthropic']).providers).toContain(
      'anthropic',
    );
    expect(consoleService.getRuntimeStatus('incident-agent')).toBe('registered');

    const heartbeat = consoleService.simulateHeartbeat('incident-agent');
    expect(heartbeat.runtime.lastHeartbeatAt).toBeDefined();

    expect(consoleService.disableAgent('incident-agent').enabled).toBe(false);
    expect(consoleService.enableAgent('incident-agent').enabled).toBe(true);
    expect(consoleService.deleteAgent('incident-agent')).toBe(true);
  });

  it('supports workflow CRUD, agent assignment, execution policies, schedule metadata, and status', () => {
    const consoleService = new WorkflowManagementConsole({
      configurationService: createPlatformConfigurationService(),
    });

    const created = consoleService.createWorkflow({
      id: 'incident-automation',
      name: 'Incident Automation',
      description: 'Automates incident workflow execution.',
      enabled: true,
      agents: ['operations-agent'],
      executionPolicy: {
        kind: 'approval',
        metadata: { tier: 'gold' },
        dependsOn: [],
        timeoutMs: 1_800_000,
        approvalRequired: true,
      },
      schedule: {
        enabled: true,
        cron: '0 * * * *',
        timezone: 'UTC',
      },
      status: 'registered',
      configuration: { maxRetries: 2 },
    });

    expect(created.id).toBe('incident-automation');
    expect(
      consoleService.assignAgents('incident-automation', ['operations-agent', 'security-agent'])
        .agents,
    ).toContain('security-agent');

    const policy = consoleService.configureExecutionPolicy('incident-automation', {
      kind: 'retry',
      retryCount: 3,
      timeoutMs: 2_400_000,
      metadata: { tier: 'gold', change: 'retry-mode' },
    });
    expect(policy.executionPolicy.kind).toBe('retry');
    expect(
      consoleService.configureSchedule('incident-automation', { enabled: false }).schedule.enabled,
    ).toBe(false);
    expect(consoleService.getStatus('incident-automation')).toBe('registered');
    expect(consoleService.getExecutionPolicySnapshot('incident-automation').kind).toBe('retry');
    expect(consoleService.deleteWorkflow('incident-automation')).toBe(true);
  });

  it('supports AI model management, routing, defaults, guardrails, prompt templates, and mock connectivity', () => {
    const consoleService = new AIModelManagementConsole({
      configurationService: createPlatformConfigurationService(),
    });

    const registered = consoleService.registerModel({
      id: 'gemini-2-5-pro',
      providerId: 'gemini',
      family: 'general',
      name: 'Gemini 2.5 Pro',
      version: '2025-06-01',
      enabled: true,
      isDefault: false,
      capabilities: ['chat', 'reasoning', 'structured-output'],
      routingPolicy: {
        strategy: 'priority',
        fallbackModelIds: ['openai-gpt-4-1'],
        preferDefault: true,
      },
      costLimits: {
        maxTokensPerRequest: 12000,
        maxCostPerMonth: 300,
        currency: 'USD',
      },
      guardrails: [
        {
          id: 'safe-output',
          name: 'Safe Output',
          enabled: true,
          rules: ['output.audit'],
        },
      ],
      promptTemplates: [
        {
          id: 'incident-summary',
          name: 'Incident Summary',
          enabled: true,
          template: 'Summarize the incident.',
          variables: ['incidentId'],
        },
      ],
      connectivity: {
        status: 'unknown',
        message: 'Pending validation.',
      },
      metadata: { tier: 'enterprise' },
    });

    expect(registered.providerId).toBe('gemini');
    expect(
      consoleService.configureRoutingPolicy('gemini-2-5-pro', { strategy: 'fallback' })
        .routingPolicy.strategy,
    ).toBe('fallback');
    expect(
      consoleService.configureCostLimits('gemini-2-5-pro', { maxCostPerMonth: 250 }).costLimits
        .maxCostPerMonth,
    ).toBe(250);
    expect(
      consoleService.configureGuardrails('gemini-2-5-pro', registered.guardrails).guardrails,
    ).toHaveLength(1);
    expect(
      consoleService.configurePromptTemplates('gemini-2-5-pro', registered.promptTemplates)
        .promptTemplates,
    ).toHaveLength(1);
    expect(consoleService.setDefaultModel('gemini-2-5-pro').isDefault).toBe(true);
    expect(consoleService.mockConnectivity('gemini-2-5-pro').success).toBe(true);
    expect(consoleService.disableModel('gemini-2-5-pro').enabled).toBe(false);
    expect(consoleService.enableModel('gemini-2-5-pro').enabled).toBe(true);
    expect(
      consoleService
        .listModels({ providerId: 'gemini', enabled: true })
        .some((model) => model.id === 'gemini-2-5-pro'),
    ).toBe(true);
    expect(consoleService.deleteModel('gemini-2-5-pro')).toBe(true);
  });

  it('supports branding, theme, navigation, feature flags, global configuration, and system settings', () => {
    const consoleService = new PlatformSettingsConsole({
      configurationService: createPlatformConfigurationService(),
    });

    const branding = consoleService.updateBranding({
      productName: 'Infrashield Ops',
      applicationName: 'Admin Console',
      supportUrl: 'https://support.example.invalid',
    });
    expect(branding.branding.productName).toBe('Infrashield Ops');

    const theme = consoleService.setTheme('custom', {
      accentColor: '#123456',
      customCss: '.app { color: #123456; }',
    });
    expect(theme.activeTheme).toBe('custom');

    const updatedNavigation = consoleService.updateNavigation([
      {
        id: 'admin',
        title: 'Administration',
        href: '/admin',
        description: 'Admin surface',
        enabled: true,
        order: 1,
      },
    ]);
    expect(updatedNavigation.navigation).toHaveLength(1);

    const flags = consoleService.updateFeatureFlags([
      { id: 'admin-console', enabled: true, description: 'Enable admin console.' },
    ]);
    expect(flags.featureFlags[0]?.id).toBe('admin-console');

    const globalConfiguration = consoleService.updateGlobalConfiguration({
      environment: 'production',
      cluster: 'primary',
    });
    expect(globalConfiguration.globalConfiguration.cluster).toBe('primary');

    const systemSettings = consoleService.updateSystemSettings({
      timezone: 'America/New_York',
      maintenanceMode: true,
    });
    expect(systemSettings.systemSettings.maintenanceMode).toBe(true);
  });
});
