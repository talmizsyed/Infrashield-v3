import type { CorrelationId, Identifier, TimestampString } from '@infrashield/contracts';
import type { Context } from '@infrashield/context';

export enum ApprovalStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  RequestedInformation = 'requested-information',
  Delegated = 'delegated',
  Escalated = 'escalated',
  Expired = 'expired',
  Cancelled = 'cancelled',
}

export enum ApprovalDecisionType {
  Approve = 'approve',
  Reject = 'reject',
  RequestInformation = 'request-information',
  Delegate = 'delegate',
  Escalate = 'escalate',
  Expire = 'expire',
  Cancel = 'cancel',
}

export enum ApprovalRiskLevel {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Critical = 'critical',
}

export enum ApprovalMode {
  Automatic = 'automatic',
  Manual = 'manual',
  MultiStage = 'multi-stage',
  MultiUser = 'multi-user',
  Majority = 'majority',
  Sequential = 'sequential',
  Parallel = 'parallel',
  EmergencyOverride = 'emergency-override',
}

export interface IApprovalEngine {
  submit(request: ApprovalRequest): Promise<ApprovalResponse>;
  evaluate(request: ApprovalRequest): ApprovalResponse;
}

export interface IApprovalWorkflow {
  evaluate(
    request: ApprovalRequest,
    policy: ApprovalPolicy,
    risk: ApprovalRiskAssessment,
  ): ApprovalDecisionType;
}

export interface IApprovalPolicy {
  evaluate(
    request: ApprovalRequest,
    risk: ApprovalRiskAssessment,
    workflow: ApprovalWorkflow,
  ): ApprovalDecisionType;
}

export interface IApprovalDecision {
  readonly decision: ApprovalDecisionType;
  readonly actorId: string;
  readonly reason?: string;
  readonly timestamp: string;
  readonly evidence?: readonly ApprovalEvidence[];
}

export interface IApprovalNotification {
  notify(request: ApprovalRequest, decision: ApprovalDecision): ApprovalNotification;
}

export class ApprovalEvidence {
  public constructor(options: {
    readonly id: Identifier;
    readonly type: string;
    readonly description: string;
    readonly createdAt?: TimestampString;
  }) {
    this.id = options.id;
    this.type = options.type;
    this.description = options.description;
    this.createdAt = options.createdAt ?? new Date().toISOString();
  }

  public readonly id: Identifier;
  public readonly type: string;
  public readonly description: string;
  public readonly createdAt: TimestampString;
}

export class ApprovalDecision implements IApprovalDecision {
  public constructor(options: {
    readonly decision: ApprovalDecisionType;
    readonly actorId: string;
    readonly reason?: string;
    readonly timestamp?: TimestampString;
    readonly evidence?: readonly ApprovalEvidence[];
  }) {
    this.decision = options.decision;
    this.actorId = options.actorId;
    this.reason = options.reason;
    this.timestamp = options.timestamp ?? new Date().toISOString();
    this.evidence = options.evidence ? Object.freeze([...options.evidence]) : undefined;
  }

  public readonly decision: ApprovalDecisionType;
  public readonly actorId: string;
  public readonly reason?: string;
  public readonly timestamp: TimestampString;
  public readonly evidence?: ReadonlyArray<ApprovalEvidence>;
}

export class ApprovalRule {
  public constructor(options: {
    readonly id: Identifier;
    readonly name: string;
    readonly decision: ApprovalDecisionType;
    readonly appliesToRisk?: ApprovalRiskLevel;
  }) {
    this.id = options.id;
    this.name = options.name;
    this.decision = options.decision;
    this.appliesToRisk = options.appliesToRisk;
  }

  public readonly id: Identifier;
  public readonly name: string;
  public readonly decision: ApprovalDecisionType;
  public readonly appliesToRisk?: ApprovalRiskLevel;
}

export class ApprovalPolicy implements IApprovalPolicy {
  public constructor(
    options: {
      readonly id?: Identifier;
      readonly name?: string;
      readonly autoApproveOnLowRisk?: boolean;
      readonly allowDelegation?: boolean;
      readonly allowEscalation?: boolean;
      readonly requireMfa?: boolean;
      readonly requireSignature?: boolean;
      readonly tenantIsolation?: boolean;
      readonly riskThreshold?: ApprovalRiskLevel;
      readonly rules?: readonly ApprovalRule[];
    } = {},
  ) {
    this.id = options.id ?? 'policy-default';
    this.name = options.name ?? 'default-policy';
    this.autoApproveOnLowRisk = options.autoApproveOnLowRisk ?? true;
    this.allowDelegation = options.allowDelegation ?? true;
    this.allowEscalation = options.allowEscalation ?? true;
    this.requireMfa = options.requireMfa ?? false;
    this.requireSignature = options.requireSignature ?? false;
    this.tenantIsolation = options.tenantIsolation ?? true;
    this.riskThreshold = options.riskThreshold ?? ApprovalRiskLevel.High;
    this.rules = Object.freeze([...(options.rules ?? [])]);
  }

  public readonly id: Identifier;
  public readonly name: string;
  public readonly autoApproveOnLowRisk: boolean;
  public readonly allowDelegation: boolean;
  public readonly allowEscalation: boolean;
  public readonly requireMfa: boolean;
  public readonly requireSignature: boolean;
  public readonly tenantIsolation: boolean;
  public readonly riskThreshold: ApprovalRiskLevel;
  public readonly rules: ReadonlyArray<ApprovalRule>;

  public evaluate(
    request: ApprovalRequest,
    risk: ApprovalRiskAssessment,
    workflow: ApprovalWorkflow,
  ): ApprovalDecisionType {
    const matchingRule = this.rules.find((rule) => rule.appliesToRisk === risk.level);
    if (matchingRule) {
      return matchingRule.decision;
    }

    if (risk.level === ApprovalRiskLevel.Critical) {
      return ApprovalDecisionType.Escalate;
    }

    if (risk.level === ApprovalRiskLevel.High) {
      return ApprovalDecisionType.RequestInformation;
    }

    if (this.autoApproveOnLowRisk && risk.level === ApprovalRiskLevel.Low) {
      return ApprovalDecisionType.Approve;
    }

    if (
      workflow.mode === ApprovalMode.Automatic ||
      workflow.mode === ApprovalMode.EmergencyOverride
    ) {
      return ApprovalDecisionType.Approve;
    }

    return ApprovalDecisionType.RequestInformation;
  }
}

export class ApprovalWorkflow implements IApprovalWorkflow {
  public constructor(options: {
    readonly id: Identifier;
    readonly name: string;
    readonly mode?: ApprovalMode;
    readonly stages?: number;
    readonly requiredApprovals?: number;
    readonly majorityThreshold?: number;
    readonly allowEmergencyOverride?: boolean;
    readonly timeoutMs?: number;
  }) {
    this.id = options.id;
    this.name = options.name;
    this.mode = options.mode ?? ApprovalMode.Manual;
    this.stages = options.stages ?? 1;
    this.requiredApprovals = options.requiredApprovals ?? 1;
    this.majorityThreshold = options.majorityThreshold ?? 1;
    this.allowEmergencyOverride = options.allowEmergencyOverride ?? false;
    this.timeoutMs = options.timeoutMs ?? 3600000;
  }

  public readonly id: Identifier;
  public readonly name: string;
  public readonly mode: ApprovalMode;
  public readonly stages: number;
  public readonly requiredApprovals: number;
  public readonly majorityThreshold: number;
  public readonly allowEmergencyOverride: boolean;
  public readonly timeoutMs: number;

  public evaluate(
    request: ApprovalRequest,
    policy: ApprovalPolicy,
    risk: ApprovalRiskAssessment,
  ): ApprovalDecisionType {
    if (this.mode === ApprovalMode.Automatic && risk.level === ApprovalRiskLevel.Low) {
      return ApprovalDecisionType.Approve;
    }

    if (risk.level === ApprovalRiskLevel.Critical && this.allowEmergencyOverride) {
      return ApprovalDecisionType.Escalate;
    }

    if (this.mode === ApprovalMode.Sequential || this.mode === ApprovalMode.MultiStage) {
      return ApprovalDecisionType.RequestInformation;
    }

    if (this.mode === ApprovalMode.Parallel && request.approvers.length > 1) {
      return ApprovalDecisionType.RequestInformation;
    }

    if (this.mode === ApprovalMode.Majority && this.majorityThreshold <= request.approvers.length) {
      return ApprovalDecisionType.Approve;
    }

    if (policy.allowDelegation && risk.level === ApprovalRiskLevel.Medium) {
      return ApprovalDecisionType.Delegate;
    }

    return ApprovalDecisionType.RequestInformation;
  }
}

export class ApprovalRiskAssessment {
  public constructor(options: {
    readonly level: ApprovalRiskLevel;
    readonly score: number;
    readonly threshold: number;
    readonly rationale?: string;
  }) {
    this.level = options.level;
    this.score = options.score;
    this.threshold = options.threshold;
    this.rationale = options.rationale ?? 'No rationale provided';
  }

  public readonly level: ApprovalRiskLevel;
  public readonly score: number;
  public readonly threshold: number;
  public readonly rationale: string;
}

export class ApprovalContext {
  public constructor(options: {
    readonly requestId: Identifier;
    readonly tenantId?: string;
    readonly correlationId?: CorrelationId;
    readonly requestContext?: Context;
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly policy?: ApprovalPolicy;
    readonly workflow?: ApprovalWorkflow;
    readonly risk?: ApprovalRiskAssessment;
  }) {
    this.requestId = options.requestId;
    this.tenantId = options.tenantId;
    this.correlationId = options.correlationId;
    this.requestContext = options.requestContext;
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
    this.policy = options.policy;
    this.workflow = options.workflow;
    this.risk = options.risk;
  }

  public readonly requestId: Identifier;
  public readonly tenantId?: string;
  public readonly correlationId?: CorrelationId;
  public readonly requestContext?: Context;
  public readonly metadata?: Readonly<Record<string, unknown>>;
  public readonly policy?: ApprovalPolicy;
  public readonly workflow?: ApprovalWorkflow;
  public readonly risk?: ApprovalRiskAssessment;
}

export class ApprovalNotification implements IApprovalNotification {
  public constructor(options: {
    readonly id: Identifier;
    readonly recipientId: string;
    readonly message: string;
    readonly createdAt?: TimestampString;
  }) {
    this.id = options.id;
    this.recipientId = options.recipientId;
    this.message = options.message;
    this.createdAt = options.createdAt ?? new Date().toISOString();
  }

  public readonly id: Identifier;
  public readonly recipientId: string;
  public readonly message: string;
  public readonly createdAt: TimestampString;

  public notify(request: ApprovalRequest, decision: ApprovalDecision): ApprovalNotification {
    return new ApprovalNotification({
      id: `${request.id}-notify`,
      recipientId: decision.actorId,
      message: `Approval ${decision.decision} for ${request.id}`,
    });
  }
}

export class ApprovalRequest {
  public constructor(options: {
    readonly id: Identifier;
    readonly title: string;
    readonly operation: string;
    readonly requestorId: string;
    readonly approvers: readonly string[];
    readonly policy?: ApprovalPolicy;
    readonly workflow?: ApprovalWorkflow;
    readonly riskAssessment?: ApprovalRiskAssessment;
    readonly createdAt?: TimestampString;
    readonly expiresAt?: TimestampString;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }) {
    this.id = options.id;
    this.title = options.title;
    this.operation = options.operation;
    this.requestorId = options.requestorId;
    this.approvers = Object.freeze([...options.approvers]);
    this.policy = options.policy;
    this.workflow = options.workflow;
    this.riskAssessment = options.riskAssessment;
    this.createdAt = options.createdAt ?? new Date().toISOString();
    this.expiresAt = options.expiresAt;
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }

  public readonly id: Identifier;
  public readonly title: string;
  public readonly operation: string;
  public readonly requestorId: string;
  public readonly approvers: ReadonlyArray<string>;
  public readonly policy?: ApprovalPolicy;
  public readonly workflow?: ApprovalWorkflow;
  public readonly riskAssessment?: ApprovalRiskAssessment;
  public readonly createdAt: TimestampString;
  public readonly expiresAt?: TimestampString;
  public readonly metadata?: Readonly<Record<string, unknown>>;
}

export class ApprovalResponse {
  public constructor(options: {
    readonly requestId: Identifier;
    readonly status: ApprovalStatus;
    readonly decision?: ApprovalDecision;
    readonly notifications?: readonly ApprovalNotification[];
    readonly checkpoint?: ApprovalCheckpoint;
    readonly snapshot?: ApprovalSnapshot;
    readonly createdAt?: TimestampString;
    readonly completedAt?: TimestampString;
  }) {
    this.requestId = options.requestId;
    this.status = options.status;
    this.decision = options.decision;
    this.notifications = options.notifications
      ? Object.freeze([...options.notifications])
      : Object.freeze([]);
    this.checkpoint = options.checkpoint;
    this.snapshot = options.snapshot;
    this.createdAt = options.createdAt ?? new Date().toISOString();
    this.completedAt = options.completedAt;
  }

  public readonly requestId: Identifier;
  public readonly status: ApprovalStatus;
  public readonly decision?: ApprovalDecision;
  public readonly notifications: ReadonlyArray<ApprovalNotification>;
  public readonly checkpoint?: ApprovalCheckpoint;
  public readonly snapshot?: ApprovalSnapshot;
  public readonly createdAt: TimestampString;
  public readonly completedAt?: TimestampString;
}

export class ApprovalCheckpoint {
  public constructor(options: {
    readonly checkpointId: Identifier;
    readonly requestId: Identifier;
    readonly status: ApprovalStatus;
    readonly timestamp?: TimestampString;
  }) {
    this.checkpointId = options.checkpointId;
    this.requestId = options.requestId;
    this.status = options.status;
    this.timestamp = options.timestamp ?? new Date().toISOString();
  }

  public readonly checkpointId: Identifier;
  public readonly requestId: Identifier;
  public readonly status: ApprovalStatus;
  public readonly timestamp: TimestampString;
}

export class ApprovalAudit {
  private readonly entries: string[] = [];

  public record(entry: string): void {
    this.entries.push(entry);
  }

  public getEntries(): readonly string[] {
    return [...this.entries];
  }
}

export class ApprovalMetrics {
  public constructor(
    options: {
      readonly latencyMs?: number;
      readonly pendingCount?: number;
      readonly approvalRate?: number;
      readonly rejectionRate?: number;
      readonly escalations?: number;
      readonly timeouts?: number;
    } = {},
  ) {
    this.latencyMs = options.latencyMs ?? 0;
    this.pendingCount = options.pendingCount ?? 0;
    this.approvalRate = options.approvalRate ?? 0;
    this.rejectionRate = options.rejectionRate ?? 0;
    this.escalations = options.escalations ?? 0;
    this.timeouts = options.timeouts ?? 0;
  }

  public readonly latencyMs: number;
  public readonly pendingCount: number;
  public readonly approvalRate: number;
  public readonly rejectionRate: number;
  public readonly escalations: number;
  public readonly timeouts: number;
}

export class ApprovalStatistics {
  public constructor(
    options: {
      readonly pending?: number;
      readonly approved?: number;
      readonly rejected?: number;
      readonly delegated?: number;
      readonly escalated?: number;
      readonly expired?: number;
      readonly cancelled?: number;
    } = {},
  ) {
    this.pending = options.pending ?? 0;
    this.approved = options.approved ?? 0;
    this.rejected = options.rejected ?? 0;
    this.delegated = options.delegated ?? 0;
    this.escalated = options.escalated ?? 0;
    this.expired = options.expired ?? 0;
    this.cancelled = options.cancelled ?? 0;
  }

  public pending: number;
  public approved: number;
  public rejected: number;
  public delegated: number;
  public escalated: number;
  public expired: number;
  public cancelled: number;
}

export class ApprovalHistory {
  private readonly entries: ApprovalDecision[] = [];

  public record(decision: ApprovalDecision): void {
    this.entries.push(decision);
  }

  public getEntries(): readonly ApprovalDecision[] {
    return [...this.entries];
  }
}

export class ApprovalEscalation {
  public constructor(options: {
    readonly escalationId: Identifier;
    readonly requestId: Identifier;
    readonly reason: string;
    readonly targetId: string;
    readonly createdAt?: TimestampString;
  }) {
    this.escalationId = options.escalationId;
    this.requestId = options.requestId;
    this.reason = options.reason;
    this.targetId = options.targetId;
    this.createdAt = options.createdAt ?? new Date().toISOString();
  }

  public readonly escalationId: Identifier;
  public readonly requestId: Identifier;
  public readonly reason: string;
  public readonly targetId: string;
  public readonly createdAt: TimestampString;
}

export class ApprovalDelegation {
  public constructor(options: {
    readonly delegationId: Identifier;
    readonly requestId: Identifier;
    readonly fromId: string;
    readonly toId: string;
    readonly reason: string;
    readonly createdAt?: TimestampString;
  }) {
    this.delegationId = options.delegationId;
    this.requestId = options.requestId;
    this.fromId = options.fromId;
    this.toId = options.toId;
    this.reason = options.reason;
    this.createdAt = options.createdAt ?? new Date().toISOString();
  }

  public readonly delegationId: Identifier;
  public readonly requestId: Identifier;
  public readonly fromId: string;
  public readonly toId: string;
  public readonly reason: string;
  public readonly createdAt: TimestampString;
}

export class ApprovalTimeout {
  public constructor(options: {
    readonly timeoutId: Identifier;
    readonly requestId: Identifier;
    readonly reason: string;
    readonly expiredAt: TimestampString;
  }) {
    this.timeoutId = options.timeoutId;
    this.requestId = options.requestId;
    this.reason = options.reason;
    this.expiredAt = options.expiredAt;
  }

  public readonly timeoutId: Identifier;
  public readonly requestId: Identifier;
  public readonly reason: string;
  public readonly expiredAt: TimestampString;
}

export class ApprovalSnapshot {
  public constructor(options: {
    readonly snapshotId: Identifier;
    readonly requestId: Identifier;
    readonly status: ApprovalStatus;
    readonly decision?: ApprovalDecision;
    readonly timestamp?: TimestampString;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }) {
    this.snapshotId = options.snapshotId;
    this.requestId = options.requestId;
    this.status = options.status;
    this.decision = options.decision;
    this.timestamp = options.timestamp ?? new Date().toISOString();
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }

  public readonly snapshotId: Identifier;
  public readonly requestId: Identifier;
  public readonly status: ApprovalStatus;
  public readonly decision?: ApprovalDecision;
  public readonly timestamp: TimestampString;
  public readonly metadata?: Readonly<Record<string, unknown>>;
}

export class ApprovalManager {
  private readonly requests = new Map<Identifier, ApprovalRequest>();
  private readonly responses = new Map<Identifier, ApprovalResponse>();
  private readonly history = new Map<Identifier, ApprovalHistory>();
  private readonly audit = new ApprovalAudit();
  private readonly metrics = new ApprovalMetrics();
  private readonly statistics = new ApprovalStatistics();

  public register(request: ApprovalRequest): void {
    this.requests.set(request.id, request);
    this.history.set(request.id, new ApprovalHistory());
    this.audit.record(`registered:${request.id}`);
    this.statistics.pending += 1;
  }

  public resolve(requestId: Identifier, response: ApprovalResponse): void {
    this.responses.set(requestId, response);
    this.audit.record(`resolved:${requestId}`);
  }

  public get(requestId: Identifier): ApprovalRequest | undefined {
    return this.requests.get(requestId);
  }

  public list(): readonly ApprovalRequest[] {
    return [...this.requests.values()];
  }

  public getPending(): readonly ApprovalRequest[] {
    return this.list().filter((request) => !this.responses.has(request.id));
  }

  public getResponse(requestId: Identifier): ApprovalResponse | undefined {
    return this.responses.get(requestId);
  }

  public getAudit(): ApprovalAudit {
    return this.audit;
  }

  public getMetrics(): ApprovalMetrics {
    return this.metrics;
  }

  public getStatistics(): ApprovalStatistics {
    return this.statistics;
  }
}

export class ApprovalEngine implements IApprovalEngine {
  public constructor(private readonly manager: ApprovalManager = new ApprovalManager()) {}

  public async submit(request: ApprovalRequest): Promise<ApprovalResponse> {
    this.manager.register(request);

    const policy = request.policy ?? new ApprovalPolicy();
    const workflow =
      request.workflow ?? new ApprovalWorkflow({ id: 'workflow-default', name: 'default' });
    const risk =
      request.riskAssessment ??
      new ApprovalRiskAssessment({ level: ApprovalRiskLevel.Medium, score: 25, threshold: 50 });

    const decisionType = this.evaluateDecision(request, policy, workflow, risk);
    const decision = new ApprovalDecision({
      decision: decisionType,
      actorId: request.requestorId,
      reason: 'evaluated',
    });

    const status = this.toStatus(decisionType);
    const checkpoint = new ApprovalCheckpoint({
      checkpointId: `${request.id}-checkpoint`,
      requestId: request.id,
      status,
    });
    const snapshot = new ApprovalSnapshot({
      snapshotId: `${request.id}-snapshot`,
      requestId: request.id,
      status,
      decision,
    });
    const notification = new ApprovalNotification({
      id: `${request.id}-notification`,
      recipientId: request.requestorId,
      message: `Approval ${decisionType} for ${request.id}`,
    });
    const response = new ApprovalResponse({
      requestId: request.id,
      status,
      decision,
      notifications: [notification],
      checkpoint,
      snapshot,
    });

    this.manager.resolve(request.id, response);
    return response;
  }

  public evaluate(request: ApprovalRequest): ApprovalResponse {
    const policy = request.policy ?? new ApprovalPolicy();
    const workflow =
      request.workflow ?? new ApprovalWorkflow({ id: 'workflow-default', name: 'default' });
    const risk =
      request.riskAssessment ??
      new ApprovalRiskAssessment({ level: ApprovalRiskLevel.Medium, score: 25, threshold: 50 });
    const decisionType = this.evaluateDecision(request, policy, workflow, risk);
    const decision = new ApprovalDecision({
      decision: decisionType,
      actorId: request.requestorId,
      reason: 'evaluated',
    });
    return new ApprovalResponse({
      requestId: request.id,
      status: this.toStatus(decisionType),
      decision,
      checkpoint: new ApprovalCheckpoint({
        checkpointId: `${request.id}-checkpoint`,
        requestId: request.id,
        status: this.toStatus(decisionType),
      }),
      snapshot: new ApprovalSnapshot({
        snapshotId: `${request.id}-snapshot`,
        requestId: request.id,
        status: this.toStatus(decisionType),
        decision,
      }),
    });
  }

  public getManager(): ApprovalManager {
    return this.manager;
  }

  private evaluateDecision(
    request: ApprovalRequest,
    policy: ApprovalPolicy,
    workflow: ApprovalWorkflow,
    risk: ApprovalRiskAssessment,
  ): ApprovalDecisionType {
    const policyDecision = policy.evaluate(request, risk, workflow);
    const workflowDecision = workflow.evaluate(request, policy, risk);

    if (
      policyDecision === ApprovalDecisionType.Escalate ||
      workflowDecision === ApprovalDecisionType.Escalate
    ) {
      return ApprovalDecisionType.Escalate;
    }

    if (
      policyDecision === ApprovalDecisionType.Delegate ||
      workflowDecision === ApprovalDecisionType.Delegate
    ) {
      return ApprovalDecisionType.Delegate;
    }

    if (policyDecision === ApprovalDecisionType.Reject) {
      return ApprovalDecisionType.Reject;
    }

    if (
      workflowDecision === ApprovalDecisionType.Approve ||
      policyDecision === ApprovalDecisionType.Approve
    ) {
      return ApprovalDecisionType.Approve;
    }

    if (
      workflowDecision === ApprovalDecisionType.RequestInformation ||
      policyDecision === ApprovalDecisionType.RequestInformation
    ) {
      return ApprovalDecisionType.RequestInformation;
    }

    return ApprovalDecisionType.RequestInformation;
  }

  private toStatus(decision: ApprovalDecisionType): ApprovalStatus {
    switch (decision) {
      case ApprovalDecisionType.Approve:
        return ApprovalStatus.Approved;
      case ApprovalDecisionType.Reject:
        return ApprovalStatus.Rejected;
      case ApprovalDecisionType.RequestInformation:
        return ApprovalStatus.RequestedInformation;
      case ApprovalDecisionType.Delegate:
        return ApprovalStatus.Delegated;
      case ApprovalDecisionType.Escalate:
        return ApprovalStatus.Escalated;
      case ApprovalDecisionType.Expire:
        return ApprovalStatus.Expired;
      case ApprovalDecisionType.Cancel:
        return ApprovalStatus.Cancelled;
      default:
        return ApprovalStatus.Pending;
    }
  }
}
