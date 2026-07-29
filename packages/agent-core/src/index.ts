import type { Context } from '@infrashield/context';
import type { Identifier, Result, SerializableValueObject } from '@infrashield/contracts';

/**
 * Agent identity categories supported by the kernel.
 */
export enum AgentType {
  System = 'system',
  Domain = 'domain',
  Utility = 'utility',
  Composite = 'composite',
}

/**
 * Declares a single capability that an agent can provide.
 */
export interface AgentCapability {
  readonly name: string;
  readonly description?: string;
  readonly categories?: readonly string[];
}

/**
 * Metadata that describes an agent implementation.
 */
export interface AgentMetadata {
  readonly agentId: Identifier;
  readonly name: string;
  readonly description?: string;
  readonly version: string;
  readonly type: AgentType;
  readonly capabilities: readonly AgentCapability[];
}

/**
 * Structured agent configuration values.
 */
export interface AgentConfiguration {
  readonly agentId: Identifier;
  readonly parameters?: SerializableValueObject;
  readonly enabled: boolean;
}

/**
 * Lifecycle state for a kernel agent.
 */
export enum AgentLifecycleState {
  Initialized = 'initialized',
  Starting = 'starting',
  Running = 'running',
  Paused = 'paused',
  Terminating = 'terminating',
  Terminated = 'terminated',
}

/**
 * Lifecycle contract for kernel agents.
 */
export interface AgentLifecycle {
  readonly currentState: AgentLifecycleState;
  initialize(): Promise<Result<void>>;
  activate(): Promise<Result<void>>;
  pause(): Promise<Result<void>>;
  resume(): Promise<Result<void>>;
  terminate(): Promise<Result<void>>;
}

/**
 * Run-time state information for an agent.
 */
export interface AgentState {
  readonly agentId: Identifier;
  readonly status: AgentLifecycleState;
  readonly lastUpdatedAt: string;
  readonly details?: SerializableValueObject;
}

/**
 * Kernel agent interface for reusable agent contracts.
 */
export interface Agent {
  readonly metadata: AgentMetadata;
  readonly configuration: AgentConfiguration;
  readonly state: AgentState;
  readonly lifecycle: AgentLifecycle;

  /**
   * Returns the unique agent identifier.
   */
  getId(): Identifier;

  /**
   * Returns run-time context for the agent.
   */
  getContext(): Context;
}

/**
 * Factory capable of creating kernel agents.
 */
export interface AgentFactory {
  createAgent(configuration: AgentConfiguration, context: Context): Agent;
}

/**
 * Registry of kernel agents.
 */
export interface AgentRegistry {
  registerAgent(agent: Agent): void;
  getAgent(agentId: Identifier): Agent | undefined;
  listAgents(): readonly Agent[];
  removeAgent(agentId: Identifier): boolean;
}
