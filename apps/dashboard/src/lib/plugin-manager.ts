import { createPluginManagerWithSamples, type PluginManager } from '@infrashield/plugin-framework';

let pluginManager: PluginManager | undefined;

export function getPluginManager(): PluginManager {
  if (!pluginManager) {
    pluginManager = createPluginManagerWithSamples();
  }

  return pluginManager;
}
