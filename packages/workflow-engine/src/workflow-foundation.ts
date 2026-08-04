import {
  ExecutionStatus,
  type CorrelationId,
  type Identifier,
  type IRuntime,
  type SerializableValueObject,
  type TimestampString,
} from '@infrashield/contracts';
import type { Context } from '@infrashield/context';

export type WorkflowOwner = string;
export type WorkflowTag = string;
export type WorkflowDescription = string;

export class WorkflowExecutionOptions {
  public readonly timeoutMs?: number;
  public readonly metadata?: SerializableValueObject;
  public readonly policies?: readonly string[];

  public constructor(
    options: {
      readonly timeoutMs?: number;
      readonly metadata?: SerializableValueObject;
      readonly policies?: readonly string[];
    } = {},
  ) {
    this.timeoutMs = options.timeoutMs;
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
    this.policies = options.policies ? Object.freeze([...options.policies]) : undefined;
  }
}

export enum WorkflowState {
  Created = 'created',
  Validated = 'validated',
  Ready = 'ready',
  Running = 'running',
  Paused = 'paused',
  Waiting = 'waiting',
  WaitingApproval = 'waitingApproval',
  WaitingExternalEvent = 'waitingExternalEvent',
  Suspended = 'suspended',
  Retrying = 'retrying',
  Compensating = 'compensating',
  Completed = 'completed',
  Cancelled = 'cancelled',
  Failed = 'failed',
  TimedOut = 'timedOut',
}

export interface IWorkflowDefinition {
  readonly id: WorkflowIdentifier;
  readonly name: string;
  readonly version: WorkflowVersion;
  readonly metadata: SerializableValueObject;
  readonly owner: WorkflowOwner;
  readonly correlationId: CorrelationId;
  readonly tags: readonly WorkflowTag[];
  readonly description?: WorkflowDescription;
  readonly executionOptions?: WorkflowExecutionOptions;
  validate(): void;
}

export interface IWorkflowBuilder {
  withId(id: string): this;
  withName(name: string): this;
  withVersion(version: string): this;
  withMetadata(metadata: SerializableValueObject): this;
  withOwner(owner: WorkflowOwner): this;
  withCorrelationId(correlationId: CorrelationId): this;
  withTags(tags: readonly WorkflowTag[]): this;
  withDescription(description: WorkflowDescription): this;
  withExecutionOptions(options: WorkflowExecutionOptions): this;
  build(): IWorkflowDefinition;
}

export interface IWorkflowExecution {
  readonly id: Identifier;
  readonly definition: IWorkflowDefinition;
  readonly status: WorkflowState;
  readonly history: readonly WorkflowState[];
  readonly context: WorkflowExecutionContext;
  readonly startedAt?: TimestampString;
  readonly completedAt?: TimestampString;
  readonly result?: WorkflowResult;
  readonly error?: WorkflowExecutionException;
  start(): Promise<void>;
  complete(result: WorkflowResult | SerializableValueObject): Promise<void>;
  cancel(reason?: string): Promise<void>;
  fail(error: WorkflowExecutionException | string): Promise<void>;
  timeout(reason?: string): Promise<void>;
  snapshot(): WorkflowExecutionSnapshot;
}

export interface IWorkflowContext {
  readonly workflowId: Identifier;
  readonly correlationId: CorrelationId;
  readonly metadata: SerializableValueObject;
  readonly requestContext?: Context;
}

export interface IWorkflowResult {
  readonly workflowId: Identifier;
  readonly status: WorkflowState;
  readonly succeeded: boolean;
  readonly output?: SerializableValueObject;
  readonly error?: WorkflowExecutionException;
  readonly startedAt: TimestampString;
  readonly completedAt?: TimestampString;
}

export interface IWorkflowValidator {
  validate(definition: IWorkflowDefinition): void;
}

export interface IWorkflowObserver {
  onStateChange(
    execution: IWorkflowExecution,
    from: WorkflowState,
    to: WorkflowState,
  ): void | Promise<void>;
}

export class WorkflowIdentifier {
  public constructor(public readonly value: string) {
    if (!value.trim()) {
      throw new WorkflowValidationException('Workflow identifier is required');
    }
  }

  public toString(): string {
    return this.value;
  }
}

export class WorkflowVersion {
  public constructor(public readonly value: string) {
    if (!/^(\d+)\.(\d+)\.(\d+)$/.test(value)) {
      throw new WorkflowVersionException(`Invalid workflow version '${value}'`);
    }
  }

  public toString(): string {
    return this.value;
  }
}

export class WorkflowException extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkflowException';
  }
}

export class WorkflowDefinitionException extends WorkflowException {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkflowDefinitionException';
  }
}

export class WorkflowBuilderException extends WorkflowException {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkflowBuilderException';
  }
}

export class WorkflowMetadataException extends WorkflowException {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkflowMetadataException';
  }
}

export class WorkflowValidationException extends WorkflowException {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkflowValidationException';
  }
}

export class WorkflowExecutionException extends WorkflowException {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkflowExecutionException';
  }
}

export class WorkflowStateException extends WorkflowException {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkflowStateException';
  }
}

export class WorkflowVersionException extends WorkflowException {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkflowVersionException';
  }
}

export class WorkflowDefinition implements IWorkflowDefinition {
  public readonly id: WorkflowIdentifier;
  public readonly name: string;
  public readonly version: WorkflowVersion;
  public readonly metadata: SerializableValueObject;
  public readonly owner: WorkflowOwner;
  public readonly correlationId: CorrelationId;
  public readonly tags: readonly WorkflowTag[];
  public readonly description?: WorkflowDescription;
  public readonly executionOptions?: WorkflowExecutionOptions;
  private readonly validator: IWorkflowValidator;

  public constructor(options: {
    readonly id: string;
    readonly name: string;
    readonly version: string;
    readonly metadata?: SerializableValueObject;
    readonly owner: string;
    readonly correlationId: CorrelationId;
    readonly tags?: readonly WorkflowTag[];
    readonly description?: WorkflowDescription;
    readonly executionOptions?: WorkflowExecutionOptions;
    readonly validator?: IWorkflowValidator;
  }) {
    this.id = new WorkflowIdentifier(options.id);
    this.name = options.name.trim();
    this.version = new WorkflowVersion(options.version);
    this.metadata = Object.freeze({ ...(options.metadata ?? {}) });
    this.owner = options.owner.trim();
    this.correlationId = options.correlationId;
    this.tags = Object.freeze([...(options.tags ?? [])]);
    this.description = options.description?.trim();
    this.executionOptions = options.executionOptions
      ? Object.freeze({ ...options.executionOptions })
      : undefined;
    this.validator = options.validator ?? new WorkflowValidator();
    this.validate();
  }

  public validate(): void {
    this.validator.validate(this);
  }
}

export class WorkflowBuilder implements IWorkflowBuilder {
  private id?: string;
  private name?: string;
  private version = '1.0.0';
  private metadata: SerializableValueObject = {};
  private owner?: string;
  private correlationId?: CorrelationId;
  private tags: WorkflowTag[] = [];
  private description?: WorkflowDescription;
  private executionOptions?: WorkflowExecutionOptions;

  public withId(id: string): this {
    this.id = id;
    return this;
  }

  public withName(name: string): this {
    this.name = name;
    return this;
  }

  public withVersion(version: string): this {
    this.version = version;
    return this;
  }

  public withMetadata(metadata: SerializableValueObject): this {
    this.metadata = metadata;
    return this;
  }

  public withOwner(owner: WorkflowOwner): this {
    this.owner = owner;
    return this;
  }

  public withCorrelationId(correlationId: CorrelationId): this {
    this.correlationId = correlationId;
    return this;
  }

  public withTags(tags: readonly WorkflowTag[]): this {
    this.tags = [...tags];
    return this;
  }

  public withDescription(description: WorkflowDescription): this {
    this.description = description;
    return this;
  }

  public withExecutionOptions(options: WorkflowExecutionOptions): this {
    this.executionOptions = options;
    return this;
  }

  public build(): IWorkflowDefinition {
    return new WorkflowDefinition({
      id: this.id ?? '',
      name: this.name ?? '',
      version: this.version,
      metadata: this.metadata,
      owner: this.owner ?? '',
      correlationId: this.correlationId ?? '',
      tags: this.tags,
      description: this.description,
      executionOptions: this.executionOptions,
    });
  }
}

export class WorkflowValidator implements IWorkflowValidator {
  public validate(definition: IWorkflowDefinition): void {
    if (!definition.id.value.trim()) {
      throw new WorkflowValidationException('Workflow identifier is required');
    }

    if (!definition.name.trim()) {
      throw new WorkflowValidationException('Workflow name is required');
    }

    if (!definition.owner.trim()) {
      throw new WorkflowValidationException('Workflow owner is required');
    }

    if (!definition.correlationId.trim()) {
      throw new WorkflowValidationException('Workflow correlationId is required');
    }

    if (!definition.version.value.trim()) {
      throw new WorkflowValidationException('Workflow version is required');
    }

    if (Object.keys(definition.metadata).length === 0) {
      throw new WorkflowValidationException('Workflow metadata is required');
    }

    if (definition.tags.length === 0) {
      throw new WorkflowValidationException('Workflow tags are required');
    }
  }
}

export class WorkflowExecutionContext implements IWorkflowContext {
  public readonly workflowId: Identifier;
  public readonly correlationId: CorrelationId;
  public readonly metadata: SerializableValueObject;
  public readonly requestContext?: Context;

  public constructor(options: {
    readonly workflowId: Identifier;
    readonly correlationId: CorrelationId;
    readonly metadata?: SerializableValueObject;
    readonly requestContext?: Context;
  }) {
    this.workflowId = options.workflowId;
    this.correlationId = options.correlationId;
    this.metadata = Object.freeze({ ...(options.metadata ?? {}) });
    this.requestContext = options.requestContext;
  }
}

export class WorkflowExecutionMetadata {
  public readonly workflowId: Identifier;
  public readonly correlationId: CorrelationId;
  public readonly startedAt?: TimestampString;
  public readonly completedAt?: TimestampString;
  public readonly metadata: SerializableValueObject;

  public constructor(options: {
    readonly workflowId: Identifier;
    readonly correlationId: CorrelationId;
    readonly startedAt?: TimestampString;
    readonly completedAt?: TimestampString;
    readonly metadata?: SerializableValueObject;
  }) {
    this.workflowId = options.workflowId;
    this.correlationId = options.correlationId;
    this.startedAt = options.startedAt;
    this.completedAt = options.completedAt;
    this.metadata = Object.freeze({ ...(options.metadata ?? {}) });
  }
}

export class WorkflowExecutionHistory {
  public constructor(public readonly values: readonly WorkflowState[] = []) {}

  public append(state: WorkflowState): WorkflowExecutionHistory {
    return new WorkflowExecutionHistory([...this.values, state]);
  }
}

export class WorkflowExecution implements IWorkflowExecution {
  public readonly id: Identifier;
  public readonly definition: IWorkflowDefinition;
  public readonly context: WorkflowExecutionContext;
  public readonly createdAt: TimestampString;
  public startedAt?: TimestampString;
  public completedAt?: TimestampString;
  public result?: WorkflowResult;
  public error?: WorkflowExecutionException;
  private _status: WorkflowState = WorkflowState.Created;
  private readonly observers: IWorkflowObserver[] = [];
  private historyStore = new WorkflowExecutionHistory([WorkflowState.Created]);

  public constructor(options: {
    readonly definition: IWorkflowDefinition;
    readonly context?: WorkflowExecutionContext;
    readonly observers?: readonly IWorkflowObserver[];
  }) {
    this.id = `${options.definition.id.value}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    this.definition = options.definition;
    this.context =
      options.context ??
      new WorkflowExecutionContext({
        workflowId: this.definition.id.value,
        correlationId: this.definition.correlationId,
        metadata: {},
      });
    this.createdAt = new Date().toISOString();
    if (options.observers) {
      this.observers.push(...options.observers);
    }
  }

  public get history(): readonly WorkflowState[] {
    return this.historyStore.values;
  }

  public get status(): WorkflowState {
    return this._status;
  }

  public async start(): Promise<void> {
    await this.transitionTo(WorkflowState.Running, 'started');
  }

  public async complete(result: WorkflowResult | SerializableValueObject): Promise<void> {
    const workflowResult =
      result instanceof WorkflowResult
        ? result
        : new WorkflowResult({
            workflowId: this.definition.id.value,
            status: WorkflowState.Completed,
            succeeded: true,
            output: result,
          });
    await this.transitionTo(WorkflowState.Completed, 'completed', workflowResult);
  }

  public async cancel(reason?: string): Promise<void> {
    await this.transitionTo(WorkflowState.Cancelled, 'cancelled', undefined, reason);
  }

  public async fail(error: WorkflowExecutionException | string): Promise<void> {
    const executionError =
      typeof error === 'string' ? new WorkflowExecutionException(error) : error;
    await this.transitionTo(WorkflowState.Failed, 'failed', undefined, undefined, executionError);
  }

  public async timeout(reason?: string): Promise<void> {
    await this.transitionTo(WorkflowState.TimedOut, 'timedOut', undefined, reason);
  }

  public snapshot(): WorkflowExecutionSnapshot {
    return new WorkflowExecutionSnapshot({
      workflowId: this.definition.id.value,
      correlationId: this.context.correlationId,
      status: this._status,
      history: [...this.history],
      metadata: { ...(this.context.metadata ?? {}) },
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      result: this.result,
      error: this.error,
    });
  }

  private async transitionTo(
    nextState: WorkflowState,
    reason: string,
    workflowResult?: WorkflowResult,
    _reasonText?: string,
    executionError?: WorkflowExecutionException,
  ): Promise<void> {
    const from = this._status;
    if (!isValidTransition(from, nextState)) {
      throw new WorkflowStateException(
        `Cannot transition workflow from ${from} to ${nextState} (${reason})`,
      );
    }

    this._status = nextState;
    this.historyStore = this.historyStore.append(nextState);
    if (nextState === WorkflowState.Running) {
      this.startedAt = new Date().toISOString();
    }
    if (
      nextState === WorkflowState.Completed ||
      nextState === WorkflowState.Failed ||
      nextState === WorkflowState.Cancelled ||
      nextState === WorkflowState.TimedOut
    ) {
      this.completedAt = new Date().toISOString();
    }
    if (workflowResult) {
      this.result = workflowResult;
    }
    if (executionError) {
      this.error = executionError;
    }

    for (const observer of this.observers) {
      await observer.onStateChange(this, from, nextState);
    }
  }
}

export class WorkflowExecutionSnapshot {
  public readonly workflowId: Identifier;
  public readonly correlationId: CorrelationId;
  public readonly status: WorkflowState;
  public readonly history: readonly WorkflowState[];
  public readonly metadata: SerializableValueObject;
  public readonly startedAt?: TimestampString;
  public readonly completedAt?: TimestampString;
  public readonly result?: WorkflowResult;
  public readonly error?: WorkflowExecutionException;

  public constructor(options: {
    readonly workflowId: Identifier;
    readonly correlationId: CorrelationId;
    readonly status: WorkflowState;
    readonly history: readonly WorkflowState[];
    readonly metadata: SerializableValueObject;
    readonly startedAt?: TimestampString;
    readonly completedAt?: TimestampString;
    readonly result?: WorkflowResult;
    readonly error?: WorkflowExecutionException;
  }) {
    this.workflowId = options.workflowId;
    this.correlationId = options.correlationId;
    this.status = options.status;
    this.history = Object.freeze([...options.history]);
    this.metadata = Object.freeze({ ...(options.metadata ?? {}) });
    this.startedAt = options.startedAt;
    this.completedAt = options.completedAt;
    this.result = options.result;
    this.error = options.error;
  }
}

export class WorkflowResult implements IWorkflowResult {
  public readonly workflowId: Identifier;
  public readonly status: WorkflowState;
  public readonly succeeded: boolean;
  public readonly output?: SerializableValueObject;
  public readonly error?: WorkflowExecutionException;
  public readonly startedAt: TimestampString;
  public readonly completedAt?: TimestampString;

  public constructor(options: {
    readonly workflowId: Identifier;
    readonly status: WorkflowState;
    readonly succeeded: boolean;
    readonly output?: SerializableValueObject;
    readonly error?: WorkflowExecutionException;
    readonly startedAt?: TimestampString;
    readonly completedAt?: TimestampString;
  }) {
    this.workflowId = options.workflowId;
    this.status = options.status;
    this.succeeded = options.succeeded;
    this.output = options.output ? Object.freeze({ ...options.output }) : undefined;
    this.error = options.error;
    this.startedAt = options.startedAt ?? new Date().toISOString();
    this.completedAt = options.completedAt;
  }
}

export class WorkflowEngine {
  private runtime?: IRuntime;

  public constructor(runtime?: IRuntime) {
    this.runtime = runtime;
  }

  public async execute(definition: IWorkflowDefinition): Promise<IWorkflowResult> {
    definition.validate();
    const execution = new WorkflowExecution({ definition });
    await execution.start();

    if (this.runtime) {
      const runtimeExecution = this.runtime.createExecution({
        id: definition.id.value,
        owner: { id: definition.owner, type: 'workflow' },
        correlationId: definition.correlationId,
        metadata: {
          workflowName: definition.name,
          workflowVersion: definition.version.toString(),
        },
      });

      await runtimeExecution.queue();
      await runtimeExecution.start();
      await runtimeExecution.complete({
        status: ExecutionStatus.Completed,
        output: { workflowId: definition.id.value, executed: true },
        metadata: { workflowName: definition.name },
      });
    }

    const result = new WorkflowResult({
      workflowId: definition.id.value,
      status: WorkflowState.Completed,
      succeeded: true,
      output: { executed: true },
    });
    await execution.complete(result);
    return result;
  }
}

function isValidTransition(from: WorkflowState, to: WorkflowState): boolean {
  const transitions: Record<WorkflowState, readonly WorkflowState[]> = {
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
    [WorkflowState.Retrying]: [WorkflowState.Running, WorkflowState.Compensating],
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

  return transitions[from]?.includes(to) ?? false;
}
