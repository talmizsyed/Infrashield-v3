import type {
  Identifier,
  SerializableValue,
  SerializableValueObject,
} from '@infrashield/contracts';

import type { IExecutionContext, IExecutionResult } from './execution.js';

/**
 * Memory provider contract for durable or ephemeral state access.
 */
export interface IMemoryProvider {
  readonly providerId: Identifier;
  readonly name: string;
  readonly version: string;

  read(key: string, context: IExecutionContext): Promise<SerializableValue | undefined>;
  write(key: string, value: SerializableValue, context: IExecutionContext): Promise<void>;
  delete(key: string, context: IExecutionContext): Promise<void>;
  search(
    query: SerializableValueObject,
    context: IExecutionContext,
  ): Promise<readonly SerializableValue[]>;
}

/**
 * Knowledge provider contract for retrieval and enrichment.
 */
export interface IKnowledgeProvider {
  readonly providerId: Identifier;
  readonly name: string;
  readonly version: string;

  query(
    query: SerializableValueObject,
    context: IExecutionContext,
  ): Promise<readonly SerializableValue[]>;
  retrieve(key: string, context: IExecutionContext): Promise<SerializableValue | undefined>;
  upsert(key: string, value: SerializableValue, context: IExecutionContext): Promise<void>;
  delete(key: string, context: IExecutionContext): Promise<void>;
}

/**
 * AI provider contract used for model-agnostic inference.
 */
export interface IAIProvider {
  readonly providerId: Identifier;
  readonly name: string;
  readonly version: string;

  invoke(
    request: SerializableValueObject,
    context: IExecutionContext,
  ): Promise<SerializableValueObject>;
}

/**
 * Workflow contract for orchestrated platform behavior.
 */
export interface IWorkflow {
  readonly workflowId: Identifier;
  readonly name: string;
  readonly version: string;
  readonly description?: string;

  execute(context: IExecutionContext): Promise<IExecutionResult>;
}

/**
 * Tool contract for reusable capability invocation.
 */
export interface ITool {
  readonly toolId: Identifier;
  readonly name: string;
  readonly version: string;
  readonly description?: string;

  execute(
    input: SerializableValueObject,
    context: IExecutionContext,
  ): Promise<SerializableValueObject>;
}

/**
 * Checkpointer contract for durable execution state.
 */
export interface ICheckpointer {
  readonly checkpointerId: Identifier;
  readonly name: string;
  readonly version: string;

  create(context: IExecutionContext): Promise<Identifier>;
  restore(checkpointId: Identifier): Promise<IExecutionContext | undefined>;
  delete(checkpointId: Identifier): Promise<void>;
  list(executionId?: Identifier): Promise<readonly Identifier[]>;
}
