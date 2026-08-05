export type ThemeMode = 'dark' | 'light' | 'corporate' | 'custom';

export type ProviderKind =
  'vmware' | 'openshift' | 'oracle' | 'linux' | 'windows' | 'azure' | 'aws';

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

export interface PromptTemplateConfiguration {
  id: string;
  name: string;
  enabled: boolean;
}

export interface AgentDefinitionConfiguration {
  id: string;
  name: string;
  enabled: boolean;
}

export interface WorkflowDefinitionConfiguration {
  id: string;
  name: string;
  enabled: boolean;
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
  promptTemplates: PromptTemplateConfiguration[];
  agentDefinitions: AgentDefinitionConfiguration[];
  workflowDefinitions: WorkflowDefinitionConfiguration[];
  knowledgeGraph: KnowledgeGraphConfiguration;
  infrastructureProviders: ProviderConfiguration[];
  securityPolicies: SecurityPolicyConfiguration[];
  rbac: RbacRoleConfiguration[];
  featureFlags: FeatureFlagConfiguration[];
  notifications: NotificationConfiguration[];
}
