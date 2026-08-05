export type PluginCategory =
  | 'infrastructure'
  | 'ai'
  | 'observability'
  | 'security'
  | 'workflow'
  | 'knowledge-graph'
  | 'authentication'
  | 'storage'
  | 'notification';

export type PluginPermission = 'configuration:read' | 'provider:register' | 'health:read';

export type PluginState = 'installed' | 'enabled' | 'disabled';

export type PluginHealthStatus = 'healthy' | 'degraded' | 'unavailable';

export interface PluginConfigurationField {
  key: string;
  type: 'string' | 'number' | 'boolean';
  required: boolean;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  vendor: string;
  category: PluginCategory;
  description: string;
  permissions: PluginPermission[];
  dependencies: string[];
  configurationSchema: PluginConfigurationField[];
  healthEndpoint: string;
}

export interface PluginMetadata {
  manifest: PluginManifest;
  state: PluginState;
  installedAt: string;
  enabledAt?: string;
  configuration: Record<string, string | number | boolean>;
}

export interface PluginHealth {
  pluginId: string;
  status: PluginHealthStatus;
  endpoint: string;
  checkedAt: string;
}

export interface ProviderRegistration {
  id: string;
  name: string;
  pluginId: string;
  category: PluginCategory;
}

export interface PluginContext {
  registerProvider(provider: ProviderRegistration): void;
  unregisterProvider(providerId: string): void;
}

export interface PluginDefinition {
  manifest: PluginManifest;
  defaultConfiguration: Record<string, string | number | boolean>;
  provider?: Omit<ProviderRegistration, 'pluginId' | 'category'>;
}

export interface PluginLifecycle {
  install(
    pluginId: string,
    configuration?: Record<string, string | number | boolean>,
  ): PluginMetadata;
  enable(pluginId: string): PluginMetadata;
  disable(pluginId: string): PluginMetadata;
  upgrade(pluginId: string, version: string): PluginMetadata;
  remove(pluginId: string): void;
  checkHealth(pluginId: string): PluginHealth;
}
