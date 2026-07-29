import type {
  CorrelationId,
  Identifier,
  SerializableValue,
  SerializableValueObject,
  TimestampString,
} from '@infrashield/contracts';

/**
 * Serializable payload contract used by platform events.
 */
export interface ISerializableEventPayload {
  readonly [key: string]: SerializableValue | undefined;
}

/**
 * Base event contract shared by the SDK event bus and adapters.
 */
export interface IPlatformEvent<
  TEventType extends string = string,
  TPayload extends ISerializableEventPayload = ISerializableEventPayload,
> {
  readonly eventId: Identifier;
  readonly eventType: TEventType;
  readonly timestamp: TimestampString;
  readonly correlationId?: CorrelationId;
  readonly traceId?: Identifier;
  readonly executionId?: Identifier;
  readonly source?: string;
  readonly metadata?: SerializableValueObject;
  readonly payload: TPayload;
}

/**
 * Execution event payload contract.
 */
export interface IExecutionEventPayload extends ISerializableEventPayload {
  readonly executionId: Identifier;
  readonly agentId?: Identifier;
  readonly runtimeId?: Identifier;
  readonly status?: string;
}

/**
 * Tool event payload contract.
 */
export interface IToolEventPayload extends ISerializableEventPayload {
  readonly toolId: Identifier;
  readonly executionId?: Identifier;
  readonly input?: SerializableValueObject;
  readonly output?: SerializableValueObject;
}

/**
 * Memory event payload contract.
 */
export interface IMemoryEventPayload extends ISerializableEventPayload {
  readonly providerId: Identifier;
  readonly key: string;
  readonly namespace?: string;
  readonly value?: SerializableValueObject;
}

/**
 * Knowledge event payload contract.
 */
export interface IKnowledgeEventPayload extends ISerializableEventPayload {
  readonly providerId: Identifier;
  readonly query: SerializableValueObject;
  readonly resultCount?: number;
}

/**
 * Prompt event payload contract.
 */
export interface IPromptEventPayload extends ISerializableEventPayload {
  readonly promptId: Identifier;
  readonly templateId?: Identifier;
  readonly variables?: SerializableValueObject;
}

/**
 * Model event payload contract.
 */
export interface IModelEventPayload extends ISerializableEventPayload {
  readonly providerId: Identifier;
  readonly modelId: string;
  readonly request?: SerializableValueObject;
  readonly response?: SerializableValueObject;
}

/**
 * Workflow event payload contract.
 */
export interface IWorkflowEventPayload extends ISerializableEventPayload {
  readonly workflowId: Identifier;
  readonly executionId?: Identifier;
}

/**
 * Plugin event payload contract.
 */
export interface IPluginEventPayload extends ISerializableEventPayload {
  readonly pluginId: Identifier;
  readonly version: string;
}

/**
 * Execution started event contract.
 */
export interface IExecutionStartedEvent extends IPlatformEvent<
  'execution.started',
  IExecutionEventPayload
> {}

/**
 * Execution completed event contract.
 */
export interface IExecutionCompletedEvent extends IPlatformEvent<
  'execution.completed',
  IExecutionEventPayload
> {}

/**
 * Execution failed event contract.
 */
export interface IExecutionFailedEvent extends IPlatformEvent<
  'execution.failed',
  IExecutionEventPayload
> {}

/**
 * Tool invoked event contract.
 */
export interface IToolInvokedEvent extends IPlatformEvent<'tool.invoked', IToolEventPayload> {}

/**
 * Tool completed event contract.
 */
export interface IToolCompletedEvent extends IPlatformEvent<'tool.completed', IToolEventPayload> {}

/**
 * Memory read event contract.
 */
export interface IMemoryReadEvent extends IPlatformEvent<'memory.read', IMemoryEventPayload> {}

/**
 * Memory write event contract.
 */
export interface IMemoryWriteEvent extends IPlatformEvent<'memory.write', IMemoryEventPayload> {}

/**
 * Knowledge queried event contract.
 */
export interface IKnowledgeQueriedEvent extends IPlatformEvent<
  'knowledge.queried',
  IKnowledgeEventPayload
> {}

/**
 * Prompt generated event contract.
 */
export interface IPromptGeneratedEvent extends IPlatformEvent<
  'prompt.generated',
  IPromptEventPayload
> {}

/**
 * Model invoked event contract.
 */
export interface IModelInvokedEvent extends IPlatformEvent<'model.invoked', IModelEventPayload> {}

/**
 * Model completed event contract.
 */
export interface IModelCompletedEvent extends IPlatformEvent<
  'model.completed',
  IModelEventPayload
> {}

/**
 * Workflow started event contract.
 */
export interface IWorkflowStartedEvent extends IPlatformEvent<
  'workflow.started',
  IWorkflowEventPayload
> {}

/**
 * Workflow completed event contract.
 */
export interface IWorkflowCompletedEvent extends IPlatformEvent<
  'workflow.completed',
  IWorkflowEventPayload
> {}

/**
 * Plugin loaded event contract.
 */
export interface IPluginLoadedEvent extends IPlatformEvent<'plugin.loaded', IPluginEventPayload> {}

/**
 * Plugin unloaded event contract.
 */
export interface IPluginUnloadedEvent extends IPlatformEvent<
  'plugin.unloaded',
  IPluginEventPayload
> {}

/**
 * Union of all platform events emitted by the SDK.
 */
export type PlatformEvent =
  | IExecutionStartedEvent
  | IExecutionCompletedEvent
  | IExecutionFailedEvent
  | IToolInvokedEvent
  | IToolCompletedEvent
  | IMemoryReadEvent
  | IMemoryWriteEvent
  | IKnowledgeQueriedEvent
  | IPromptGeneratedEvent
  | IModelInvokedEvent
  | IModelCompletedEvent
  | IWorkflowStartedEvent
  | IWorkflowCompletedEvent
  | IPluginLoadedEvent
  | IPluginUnloadedEvent;

/**
 * Event subscription contract used by the event bus.
 */
export interface IEventSubscription {
  readonly subscriptionId: Identifier;
  readonly eventType: string;
  readonly active: boolean;

  dispose(): Promise<void> | void;
}

/**
 * Event bus contract for publishing and observing platform events.
 */
export interface IEventBus<TEvent extends IPlatformEvent = PlatformEvent> {
  publish(event: TEvent): Promise<void>;
  subscribe<TSubscribedEvent extends TEvent>(
    eventType: TSubscribedEvent['eventType'],
    handler: (event: TSubscribedEvent) => Promise<void> | void,
  ): Promise<IEventSubscription>;
  unsubscribe(subscriptionId: Identifier): Promise<void>;
}
