import type { Identifier, SerializableValueObject } from '@infrashield/contracts';

import type { IRetryPolicy } from './retry.js';

/**
 * Agent section of the manifest document.
 */
export interface IAgentManifestAgentSection {
  readonly id: Identifier;
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly capabilities?: readonly string[];
}

/**
 * Runtime section of the manifest document.
 */
export interface IAgentManifestRuntimeSection {
  readonly runtimeId?: Identifier;
  readonly environment?: string;
  readonly concurrency?: number;
  readonly retryPolicy?: IRetryPolicy;
  readonly metadata?: SerializableValueObject;
}

/**
 * Provider binding within the manifest document.
 */
export interface IAgentManifestProviderBinding {
  readonly providerId: Identifier;
  readonly version?: string;
  readonly configuration?: SerializableValueObject;
  readonly permissions?: readonly string[];
}

/**
 * Provider section of the manifest document.
 */
export interface IAgentManifestProvidersSection {
  readonly ai?: readonly IAgentManifestProviderBinding[];
  readonly memory?: readonly IAgentManifestProviderBinding[];
  readonly knowledge?: readonly IAgentManifestProviderBinding[];
}

/**
 * Memory section of the manifest document.
 */
export interface IAgentManifestMemorySection {
  readonly providerId: Identifier;
  readonly namespace?: string;
  readonly configuration?: SerializableValueObject;
}

/**
 * Knowledge section of the manifest document.
 */
export interface IAgentManifestKnowledgeSection {
  readonly providerId: Identifier;
  readonly namespace?: string;
  readonly configuration?: SerializableValueObject;
}

/**
 * Workflow section of the manifest document.
 */
export interface IAgentManifestWorkflowSection {
  readonly workflowId: Identifier;
  readonly enabled?: boolean;
  readonly configuration?: SerializableValueObject;
}

/**
 * Plugin section of the manifest document.
 */
export interface IAgentManifestPluginSection {
  readonly pluginId: Identifier;
  readonly version?: string;
  readonly enabled?: boolean;
  readonly configuration?: SerializableValueObject;
  readonly permissions?: readonly string[];
}

/**
 * Tool section of the manifest document.
 */
export interface IAgentManifestToolSection {
  readonly toolId: Identifier;
  readonly version?: string;
  readonly enabled?: boolean;
  readonly configuration?: SerializableValueObject;
}

/**
 * Agent manifest document contract.
 */
export interface IAgentManifest {
  readonly kind: 'agent-manifest';
  readonly apiVersion: string;
  readonly format: 'yaml';
  readonly agent: IAgentManifestAgentSection;
  readonly runtime: IAgentManifestRuntimeSection;
  readonly providers: IAgentManifestProvidersSection;
  readonly memory?: IAgentManifestMemorySection;
  readonly knowledge?: IAgentManifestKnowledgeSection;
  readonly workflow?: IAgentManifestWorkflowSection;
  readonly plugins?: readonly IAgentManifestPluginSection[];
  readonly tools?: readonly IAgentManifestToolSection[];
  readonly configuration?: SerializableValueObject;
}
