import type { PluginDefinition } from './types';

export class PluginLoader {
  private readonly definitions = new Map<string, PluginDefinition>();

  public register(definition: PluginDefinition): void {
    this.definitions.set(definition.manifest.id, definition);
  }

  public load(pluginId: string): PluginDefinition {
    const definition = this.definitions.get(pluginId);
    if (!definition) throw new Error(`Plugin ${pluginId} is not available.`);
    return definition;
  }

  public list(): PluginDefinition[] {
    return [...this.definitions.values()];
  }
}
