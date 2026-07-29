import type { Identifier, SerializableValueObject } from '@infrashield/contracts';

import type { IHealthStatus } from './common.js';
import type { ILifecycleHooks } from './hooks.js';

/**
 * Capability declared by a plugin.
 */
export interface IPluginCapability {
  readonly id: Identifier;
  readonly name: string;
  readonly description?: string;
  readonly version?: string;
}

/**
 * Dependency declared by a plugin.
 */
export interface IPluginDependency {
  readonly pluginId: Identifier;
  readonly versionRange: string;
  readonly optional?: boolean;
  readonly description?: string;
}

/**
 * Permission declared by a plugin.
 */
export interface IPluginPermission {
  readonly scope: string;
  readonly actions: readonly string[];
  readonly resources?: readonly string[];
  readonly description?: string;
}

/**
 * Configuration schema description for a plugin.
 */
export interface IPluginConfigurationSchema {
  readonly schemaVersion: string;
  readonly format: 'yaml' | 'json-schema' | 'object';
  readonly schema: SerializableValueObject;
}

/**
 * Health contract for a plugin instance.
 */
export interface IPluginHealth extends IHealthStatus {
  readonly pluginId: Identifier;
  readonly version: string;
}

/**
 * Lifecycle hooks dedicated to plugins.
 */
export interface IPluginLifecycleHooks extends ILifecycleHooks {}

/**
 * Plugin contract used to extend the platform.
 */
export interface IPlugin {
  readonly id: Identifier;
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly capabilities: readonly IPluginCapability[];
  readonly dependencies: readonly IPluginDependency[];
  readonly configurationSchema?: IPluginConfigurationSchema;
  readonly permissions: readonly IPluginPermission[];
  readonly health?: IPluginHealth;
  readonly lifecycleHooks?: IPluginLifecycleHooks;
}
