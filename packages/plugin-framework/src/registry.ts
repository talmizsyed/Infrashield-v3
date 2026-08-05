import type { PluginMetadata, ProviderRegistration } from './types';

export class PluginRegistry {
  private readonly plugins = new Map<string, PluginMetadata>();

  public register(plugin: PluginMetadata): void {
    this.plugins.set(plugin.manifest.id, plugin);
  }

  public get(pluginId: string): PluginMetadata | undefined {
    return this.plugins.get(pluginId);
  }

  public remove(pluginId: string): void {
    this.plugins.delete(pluginId);
  }

  public list(): PluginMetadata[] {
    return [...this.plugins.values()].sort((left, right) =>
      left.manifest.name.localeCompare(right.manifest.name),
    );
  }
}

export class ProviderRegistry {
  private readonly providers = new Map<string, ProviderRegistration>();

  public register(provider: ProviderRegistration): void {
    this.providers.set(provider.id, provider);
  }

  public unregister(providerId: string): void {
    this.providers.delete(providerId);
  }

  public get(providerId: string): ProviderRegistration | undefined {
    return this.providers.get(providerId);
  }

  public list(): ProviderRegistration[] {
    return [...this.providers.values()].sort((left, right) => left.name.localeCompare(right.name));
  }
}
