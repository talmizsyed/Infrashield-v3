import {
  EventEnvelope,
  EventMetadata,
  type IEvent,
  type IEventBus,
} from '@infrashield/core-infrastructure';

import {
  WorkflowExecutionException,
  WorkflowExecutionHistory,
  WorkflowState,
} from './workflow-foundation.js';

export { WorkflowExecutionException, WorkflowState } from './workflow-foundation.js';

export interface IWorkflowStateMachine {
  readonly workflowId: string;
  readonly correlationId: string;
  readonly state: WorkflowState;
  readonly history: WorkflowExecutionHistory;
  readonly journal: WorkflowExecutionJournal;
  readonly metrics: WorkflowExecutionMetrics;
  create(): void;
  validate(): void;
  start(): void;
  pause(reason: string): void;
  resume(reason: string): void;
  suspend(reason: string): void;
  wait(reason: string): void;
  waitForApproval(reason: string): void;
  waitForExternalEvent(reason: string): void;
  retry(reason: string): void;
  compensate(reason: string): void;
  complete(output?: Record<string, unknown>): void;
  cancel(reason: string): void;
  fail(reason: string): void;
  timeout(reason: string): void;
  checkpoint(options: WorkflowCheckpointOptions): WorkflowExecutionCheckpoint | undefined;
  createSuspensionContext(options: { readonly reason: string }): WorkflowSuspensionContext;
  snapshot(): WorkflowExecutionSnapshot;
}

export interface IWorkflowState {
  readonly workflowId: string;
  readonly correlationId: string;
  readonly state: WorkflowState;
  readonly history: readonly WorkflowState[];
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface IWorkflowTransition {
  readonly from: WorkflowState;
  readonly to: WorkflowState;
  readonly actor: string;
  readonly reason: string;
  readonly correlationId: string;
  readonly timestamp: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface IWorkflowJournal {
  readonly transitions: readonly WorkflowTransition[];
  snapshot(): WorkflowExecutionJournal;
}

export interface IWorkflowExecutionHistory {
  readonly values: readonly WorkflowState[];
  append(state: WorkflowState): WorkflowExecutionHistory;
}

export class WorkflowStateMachineException extends WorkflowExecutionException {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkflowStateMachineException';
  }
}

export class WorkflowTransitionException extends WorkflowExecutionException {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkflowTransitionException';
  }
}

export class WorkflowPauseException extends WorkflowExecutionException {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkflowPauseException';
  }
}

export class WorkflowResumeException extends WorkflowExecutionException {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkflowResumeException';
  }
}

export class WorkflowCheckpointException extends WorkflowExecutionException {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkflowCheckpointException';
  }
}

export class WorkflowTransitionValidator {
  public validate(transition: IWorkflowTransition, machine: IWorkflowStateMachine): void {
    const isInitialCreate =
      transition.from === WorkflowState.Created &&
      transition.to === WorkflowState.Created &&
      machine.journal.transitions.length === 0;

    if (transition.from === transition.to && transition.from !== WorkflowState.Created) {
      throw new WorkflowTransitionException('Transition cannot be self-referential');
    }

    const allowed = WorkflowStateMachine.allowedTransitions[transition.from] ?? [];
    if (
      !isInitialCreate &&
      transition.from !== WorkflowState.Created &&
      !allowed.includes(transition.to)
    ) {
      throw new WorkflowTransitionException(
        `Cannot transition from ${transition.from} to ${transition.to}`,
      );
    }

    if (!transition.actor.trim()) {
      throw new WorkflowTransitionException('Transition actor is required');
    }

    if (!transition.reason.trim()) {
      throw new WorkflowTransitionException('Transition reason is required');
    }

    if (transition.from !== machine.state && !machine.history.values.includes(transition.from)) {
      throw new WorkflowTransitionException('Transition does not match the machine state history');
    }
  }
}

export class WorkflowTransition implements IWorkflowTransition {
  public readonly from: WorkflowState;
  public readonly to: WorkflowState;
  public readonly actor: string;
  public readonly reason: string;
  public readonly correlationId: string;
  public readonly timestamp: string;
  public readonly metadata: Readonly<Record<string, unknown>>;

  public constructor(options: {
    readonly from: WorkflowState;
    readonly to: WorkflowState;
    readonly actor: string;
    readonly reason: string;
    readonly correlationId: string;
    readonly timestamp?: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }) {
    this.from = options.from;
    this.to = options.to;
    this.actor = options.actor.trim();
    this.reason = options.reason.trim();
    this.correlationId = options.correlationId.trim();
    this.timestamp = options.timestamp ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(options.metadata ?? {}) });
  }
}

export class WorkflowExecutionJournal implements IWorkflowJournal {
  private readonly transitionsStore: readonly WorkflowTransition[];

  public constructor(transitions: readonly WorkflowTransition[] = []) {
    this.transitionsStore = Object.freeze([...transitions]);
  }

  public get transitions(): readonly WorkflowTransition[] {
    return this.transitionsStore;
  }

  public append(transition: WorkflowTransition): WorkflowExecutionJournal {
    return new WorkflowExecutionJournal([...this.transitionsStore, transition]);
  }

  public snapshot(): WorkflowExecutionJournal {
    return new WorkflowExecutionJournal(this.transitionsStore);
  }
}

export class WorkflowExecutionCheckpoint {
  public readonly executionProgress: number;
  public readonly completedSteps: readonly string[];
  public readonly pendingSteps: readonly string[];
  public readonly workflowMetadata: Readonly<Record<string, unknown>>;
  public readonly recoveryMetadata: Readonly<Record<string, unknown>>;
  public readonly checkpointVersion: number;
  public readonly createdAt: string;

  public constructor(options: {
    readonly executionProgress: number;
    readonly completedSteps: readonly string[];
    readonly pendingSteps: readonly string[];
    readonly workflowMetadata: Readonly<Record<string, unknown>>;
    readonly recoveryMetadata: Readonly<Record<string, unknown>>;
    readonly checkpointVersion: number;
    readonly createdAt?: string;
  }) {
    this.executionProgress = options.executionProgress;
    this.completedSteps = Object.freeze([...options.completedSteps]);
    this.pendingSteps = Object.freeze([...options.pendingSteps]);
    this.workflowMetadata = Object.freeze({ ...(options.workflowMetadata ?? {}) });
    this.recoveryMetadata = Object.freeze({ ...(options.recoveryMetadata ?? {}) });
    this.checkpointVersion = options.checkpointVersion;
    this.createdAt = options.createdAt ?? new Date().toISOString();
  }
}

export class WorkflowPauseToken {
  public readonly reason: string;
  public readonly pausedAt: string;

  public constructor(reason: string, pausedAt?: string) {
    this.reason = reason.trim();
    this.pausedAt = pausedAt ?? new Date().toISOString();
  }
}

export class WorkflowResumeToken {
  public readonly reason: string;
  public readonly resumedAt: string;

  public constructor(reason: string, resumedAt?: string) {
    this.reason = reason.trim();
    this.resumedAt = resumedAt ?? new Date().toISOString();
  }
}

export class WorkflowSuspensionContext {
  public readonly reason: string;
  public readonly suspendedAt: string;
  public readonly correlationId: string;
  public readonly workflowId: string;

  public constructor(options: {
    readonly reason: string;
    readonly suspendedAt?: string;
    readonly correlationId: string;
    readonly workflowId: string;
  }) {
    this.reason = options.reason.trim();
    this.suspendedAt = options.suspendedAt ?? new Date().toISOString();
    this.correlationId = options.correlationId.trim();
    this.workflowId = options.workflowId.trim();
  }
}

export interface WorkflowCheckpointOptions {
  readonly executionProgress: number;
  readonly completedSteps: readonly string[];
  readonly pendingSteps: readonly string[];
  readonly workflowMetadata: Readonly<Record<string, unknown>>;
  readonly recoveryMetadata: Readonly<Record<string, unknown>>;
  readonly checkpointVersion: number;
}

export class WorkflowExecutionMetrics {
  public readonly stateDurationMs: number;
  public readonly transitionCount: number;
  public readonly pauseDurationMs: number;
  public readonly waitDurationMs: number;
  public readonly retryDurationMs: number;
  public readonly compensationDurationMs: number;
  public readonly checkpointCount: number;

  public constructor(
    options: {
      readonly stateDurationMs?: number;
      readonly transitionCount?: number;
      readonly pauseDurationMs?: number;
      readonly waitDurationMs?: number;
      readonly retryDurationMs?: number;
      readonly compensationDurationMs?: number;
      readonly checkpointCount?: number;
    } = {},
  ) {
    this.stateDurationMs = options.stateDurationMs ?? 0;
    this.transitionCount = options.transitionCount ?? 0;
    this.pauseDurationMs = options.pauseDurationMs ?? 0;
    this.waitDurationMs = options.waitDurationMs ?? 0;
    this.retryDurationMs = options.retryDurationMs ?? 0;
    this.compensationDurationMs = options.compensationDurationMs ?? 0;
    this.checkpointCount = options.checkpointCount ?? 0;
  }
}

export class WorkflowExecutionSnapshot {
  public readonly workflowId: string;
  public readonly correlationId: string;
  public readonly state: WorkflowState;
  public readonly history: WorkflowExecutionHistory;
  public readonly journal: WorkflowExecutionJournal;
  public readonly metrics: WorkflowExecutionMetrics;
  public readonly checkpoint?: WorkflowExecutionCheckpoint;
  public readonly metadata: Readonly<Record<string, unknown>>;

  public constructor(options: {
    readonly workflowId: string;
    readonly correlationId: string;
    readonly state: WorkflowState;
    readonly history: WorkflowExecutionHistory;
    readonly journal: WorkflowExecutionJournal;
    readonly metrics: WorkflowExecutionMetrics;
    readonly checkpoint?: WorkflowExecutionCheckpoint;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }) {
    this.workflowId = options.workflowId;
    this.correlationId = options.correlationId;
    this.state = options.state;
    this.history = options.history;
    this.journal = options.journal;
    this.metrics = options.metrics;
    this.checkpoint = options.checkpoint;
    this.metadata = Object.freeze({ ...(options.metadata ?? {}) });
  }
}

export class WorkflowStateMachine implements IWorkflowStateMachine {
  public readonly workflowId: string;
  public readonly correlationId: string;
  private readonly eventBus?: IEventBus;
  private readonly metadata: Readonly<Record<string, unknown>>;
  private readonly validator: WorkflowTransitionValidator;
  private stateValue: WorkflowState = WorkflowState.Created;
  private historyValue = new WorkflowExecutionHistory([WorkflowState.Created]);
  private journalValue = new WorkflowExecutionJournal();
  private metricsValue = new WorkflowExecutionMetrics();
  private checkpointValue?: WorkflowExecutionCheckpoint;
  private pauseToken?: WorkflowPauseToken;
  private resumeToken?: WorkflowResumeToken;

  public constructor(options: {
    readonly workflowId: string;
    readonly correlationId: string;
    readonly eventBus?: IEventBus;
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly validator?: WorkflowTransitionValidator;
  }) {
    if (!options.workflowId?.trim() || !options.correlationId?.trim()) {
      throw new WorkflowStateMachineException(
        'Workflow identifier and correlation id are required',
      );
    }

    this.workflowId = options.workflowId.trim();
    this.correlationId = options.correlationId.trim();
    this.eventBus = options.eventBus;
    this.metadata = Object.freeze({ ...(options.metadata ?? {}) });
    this.validator = options.validator ?? new WorkflowTransitionValidator();
  }

  public get state(): WorkflowState {
    return this.stateValue;
  }

  public get history(): WorkflowExecutionHistory {
    return this.historyValue;
  }

  public get journal(): WorkflowExecutionJournal {
    return this.journalValue;
  }

  public get metrics(): WorkflowExecutionMetrics {
    return this.metricsValue;
  }

  public create(): void {
    this.transition(WorkflowState.Created, 'system', 'created', {});
  }

  public validate(): void {
    this.transition(WorkflowState.Validated, 'system', 'validated', {});
  }

  public start(): void {
    this.transition(WorkflowState.Running, 'system', 'started', {});
  }

  public pause(reason: string): void {
    if (this.stateValue !== WorkflowState.Running && this.stateValue !== WorkflowState.Waiting) {
      throw new WorkflowPauseException('Workflow can only be paused from running or waiting state');
    }

    this.pauseToken = new WorkflowPauseToken(reason);
    this.transition(WorkflowState.Paused, 'system', reason, { pauseToken: this.pauseToken });
  }

  public resume(reason: string): void {
    if (this.stateValue !== WorkflowState.Paused) {
      throw new WorkflowResumeException('Workflow can only be resumed from paused state');
    }

    this.resumeToken = new WorkflowResumeToken(reason);
    this.transition(WorkflowState.Running, 'system', reason, { resumeToken: this.resumeToken });
  }

  public suspend(reason: string): void {
    if (this.stateValue !== WorkflowState.Running && this.stateValue !== WorkflowState.Waiting) {
      throw new WorkflowTransitionException(
        'Workflow can only be suspended from running or waiting state',
      );
    }

    this.transition(WorkflowState.Suspended, 'system', reason, { suspensionReason: reason });
  }

  public wait(reason: string): void {
    if (this.stateValue !== WorkflowState.Running) {
      throw new WorkflowTransitionException('Workflow can only wait from running state');
    }

    this.transition(WorkflowState.Waiting, 'system', reason, { waitReason: reason });
  }

  public waitForApproval(reason: string): void {
    if (this.stateValue !== WorkflowState.Running) {
      throw new WorkflowTransitionException(
        'Workflow can only wait for approval from running state',
      );
    }

    this.transition(WorkflowState.WaitingApproval, 'system', reason, { approvalReason: reason });
  }

  public waitForExternalEvent(reason: string): void {
    if (this.stateValue !== WorkflowState.Running) {
      throw new WorkflowTransitionException(
        'Workflow can only wait for external event from running state',
      );
    }

    this.transition(WorkflowState.WaitingExternalEvent, 'system', reason, {
      externalEventReason: reason,
    });
  }

  public retry(reason: string): void {
    if (this.stateValue !== WorkflowState.Failed && this.stateValue !== WorkflowState.Suspended) {
      throw new WorkflowTransitionException(
        'Workflow can only retry from failed or suspended state',
      );
    }

    this.transition(WorkflowState.Retrying, 'system', reason, { retryReason: reason });
  }

  public compensate(reason: string): void {
    if (this.stateValue !== WorkflowState.Retrying && this.stateValue !== WorkflowState.Failed) {
      throw new WorkflowTransitionException(
        'Workflow can only compensate from retrying or failed state',
      );
    }

    this.transition(WorkflowState.Compensating, 'system', reason, { compensationReason: reason });
  }

  public complete(output?: Record<string, unknown>): void {
    if (this.stateValue !== WorkflowState.Running && this.stateValue !== WorkflowState.Waiting) {
      throw new WorkflowTransitionException(
        'Workflow can only complete from running or waiting state',
      );
    }

    this.transition(WorkflowState.Completed, 'system', 'completed', {
      output,
    });
  }

  public cancel(reason: string): void {
    if (
      this.stateValue === WorkflowState.Completed ||
      this.stateValue === WorkflowState.Cancelled
    ) {
      throw new WorkflowTransitionException('Workflow cannot be cancelled from its terminal state');
    }

    this.transition(WorkflowState.Cancelled, 'system', reason, { cancellationReason: reason });
  }

  public fail(reason: string): void {
    if (this.stateValue === WorkflowState.Completed || this.stateValue === WorkflowState.Failed) {
      throw new WorkflowTransitionException('Workflow cannot fail from its terminal state');
    }

    this.transition(WorkflowState.Failed, 'system', reason, { failureReason: reason });
  }

  public timeout(reason: string): void {
    if (this.stateValue !== WorkflowState.Running && this.stateValue !== WorkflowState.Waiting) {
      throw new WorkflowTransitionException(
        'Workflow can only timeout from running or waiting state',
      );
    }

    this.transition(WorkflowState.TimedOut, 'system', reason, { timeoutReason: reason });
  }

  public checkpoint(options: WorkflowCheckpointOptions): WorkflowExecutionCheckpoint | undefined {
    if (this.stateValue !== WorkflowState.Running && this.stateValue !== WorkflowState.Waiting) {
      throw new WorkflowCheckpointException(
        'Checkpoint can only be created from running or waiting state',
      );
    }

    if (options.checkpointVersion < 1) {
      throw new WorkflowCheckpointException('Checkpoint version must be at least 1');
    }

    const checkpoint = new WorkflowExecutionCheckpoint({
      executionProgress: options.executionProgress,
      completedSteps: options.completedSteps,
      pendingSteps: options.pendingSteps,
      workflowMetadata: options.workflowMetadata,
      recoveryMetadata: options.recoveryMetadata,
      checkpointVersion: options.checkpointVersion,
    });

    this.checkpointValue = checkpoint;
    this.metricsValue = new WorkflowExecutionMetrics({
      ...this.metricsValue,
      checkpointCount: this.metricsValue.checkpointCount + 1,
    });
    this.publishEvent('WorkflowCheckpointCreated');
    return checkpoint;
  }

  public createSuspensionContext(options: { readonly reason: string }): WorkflowSuspensionContext {
    return new WorkflowSuspensionContext({
      reason: options.reason,
      correlationId: this.correlationId,
      workflowId: this.workflowId,
    });
  }

  public snapshot(): WorkflowExecutionSnapshot {
    return new WorkflowExecutionSnapshot({
      workflowId: this.workflowId,
      correlationId: this.correlationId,
      state: this.stateValue,
      history: this.historyValue,
      journal: this.journalValue,
      metrics: this.metricsValue,
      checkpoint: this.checkpointValue,
      metadata: this.metadata,
    });
  }

  private transition(
    nextState: WorkflowState,
    actor: string,
    reason: string,
    metadata: Readonly<Record<string, unknown>>,
  ): void {
    const from = this.stateValue;
    const transition = new WorkflowTransition({
      from,
      to: nextState,
      actor,
      reason,
      correlationId: this.correlationId,
      metadata,
    });

    this.validator.validate(transition, this);

    this.stateValue = nextState;
    const previousState = this.historyValue.values[this.historyValue.values.length - 1];
    if (previousState !== nextState) {
      this.historyValue = this.historyValue.append(nextState);
    }
    this.journalValue = this.journalValue.append(transition);
    this.metricsValue = new WorkflowExecutionMetrics({
      ...this.metricsValue,
      transitionCount: this.metricsValue.transitionCount + 1,
    });

    this.publishEvent(this.eventTypeFor(nextState));
  }

  private publishEvent(eventType: string): void {
    if (!this.eventBus) {
      return;
    }

    const event = new WorkflowStateMachineEvent({
      eventType,
      workflowId: this.workflowId,
      correlationId: this.correlationId,
      payload: {
        state: this.stateValue,
        history: this.historyValue.values,
        metrics: this.metricsValue,
      },
      metadata: { source: 'workflow-engine', state: this.stateValue },
    });

    void this.eventBus.publish(event);
  }

  private eventTypeFor(state: WorkflowState): string {
    switch (state) {
      case WorkflowState.Paused:
        return 'WorkflowPausedEvent';
      case WorkflowState.Running:
        return 'WorkflowResumedEvent';
      case WorkflowState.Suspended:
        return 'WorkflowSuspendedEvent';
      case WorkflowState.Waiting:
      case WorkflowState.WaitingApproval:
      case WorkflowState.WaitingExternalEvent:
        return 'WorkflowWaitingEvent';
      case WorkflowState.Retrying:
        return 'WorkflowRetryingEvent';
      case WorkflowState.Compensating:
        return 'WorkflowCompensatingEvent';
      case WorkflowState.Completed:
      case WorkflowState.Cancelled:
      case WorkflowState.Failed:
      case WorkflowState.TimedOut:
      case WorkflowState.Created:
      case WorkflowState.Validated:
      case WorkflowState.Ready:
      default:
        return 'WorkflowStateChangedEvent';
    }
  }

  public static allowedTransitions: Record<WorkflowState, readonly WorkflowState[]> = {
    [WorkflowState.Created]: [WorkflowState.Validated, WorkflowState.Ready, WorkflowState.Running],
    [WorkflowState.Validated]: [WorkflowState.Ready, WorkflowState.Running],
    [WorkflowState.Ready]: [WorkflowState.Running],
    [WorkflowState.Running]: [
      WorkflowState.Paused,
      WorkflowState.Waiting,
      WorkflowState.WaitingApproval,
      WorkflowState.WaitingExternalEvent,
      WorkflowState.Suspended,
      WorkflowState.Retrying,
      WorkflowState.Completed,
      WorkflowState.Cancelled,
      WorkflowState.Failed,
      WorkflowState.TimedOut,
    ],
    [WorkflowState.Paused]: [WorkflowState.Running],
    [WorkflowState.Waiting]: [
      WorkflowState.Running,
      WorkflowState.Suspended,
      WorkflowState.Completed,
    ],
    [WorkflowState.WaitingApproval]: [WorkflowState.Running, WorkflowState.Suspended],
    [WorkflowState.WaitingExternalEvent]: [WorkflowState.Running, WorkflowState.Suspended],
    [WorkflowState.Suspended]: [WorkflowState.Retrying, WorkflowState.Running],
    [WorkflowState.Retrying]: [WorkflowState.Compensating, WorkflowState.Running],
    [WorkflowState.Compensating]: [
      WorkflowState.Completed,
      WorkflowState.Failed,
      WorkflowState.Cancelled,
    ],
    [WorkflowState.Completed]: [],
    [WorkflowState.Cancelled]: [],
    [WorkflowState.Failed]: [WorkflowState.Retrying, WorkflowState.Compensating],
    [WorkflowState.TimedOut]: [],
  };
}

export class WorkflowStateMachineEvent implements IEvent {
  public readonly eventId: string;
  public readonly correlationId: string | undefined;
  public readonly timestamp: string;
  public readonly source: string;
  public readonly category: 'domain' | 'integration' | 'application' | 'system';
  public readonly priority: 'low' | 'normal' | 'high' | 'critical';
  public readonly version: number;
  public readonly tags: readonly string[];
  public readonly eventType: string;
  public readonly payload: Readonly<Record<string, unknown>>;
  public readonly metadata: EventMetadata;

  public constructor(options: {
    readonly eventType: string;
    readonly workflowId: string;
    readonly correlationId: string;
    readonly payload: Readonly<Record<string, unknown>>;
    readonly metadata: Readonly<Record<string, unknown>>;
  }) {
    this.eventId = `${options.workflowId}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    this.correlationId = options.correlationId;
    this.timestamp = new Date().toISOString();
    this.source = 'workflow-engine';
    this.category = 'domain';
    this.priority = 'normal';
    this.version = 1;
    this.tags = Object.freeze(['workflow', 'state-machine']);
    this.eventType = options.eventType;
    this.payload = Object.freeze({ workflowId: options.workflowId, ...options.payload });
    this.metadata = EventMetadata.create({
      eventId: this.eventId,
      correlationId: this.correlationId,
      timestamp: this.timestamp,
      source: this.source,
      category: this.category,
      priority: this.priority,
      version: this.version,
      tags: this.tags,
    });
  }

  public toEnvelope(): EventEnvelope<this> {
    return new EventEnvelope(this, this.metadata);
  }
}
