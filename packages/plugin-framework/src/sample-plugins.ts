import { PluginLoader } from './loader';
import { PluginManager } from './manager';
import type { PluginCategory, PluginDefinition } from './types';

function createProviderPlugin(
  id: string,
  name: string,
  category: PluginCategory,
  vendor: string,
): PluginDefinition {
  return {
    manifest: {
      id,
      name,
      version: '1.0.0',
      vendor,
      category,
      description: `${name} platform integration plugin.`,
      permissions: ['configuration:read', 'provider:register', 'health:read'],
      dependencies: [],
      configurationSchema: [{ key: 'enabled', type: 'boolean', required: true }],
      healthEndpoint: `/plugins/${id}/health`,
    },
    defaultConfiguration: { enabled: true },
    provider: { id, name },
  };
}

export const samplePlugins: PluginDefinition[] = [
  createProviderPlugin('vmware', 'VMware Plugin', 'infrastructure', 'VMware'),
  createProviderPlugin('openshift', 'OpenShift Plugin', 'infrastructure', 'Red Hat'),
  createProviderPlugin('oracle', 'Oracle Plugin', 'infrastructure', 'Oracle'),
  createProviderPlugin('linux', 'Linux Plugin', 'infrastructure', 'InfraShield'),
  createProviderPlugin('windows', 'Windows Plugin', 'infrastructure', 'Microsoft'),
  createProviderPlugin('neo4j', 'Neo4j Plugin', 'knowledge-graph', 'Neo4j'),
  createProviderPlugin('openai', 'OpenAI Plugin', 'ai', 'OpenAI'),
  createProviderPlugin('ollama', 'Ollama Plugin', 'ai', 'Ollama'),
];

export function createPluginManagerWithSamples(): PluginManager {
  const loader = new PluginLoader();
  for (const plugin of samplePlugins) loader.register(plugin);
  const manager = new PluginManager(loader);
  for (const plugin of samplePlugins) {
    manager.install(plugin.manifest.id);
    manager.enable(plugin.manifest.id);
  }
  return manager;
}
