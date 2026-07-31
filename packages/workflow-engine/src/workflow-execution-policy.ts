import { WorkflowExecutionException } from './workflow-foundation.js';

export interface IWorkflowExecutionPolicy {
  readonly id: string;
  readonly name?: string;
  readonly kind: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly dependsOn: readonly string[];
  validate(): void;
  snapshot(): WorkflowExecutionPolicySnapshot;
}

export interface IRetryPolicy extends IWorkflowExecutionPolicy {
  readonly strategy: 'fixed' | 'exponential';
  readonly maxAttempts: number;
  readonly delayMs: number;
  readonly backoffMultiplier?: number;
  readonly retryConditions: readonly string[];
  readonly jitterMs?: number;
}

export interface ITimeoutPolicy extends IWorkflowExecutionPolicy {
  readonly executionTimeoutMs?: number;
  readonly queueTimeoutMs?: number;
  readonly approvalTimeoutMs?: number;
  readonly workflowTimeoutMs?: number;
}

export interface ICompensationPolicy extends IWorkflowExecutionPolicy {
  readonly compensationStepId?: string;
  readonly rollbackMetadata: Readonly<Record<string, unknown>>;
  readonly failureHandling?: 'fail' | 'skip' | 'continue';
}

export interface IConcurrencyPolicy extends IWorkflowExecutionPolicy {
  readonly mode: 'sequential' | 'parallel';
  readonly maxConcurrency?: number;
  readonly queueStrategy?: 'fifo' | 'priority' | 'distributed';
}

export interface IFailurePolicy extends IWorkflowExecutionPolicy {
  readonly action: 'fail' | 'skip' | 'continue' | 'retry' | 'compensate' | 'abort';
}

export interface ICancellationPolicy extends IWorkflowExecutionPolicy {
  readonly mode: 'fail' | 'skip' | 'continue' | 'compensate';
}

export interface IApprovalPolicy extends IWorkflowExecutionPolicy {
  readonly required: boolean;
  readonly timeoutMs?: number;
  readonly escalationMetadata: Readonly<Record<string, unknown>>;
  readonly approverMetadata: Readonly<Record<string, unknown>>;
}

export interface IRateLimitPolicy extends IWorkflowExecutionPolicy {
  readonly limit: number;
  readonly windowMs: number;
  readonly burst?: number;
}

export type WorkflowExecutionPolicyKind =
  | 'retry'
  | 'timeout'
  | 'compensation'
  | 'concurrency'
  | 'failure'
  | 'cancellation'
  | 'approval'
  | 'rate-limit';

export interface WorkflowExecutionPolicySnapshot {
  readonly id: string;
  readonly name?: string;
  readonly kind: WorkflowExecutionPolicyKind;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly dependsOn: readonly string[];
  readonly strategy?: 'fixed' | 'exponential';
  readonly maxAttempts?: number;
  readonly delayMs?: number;
  readonly backoffMultiplier?: number;
  readonly retryConditions?: readonly string[];
  readonly jitterMs?: number;
  readonly executionTimeoutMs?: number;
  readonly queueTimeoutMs?: number;
  readonly approvalTimeoutMs?: number;
  readonly workflowTimeoutMs?: number;
  readonly compensationStepId?: string;
  readonly rollbackMetadata?: Readonly<Record<string, unknown>>;
  readonly failureHandling?: 'fail' | 'skip' | 'continue';
  readonly mode?: 'sequential' | 'parallel' | 'fail' | 'skip' | 'continue' | 'compensate';
  readonly maxConcurrency?: number;
  readonly queueStrategy?: 'fifo' | 'priority' | 'distributed';
  readonly action?: 'fail' | 'skip' | 'continue' | 'retry' | 'compensate' | 'abort';
  readonly required?: boolean;
  readonly timeoutMs?: number;
  readonly escalationMetadata?: Readonly<Record<string, unknown>>;
  readonly approverMetadata?: Readonly<Record<string, unknown>>;
  readonly limit?: number;
  readonly windowMs?: number;
  readonly burst?: number;
}

export class WorkflowExecutionPolicyValidationException extends WorkflowExecutionException {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkflowExecutionPolicyValidationException';
  }
}

export class WorkflowExecutionPolicyException extends WorkflowExecutionException {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkflowExecutionPolicyException';
  }
}

export class WorkflowExecutionPolicy implements IWorkflowExecutionPolicy {
  public readonly id: string;
  public readonly name?: string;
  public readonly kind: WorkflowExecutionPolicyKind;
  public readonly metadata: Readonly<Record<string, unknown>>;
  public readonly dependsOn: readonly string[];

  public constructor(options: {
    readonly id: string;
    readonly name?: string;
    readonly kind: WorkflowExecutionPolicyKind;
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly dependsOn?: readonly string[];
  }) {
    if (!options.id?.trim()) {
      throw new WorkflowExecutionPolicyValidationException('Policy identifier is required');
    }
    this.id = options.id.trim();
    this.name = options.name?.trim();
    this.kind = options.kind;
    this.metadata = Object.freeze({ ...(options.metadata ?? {}) });
    this.dependsOn = Object.freeze([...(options.dependsOn ?? [])]);
    this.validate();
  }

  public validate(): void {
    if (this.dependsOn.includes(this.id)) {
      throw new WorkflowExecutionPolicyValidationException('Policy cannot depend on itself');
    }
  }

  public snapshot(): WorkflowExecutionPolicySnapshot {
    return {
      id: this.id,
      name: this.name,
      kind: this.kind,
      metadata: this.metadata,
      dependsOn: this.dependsOn,
    };
  }
}

export class WorkflowRetryPolicy extends WorkflowExecutionPolicy implements IRetryPolicy {
  public readonly strategy: 'fixed' | 'exponential';
  public readonly maxAttempts: number;
  public readonly delayMs: number;
  public readonly backoffMultiplier?: number;
  public readonly retryConditions: readonly string[];
  public readonly jitterMs?: number;

  public constructor(options: {
    readonly id: string;
    readonly name?: string;
    readonly strategy?: 'fixed' | 'exponential';
    readonly maxAttempts?: number;
    readonly delayMs?: number;
    readonly backoffMultiplier?: number;
    readonly retryConditions?: readonly string[];
    readonly jitterMs?: number;
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly dependsOn?: readonly string[];
  }) {
    super({
      id: options.id,
      name: options.name,
      kind: 'retry',
      metadata: options.metadata,
      dependsOn: options.dependsOn,
    });
    this.strategy = options.strategy ?? 'fixed';
    this.maxAttempts = options.maxAttempts ?? 1;
    this.delayMs = options.delayMs ?? 0;
    this.backoffMultiplier = options.backoffMultiplier;
    this.retryConditions = Object.freeze([...(options.retryConditions ?? [])]);
    this.jitterMs = options.jitterMs;
    this.validate();
  }

  public override validate(): void {
    super.validate();
    if (this.maxAttempts < 1) {
      throw new WorkflowExecutionPolicyValidationException('Retry maxAttempts must be at least 1');
    }
    if (this.delayMs < 0) {
      throw new WorkflowExecutionPolicyValidationException('Retry delayMs must be non-negative');
    }
    if (this.backoffMultiplier !== undefined && this.backoffMultiplier < 1) {
      throw new WorkflowExecutionPolicyValidationException(
        'Retry backoffMultiplier must be at least 1',
      );
    }
    if (this.jitterMs !== undefined && this.jitterMs < 0) {
      throw new WorkflowExecutionPolicyValidationException('Retry jitterMs must be non-negative');
    }
  }
}

export class WorkflowTimeoutPolicy extends WorkflowExecutionPolicy implements ITimeoutPolicy {
  public readonly executionTimeoutMs?: number;
  public readonly queueTimeoutMs?: number;
  public readonly approvalTimeoutMs?: number;
  public readonly workflowTimeoutMs?: number;

  public constructor(options: {
    readonly id: string;
    readonly name?: string;
    readonly executionTimeoutMs?: number;
    readonly queueTimeoutMs?: number;
    readonly approvalTimeoutMs?: number;
    readonly workflowTimeoutMs?: number;
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly dependsOn?: readonly string[];
  }) {
    super({
      id: options.id,
      name: options.name,
      kind: 'timeout',
      metadata: options.metadata,
      dependsOn: options.dependsOn,
    });
    this.executionTimeoutMs = options.executionTimeoutMs;
    this.queueTimeoutMs = options.queueTimeoutMs;
    this.approvalTimeoutMs = options.approvalTimeoutMs;
    this.workflowTimeoutMs = options.workflowTimeoutMs;
    this.validate();
  }

  public override validate(): void {
    super.validate();
    const values = [
      this.executionTimeoutMs,
      this.queueTimeoutMs,
      this.approvalTimeoutMs,
      this.workflowTimeoutMs,
    ];
    for (const value of values) {
      if (value !== undefined && value < 0) {
        throw new WorkflowExecutionPolicyValidationException('Timeout values must be non-negative');
      }
    }
  }

  public override snapshot(): WorkflowExecutionPolicySnapshot {
    return {
      ...super.snapshot(),
      executionTimeoutMs: this.executionTimeoutMs,
      queueTimeoutMs: this.queueTimeoutMs,
      approvalTimeoutMs: this.approvalTimeoutMs,
      workflowTimeoutMs: this.workflowTimeoutMs,
    };
  }
}

export class WorkflowCompensationPolicy
  extends WorkflowExecutionPolicy
  implements ICompensationPolicy
{
  public readonly compensationStepId?: string;
  public readonly rollbackMetadata: Readonly<Record<string, unknown>>;
  public readonly failureHandling?: 'fail' | 'skip' | 'continue';

  public constructor(options: {
    readonly id: string;
    readonly name?: string;
    readonly compensationStepId?: string;
    readonly rollbackMetadata?: Readonly<Record<string, unknown>>;
    readonly failureHandling?: 'fail' | 'skip' | 'continue';
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly dependsOn?: readonly string[];
  }) {
    super({
      id: options.id,
      name: options.name,
      kind: 'compensation',
      metadata: options.metadata,
      dependsOn: options.dependsOn,
    });
    this.compensationStepId = options.compensationStepId?.trim();
    this.rollbackMetadata = Object.freeze({ ...(options.rollbackMetadata ?? {}) });
    this.failureHandling = options.failureHandling;
    this.validate();
  }

  public override validate(): void {
    super.validate();
    if (this.compensationStepId !== undefined && !this.compensationStepId.trim()) {
      throw new WorkflowExecutionPolicyValidationException(
        'Compensation step reference must be non-empty',
      );
    }
  }
}

export class WorkflowConcurrencyPolicy
  extends WorkflowExecutionPolicy
  implements IConcurrencyPolicy
{
  public readonly mode: 'sequential' | 'parallel';
  public readonly maxConcurrency?: number;
  public readonly queueStrategy?: 'fifo' | 'priority' | 'distributed';

  public constructor(options: {
    readonly id: string;
    readonly name?: string;
    readonly mode?: 'sequential' | 'parallel';
    readonly maxConcurrency?: number;
    readonly queueStrategy?: 'fifo' | 'priority' | 'distributed';
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly dependsOn?: readonly string[];
  }) {
    super({
      id: options.id,
      name: options.name,
      kind: 'concurrency',
      metadata: options.metadata,
      dependsOn: options.dependsOn,
    });
    this.mode = options.mode ?? 'sequential';
    this.maxConcurrency = options.maxConcurrency;
    this.queueStrategy = options.queueStrategy;
    this.validate();
  }

  public override validate(): void {
    super.validate();
    if (this.maxConcurrency !== undefined && this.maxConcurrency < 1) {
      throw new WorkflowExecutionPolicyValidationException(
        'Concurrency maxConcurrency must be at least 1',
      );
    }
  }
}

export class WorkflowFailurePolicy extends WorkflowExecutionPolicy implements IFailurePolicy {
  public readonly action: 'fail' | 'skip' | 'continue' | 'retry' | 'compensate' | 'abort';

  public constructor(options: {
    readonly id: string;
    readonly name?: string;
    readonly action: 'fail' | 'skip' | 'continue' | 'retry' | 'compensate' | 'abort';
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly dependsOn?: readonly string[];
  }) {
    super({
      id: options.id,
      name: options.name,
      kind: 'failure',
      metadata: options.metadata,
      dependsOn: options.dependsOn,
    });
    this.action = options.action;
    this.validate();
  }
}

export class WorkflowCancellationPolicy
  extends WorkflowExecutionPolicy
  implements ICancellationPolicy
{
  public readonly mode: 'fail' | 'skip' | 'continue' | 'compensate';

  public constructor(options: {
    readonly id: string;
    readonly name?: string;
    readonly mode: 'fail' | 'skip' | 'continue' | 'compensate';
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly dependsOn?: readonly string[];
  }) {
    super({
      id: options.id,
      name: options.name,
      kind: 'cancellation',
      metadata: options.metadata,
      dependsOn: options.dependsOn,
    });
    this.mode = options.mode;
    this.validate();
  }
}

export class WorkflowApprovalPolicy extends WorkflowExecutionPolicy implements IApprovalPolicy {
  public readonly required: boolean;
  public readonly timeoutMs?: number;
  public readonly escalationMetadata: Readonly<Record<string, unknown>>;
  public readonly approverMetadata: Readonly<Record<string, unknown>>;

  public constructor(options: {
    readonly id: string;
    readonly name?: string;
    readonly required?: boolean;
    readonly timeoutMs?: number;
    readonly escalationMetadata?: Readonly<Record<string, unknown>>;
    readonly approverMetadata?: Readonly<Record<string, unknown>>;
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly dependsOn?: readonly string[];
  }) {
    super({
      id: options.id,
      name: options.name,
      kind: 'approval',
      metadata: options.metadata,
      dependsOn: options.dependsOn,
    });
    this.required = options.required ?? false;
    this.timeoutMs = options.timeoutMs;
    this.escalationMetadata = Object.freeze({ ...(options.escalationMetadata ?? {}) });
    this.approverMetadata = Object.freeze({ ...(options.approverMetadata ?? {}) });
    this.validate();
  }

  public override validate(): void {
    super.validate();
    if (this.timeoutMs !== undefined && this.timeoutMs < 0) {
      throw new WorkflowExecutionPolicyValidationException(
        'Approval timeoutMs must be non-negative',
      );
    }
  }
}

export class WorkflowRateLimitPolicy extends WorkflowExecutionPolicy implements IRateLimitPolicy {
  public readonly limit: number;
  public readonly windowMs: number;
  public readonly burst?: number;

  public constructor(options: {
    readonly id: string;
    readonly name?: string;
    readonly limit: number;
    readonly windowMs: number;
    readonly burst?: number;
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly dependsOn?: readonly string[];
  }) {
    super({
      id: options.id,
      name: options.name,
      kind: 'rate-limit',
      metadata: options.metadata,
      dependsOn: options.dependsOn,
    });
    this.limit = options.limit;
    this.windowMs = options.windowMs;
    this.burst = options.burst;
    this.validate();
  }

  public override validate(): void {
    super.validate();
    if (this.limit < 1) {
      throw new WorkflowExecutionPolicyValidationException('Rate limit must be at least 1');
    }
    if (this.windowMs < 1) {
      throw new WorkflowExecutionPolicyValidationException(
        'Rate limit windowMs must be at least 1',
      );
    }
    if (this.burst !== undefined && this.burst < 1) {
      throw new WorkflowExecutionPolicyValidationException('Rate limit burst must be at least 1');
    }
  }
}

export class WorkflowPolicyCollection {
  public readonly values: readonly IWorkflowExecutionPolicy[];

  public constructor(policies: readonly IWorkflowExecutionPolicy[] = []) {
    this.values = Object.freeze([...policies]);
    this.validate();
  }

  public get(id: string): IWorkflowExecutionPolicy | undefined {
    return this.values.find((policy) => policy.id === id);
  }

  public validate(): void {
    const ids = new Set<string>();
    for (const policy of this.values) {
      if (ids.has(policy.id)) {
        throw new WorkflowExecutionPolicyValidationException('Duplicate policy identifier');
      }
      ids.add(policy.id);
      for (const dependencyId of policy.dependsOn) {
        if (!this.values.some((candidate) => candidate.id === dependencyId)) {
          throw new WorkflowExecutionPolicyValidationException(
            `Missing policy dependency '${dependencyId}'`,
          );
        }
      }
    }
  }
}

export class WorkflowPolicyRegistry {
  private readonly policies = new Map<string, IWorkflowExecutionPolicy>();

  public register(policy: IWorkflowExecutionPolicy): void {
    if (this.policies.has(policy.id)) {
      throw new WorkflowExecutionPolicyValidationException('Duplicate policy identifier');
    }
    policy.validate();
    this.validateDependencyGraph(policy);
    this.policies.set(policy.id, policy);
  }

  public get(id: string): IWorkflowExecutionPolicy | undefined {
    return this.policies.get(id);
  }

  public resolve(ids: readonly string[]): readonly IWorkflowExecutionPolicy[] {
    return ids.map((id) => {
      const policy = this.policies.get(id);
      if (!policy) {
        throw new WorkflowExecutionPolicyValidationException(`Unknown policy '${id}'`);
      }
      return policy;
    });
  }

  public values(): readonly IWorkflowExecutionPolicy[] {
    return [...this.policies.values()];
  }

  public validateDependencyGraph(policy: IWorkflowExecutionPolicy): void {
    const seen = new Set<string>();
    const stack: string[] = [];

    const visit = (current: IWorkflowExecutionPolicy): void => {
      if (stack.includes(current.id)) {
        throw new WorkflowExecutionPolicyValidationException('Circular policy reference detected');
      }
      if (seen.has(current.id)) {
        return;
      }
      stack.push(current.id);
      for (const dependencyId of current.dependsOn) {
        if (dependencyId === current.id) {
          throw new WorkflowExecutionPolicyValidationException('Policy cannot depend on itself');
        }
        const dependency = this.policies.get(dependencyId);
        if (!dependency) {
          throw new WorkflowExecutionPolicyValidationException(
            `Missing policy dependency '${dependencyId}'`,
          );
        }
        visit(dependency);
      }
      stack.pop();
      seen.add(current.id);
    };

    visit(policy);
  }
}
