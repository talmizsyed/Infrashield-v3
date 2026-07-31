import {
  type ExecutionMetadata,
  type IRuntimeMetrics,
  type IRuntimeObserver,
  type RuntimeMetricsSnapshot,
} from './runtime-foundation.js';
import {
  RuntimeExecutionHistory,
  RuntimeExecutionHistoryEntry,
  RuntimeExecutionTimeline,
  RuntimeExecutionTimelineSnapshot,
} from './runtime-resilience.js';

export type RuntimeHealthStatus = 'healthy' | 'degraded' | 'unhealthy';
export type RuntimeTraceStatus = 'running' | 'completed' | 'failed';

export interface RuntimeObservabilityEvent {
  readonly type: string;
  readonly timestamp: string;
  readonly payload?: ExecutionMetadata;
}

export interface IRuntimeTracer {
  startTrace(options: RuntimeTraceOptions): RuntimeTrace;
}

export interface IRuntimeDiagnostics {
  snapshot(): RuntimeDiagnosticsSnapshot;
}

export interface IRuntimeHealth {
  readonly checks: readonly IRuntimeHealthCheck[];
  snapshot(): RuntimeHealthSnapshot;
}

export interface IRuntimeHealthCheck {
  readonly name: string;
  readonly status: RuntimeHealthStatus;
  readonly message: string;
  readonly metadata?: ExecutionMetadata;
}

export interface IRuntimePerformanceSnapshot {
  readonly pipelineDurationMs: number;
  readonly middlewareDurationMs: number;
  readonly schedulerLatencyMs: number;
  readonly workerUtilization: number;
  readonly concurrentExecutions: number;
  readonly throughput: number;
}

export interface RuntimeTraceOptions {
  readonly executionId: string;
  readonly correlationId: string;
  readonly parentExecutionId?: string;
  readonly name?: string;
  readonly metadata?: ExecutionMetadata;
}

export interface RuntimeTraceSnapshot {
  readonly id: string;
  readonly name: string;
  readonly status: RuntimeTraceStatus;
  readonly traceContext: RuntimeTraceContextSnapshot;
  readonly activities: readonly RuntimeActivitySnapshot[];
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly durationMs?: number;
  readonly metadata: ExecutionMetadata;
}

export interface RuntimeTraceContextSnapshot {
  readonly executionId: string;
  readonly correlationId: string;
  readonly parentExecutionId?: string;
}

export interface RuntimeActivitySnapshot {
  readonly id: string;
  readonly name: string;
  readonly status: RuntimeTraceStatus;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly metadata: ExecutionMetadata;
}

export interface RuntimeHealthSnapshot {
  readonly status: RuntimeHealthStatus;
  readonly checks: readonly IRuntimeHealthCheck[];
  readonly timestamp: string;
}

export interface RuntimeDiagnosticsSnapshot {
  readonly metrics: RuntimeMetricsSnapshot;
  readonly traces: readonly RuntimeTraceSnapshot[];
  readonly history: readonly RuntimeExecutionHistoryEntry[];
  readonly timeline: RuntimeExecutionTimelineSnapshot;
  readonly performance: IRuntimePerformanceSnapshot;
  readonly health: RuntimeHealthSnapshot;
}

export class RuntimeCounters {
  private total = 0;
  private successful = 0;
  private failed = 0;
  private cancelled = 0;
  private timedOut = 0;
  private queued = 0;
  private checkpoints = 0;
  private timeouts = 0;
  private cancellations = 0;

  public incrementQueued(): void {
    this.total += 1;
    this.queued += 1;
  }

  public incrementCompleted(): void {
    this.total += 1;
    this.successful += 1;
  }

  public incrementFailed(): void {
    this.total += 1;
    this.failed += 1;
  }

  public incrementCancelled(): void {
    this.total += 1;
    this.cancelled += 1;
  }

  public incrementTimedOut(): void {
    this.total += 1;
    this.timedOut += 1;
  }

  public incrementCheckpoint(): void {
    this.checkpoints += 1;
  }

  public incrementTimeout(): void {
    this.timeouts += 1;
  }

  public incrementCancellation(): void {
    this.cancellations += 1;
  }

  public snapshot(): Readonly<{
    total: number;
    successful: number;
    failed: number;
    cancelled: number;
    timedOut: number;
    queued: number;
    checkpoints: number;
    timeouts: number;
    cancellations: number;
  }> {
    return Object.freeze({
      total: this.total,
      successful: this.successful,
      failed: this.failed,
      cancelled: this.cancelled,
      timedOut: this.timedOut,
      queued: this.queued,
      checkpoints: this.checkpoints,
      timeouts: this.timeouts,
      cancellations: this.cancellations,
    });
  }
}

export class RuntimeStatistics {
  private readonly durations: number[] = [];
  private readonly pipelineDurations: number[] = [];
  private readonly middlewareDurations: number[] = [];
  private readonly schedulerLatencies: number[] = [];
  private readonly workerUtilizations: number[] = [];

  public recordDuration(value: number): void {
    this.durations.push(value);
  }

  public recordPipelineDuration(value: number): void {
    this.pipelineDurations.push(value);
  }

  public recordMiddlewareDuration(value: number): void {
    this.middlewareDurations.push(value);
  }

  public recordSchedulerLatency(value: number): void {
    this.schedulerLatencies.push(value);
  }

  public recordWorkerUtilization(value: number): void {
    this.workerUtilizations.push(value);
  }

  public snapshot(): Readonly<{
    averageDurationMs: number;
    maximumDurationMs: number;
    minimumDurationMs: number;
    pipelineDurationMs: number;
    middlewareDurationMs: number;
    schedulerLatencyMs: number;
    workerUtilization: number;
  }> {
    return Object.freeze({
      averageDurationMs: average(this.durations),
      maximumDurationMs: max(this.durations),
      minimumDurationMs: min(this.durations),
      pipelineDurationMs: average(this.pipelineDurations),
      middlewareDurationMs: average(this.middlewareDurations),
      schedulerLatencyMs: average(this.schedulerLatencies),
      workerUtilization: average(this.workerUtilizations),
    });
  }
}

export class RuntimeActivity {
  public readonly id: string;
  public readonly name: string;
  public readonly startedAt: string;
  private _status: RuntimeTraceStatus;
  public completedAt?: string;
  private _metadata: ExecutionMetadata;

  public constructor(options: {
    readonly id: string;
    readonly name: string;
    readonly metadata?: ExecutionMetadata;
  }) {
    this.id = options.id;
    this.name = options.name;
    this.startedAt = new Date().toISOString();
    this._metadata = Object.freeze({ ...(options.metadata ?? {}) });
    this._status = 'running';
  }

  public get status(): RuntimeTraceStatus {
    return this._status;
  }

  public get metadata(): ExecutionMetadata {
    return this._metadata;
  }

  public complete(result?: ExecutionMetadata): void {
    this.completedAt = new Date().toISOString();
    this._status = 'completed';
    if (result) {
      this._metadata = Object.freeze({ ...this._metadata, ...result });
    }
  }

  public snapshot(): RuntimeActivitySnapshot {
    return Object.freeze({
      id: this.id,
      name: this.name,
      status: this.status,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      metadata: this._metadata,
    });
  }
}

export class RuntimeTraceContext {
  public readonly executionId: string;
  public readonly correlationId: string;
  public readonly parentExecutionId?: string;

  public constructor(options: RuntimeTraceOptions) {
    this.executionId = options.executionId;
    this.correlationId = options.correlationId;
    this.parentExecutionId = options.parentExecutionId;
  }

  public snapshot(): RuntimeTraceContextSnapshot {
    return Object.freeze({
      executionId: this.executionId,
      correlationId: this.correlationId,
      parentExecutionId: this.parentExecutionId,
    });
  }
}

export class RuntimeTrace {
  public readonly id: string;
  public readonly name: string;
  public readonly traceContext: RuntimeTraceContext;
  public readonly activities: RuntimeActivity[] = [];
  public readonly startedAt: string;
  private _metadata: ExecutionMetadata;
  private _status: RuntimeTraceStatus;
  public completedAt?: string;

  public constructor(options: RuntimeTraceOptions) {
    this.id = `trace-${options.executionId}-${Date.now()}`;
    this.name = options.name ?? 'runtime-trace';
    this.traceContext = new RuntimeTraceContext(options);
    this.startedAt = new Date().toISOString();
    this._metadata = Object.freeze({ ...(options.metadata ?? {}) });
    this._status = 'running';
  }

  public get status(): RuntimeTraceStatus {
    return this._status;
  }

  public get metadata(): ExecutionMetadata {
    return this._metadata;
  }

  public startActivity(name: string, metadata?: ExecutionMetadata): RuntimeActivity {
    const activity = new RuntimeActivity({
      id: `activity-${this.activities.length + 1}`,
      name,
      metadata,
    });
    this.activities.push(activity);
    return activity;
  }

  public completeActivity(activityId: string, metadata?: ExecutionMetadata): RuntimeActivity {
    const activity = this.activities.find((entry) => entry.id === activityId);
    if (!activity) {
      throw new RuntimeTraceException(`Activity ${activityId} not found`);
    }

    activity.complete(metadata);
    return activity;
  }

  public complete(metadata?: ExecutionMetadata): void {
    this._status = 'completed';
    this.completedAt = new Date().toISOString();
    if (metadata) {
      this._metadata = Object.freeze({ ...this._metadata, ...metadata });
    }
  }

  public snapshot(): RuntimeTraceSnapshot {
    return Object.freeze({
      id: this.id,
      name: this.name,
      status: this.status,
      traceContext: this.traceContext.snapshot(),
      activities: Object.freeze(this.activities.map((activity) => activity.snapshot())),
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      durationMs: this.completedAt
        ? Date.parse(this.completedAt) - Date.parse(this.startedAt)
        : undefined,
      metadata: this._metadata,
    });
  }
}

export class RuntimeTracer implements IRuntimeTracer {
  private readonly traces: RuntimeTrace[] = [];

  public startTrace(options: RuntimeTraceOptions): RuntimeTrace {
    const trace = new RuntimeTrace(options);
    this.traces.push(trace);
    return trace;
  }

  public snapshot(): readonly RuntimeTraceSnapshot[] {
    return Object.freeze(this.traces.map((trace) => trace.snapshot()));
  }
}

export class RuntimeHealthCheck implements IRuntimeHealthCheck {
  public readonly name: string;
  public readonly status: RuntimeHealthStatus;
  public readonly message: string;
  public readonly metadata: ExecutionMetadata;

  public constructor(options: {
    readonly name: string;
    readonly status: RuntimeHealthStatus;
    readonly message: string;
    readonly metadata?: ExecutionMetadata;
  }) {
    this.name = options.name;
    this.status = options.status;
    this.message = options.message;
    this.metadata = Object.freeze({ ...(options.metadata ?? {}) });
  }
}

export class RuntimeHealth implements IRuntimeHealth {
  public readonly checks: readonly IRuntimeHealthCheck[];
  public readonly timestamp: string;

  public constructor(options: { readonly checks: readonly IRuntimeHealthCheck[] }) {
    this.checks = Object.freeze([...options.checks]);
    this.timestamp = new Date().toISOString();
  }

  public snapshot(): RuntimeHealthSnapshot {
    const status: RuntimeHealthStatus = this.checks.some((check) => check.status === 'unhealthy')
      ? 'unhealthy'
      : this.checks.some((check) => check.status === 'degraded')
        ? 'degraded'
        : 'healthy';

    return Object.freeze({
      status,
      checks: this.checks,
      timestamp: this.timestamp,
    });
  }
}

export class RuntimePerformanceSnapshot implements IRuntimePerformanceSnapshot {
  public readonly pipelineDurationMs: number;
  public readonly middlewareDurationMs: number;
  public readonly schedulerLatencyMs: number;
  public readonly workerUtilization: number;
  public readonly concurrentExecutions: number;
  public readonly throughput: number;

  public constructor(options: {
    readonly pipelineDurationMs?: number;
    readonly middlewareDurationMs?: number;
    readonly schedulerLatencyMs?: number;
    readonly workerUtilization?: number;
    readonly concurrentExecutions?: number;
    readonly throughput?: number;
  }) {
    this.pipelineDurationMs = options.pipelineDurationMs ?? 0;
    this.middlewareDurationMs = options.middlewareDurationMs ?? 0;
    this.schedulerLatencyMs = options.schedulerLatencyMs ?? 0;
    this.workerUtilization = options.workerUtilization ?? 0;
    this.concurrentExecutions = options.concurrentExecutions ?? 0;
    this.throughput = options.throughput ?? 0;
  }
}

export class RuntimeDiagnostics implements IRuntimeDiagnostics {
  private readonly metrics: IRuntimeMetrics;
  private readonly tracer: IRuntimeTracer;
  private readonly history: RuntimeExecutionHistory;
  private readonly timeline: RuntimeExecutionTimeline;
  private readonly health: IRuntimeHealth;

  public constructor(options: {
    readonly metrics?: IRuntimeMetrics;
    readonly tracer?: IRuntimeTracer;
    readonly history?: RuntimeExecutionHistory;
    readonly timeline?: RuntimeExecutionTimeline;
    readonly health?: IRuntimeHealth;
  }) {
    this.metrics = options.metrics ?? new RuntimeMetricsAdapter();
    this.tracer = options.tracer ?? new RuntimeTracer();
    this.history = options.history ?? new RuntimeExecutionHistory();
    this.timeline = options.timeline ?? new RuntimeExecutionTimeline();
    this.health = options.health ?? new RuntimeHealth({ checks: [] });
  }

  public snapshot(): RuntimeDiagnosticsSnapshot {
    const metricsSnapshot = this.metrics.snapshot();
    const traces = this.tracer instanceof RuntimeTracer ? this.tracer.snapshot() : [];

    return Object.freeze({
      metrics: metricsSnapshot,
      traces,
      history: this.history.snapshot(),
      timeline: this.timeline.snapshot(),
      performance: new RuntimePerformanceSnapshot({
        pipelineDurationMs: metricsSnapshot.pipelineDurationMs ?? 0,
        middlewareDurationMs: metricsSnapshot.middlewareDurationMs ?? 0,
        schedulerLatencyMs: metricsSnapshot.schedulerLatencyMs ?? 0,
        workerUtilization: metricsSnapshot.workerUtilization ?? 0,
        concurrentExecutions: metricsSnapshot.concurrentExecutions ?? 0,
        throughput: metricsSnapshot.throughput ?? 0,
      }),
      health: this.health.snapshot(),
    });
  }
}

export class RuntimeObserver implements IRuntimeObserver<RuntimeObservabilityEvent> {
  public readonly id: string;
  private readonly handler: (event: RuntimeObservabilityEvent) => void | Promise<void>;

  public constructor(options: {
    readonly id: string;
    readonly onEvent: (event: RuntimeObservabilityEvent) => void | Promise<void>;
  }) {
    this.id = options.id;
    this.handler = options.onEvent;
  }

  public async onObserved(event: RuntimeObservabilityEvent): Promise<void> {
    await this.handler(event);
  }

  public async onEvent(event: RuntimeObservabilityEvent): Promise<void> {
    await this.onObserved(event);
  }
}

export class RuntimeObserverCollection {
  private readonly observers = new Set<IRuntimeObserver<RuntimeObservabilityEvent>>();

  public add(observer: IRuntimeObserver<RuntimeObservabilityEvent>): void {
    this.observers.add(observer);
  }

  public remove(observer: IRuntimeObserver<RuntimeObservabilityEvent>): void {
    this.observers.delete(observer);
  }

  public async notify(event: RuntimeObservabilityEvent): Promise<void> {
    for (const observer of this.observers) {
      try {
        await observer.onObserved(event);
      } catch {
        continue;
      }
    }
  }
}

export class RuntimeHealthException extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'RuntimeHealthException';
  }
}

export class RuntimeTraceException extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'RuntimeTraceException';
  }
}

export class RuntimeDiagnosticsException extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'RuntimeDiagnosticsException';
  }
}

export class RuntimeObserverException extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'RuntimeObserverException';
  }
}

export class PerformanceSnapshotException extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'PerformanceSnapshotException';
  }
}

class RuntimeMetricsAdapter implements IRuntimeMetrics {
  public recordQueued(): void {
    return undefined;
  }

  public recordCompleted(_durationMs: number): void {
    return undefined;
  }

  public recordFailed(_durationMs: number): void {
    return undefined;
  }

  public recordCancelled(_durationMs: number): void {
    return undefined;
  }

  public recordTimedOut(_durationMs: number): void {
    return undefined;
  }

  public recordCheckpoint(): void {
    return undefined;
  }

  public recordTimeout(): void {
    return undefined;
  }

  public recordCancellation(): void {
    return undefined;
  }

  public recordPipelineDuration(_durationMs: number): void {
    return undefined;
  }

  public recordMiddlewareDuration(_durationMs: number): void {
    return undefined;
  }

  public recordSchedulerLatency(_durationMs: number): void {
    return undefined;
  }

  public recordWorkerUtilization(_utilization: number): void {
    return undefined;
  }

  public recordConcurrentExecution(): void {
    return undefined;
  }

  public recordThroughput(): void {
    return undefined;
  }

  public snapshot(): RuntimeMetricsSnapshot {
    return {
      executionCount: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      averageDurationMs: 0,
      maximumDurationMs: 0,
      minimumDurationMs: 0,
      concurrentExecutions: 0,
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      cancelledExecutions: 0,
      timedOutExecutions: 0,
      queuedExecutions: 0,
      averageExecutionDurationMs: 0,
      maximumExecutionDurationMs: 0,
      minimumExecutionDurationMs: 0,
      pipelineDurationMs: 0,
      middlewareDurationMs: 0,
      schedulerLatencyMs: 0,
      workerUtilization: 0,
      checkpointCount: 0,
      timeoutCount: 0,
      cancellationCount: 0,
      throughput: 0,
    };
  }
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function min(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return Math.min(...values);
}

function max(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return Math.max(...values);
}
