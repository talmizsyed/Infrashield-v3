import type {
  FeatureFlagConfiguration,
  NavigationConfiguration,
  PlatformConfiguration,
} from './types';

const widgets = [
  { id: 'InfrastructureHealth', title: 'Infrastructure Health', enabled: true, order: 10 },
  { id: 'RuntimeHealth', title: 'Runtime Health', enabled: true, order: 20 },
  { id: 'WorkflowStatus', title: 'Workflow Status', enabled: true, order: 30 },
  { id: 'SecurityOverview', title: 'Security Overview', enabled: true, order: 40 },
  { id: 'AgentHealth', title: 'Agent Health', enabled: true, order: 50 },
  { id: 'KnowledgeGraph', title: 'Knowledge Graph', enabled: true, order: 60 },
];

const infrastructureProviders = [
  { id: 'vmware', label: 'VMware', enabled: true },
  { id: 'openshift', label: 'OpenShift', enabled: true },
  { id: 'oracle', label: 'Oracle', enabled: true },
  { id: 'linux', label: 'Linux', enabled: true },
  { id: 'windows', label: 'Windows', enabled: true },
  { id: 'azure', label: 'Azure', enabled: true },
  { id: 'aws', label: 'AWS', enabled: true },
] as const;

const defaultToolDefinitions = [
  {
    id: 'incident-summary-tool',
    name: 'Incident Summary',
    description: 'Summarizes incident context for operators.',
    enabled: true,
    category: 'Workflow',
    categories: ['Workflow', 'Utility'],
    metadata: {
      version: '1.0.0',
      vendor: 'Infrashield',
      description: 'Incident summarization tool.',
      tags: ['incident', 'summary'],
      capabilities: ['summarization', 'contextualization'],
    },
    permissions: {
      requiredPermissions: ['tools.read', 'tools.execute'],
      scopes: ['read', 'execute'],
    },
    configuration: { timeoutMs: 15_000, maxTokens: 4096 },
  },
  {
    id: 'policy-lint-tool',
    name: 'Policy Lint',
    description: 'Validates policy metadata and execution constraints.',
    enabled: true,
    category: 'Security',
    categories: ['Security', 'Utility'],
    metadata: {
      version: '1.0.0',
      vendor: 'Infrashield',
      description: 'Policy validation tool.',
      tags: ['policy', 'security'],
      capabilities: ['validation', 'linting'],
    },
    permissions: {
      requiredPermissions: ['tools.read'],
      scopes: ['read'],
    },
    configuration: { strict: true },
  },
] as const;

const defaultAiModels = [
  {
    id: 'openai-gpt-4-1',
    providerId: 'openai',
    family: 'general',
    name: 'GPT-4.1',
    version: '2025-04-14',
    enabled: true,
    isDefault: true,
    capabilities: ['chat', 'structured-output', 'tool-calling'],
    routingPolicy: {
      strategy: 'priority',
      fallbackModelIds: ['anthropic-claude-3-7-sonnet'],
      preferDefault: true,
    },
    costLimits: {
      maxTokensPerRequest: 8192,
      maxCostPerMonth: 500,
      currency: 'USD',
    },
    guardrails: [
      {
        id: 'pii-redaction',
        name: 'PII Redaction',
        enabled: true,
        description: 'Mask sensitive user content before routing.',
        rules: ['redact.pii', 'audit.prompt'],
      },
    ],
    promptTemplates: [
      {
        id: 'ops-summary',
        name: 'Operations Summary',
        enabled: true,
        template: 'Summarize the incident in three bullets.',
        variables: ['incidentId', 'severity'],
      },
    ],
    connectivity: {
      status: 'connected',
      message: 'Mock connectivity available.',
    },
    metadata: { tier: 'enterprise', region: 'global' },
  },
  {
    id: 'anthropic-claude-3-7-sonnet',
    providerId: 'anthropic',
    family: 'reasoning',
    name: 'Claude 3.7 Sonnet',
    version: '2025-02-20',
    enabled: true,
    isDefault: false,
    capabilities: ['chat', 'reasoning'],
    routingPolicy: {
      strategy: 'fallback',
      fallbackModelIds: [],
      preferDefault: false,
    },
    costLimits: {
      maxTokensPerRequest: 4096,
      maxCostPerMonth: 250,
      currency: 'USD',
    },
    guardrails: [],
    promptTemplates: [],
    connectivity: {
      status: 'connected',
      message: 'Mock connectivity available.',
    },
    metadata: { tier: 'standard' },
  },
] as const;

const defaultPlatformSettings = {
  branding: {
    productName: 'Infrashield',
    applicationName: 'Administration Console',
    supportUrl: 'https://example.invalid/support',
  },
  theme: {
    id: 'dark' as const,
    accentColor: '#0ea5e9',
    customCss: '',
  },
  navigation: [] as NavigationConfiguration[],
  featureFlags: [] as FeatureFlagConfiguration[],
  globalConfiguration: {
    environment: 'development',
    region: 'local',
  },
  systemSettings: {
    timezone: 'UTC',
    locale: 'en-US',
    maintenanceMode: false,
    auditRetentionDays: 90,
    sessionTimeoutMinutes: 30,
  },
};

export function createDefaultPlatformConfiguration(): PlatformConfiguration {
  return {
    dashboard: { title: 'Executive Dashboard', widgets: widgets.map((widget) => ({ ...widget })) },
    widgets: widgets.map((widget) => ({ ...widget })),
    navigation: [
      {
        id: 'dashboard',
        title: 'Dashboard',
        href: '/',
        description: 'Platform overview and operational health',
        badge: 'Live',
        enabled: true,
        order: 10,
      },
      {
        id: 'infrastructure',
        title: 'Infrastructure',
        href: '/infrastructure',
        description: 'Cluster posture and environment health',
        enabled: true,
        order: 20,
      },
      {
        id: 'openshift',
        title: 'OpenShift',
        href: '/openshift',
        description: 'Control plane and node readiness',
        enabled: true,
        order: 30,
      },
      {
        id: 'vmware',
        title: 'VMware',
        href: '/vmware',
        description: 'Virtual infrastructure and workload health',
        enabled: true,
        order: 40,
      },
      {
        id: 'providers',
        title: 'AI Providers',
        href: '/ai-providers',
        description: 'Model health and provider routing',
        enabled: true,
        order: 50,
      },
      {
        id: 'agents',
        title: 'Agents',
        href: '/agents',
        description: 'Runtime fleet and execution status',
        enabled: true,
        order: 60,
      },
      {
        id: 'workflows',
        title: 'Workflow Studio',
        href: '/workflows',
        description: 'Execution graphs and orchestration state',
        enabled: true,
        order: 70,
      },
      {
        id: 'knowledge',
        title: 'Knowledge Graph',
        href: '/knowledge-graph',
        description: 'Context memory and retrieval topology',
        enabled: true,
        order: 80,
      },
      {
        id: 'security',
        title: 'Security',
        href: '/security',
        description: 'Threats, vulnerabilities, and posture',
        enabled: true,
        order: 90,
      },
      {
        id: 'governance',
        title: 'Governance',
        href: '/governance',
        description: 'Policies, approvals, and controls',
        enabled: true,
        order: 100,
      },
      {
        id: 'observability',
        title: 'Observability',
        href: '/observability',
        description: 'Tracing, analytics, and audit surfaces',
        enabled: true,
        order: 110,
      },
      {
        id: 'settings',
        title: 'Settings',
        href: '/settings',
        description: 'Workspace preferences and integrations',
        enabled: true,
        order: 120,
      },
    ],
    themes: [
      { id: 'dark', label: 'Dark', enabled: true },
      { id: 'light', label: 'Light', enabled: true },
      { id: 'corporate', label: 'Corporate', enabled: true },
      { id: 'custom', label: 'Custom', enabled: true },
    ],
    providers: infrastructureProviders.map((provider) => ({ ...provider })),
    aiProviders: [
      { id: 'openai', label: 'OpenAI', enabled: true },
      { id: 'anthropic', label: 'Anthropic', enabled: true },
      { id: 'gemini', label: 'Gemini', enabled: true },
    ],
    aiModels: defaultAiModels.map((model) => ({
      ...model,
      capabilities: [...model.capabilities],
      routingPolicy: {
        ...model.routingPolicy,
        fallbackModelIds: [...model.routingPolicy.fallbackModelIds],
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
    })),
    toolDefinitions: defaultToolDefinitions.map((tool) => ({
      ...tool,
      categories: [...tool.categories],
      metadata: {
        ...tool.metadata,
        tags: [...tool.metadata.tags],
        capabilities: [...tool.metadata.capabilities],
      },
      permissions: {
        ...tool.permissions,
        requiredPermissions: [...tool.permissions.requiredPermissions],
        scopes: [...tool.permissions.scopes],
      },
      configuration: { ...tool.configuration },
    })),
    promptTemplates: [{ id: 'operations-summary', name: 'Operations Summary', enabled: true }],
    agentDefinitions: [
      {
        id: 'operations-agent',
        name: 'Operations Agent',
        enabled: true,
        description: 'Primary incident operations agent.',
        type: 'OperationsAgent',
        tools: ['incident-summary-tool', 'policy-lint-tool'],
        providers: ['openai'],
        policy: {
          executionLimit: 3,
          timeoutMs: 30_000,
          approvalRequired: false,
        },
        runtime: {
          status: 'registered',
          mode: 'interactive',
          message: 'Mock runtime state.',
        },
        configuration: { profile: 'operations' },
      },
    ],
    workflowDefinitions: [
      {
        id: 'incident-response',
        name: 'Incident Response',
        enabled: true,
        description: 'Standard incident response workflow.',
        agents: ['operations-agent'],
        executionPolicy: {
          kind: 'approval',
          metadata: { tier: 'standard' },
          dependsOn: [],
          timeoutMs: 3_600_000,
          approvalRequired: true,
        },
        schedule: {
          enabled: false,
          cron: '0 */6 * * *',
          timezone: 'UTC',
        },
        status: 'registered',
        configuration: { owner: 'platform-operator' },
      },
    ],
    knowledgeGraph: { enabled: true, maxRelationships: 10000 },
    infrastructureProviders: infrastructureProviders.map((provider) => ({ ...provider })),
    securityPolicies: [{ id: 'zero-trust-baseline', name: 'Zero Trust Baseline', enabled: true }],
    rbac: [
      { id: 'platform-operator', name: 'Platform Operator', permissions: ['configuration.read'] },
    ],
    featureFlags: [
      { id: 'executive-dashboard', enabled: true, description: 'Enable the executive dashboard.' },
    ],
    notifications: [{ id: 'in-app-alerts', channel: 'in-app', enabled: true }],
    platformSettings: {
      branding: { ...defaultPlatformSettings.branding },
      theme: { ...defaultPlatformSettings.theme },
      navigation: defaultPlatformSettings.navigation.map((item) => ({ ...item })),
      featureFlags: defaultPlatformSettings.featureFlags.map((flag) => ({ ...flag })),
      globalConfiguration: { ...defaultPlatformSettings.globalConfiguration },
      systemSettings: { ...defaultPlatformSettings.systemSettings },
    },
  };
}
