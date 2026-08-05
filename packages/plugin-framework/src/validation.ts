import type { PluginDefinition, PluginManifest } from './types';

export function validatePluginManifest(manifest: PluginManifest): void {
  if (!manifest.id || !manifest.name || !manifest.version || !manifest.vendor) {
    throw new Error('Plugin manifest requires id, name, version, and vendor.');
  }
  if (!manifest.healthEndpoint.startsWith('/')) {
    throw new Error(`Plugin ${manifest.id} must expose an absolute health endpoint.`);
  }
}

export function validatePluginConfiguration(
  definition: PluginDefinition,
  configuration: Record<string, string | number | boolean>,
): void {
  for (const field of definition.manifest.configurationSchema) {
    const value = configuration[field.key];
    if (field.required && typeof value === 'undefined') {
      throw new Error(
        `Plugin ${definition.manifest.id} requires configuration value ${field.key}.`,
      );
    }
    if (typeof value !== 'undefined' && typeof value !== field.type) {
      throw new Error(
        `Plugin ${definition.manifest.id} configuration value ${field.key} must be ${field.type}.`,
      );
    }
  }
}
