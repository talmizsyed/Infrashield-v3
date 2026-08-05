import { PluginLoader } from './loader';
import { PluginRegistry, ProviderRegistry } from './registry';
import type {
  PluginContext,
  PluginHealth,
  PluginLifecycle,
  PluginMetadata,
  ProviderRegistration,
} from './types';
import { validatePluginConfiguration, validatePluginManifest } from './validation';

export class PluginManager implements PluginLifecycle {
  public readonly pluginRegistry = new PluginRegistry();
  public readonly providerRegistry = new ProviderRegistry();

  public constructor(public readonly loader: PluginLoader = new PluginLoader()) {}

  public install(
    pluginId: string,
    configuration: Record<string, string | number | boolean> = {},
  ): PluginMetadata {
    const definition = this.loader.load(pluginId);
    validatePluginManifest(definition.manifest);
    const mergedConfiguration = { ...definition.defaultConfiguration, ...configuration };
    validatePluginConfiguration(definition, mergedConfiguration);

    const metadata: PluginMetadata = {
      manifest: definition.manifest,
      state: 'installed',
      installedAt: new Date().toISOString(),
      configuration: mergedConfiguration,
    };
    this.pluginRegistry.register(metadata);
    return metadata;
  }

  public enable(pluginId: string): PluginMetadata {
    const plugin = this.getRequiredPlugin(pluginId);
    this.assertDependencies(plugin.manifest.dependencies);
    const enabledPlugin: PluginMetadata = {
      ...plugin,
      state: 'enabled',
      enabledAt: new Date().toISOString(),
    };
    this.pluginRegistry.register(enabledPlugin);
    this.registerProvider(enabledPlugin.manifest.id);
    return enabledPlugin;
  }

  public disable(pluginId: string): PluginMetadata {
    const plugin = this.getRequiredPlugin(pluginId);
    const disabledPlugin: PluginMetadata = { ...plugin, state: 'disabled', enabledAt: undefined };
    this.pluginRegistry.register(disabledPlugin);
    this.unregisterProvider(plugin.manifest.id);
    return disabledPlugin;
  }

  public upgrade(pluginId: string, version: string): PluginMetadata {
    const plugin = this.getRequiredPlugin(pluginId);
    const upgradedPlugin: PluginMetadata = {
      ...plugin,
      manifest: { ...plugin.manifest, version },
    };
    this.pluginRegistry.register(upgradedPlugin);
    return upgradedPlugin;
  }

  public remove(pluginId: string): void {
    this.getRequiredPlugin(pluginId);
    this.unregisterProvider(pluginId);
    this.pluginRegistry.remove(pluginId);
  }

  public checkHealth(pluginId: string): PluginHealth {
    const plugin = this.getRequiredPlugin(pluginId);
    return {
      pluginId,
      status: plugin.state === 'enabled' ? 'healthy' : 'unavailable',
      endpoint: plugin.manifest.healthEndpoint,
      checkedAt: new Date().toISOString(),
    };
  }

  public getContext(): PluginContext {
    return {
      registerProvider: (provider) => this.providerRegistry.register(provider),
      unregisterProvider: (providerId) => this.providerRegistry.unregister(providerId),
    };
  }

  private getRequiredPlugin(pluginId: string): PluginMetadata {
    const plugin = this.pluginRegistry.get(pluginId);
    if (!plugin) throw new Error(`Plugin ${pluginId} is not installed.`);
    return plugin;
  }

  private assertDependencies(dependencies: string[]): void {
    for (const dependency of dependencies) {
      if (this.pluginRegistry.get(dependency)?.state !== 'enabled') {
        throw new Error(`Plugin dependency ${dependency} must be enabled.`);
      }
    }
  }

  private registerProvider(pluginId: string): void {
    const definition = this.loader.load(pluginId);
    if (!definition.provider) return;
    const provider: ProviderRegistration = {
      ...definition.provider,
      pluginId,
      category: definition.manifest.category,
    };
    this.providerRegistry.register(provider);
  }

  private unregisterProvider(pluginId: string): void {
    const definition = this.loader.load(pluginId);
    if (definition.provider) this.providerRegistry.unregister(definition.provider.id);
  }
}
