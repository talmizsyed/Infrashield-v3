import {
  ExecutionPriority,
  ExecutionStatus,
  ExecutionTimeoutException,
  type ExecutionMetadata,
  type ExecutionOwner,
  type IRuntimeContext,
  type IRuntimeExecution,
  RuntimeContext,
} from './runtime-foundation.js';

export interface RuntimeResilienceEvent {
  readonly type: string;
  readonly timestamp: string;
  readonly payload?: unknown;
}

export interface RuntimeResilienceEventBus {
  publish(event: RuntimeResilienceEvent): Promise<void> | void;
}

export interface IRuntimeTimeoutManager {
  start(
    execution: IRuntimeExecution,
    options?: { readonly timeoutMs?: number; readonly reason?: string },
  ): void;
  stop(execution: IRuntimeExecution): void;
  setDefaultTimeout(timeoutMs: number): void;
  getDiagnostics(): RuntimeTimeoutDiagnostics;
}

export interface IRuntimeCancellationManager {
  readonly signal: AbortSignal;
  readonly isCancellationRequested: boolean;
  readonly reason?: string;
  readonly cancelledAt?: string;
  cancel(reason?: string): void;
  addObserver(observer: (reason?: string) => void): () => void;
  link(other: IRuntimeCancellationManager): void;
  throwIfCancellationRequested(): void;
}

export interface IRuntimeCheckpointManager {
  createCheckpoint(
    execution: IRuntimeExecution,
    options?: {
      readonly version?: number;
      readonly metadata?: ExecutionMetadata;
      readonly progress?: number;
      readonly status?: ExecutionStatus;
      readonly contextSnapshot?: IRuntimeContext;
      readonly timeline?: readonly RuntimeExecutionTimelineEvent[];
    },
  ): RuntimeCheckpoint;
  getCheckpoint(executionId: string, version?: number): RuntimeCheckpoint | undefined;
  getLatestCheckpoint(executionId: string): RuntimeCheckpoint | undefined;
  getCheckpointCount(): number;
}

export interface IRuntimeCheckpoint {
  readonly id: string;
  readonly executionId: string;
  readonly version: number;
  readonly createdAt: string;
  readonly status: ExecutionStatus;
  readonly metadata: ExecutionMetadata;
  readonly progress: number;
  readonly contextSnapshot: IRuntimeContext;
  readonly timeline: readonly RuntimeExecutionTimelineEvent[];
  readonly owner: ExecutionOwner;
  readonly correlationId: string;
  readonly timestamp: string;
  snapshot(): RuntimeCheckpointSnapshot;
}

export interface IRuntimeExecutionSnapshot {
  readonly executionId: string;
  readonly status: ExecutionStatus;
  readonly priority: ExecutionPriority;
  readonly owner: ExecutionOwner;
  readonly metadata: ExecutionMetadata;
  readonly startedAt?: string;
  readonly endedAt?: string;
  readonly durationMs?: number;
  readonly cancellationState: {
    readonly requested: boolean;
    readonly reason?: string;
    readonly cancelledAt?: string;
  };
  readonly timeoutState: {
    readonly timedOut: boolean;
    readonly timeoutMs?: number;
    readonly timedOutAt?: string;
  };
  readonly timeline: readonly RuntimeExecutionTimelineEvent[];
  readonly checkpointReference?: {
    readonly id: string;
    readonly version: number;
  };
}

export interface IRuntimeRecoveryHint {
  readonly code: string;
  readonly message: string;
  readonly checkpointId?: string;
  readonly metadata: ExecutionMetadata;
}

export interface RuntimeTimeoutDiagnostics {
  readonly timeoutCount: number;
  readonly lastTimeoutMs?: number;
  readonly history: readonly RuntimeTimeoutRecord[];
}

export interface RuntimeTimeoutRecord {
  readonly executionId: string;
  readonly timedOutAt: string;
  readonly timeoutMs: number;
  readonly reason?: string;
}

export interface RuntimeExecutionTimelineEvent {
  readonly type: string;
  readonly timestamp: string;
  readonly payload?: ExecutionMetadata;
}

export interface RuntimeCheckpointSnapshot {
  readonly id: string;
  readonly executionId: string;
  readonly version: number;
  readonly createdAt: string;
  readonly status: ExecutionStatus;
  readonly metadata: ExecutionMetadata;
  readonly progress: number;
  readonly contextSnapshot: IRuntimeContext;
  readonly timeline: readonly RuntimeExecutionTimelineEvent[];
  readonly owner: ExecutionOwner;
  readonly correlationId: string;
  readonly timestamp: string;
}

export interface RuntimeExecutionTimelineSnapshot {
  readonly events: readonly RuntimeExecutionTimelineEvent[];
}

export class CheckpointException extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'CheckpointException';
  }
}

export class CheckpointValidationException extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'CheckpointValidationException';
  }
}

export class CancellationException extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'CancellationException';
  }
}

export class RecoveryHintException extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'RecoveryHintException';
  }
}

export class RuntimeTimeoutManager implements IRuntimeTimeoutManager {
  private defaultTimeoutMs: number;
  private readonly eventBus?: RuntimeResilienceEventBus;
  private diagnostics: RuntimeTimeoutDiagnostics & { timeoutCount: number } = {
    timeoutCount: 0,
    history: [],
  };
  private readonly sessions = new Map<
    string,
    { timer: ReturnType<typeof setTimeout>; timeoutMs: number }
  >();

  public constructor(
    options: {
      readonly defaultTimeoutMs?: number;
      readonly eventBus?: RuntimeResilienceEventBus;
    } = {},
  ) {
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 30000;
    this.eventBus = options.eventBus;
  }

  public start(
    execution: IRuntimeExecution,
    options: { readonly timeoutMs?: number; readonly reason?: string } = {},
  ): void {
    this.stop(execution);
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const timer = setTimeout(async () => {
      if (
        execution.status === ExecutionStatus.Completed ||
        execution.status === ExecutionStatus.Cancelled ||
        execution.status === ExecutionStatus.Failed ||
        execution.status === ExecutionStatus.TimedOut
      ) {
        return;
      }

      try {
        await execution.timeout(options.reason ?? 'Execution timed out');
      } catch {
        return;
      }

      this.diagnostics.timeoutCount += 1;
      const record: RuntimeTimeoutRecord = {
        executionId: execution.id,
        timedOutAt: new Date().toISOString(),
        timeoutMs,
        reason: options.reason,
      };
      const history = [...this.diagnostics.history, record];
      (
        this.diagnostics as RuntimeTimeoutDiagnostics & { history: RuntimeTimeoutRecord[] }
      ).history = history;
      void this.publish({
        type: 'ExecutionTimedOut',
        timestamp: new Date().toISOString(),
        payload: record,
      });
    }, timeoutMs);

    this.sessions.set(execution.id, { timer, timeoutMs });
  }

  public stop(execution: IRuntimeExecution): void {
    const session = this.sessions.get(execution.id);
    if (session) {
      clearTimeout(session.timer);
      this.sessions.delete(execution.id);
    }
  }

  public setDefaultTimeout(timeoutMs: number): void {
    if (timeoutMs <= 0) {
      throw new ExecutionTimeoutException('Timeout must be greater than zero');
    }

    this.defaultTimeoutMs = timeoutMs;
  }

  public getDiagnostics(): RuntimeTimeoutDiagnostics {
    return {
      timeoutCount: this.diagnostics.timeoutCount,
      lastTimeoutMs: this.diagnostics.history.at(-1)?.timeoutMs,
      history: [...this.diagnostics.history],
    };
  }

  private async publish(event: RuntimeResilienceEvent): Promise<void> {
    await this.eventBus?.publish(event);
  }
}

export class RuntimeCancellationManager implements IRuntimeCancellationManager {
  private readonly listeners = new Set<(reason?: string) => void>();
  private readonly linkedManagers = new Set<IRuntimeCancellationManager>();
  private readonly controller?: AbortController;
  private _reason?: string;
  private _cancelled = false;
  private _cancelledAt?: string;
  public readonly signal: AbortSignal;

  public constructor(signal?: AbortSignal) {
    if (signal) {
      this.signal = signal;
      if (signal.aborted) {
        this._cancelled = true;
        this._reason = signal.reason instanceof Error ? signal.reason.message : undefined;
        this._cancelledAt = new Date().toISOString();
      } else {
        signal.addEventListener(
          'abort',
          () => {
            this._cancelled = true;
            this._reason = signal.reason instanceof Error ? signal.reason.message : undefined;
            this._cancelledAt = new Date().toISOString();
            for (const listener of this.listeners) {
              listener(this._reason);
            }
            for (const linked of this.linkedManagers) {
              linked.cancel(this._reason);
            }
          },
          { once: true },
        );
      }
    } else {
      const controller = new AbortController();
      this.controller = controller;
      this.signal = controller.signal;
    }
  }

  public get isCancellationRequested(): boolean {
    return this._cancelled || this.signal.aborted;
  }

  public get reason(): string | undefined {
    return (
      this._reason ?? (this.signal.reason instanceof Error ? this.signal.reason.message : undefined)
    );
  }

  public get cancelledAt(): string | undefined {
    return this._cancelledAt;
  }

  public cancel(reason?: string): void {
    if (this.isCancellationRequested) {
      return;
    }

    this._cancelled = true;
    this._reason = reason ?? 'cancelled';
    this._cancelledAt = new Date().toISOString();
    this.controller?.abort(this._reason);
    for (const listener of this.listeners) {
      listener(this._reason);
    }
    for (const linked of this.linkedManagers) {
      linked.cancel(this._reason);
    }
  }

  public addObserver(observer: (reason?: string) => void): () => void {
    this.listeners.add(observer);
    return () => this.listeners.delete(observer);
  }

  public link(other: IRuntimeCancellationManager): void {
    this.linkedManagers.add(other);
    const unsubscribe = other.addObserver((reason) => {
      this.cancel(reason);
    });

    const cleanup = (): void => {
      unsubscribe();
      this.linkedManagers.delete(other);
    };

    if (this.isCancellationRequested) {
      cleanup();
    }
  }

  public throwIfCancellationRequested(): void {
    if (this.isCancellationRequested) {
      throw new CancellationException(this.reason ?? 'Execution cancelled');
    }
  }
}

export class RuntimeCheckpoint implements IRuntimeCheckpoint {
  public readonly id: string;
  public readonly executionId: string;
  public readonly version: number;
  public readonly createdAt: string;
  public readonly status: ExecutionStatus;
  public readonly metadata: ExecutionMetadata;
  public readonly progress: number;
  public readonly contextSnapshot: IRuntimeContext;
  public readonly timeline: readonly RuntimeExecutionTimelineEvent[];
  public readonly owner: ExecutionOwner;
  public readonly correlationId: string;
  public readonly timestamp: string;

  public constructor(options: {
    readonly id: string;
    readonly executionId: string;
    readonly version: number;
    readonly createdAt?: string;
    readonly status?: ExecutionStatus;
    readonly metadata?: ExecutionMetadata;
    readonly progress?: number;
    readonly contextSnapshot?: IRuntimeContext;
    readonly timeline?: readonly RuntimeExecutionTimelineEvent[];
    readonly owner: ExecutionOwner;
    readonly correlationId: string;
    readonly timestamp?: string;
  }) {
    this.id = options.id;
    this.executionId = options.executionId;
    this.version = options.version;
    this.createdAt = options.createdAt ?? new Date().toISOString();
    this.status = options.status ?? ExecutionStatus.Created;
    this.metadata = freezeMetadata(options.metadata ?? {});
    this.progress = options.progress ?? 0;
    this.contextSnapshot =
      options.contextSnapshot ??
      new RuntimeContext({
        executionId: options.executionId,
        correlationId: options.correlationId,
      });
    this.timeline = Object.freeze([...(options.timeline ?? [])]);
    this.owner = options.owner;
    this.correlationId = options.correlationId;
    this.timestamp = options.timestamp ?? new Date().toISOString();
  }

  public snapshot(): RuntimeCheckpointSnapshot {
    return {
      id: this.id,
      executionId: this.executionId,
      version: this.version,
      createdAt: this.createdAt,
      status: this.status,
      metadata: this.metadata,
      progress: this.progress,
      contextSnapshot: this.contextSnapshot,
      timeline: this.timeline,
      owner: this.owner,
      correlationId: this.correlationId,
      timestamp: this.timestamp,
    };
  }
}

export class RuntimeCheckpointBuilder {
  private execution?: IRuntimeExecution;
  private version = 1;
  private metadata: ExecutionMetadata = {};
  private progress = 0;
  private status = ExecutionStatus.Created;
  private contextSnapshot?: IRuntimeContext;
  private timeline: RuntimeExecutionTimelineEvent[] = [];
  private owner?: ExecutionOwner;
  private correlationId?: string;

  public withExecution(execution: IRuntimeExecution): this {
    this.execution = execution;
    this.owner = execution.owner;
    this.correlationId = execution.correlationId;
    this.status = execution.status;
    return this;
  }

  public withVersion(version: number): this {
    this.version = version;
    return this;
  }

  public withMetadata(metadata: ExecutionMetadata): this {
    this.metadata = metadata;
    return this;
  }

  public withProgress(progress: number): this {
    this.progress = progress;
    return this;
  }

  public withStatus(status: ExecutionStatus): this {
    this.status = status;
    return this;
  }

  public withContextSnapshot(contextSnapshot: IRuntimeContext): this {
    this.contextSnapshot = contextSnapshot;
    return this;
  }

  public withTimeline(events: readonly RuntimeExecutionTimelineEvent[]): this {
    this.timeline = [...events];
    return this;
  }

  public build(): RuntimeCheckpoint {
    if (!this.execution) {
      throw new CheckpointValidationException('Execution is required to build a checkpoint');
    }

    return new RuntimeCheckpoint({
      id: `checkpoint-${this.execution.id}-${this.version}`,
      executionId: this.execution.id,
      version: this.version,
      status: this.status,
      metadata: this.metadata,
      progress: this.progress,
      contextSnapshot: this.contextSnapshot ?? this.execution.context,
      timeline: this.timeline,
      owner: this.owner ?? this.execution.owner,
      correlationId: this.correlationId ?? this.execution.correlationId,
    });
  }
}

export class RuntimeCheckpointManager implements IRuntimeCheckpointManager {
  private readonly checkpoints = new Map<string, RuntimeCheckpoint[]>();
  private readonly eventBus?: RuntimeResilienceEventBus;
  private checkpointCount = 0;

  public constructor(eventBus?: RuntimeResilienceEventBus) {
    this.eventBus = eventBus;
  }

  public createCheckpoint(
    execution: IRuntimeExecution,
    options: {
      readonly version?: number;
      readonly metadata?: ExecutionMetadata;
      readonly progress?: number;
      readonly status?: ExecutionStatus;
      readonly contextSnapshot?: IRuntimeContext;
      readonly timeline?: readonly RuntimeExecutionTimelineEvent[];
    } = {},
  ): RuntimeCheckpoint {
    const version = options.version ?? this.nextVersion(execution.id);
    const checkpoint = new RuntimeCheckpoint({
      id: `checkpoint-${execution.id}-${version}`,
      executionId: execution.id,
      version,
      status: options.status ?? execution.status,
      metadata: options.metadata ?? execution.metadata,
      progress: options.progress ?? 0,
      contextSnapshot: options.contextSnapshot ?? execution.context,
      timeline: options.timeline ?? [],
      owner: execution.owner,
      correlationId: execution.correlationId,
    });

    const existing = this.checkpoints.get(execution.id) ?? [];
    existing.push(checkpoint);
    this.checkpoints.set(execution.id, existing);
    this.checkpointCount += 1;
    void this.publish({
      type: 'CheckpointCreated',
      timestamp: new Date().toISOString(),
      payload: checkpoint,
    });
    return checkpoint;
  }

  public getCheckpoint(executionId: string, version?: number): RuntimeCheckpoint | undefined {
    const checkpoints = this.checkpoints.get(executionId) ?? [];
    if (version === undefined) {
      return checkpoints.at(-1);
    }

    return checkpoints.find((checkpoint) => checkpoint.version === version);
  }

  public getLatestCheckpoint(executionId: string): RuntimeCheckpoint | undefined {
    return this.getCheckpoint(executionId);
  }

  public getCheckpointCount(): number {
    return this.checkpointCount;
  }

  private nextVersion(executionId: string): number {
    const existing = this.checkpoints.get(executionId) ?? [];
    return existing.length + 1;
  }

  private async publish(event: RuntimeResilienceEvent): Promise<void> {
    await this.eventBus?.publish(event);
  }
}

export class RuntimeExecutionSnapshot implements IRuntimeExecutionSnapshot {
  public readonly executionId: string;
  public readonly status: ExecutionStatus;
  public readonly priority: ExecutionPriority;
  public readonly owner: ExecutionOwner;
  public readonly metadata: ExecutionMetadata;
  public readonly startedAt?: string;
  public readonly endedAt?: string;
  public readonly durationMs?: number;
  public readonly cancellationState: IRuntimeExecutionSnapshot['cancellationState'];
  public readonly timeoutState: IRuntimeExecutionSnapshot['timeoutState'];
  public readonly timeline: readonly RuntimeExecutionTimelineEvent[];
  public readonly checkpointReference?: { readonly id: string; readonly version: number };

  public constructor(
    options: IRuntimeExecutionSnapshot & {
      readonly timeline?: readonly RuntimeExecutionTimelineEvent[];
    },
  ) {
    this.executionId = options.executionId;
    this.status = options.status;
    this.priority = options.priority;
    this.owner = options.owner;
    this.metadata = freezeMetadata(options.metadata);
    this.startedAt = options.startedAt;
    this.endedAt = options.endedAt;
    this.durationMs = options.durationMs;
    this.cancellationState = Object.freeze({ ...options.cancellationState });
    this.timeoutState = Object.freeze({ ...options.timeoutState });
    this.timeline = Object.freeze([...(options.timeline ?? [])]);
    this.checkpointReference = options.checkpointReference
      ? Object.freeze({ ...options.checkpointReference })
      : undefined;
  }
}

export class RuntimeExecutionHistory {
  private readonly snapshots: RuntimeExecutionSnapshot[] = [];

  public record(snapshot: RuntimeExecutionSnapshot): void {
    this.snapshots.push(snapshot);
  }

  public snapshot(): readonly RuntimeExecutionSnapshot[] {
    return Object.freeze([...this.snapshots]);
  }
}

export class RuntimeExecutionTimeline {
  private readonly events: RuntimeExecutionTimelineEvent[] = [];

  public record(type: string, payload?: ExecutionMetadata): void {
    this.events.push({
      type,
      timestamp: new Date().toISOString(),
      payload: payload ? freezeMetadata(payload) : undefined,
    });
  }

  public snapshot(): RuntimeExecutionTimelineSnapshot {
    return {
      events: Object.freeze([...this.events]),
    };
  }
}

export class RuntimeRecoveryHint implements IRuntimeRecoveryHint {
  public readonly code: string;
  public readonly message: string;
  public readonly checkpointId?: string;
  public readonly metadata: ExecutionMetadata;

  public constructor(options: {
    readonly code: string;
    readonly message: string;
    readonly checkpointId?: string;
    readonly metadata?: ExecutionMetadata;
  }) {
    this.code = options.code;
    this.message = options.message;
    this.checkpointId = options.checkpointId;
    this.metadata = freezeMetadata(options.metadata ?? {});
  }

  public static fromCheckpoint(
    checkpoint: IRuntimeCheckpoint,
    reason: string,
  ): RuntimeRecoveryHint {
    if (!reason.trim()) {
      throw new RecoveryHintException('Recovery reason is required');
    }

    return new RuntimeRecoveryHint({
      code: `recovery.${reason}`,
      message: `Recovery hint for ${checkpoint.executionId}`,
      checkpointId: checkpoint.id,
      metadata: {
        executionId: checkpoint.executionId,
        status: checkpoint.status,
      },
    });
  }
}

function freezeMetadata(metadata: ExecutionMetadata): ExecutionMetadata {
  return Object.freeze({ ...metadata }) as ExecutionMetadata;
}
