import { describe, expect, it } from 'vitest';
import { createPluginManagerWithSamples } from './index';

describe('plugin framework', () => {
  it('loads sample plugins and registers enabled providers through the plugin manager', () => {
    const manager = createPluginManagerWithSamples();

    expect(manager.pluginRegistry.list()).toHaveLength(8);
    expect(manager.providerRegistry.list().map((provider) => provider.id)).toEqual(
      expect.arrayContaining(['vmware', 'openai', 'neo4j']),
    );
    expect(manager.checkHealth('vmware').status).toBe('healthy');
  });

  it('supports disable, upgrade, and remove lifecycle operations', () => {
    const manager = createPluginManagerWithSamples();

    expect(manager.disable('ollama').state).toBe('disabled');
    expect(manager.providerRegistry.get('ollama')).toBeUndefined();
    expect(manager.upgrade('ollama', '1.1.0').manifest.version).toBe('1.1.0');
    manager.remove('ollama');
    expect(manager.pluginRegistry.get('ollama')).toBeUndefined();
  });
});
