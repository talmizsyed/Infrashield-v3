import type {
  CorrelationId,
  Identifier,
  SerializableValueObject,
  TimestampString,
} from '@infrashield/contracts';
import { ExecutionStatus } from '@infrashield/execution';

import type { ICancellationToken } from './common.js';
import type { IConfigurationProvider } from './config.js';
import type { IEventBus } from './events.js';
import type { ILogger, ITracer } from './logging.js';
import type {
  IAIProvider,
  ICheckpointer,
  IKnowledgeProvider,
  IMemoryProvider,
  ITool,
  IWorkflow,
} from './providers.js';

/**
 * Execution error contract used by the SDK.
 */
export interface IExecutionError {
  readonly code: string;
  readonly message: string;
  readonly correlationId?: CorrelationId;
  readonly details?: SerializableValueObject;
  readonly timestamp: TimestampString;
}

/**
 * Execution result contract returned by the executor and runtime.
 */
export interface IExecutionResult {
  readonly executionId: Identifier;
  readonly status: ExecutionStatus;
  readonly succeeded: boolean;
  readonly startedAt: TimestampString;
  readonly completedAt?: TimestampString;
  readonly output?: SerializableValueObject;
  readonly error?: IExecutionError;
}

/**
 * Runtime services exposed to execution contexts.
 */
export interface IRuntimeServices {
  readonly logger: ILogger;
  readonly tracer: ITracer;
  readonly eventBus: IEventBus;
  readonly memory?: IMemoryProvider;
  readonly knowledge?: IKnowledgeProvider;
  readonly ai?: IAIProvider;
  readonly workflow?: IWorkflow;
  readonly checkpointer?: ICheckpointer;
  readonly tools?: readonly ITool[];
}

/**
 * Execution context contract passed through middleware and executors.
 */
export interface IExecutionContext {
  readonly executionId: Identifier;
  readonly correlationId: CorrelationId;
  readonly traceId: Identifier;
  readonly conversationId?: Identifier;
  readonly variables: SerializableValueObject;
  readonly cancellationToken: ICancellationToken;
  readonly logger: ILogger;
  readonly runtime: IRuntimeServices;
  readonly configuration: IConfigurationProvider;
  readonly metadata?: SerializableValueObject;
}

/**
 * Executor contract for running an agent in a given execution context.
 */
export interface IAgentExecutor {
  execute(
    agent: import('./agent.js').IAgent,
    context: IExecutionContext,
  ): Promise<IExecutionResult>;
}

/**
 * Middleware contract for request/response pipeline composition.
 */
export interface IMiddleware {
  readonly middlewareId: Identifier;
  readonly name: string;
  readonly description?: string;

  execute(
    context: IExecutionContext,
    next: () => Promise<IExecutionResult>,
  ): Promise<IExecutionResult>;
}
