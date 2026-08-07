import type { SerializableValueObject } from '@infrashield/contracts';

export type ThemeMode = 'dark' | 'light' | 'corporate' | 'custom';

export type ProviderKind =
  'vmware' | 'openshift' | 'oracle' | 'linux' | 'windows' | 'azure' | 'aws';

export type ToolCategoryName =
  | 'Infrastructure'
  | 'AI'
  | 'Security'
  | 'Workflow'
  | 'KnowledgeGraph'
  | 'Provider'
  | 'Utility'
  | 'Custom';

export type AgentRuntimeStatus =
  | 'registered'
  | 'initialized'
  | 'validated'
  | 'planned'
  | 'executing'
  | 'observing'
  | 'recovering'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'awaiting-approval'
  | 'idle'
  | 'disabled'
  | 'degraded';

export type WorkflowExecutionPolicyKind =
  | 'retry'
  | 'timeout'
  | 'compensation'
  | 'concurrency'
  | 'failure'
  | 'cancellation'
  | 'approval'
  | 'rate-limit';

export type AIModelRoutingStrategy = 'priority' | 'cost' | 'latency' | 'fallback';

export type AIModelConnectivityStatus = 'unknown' | 'connected' | 'degraded' | 'disconnected';

export interface ToolPermissionConfiguration {
  readonly requiredPermissions: readonly string[];
  readonly scopes: readonly string[];
}

export interface ToolMetadataConfiguration {
  version: string;
  vendor?: string;
  description?: string;
  readonly tags: readonly string[];
  readonly capabilities: readonly string[];
}

export interface ToolDefinitionConfiguration {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  category: ToolCategoryName;
  readonly categories: readonly ToolCategoryName[];
  metadata: ToolMetadataConfiguration;
  permissions: ToolPermissionConfiguration;
  configuration: Readonly<Record<string, unknown>>;
}

export interface AgentPolicyConfiguration {
  executionLimit: number;
  timeoutMs: number;
  approvalRequired: boolean;
}

export interface AgentRuntimeConfiguration {
  status: AgentRuntimeStatus;
  mode: 'interactive' | 'background' | 'scheduled' | 'event-driven';
  lastRunAt?: string;
  lastHeartbeatAt?: string;
  message?: string;
}

export interface DashboardWidgetConfiguration {
  id: string;
  title: string;
  enabled: boolean;
  order: number;
}

export interface DashboardConfiguration {
  title: string;
  widgets: DashboardWidgetConfiguration[];
}

export interface NavigationConfiguration {
  id: string;
  title: string;
  href: string;
  description: string;
  badge?: string;
  enabled: boolean;
  order: number;
}

export interface ThemeConfiguration {
  id: ThemeMode;
  label: string;
  enabled: boolean;
}

export interface ProviderConfiguration {
  id: ProviderKind;
  label: string;
  enabled: boolean;
}

export interface AiProviderConfiguration {
  id: string;
  label: string;
  enabled: boolean;
}

export interface AIModelRoutingPolicyConfiguration {
  strategy: AIModelRoutingStrategy;
  readonly fallbackModelIds: readonly string[];
  preferDefault: boolean;
}

export interface AIModelCostLimitsConfiguration {
  maxTokensPerRequest: number;
  maxCostPerMonth: number;
  currency: 'USD' | 'EUR' | 'GBP' | 'JPY';
}

export interface AIModelGuardrailConfiguration {
  id: string;
  name: string;
  enabled: boolean;
  description?: string;
  readonly rules: readonly string[];
}

export interface AIModelPromptTemplateConfiguration {
  id: string;
  name: string;
  enabled: boolean;
  template: string;
  readonly variables: readonly string[];
}

export interface AIModelConnectivityConfiguration {
  status: AIModelConnectivityStatus;
  lastCheckedAt?: string;
  message?: string;
}

export interface AIModelConfiguration {
  id: string;
  providerId: string;
  family: string;
  name: string;
  version: string;
  enabled: boolean;
  isDefault: boolean;
  readonly capabilities: readonly string[];
  routingPolicy: AIModelRoutingPolicyConfiguration;
  costLimits: AIModelCostLimitsConfiguration;
  readonly guardrails: readonly AIModelGuardrailConfiguration[];
  readonly promptTemplates: readonly AIModelPromptTemplateConfiguration[];
  connectivity: AIModelConnectivityConfiguration;
  metadata: SerializableValueObject;
}

export interface PromptTemplateConfiguration {
  id: string;
  name: string;
  enabled: boolean;
}

export interface AgentDefinitionConfiguration {
  id: string;
  name: string;
  enabled: boolean;
  description?: string;
  type?: string;
  readonly tools: readonly string[];
  readonly providers: readonly string[];
  policy: AgentPolicyConfiguration;
  runtime: AgentRuntimeConfiguration;
  configuration: Readonly<Record<string, unknown>>;
}

export interface WorkflowDefinitionConfiguration {
  id: string;
  name: string;
  enabled: boolean;
  description?: string;
  readonly agents: readonly string[];
  executionPolicy: {
    kind: WorkflowExecutionPolicyKind;
    metadata: SerializableValueObject;
    readonly dependsOn: readonly string[];
    timeoutMs?: number;
    retryCount?: number;
    approvalRequired?: boolean;
    concurrencyLimit?: number;
    schedule?: string;
  };
  schedule: {
    enabled: boolean;
    cron?: string;
    timezone?: string;
    nextRunAt?: string;
  };
  status: AgentRuntimeStatus;
  configuration: SerializableValueObject;
}

export interface PlatformBrandingConfiguration {
  productName: string;
  applicationName: string;
  logoUrl?: string;
  faviconUrl?: string;
  supportUrl?: string;
}

export interface PlatformSystemSettingsConfiguration {
  timezone: string;
  locale: string;
  maintenanceMode: boolean;
  auditRetentionDays: number;
  sessionTimeoutMinutes: number;
}

export interface PlatformSettingsConfiguration {
  branding: PlatformBrandingConfiguration;
  theme: {
    id: ThemeMode;
    accentColor?: string;
    customCss?: string;
  };
  navigation: NavigationConfiguration[];
  featureFlags: FeatureFlagConfiguration[];
  globalConfiguration: Readonly<Record<string, unknown>>;
  systemSettings: PlatformSystemSettingsConfiguration;
}

export interface KnowledgeGraphConfiguration {
  enabled: boolean;
  maxRelationships: number;
}

export interface SecurityPolicyConfiguration {
  id: string;
  name: string;
  enabled: boolean;
}

export interface RbacRoleConfiguration {
  id: string;
  name: string;
  permissions: string[];
}

export interface FeatureFlagConfiguration {
  id: string;
  enabled: boolean;
  description: string;
}

export interface NotificationConfiguration {
  id: string;
  channel: 'in-app' | 'email' | 'webhook';
  enabled: boolean;
}

export interface PlatformConfiguration {
  dashboard: DashboardConfiguration;
  navigation: NavigationConfiguration[];
  widgets: DashboardWidgetConfiguration[];
  themes: ThemeConfiguration[];
  providers: ProviderConfiguration[];
  aiProviders: AiProviderConfiguration[];
  aiModels: AIModelConfiguration[];
  toolDefinitions: ToolDefinitionConfiguration[];
  promptTemplates: PromptTemplateConfiguration[];
  agentDefinitions: AgentDefinitionConfiguration[];
  workflowDefinitions: WorkflowDefinitionConfiguration[];
  knowledgeGraph: KnowledgeGraphConfiguration;
  infrastructureProviders: ProviderConfiguration[];
  securityPolicies: SecurityPolicyConfiguration[];
  rbac: RbacRoleConfiguration[];
  featureFlags: FeatureFlagConfiguration[];
  notifications: NotificationConfiguration[];
  platformSettings: PlatformSettingsConfiguration;
}
