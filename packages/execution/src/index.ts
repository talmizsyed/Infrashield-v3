import type {
  CorrelationId,
  Identifier,
  Result,
  SerializableValueObject,
  TimestampString,
} from '@infrashield/contracts';
import type { Context } from '@infrashield/context';

/**
 * Execution engine lifecycle states.
 */
export enum ExecutionStatus {
  Created = 'created',
  Queued = 'queued',
  Scheduled = 'scheduled',
  Running = 'running',
  Paused = 'paused',
  Waiting = 'waiting',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
  TimedOut = 'timedOut',
  Retrying = 'retrying',
}

/**
 * Execution snapshot capturing state at a point in time.
 */
export interface ExecutionSnapshot {
  readonly snapshotId: Identifier;
  readonly executionId: Identifier;
  readonly status: ExecutionStatus;
  readonly timestamp: TimestampString;
  readonly metadata?: SerializableValueObject;
  readonly progress?: number;
  readonly details?: SerializableValueObject;
}

/**
 * Execution checkpoint contract for fault-tolerant resumes.
 */
export interface ExecutionCheckpoint {
  readonly checkpointId: Identifier;
  readonly executionId: Identifier;
  readonly createdAt: TimestampString;
  readonly state: ExecutionSnapshot;
}

/**
 * Execution result contract.
 */
export interface ExecutionResult {
  readonly executionId: Identifier;
  readonly status: ExecutionStatus;
  readonly succeeded: boolean;
  readonly startedAt: TimestampString;
  readonly completedAt?: TimestampString;
  readonly output?: SerializableValueObject;
  readonly error?: ExecutionError;
}

/**
 * Execution engine error contract.
 */
export interface ExecutionError {
  readonly code: string;
  readonly message: string;
  readonly correlationId?: CorrelationId;
  readonly details?: SerializableValueObject;
  readonly timestamp: TimestampString;
}

/**
 * Execution strategy contract for decision making.
 */
export interface ExecutionStrategy {
  readonly strategyId: Identifier;
  readonly name: string;
  readonly description?: string;
  readonly maxRetries?: number;
  readonly timeoutMs?: number;
}

/**
 * Options applied to an individual execution.
 */
export interface ExecutionOptions {
  readonly timeoutMs?: number;
  readonly retryCount?: number;
  readonly retryDelayMs?: number;
  readonly enableCheckpointing?: boolean;
  readonly metadata?: SerializableValueObject;
}

/**
 * Execution metrics collected during runtime.
 */
export interface ExecutionMetrics {
  readonly executionId: Identifier;
  readonly startTime: TimestampString;
  readonly endTime?: TimestampString;
  readonly durationMs?: number;
  readonly progress?: number;
  readonly retries: number;
  readonly checkpointCount: number;
}

/**
 * Execution statistics snapshot for observability.
 */
export interface ExecutionStatistics {
  readonly totalExecutions: number;
  readonly runningExecutions: number;
  readonly queuedExecutions: number;
  readonly failedExecutions: number;
  readonly completedExecutions: number;
  readonly cancelledExecutions: number;
  readonly timedOutExecutions: number;
}

/**
 * Execution hook contract for lifecycle events.
 */
export interface ExecutionHooks {
  beforeExecute?(context: ExecutionContext): Promise<void>;
  afterExecute?(result: ExecutionResult): Promise<void>;
  onError?(error: ExecutionError): Promise<void>;
  onRetry?(executionId: Identifier, attempt: number): Promise<void>;
}

/**
 * Execution validator contract.
 */
export interface ExecutionValidator {
  validate(context: ExecutionContext): Promise<Result<void>>;
}

/**
 * Execution interceptor contract for request interception.
 */
export interface ExecutionInterceptor {
  intercept(
    context: ExecutionContext,
    next: () => Promise<ExecutionResult>,
  ): Promise<ExecutionResult>;
}

/**
 * Execution middleware contract.
 */
export interface ExecutionMiddleware {
  execute(
    context: ExecutionContext,
    next: () => Promise<ExecutionResult>,
  ): Promise<ExecutionResult>;
}

/**
 * Execution step contract used in a pipeline.
 */
export interface ExecutionStep {
  readonly stepId: Identifier;
  readonly name: string;
  execute(context: ExecutionContext): Promise<ExecutionResult>;
}

/**
 * Execution pipeline contract.
 */
export interface ExecutionPipeline {
  readonly pipelineId: Identifier;
  readonly steps: readonly ExecutionStep[];
  run(context: ExecutionContext): Promise<ExecutionResult>;
}

/**
 * Execution manager contract for orchestration.
 */
export interface ExecutionManager {
  enqueue(context: ExecutionContext, options?: ExecutionOptions): Promise<ExecutionResult>;
  schedule(context: ExecutionContext, options?: ExecutionOptions): Promise<ExecutionResult>;
  cancel(executionId: Identifier): Promise<ExecutionResult>;
  pause(executionId: Identifier): Promise<ExecutionResult>;
  resume(executionId: Identifier): Promise<ExecutionResult>;
  getStatus(executionId: Identifier): Promise<ExecutionStatus>;
  getStatistics(): Promise<ExecutionStatistics>;
}

/**
 * Execution engine contract.
 */
export interface ExecutionEngine {
  readonly engineId: Identifier;
  readonly options: ExecutionOptions;
  readonly hooks?: ExecutionHooks;
  readonly interceptors?: readonly ExecutionInterceptor[];
  readonly middleware?: readonly ExecutionMiddleware[];
  readonly pipeline: ExecutionPipeline;

  execute(context: ExecutionContext): Promise<ExecutionResult>;
  createExecutionContext(requestContext: Context, options?: ExecutionOptions): ExecutionContext;
  getMetrics(executionId: Identifier): Promise<ExecutionMetrics>;
}

/**
 * Factory responsible for creating execution contexts.
 */
export interface ExecutionContextFactory {
  create(requestContext: Context, options?: ExecutionOptions): ExecutionContext;
}

/**
 * Execution context contract passed through the engine.
 */
export interface ExecutionContext {
  readonly executionId: Identifier;
  readonly correlationId: CorrelationId;
  readonly status: ExecutionStatus;
  readonly requestContext: Context;
  readonly options: ExecutionOptions;
  readonly strategy?: ExecutionStrategy;
  readonly metadata?: SerializableValueObject;
  readonly timestamp: TimestampString;
}
