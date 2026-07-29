import type { Identifier, SerializableValueObject, TimestampString } from '@agentic/sdk';
import { ExecutionStatus } from '@agentic/sdk';
import type { IExecutionError } from '@agentic/sdk';

/**
 * Runtime lifecycle states.
 */
export enum RuntimeStatus {
  Created = 'created',
  Initialized = 'initialized',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
  Disposed = 'disposed',
}

/**
 * Runtime configuration contract.
 */
export interface RuntimeConfiguration {
  readonly runtimeId: Identifier;
  readonly environment: string;
  readonly maxConcurrency?: number;
  readonly schedulingPolicy?: string;
}

/**
 * Runtime event type contract.
 */
export enum RuntimeEventType {
  RuntimeInitialized = 'runtime.initialized',
  RuntimeStarted = 'runtime.started',
  ExecutionStarted = 'execution.started',
  ExecutionCompleted = 'execution.completed',
  ExecutionFailed = 'execution.failed',
  ExecutionCancelled = 'execution.cancelled',
  MiddlewareStarted = 'middleware.started',
  MiddlewareCompleted = 'middleware.completed',
  RuntimeDisposed = 'runtime.disposed',
}

/**
 * Runtime event payload contract.
 */
export interface RuntimeEvent {
  readonly eventType: RuntimeEventType;
  readonly timestamp: TimestampString;
  readonly executionId?: Identifier;
  readonly middlewareId?: Identifier;
  readonly payload?: SerializableValueObject;
}

/**
 * Runtime health snapshot.
 */
export interface RuntimeHealth {
  readonly runtimeId: Identifier;
  readonly status: RuntimeStatus;
  readonly checkedAt: TimestampString;
  readonly details?: SerializableValueObject;
}

/**
 * Runtime execution result contract.
 */
export class ExecutionResult {
  public readonly executionId: Identifier;
  public readonly status: ExecutionStatus;
  public readonly succeeded: boolean;
  public readonly startedAt: TimestampString;
  public readonly completedAt?: TimestampString;
  public readonly output?: SerializableValueObject;
  public readonly error?: IExecutionError;

  public constructor(input: {
    readonly executionId: Identifier;
    readonly status: ExecutionStatus;
    readonly succeeded: boolean;
    readonly startedAt: TimestampString;
    readonly completedAt?: TimestampString;
    readonly output?: SerializableValueObject;
    readonly error?: IExecutionError;
  }) {
    this.executionId = input.executionId;
    this.status = input.status;
    this.succeeded = input.succeeded;
    this.startedAt = input.startedAt;
    this.completedAt = input.completedAt;
    this.output = input.output;
    this.error = input.error;
  }
}
