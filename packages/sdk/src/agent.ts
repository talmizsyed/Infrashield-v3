import type { Identifier, SerializableValueObject } from '@infrashield/contracts';

import type { IHealthStatus } from './common.js';
import type { IConfigurationProvider } from './config.js';
import type { IExecutionContext, IExecutionResult, IAgentExecutor } from './execution.js';
import type { IEventBus } from './events.js';
import type { IAgentLifecycleHooks } from './hooks.js';
import type { ILogger, ITracer } from './logging.js';
import type { IAgentManifest } from './manifest.js';
import type { IPlugin } from './plugin.js';
import type { ITool } from './providers.js';

/**
 * Agent contract exposed through the public SDK.
 */
export interface IAgent {
  readonly id: Identifier;
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly capabilities: readonly string[];
  readonly plugins: readonly IPlugin[];
  readonly tools: readonly ITool[];
  readonly configuration?: IConfigurationProvider;
  readonly health?: IHealthStatus;
  readonly lifecycleHooks?: IAgentLifecycleHooks;
  readonly metadata?: SerializableValueObject;
}

/**
 * Builder contract used to convert manifests into runnable agents.
 */
export interface IAgentBuilder {
  build(manifest: IAgentManifest, context: IExecutionContext): Promise<IAgent>;
}

/**
 * Runtime contract that orchestrates agents, plugins, and tools.
 */
export interface IAgentRuntime {
  readonly runtimeId: Identifier;
  readonly name: string;
  readonly version: string;
  readonly configuration: IConfigurationProvider;
  readonly logger: ILogger;
  readonly tracer: ITracer;
  readonly eventBus: IEventBus;
  readonly agents: readonly IAgent[];
  readonly plugins: readonly IPlugin[];
  readonly tools: readonly ITool[];
  readonly lifecycleHooks?: IAgentLifecycleHooks;

  initialize(manifest?: IAgentManifest): Promise<void>;
  execute(
    executor: IAgentExecutor,
    context: IExecutionContext,
    agent: IAgent,
  ): Promise<IExecutionResult>;
  registerAgent(agent: IAgent): Promise<void>;
  registerPlugin(plugin: IPlugin): Promise<void>;
  registerTool(tool: ITool): Promise<void>;
  dispose(): Promise<void>;
}
