/**
 * Public runtime core entry point for Agentic OS.
 */
export * from './cancellation.js';
export * from './common.js';
export * from './events.js';
export * from './execution-context.js';
export * from './execution-pipeline.js';
export * from './lifecycle.js';
export * from './logging.js';
export * from './middleware.js';
export { ExecutionPipeline as LegacyExecutionPipeline } from './pipeline.js';
export * from './registry.js';
export * from './retry.js';
export * from './runtime-engine.js';
export * from './runtime-foundation.js';
export {
  CheckpointException,
  CheckpointValidationException,
  CancellationException,
  RecoveryHintException,
  RuntimeCancellationManager,
  RuntimeCheckpoint,
  RuntimeCheckpointBuilder,
  RuntimeCheckpointManager,
  RuntimeCheckpointSnapshot,
  RuntimeExecutionHistory,
  RuntimeExecutionHistoryEntry,
  RuntimeExecutionSnapshot,
  RuntimeExecutionTimeline,
  RuntimeExecutionTimelineEvent,
  RuntimeExecutionTimelineSnapshot,
  RuntimeRecoveryHint,
  RuntimeResilienceEvent,
  RuntimeResilienceEventBus,
  RuntimeTimeoutDiagnostics,
  RuntimeTimeoutManager,
  RuntimeTimeoutRecord,
  type IRuntimeCancellationManager,
  type IRuntimeCheckpoint,
  type IRuntimeCheckpointManager,
  type IRuntimeExecutionSnapshot,
  type IRuntimeRecoveryHint,
  type IRuntimeTimeoutManager,
} from './runtime-resilience.js';
export {
  PerformanceSnapshotException,
  RuntimeActivity,
  RuntimeActivitySnapshot,
  RuntimeCounters,
  RuntimeDiagnostics,
  RuntimeDiagnosticsException,
  RuntimeDiagnosticsSnapshot,
  RuntimeHealth,
  RuntimeHealthCheck,
  RuntimeHealthException,
  RuntimeHealthSnapshot,
  RuntimeHealthStatus,
  RuntimeObservabilityEvent,
  RuntimeObserver,
  RuntimeObserverCollection,
  RuntimeObserverException,
  RuntimePerformanceSnapshot,
  RuntimeStatistics,
  RuntimeTrace,
  RuntimeTraceContext,
  RuntimeTraceContextSnapshot,
  RuntimeTraceException,
  RuntimeTraceOptions,
  RuntimeTraceSnapshot,
  RuntimeTraceStatus,
  RuntimeTracer,
  type IRuntimeDiagnostics,
  type IRuntimeHealth,
  type IRuntimeHealthCheck,
  type IRuntimePerformanceSnapshot,
  type IRuntimeTracer,
} from './runtime-observability.js';
export * from './runtime-scheduler.js';

import type { Context } from '@infrashield/context';
import type { Agent } from '@infrashield/agent-core';
import type {
  HealthReport,
  Identifier,
  Result,
  SerializableValueObject,
} from '@infrashield/contracts';

/**
 * Execution context details used by the runtime.
 */
export interface ExecutionContext {
  readonly contextId: Identifier;
  readonly agentId: Identifier;
  readonly requestContext: Context;
  readonly metadata?: SerializableValueObject;
}

/**
 * Valid runtime event types.
 */
export enum RuntimeEventType {
  Started = 'runtime.started',
  Stopped = 'runtime.stopped',
  AgentScheduled = 'runtime.agentScheduled',
  AgentCompleted = 'runtime.agentCompleted',
  AgentFailed = 'runtime.agentFailed',
}

/**
 * Event contract emitted by the runtime.
 */
export interface RuntimeEvent {
  readonly eventType: RuntimeEventType;
  readonly executionContext: ExecutionContext;
  readonly timestamp: string;
  readonly payload?: SerializableValueObject;
}

/**
 * Configuration for runtime behavior.
 */
export interface RuntimeConfiguration {
  readonly runtimeId: Identifier;
  readonly environment: string;
  readonly maxConcurrency?: number;
  readonly schedulingPolicy?: string;
}

/**
 * Execution result returned by the runtime.
 */
export interface ExecutionResult {
  readonly executionId: Identifier;
  readonly agentId: Identifier;
  readonly succeeded: boolean;
  readonly output?: SerializableValueObject;
  readonly errorCode?: string;
  readonly errorMessage?: string;
  readonly startedAt: string;
  readonly completedAt: string;
}

/**
 * Runtime health contract for operational status.
 */
export interface RuntimeHealthReport {
  readonly runtimeId: Identifier;
  readonly report: HealthReport;
}

/**
 * Lifecycle manager interface for runtime lifecycle operations.
 */
export interface LifecycleManager {
  initialize(configuration: RuntimeConfiguration): Promise<Result<RuntimeHealthReport>>;
  start(): Promise<Result<void>>;
  stop(): Promise<Result<void>>;
  getHealth(): Promise<Result<RuntimeHealthReport>>;
}

/**
 * Scheduler interface for agent execution control.
 */
export interface Scheduler {
  schedule(agent: Agent, context: ExecutionContext): Promise<Result<ExecutionResult>>;
  cancel(executionId: Identifier): Promise<Result<void>>;
  listScheduled(): Promise<Result<readonly ExecutionContext[]>>;
}

/**
 * Runtime interface for the kernel execution layer.
 */
export interface Runtime {
  readonly configuration: RuntimeConfiguration;
  readonly health: RuntimeHealthReport;

  getRuntimeId(): Identifier;
  getConfiguration(): RuntimeConfiguration;
  getHealth(): RuntimeHealthReport;
  emitEvent(event: RuntimeEvent): void;
}
