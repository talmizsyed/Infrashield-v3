import type { Identifier, SerializableValueObject } from '@infrashield/contracts';

import type { IConfigurationProvider } from './config.js';
import type { IExecutionContext, IExecutionError, IExecutionResult } from './execution.js';

/**
 * Initialization hook context.
 */
export interface IInitializationContext {
  readonly runtimeId: Identifier;
  readonly configuration: IConfigurationProvider;
  readonly metadata?: SerializableValueObject;
}

/**
 * Completion hook context.
 */
export interface ICompletionContext {
  readonly execution: IExecutionContext;
  readonly result: IExecutionResult;
}

/**
 * Cancellation hook context.
 */
export interface ICancelContext {
  readonly execution: IExecutionContext;
  readonly reason?: string;
}

/**
 * Error hook context.
 */
export interface IErrorContext {
  readonly error: IExecutionError;
  readonly execution?: IExecutionContext;
  readonly metadata?: SerializableValueObject;
}

/**
 * Disposal hook context.
 */
export interface IDisposeContext {
  readonly runtimeId: Identifier;
  readonly metadata?: SerializableValueObject;
}

/**
 * Lifecycle hook contract shared by agents, plugins, and runtime services.
 */
export interface ILifecycleHooks {
  beforeInitialize?(context: IInitializationContext): Promise<void>;
  afterInitialize?(context: IInitializationContext): Promise<void>;
  beforeExecute?(context: IExecutionContext): Promise<void>;
  afterExecute?(context: IExecutionResult): Promise<void>;
  beforeComplete?(context: ICompletionContext): Promise<void>;
  beforeCancel?(context: ICancelContext): Promise<void>;
  onError?(context: IErrorContext): Promise<void>;
  onDispose?(context: IDisposeContext): Promise<void>;
}

/**
 * Lifecycle hooks dedicated to agents.
 */
export interface IAgentLifecycleHooks extends ILifecycleHooks {}
