import type { Identifier, SerializableValueObject, TimestampString } from '@infrashield/contracts';

export enum GovernanceDecision {
  Allow = 'allow',
  Deny = 'deny',
  RequireApproval = 'require-approval',
  Escalate = 'escalate',
  Continue = 'continue',
}

export enum GovernanceCategory {
  Authorization = 'authorization',
  Approval = 'approval',
  Risk = 'risk',
  Compliance = 'compliance',
  Guardrail = 'guardrail',
  Audit = 'audit',
}

export enum ApprovalDecision {
  Approved = 'approved',
  Rejected = 'rejected',
  Pending = 'pending',
  Delegated = 'delegated',
  TimedOut = 'timed-out',
}

export enum TrustLevel {
  Unknown = 'unknown',
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Critical = 'critical',
}

export enum ComplianceStatus {
  Compliant = 'compliant',
  Warning = 'warning',
  NonCompliant = 'non-compliant',
  Pending = 'pending',
}

export interface IGovernanceEngine {
  evaluate(context: GovernanceContext): GovernanceResult;
}

export interface IGovernancePolicy {
  readonly id: Identifier;
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly publishedAt: TimestampString;
  readonly immutable: boolean;
  readonly tenantScope?: string;
  readonly scopes: readonly GovernanceScope[];
  readonly rules: readonly GovernanceRule[];
  readonly constraints: readonly GovernanceConstraint[];
  readonly approvalPolicy?: ApprovalPolicy;
}

export interface IApprovalEngine {
  request(context: GovernanceContext): ApprovalResult;
  decide(request: ApprovalRequest, decision: ApprovalDecision): ApprovalResult;
}

export interface ITrustEvaluator {
  evaluate(context: GovernanceContext): TrustEvaluation;
}

export interface IComplianceEvaluator {
  evaluate(context: GovernanceContext): ComplianceEvaluation;
}

export interface IGovernanceAudit {
  record(entry: GovernanceAudit): void;
  list(): readonly GovernanceAudit[];
  snapshot(): GovernanceSnapshot;
}

export type GovernanceEventName =
  | 'PolicyEvaluated'
  | 'ExecutionApproved'
  | 'ExecutionRejected'
  | 'ApprovalRequested'
  | 'ApprovalCompleted'
  | 'RiskCalculated'
  | 'ComplianceValidated'
  | 'GuardrailTriggered';

export class GovernanceScope {
  public constructor(options: {
    readonly id: Identifier;
    readonly name: string;
    readonly tenant?: string;
    readonly resource?: string;
    readonly action?: string;
    readonly mode?: 'rbac' | 'abac' | 'policy';
  }) {
    this.id = options.id;
    this.name = options.name;
    this.tenant = options.tenant;
    this.resource = options.resource;
    this.action = options.action;
    this.mode = options.mode ?? 'policy';
  }

  public readonly id: Identifier;
  public readonly name: string;
  public readonly tenant?: string;
  public readonly resource?: string;
  public readonly action?: string;
  public readonly mode: 'rbac' | 'abac' | 'policy';
}

export class GovernanceCondition {
  public constructor(options: {
    readonly id: Identifier;
    readonly description: string;
    readonly attribute: string;
    readonly operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in';
    readonly value: string | number | boolean | readonly string[];
    readonly metadata?: SerializableValueObject;
  }) {
    this.id = options.id;
    this.description = options.description;
    this.attribute = options.attribute;
    this.operator = options.operator;
    this.value = options.value;
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }

  public readonly id: Identifier;
  public readonly description: string;
  public readonly attribute: string;
  public readonly operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in';
  public readonly value: string | number | boolean | readonly string[];
  public readonly metadata?: Readonly<SerializableValueObject>;
}

export class GovernanceConstraint {
  public constructor(options: {
    readonly id: Identifier;
    readonly description: string;
    readonly conditions?: readonly GovernanceCondition[];
    readonly enforcement?: 'soft' | 'hard';
  }) {
    this.id = options.id;
    this.description = options.description;
    this.conditions = [...(options.conditions ?? [])];
    this.enforcement = options.enforcement ?? 'hard';
  }

  public readonly id: Identifier;
  public readonly description: string;
  public readonly conditions: readonly GovernanceCondition[];
  public readonly enforcement: 'soft' | 'hard';
}

export class GovernanceRule {
  public constructor(options: {
    readonly id: Identifier;
    readonly name: string;
    readonly description?: string;
    readonly decision: GovernanceDecision;
    readonly conditions?: readonly GovernanceCondition[];
    readonly scopes?: readonly GovernanceScope[];
    readonly priority?: number;
  }) {
    this.id = options.id;
    this.name = options.name;
    this.description = options.description;
    this.decision = options.decision;
    this.conditions = [...(options.conditions ?? [])];
    this.scopes = [...(options.scopes ?? [])];
    this.priority = options.priority ?? 0;
  }

  public readonly id: Identifier;
  public readonly name: string;
  public readonly description?: string;
  public readonly decision: GovernanceDecision;
  public readonly conditions: readonly GovernanceCondition[];
  public readonly scopes: readonly GovernanceScope[];
  public readonly priority: number;
}

export class GovernancePolicy implements IGovernancePolicy {
  public constructor(
    options: {
      readonly id?: Identifier;
      readonly name?: string;
      readonly version?: string;
      readonly description?: string;
      readonly publishedAt?: TimestampString;
      readonly immutable?: boolean;
      readonly tenantScope?: string;
      readonly scopes?: readonly GovernanceScope[];
      readonly rules?: readonly GovernanceRule[];
      readonly constraints?: readonly GovernanceConstraint[];
      readonly approvalPolicy?: ApprovalPolicy;
    } = {},
  ) {
    this.id = options.id ?? 'policy-default';
    this.name = options.name ?? 'default-policy';
    this.version = options.version ?? '1.0.0';
    this.description = options.description;
    this.publishedAt = options.publishedAt ?? new Date().toISOString();
    this.immutable = options.immutable ?? true;
    this.tenantScope = options.tenantScope;
    this.scopes = [...(options.scopes ?? [])];
    this.rules = [...(options.rules ?? [])];
    this.constraints = [...(options.constraints ?? [])];
    this.approvalPolicy = options.approvalPolicy;
  }

  public readonly id: Identifier;
  public readonly name: string;
  public readonly version: string;
  public readonly description?: string;
  public readonly publishedAt: TimestampString;
  public readonly immutable: boolean;
  public readonly tenantScope?: string;
  public readonly scopes: readonly GovernanceScope[];
  public readonly rules: readonly GovernanceRule[];
  public readonly constraints: readonly GovernanceConstraint[];
  public readonly approvalPolicy?: ApprovalPolicy;
}

export class GovernanceContext {
  public constructor(options: {
    readonly id: Identifier;
    readonly actor: string;
    readonly action: string;
    readonly resource: string;
    readonly tenant?: string;
    readonly metadata?: SerializableValueObject;
    readonly policy?: GovernancePolicy;
    readonly scopes?: readonly GovernanceScope[];
    readonly riskScore?: number;
    readonly approvalRequired?: boolean;
    readonly requiredTrustLevel?: TrustLevel;
    readonly requiredCompliance?: ComplianceStatus;
    readonly execution?: SerializableValueObject;
  }) {
    this.id = options.id;
    this.actor = options.actor;
    this.action = options.action;
    this.resource = options.resource;
    this.tenant = options.tenant;
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
    this.policy = options.policy ?? new GovernancePolicy();
    this.scopes = [...(options.scopes ?? [])];
    this.riskScore = options.riskScore ?? 0;
    this.approvalRequired = options.approvalRequired ?? false;
    this.requiredTrustLevel = options.requiredTrustLevel ?? TrustLevel.Medium;
    this.requiredCompliance = options.requiredCompliance ?? ComplianceStatus.Compliant;
    this.execution = options.execution ? Object.freeze({ ...options.execution }) : undefined;
  }

  public readonly id: Identifier;
  public readonly actor: string;
  public readonly action: string;
  public readonly resource: string;
  public readonly tenant?: string;
  public readonly metadata?: Readonly<SerializableValueObject>;
  public readonly policy: GovernancePolicy;
  public readonly scopes: readonly GovernanceScope[];
  public readonly riskScore: number;
  public readonly approvalRequired: boolean;
  public readonly requiredTrustLevel: TrustLevel;
  public readonly requiredCompliance: ComplianceStatus;
  public readonly execution?: Readonly<SerializableValueObject>;
}

export class GovernanceRisk {
  public constructor(options: {
    readonly category: GovernanceCategory;
    readonly score: number;
    readonly confidence: number;
    readonly explanation: string;
    readonly policyViolations?: readonly GovernanceViolation[];
    readonly metadata?: SerializableValueObject;
  }) {
    this.category = options.category;
    this.score = Math.max(0, Math.min(1, options.score));
    this.confidence = Math.max(0, Math.min(1, options.confidence));
    this.explanation = options.explanation;
    this.policyViolations = [...(options.policyViolations ?? [])];
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }

  public readonly category: GovernanceCategory;
  public readonly score: number;
  public readonly confidence: number;
  public readonly explanation: string;
  public readonly policyViolations: readonly GovernanceViolation[];
  public readonly metadata?: Readonly<SerializableValueObject>;
}

export class GovernanceViolation {
  public constructor(options: {
    readonly id: Identifier;
    readonly ruleId: Identifier;
    readonly message: string;
    readonly severity: 'info' | 'warning' | 'critical';
  }) {
    this.id = options.id;
    this.ruleId = options.ruleId;
    this.message = options.message;
    this.severity = options.severity;
  }

  public readonly id: Identifier;
  public readonly ruleId: Identifier;
  public readonly message: string;
  public readonly severity: 'info' | 'warning' | 'critical';
}

export class GovernanceRecommendation {
  public constructor(options: {
    readonly id: Identifier;
    readonly title: string;
    readonly detail: string;
    readonly decision: GovernanceDecision;
    readonly score: number;
  }) {
    this.id = options.id;
    this.title = options.title;
    this.detail = options.detail;
    this.decision = options.decision;
    this.score = Math.max(0, Math.min(1, options.score));
  }

  public readonly id: Identifier;
  public readonly title: string;
  public readonly detail: string;
  public readonly decision: GovernanceDecision;
  public readonly score: number;
}

export class GovernanceResult {
  public constructor(options: {
    readonly decision: GovernanceDecision;
    readonly approved: boolean;
    readonly reason: string;
    readonly policy: GovernancePolicy;
    readonly risk: GovernanceRisk;
    readonly recommendations: readonly GovernanceRecommendation[];
    readonly violations: readonly GovernanceViolation[];
    readonly approval?: ApprovalResult;
    readonly execution?: ExecutionGuardrail;
    readonly audit?: GovernanceAudit;
  }) {
    this.decision = options.decision;
    this.approved = options.approved;
    this.reason = options.reason;
    this.policy = options.policy;
    this.risk = options.risk;
    this.recommendations = [...options.recommendations];
    this.violations = [...options.violations];
    this.approval = options.approval;
    this.execution = options.execution;
    this.audit = options.audit;
  }

  public readonly decision: GovernanceDecision;
  public readonly approved: boolean;
  public readonly reason: string;
  public readonly policy: GovernancePolicy;
  public readonly risk: GovernanceRisk;
  public readonly recommendations: readonly GovernanceRecommendation[];
  public readonly violations: readonly GovernanceViolation[];
  public readonly approval?: ApprovalResult;
  public readonly execution?: ExecutionGuardrail;
  public readonly audit?: GovernanceAudit;
}

export class GovernanceSnapshot {
  public constructor(options: {
    readonly id: Identifier;
    readonly policyId: Identifier;
    readonly decision: GovernanceDecision;
    readonly approved: boolean;
    readonly riskScore: number;
    readonly violations: readonly GovernanceViolation[];
    readonly recommendations: readonly GovernanceRecommendation[];
    readonly createdAt: TimestampString;
  }) {
    this.id = options.id;
    this.policyId = options.policyId;
    this.decision = options.decision;
    this.approved = options.approved;
    this.riskScore = options.riskScore;
    this.violations = [...options.violations];
    this.recommendations = [...options.recommendations];
    this.createdAt = options.createdAt;
  }

  public readonly id: Identifier;
  public readonly policyId: Identifier;
  public readonly decision: GovernanceDecision;
  public readonly approved: boolean;
  public readonly riskScore: number;
  public readonly violations: readonly GovernanceViolation[];
  public readonly recommendations: readonly GovernanceRecommendation[];
  public readonly createdAt: TimestampString;
}

export class GovernanceAudit {
  public constructor(options: {
    readonly id: Identifier;
    readonly actor: string;
    readonly action: string;
    readonly reason: string;
    readonly decision: GovernanceDecision;
    readonly policyId: Identifier;
    readonly risk: GovernanceRisk;
    readonly approval?: ApprovalResult;
    readonly execution?: ExecutionGuardrail;
    readonly outcome: 'approved' | 'rejected' | 'pending';
    readonly occurredAt: TimestampString;
    readonly metadata?: SerializableValueObject;
  }) {
    this.id = options.id;
    this.actor = options.actor;
    this.action = options.action;
    this.reason = options.reason;
    this.decision = options.decision;
    this.policyId = options.policyId;
    this.risk = options.risk;
    this.approval = options.approval;
    this.execution = options.execution;
    this.outcome = options.outcome;
    this.occurredAt = options.occurredAt;
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }

  public readonly id: Identifier;
  public readonly actor: string;
  public readonly action: string;
  public readonly reason: string;
  public readonly decision: GovernanceDecision;
  public readonly policyId: Identifier;
  public readonly risk: GovernanceRisk;
  public readonly approval?: ApprovalResult;
  public readonly execution?: ExecutionGuardrail;
  public readonly outcome: 'approved' | 'rejected' | 'pending';
  public readonly occurredAt: TimestampString;
  public readonly metadata?: Readonly<SerializableValueObject>;
}

export class ApprovalRequest {
  public constructor(options: {
    readonly id: Identifier;
    readonly actor: string;
    readonly action: string;
    readonly resource: string;
    readonly reason: string;
    readonly metadata?: SerializableValueObject;
    readonly stages?: readonly ApprovalStage[];
    readonly policy?: ApprovalPolicy;
    readonly timeoutMs?: number;
  }) {
    this.id = options.id;
    this.actor = options.actor;
    this.action = options.action;
    this.resource = options.resource;
    this.reason = options.reason;
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
    this.stages = [...(options.stages ?? [])];
    this.policy = options.policy ?? new ApprovalPolicy();
    this.timeoutMs = options.timeoutMs ?? 30000;
  }

  public readonly id: Identifier;
  public readonly actor: string;
  public readonly action: string;
  public readonly resource: string;
  public readonly reason: string;
  public readonly metadata?: Readonly<SerializableValueObject>;
  public readonly stages: readonly ApprovalStage[];
  public readonly policy: ApprovalPolicy;
  public readonly timeoutMs: number;
}

export class ApprovalStage {
  public constructor(options: {
    readonly id: Identifier;
    readonly name: string;
    readonly approver: string;
    readonly required: boolean;
    readonly delegated?: boolean;
    readonly decision?: ApprovalDecision;
  }) {
    this.id = options.id;
    this.name = options.name;
    this.approver = options.approver;
    this.required = options.required;
    this.delegated = options.delegated ?? false;
    this.decision = options.decision;
  }

  public readonly id: Identifier;
  public readonly name: string;
  public readonly approver: string;
  public readonly required: boolean;
  public readonly delegated: boolean;
  public readonly decision?: ApprovalDecision;
}

export class ApprovalPolicy {
  public constructor(
    options: {
      readonly mode?: 'automatic' | 'human' | 'multi-stage' | 'delegated';
      readonly requireHumanApproval?: boolean;
      readonly allowDelegation?: boolean;
      readonly timeoutMs?: number;
      readonly escalationEnabled?: boolean;
    } = {},
  ) {
    this.mode = options.mode ?? 'human';
    this.requireHumanApproval = options.requireHumanApproval ?? true;
    this.allowDelegation = options.allowDelegation ?? true;
    this.timeoutMs = options.timeoutMs ?? 30000;
    this.escalationEnabled = options.escalationEnabled ?? true;
  }

  public readonly mode: 'automatic' | 'human' | 'multi-stage' | 'delegated';
  public readonly requireHumanApproval: boolean;
  public readonly allowDelegation: boolean;
  public readonly timeoutMs: number;
  public readonly escalationEnabled: boolean;
}

export class ApprovalResult {
  public constructor(options: {
    readonly id: Identifier;
    readonly requestId: Identifier;
    readonly decision: ApprovalDecision;
    readonly approved: boolean;
    readonly reason: string;
    readonly stages: readonly ApprovalStage[];
    readonly completedAt: TimestampString;
    readonly metadata?: SerializableValueObject;
  }) {
    this.id = options.id;
    this.requestId = options.requestId;
    this.decision = options.decision;
    this.approved = options.approved;
    this.reason = options.reason;
    this.stages = [...options.stages];
    this.completedAt = options.completedAt;
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }

  public readonly id: Identifier;
  public readonly requestId: Identifier;
  public readonly decision: ApprovalDecision;
  public readonly approved: boolean;
  public readonly reason: string;
  public readonly stages: readonly ApprovalStage[];
  public readonly completedAt: TimestampString;
  public readonly metadata?: Readonly<SerializableValueObject>;
}

export class ApprovalWorkflow {
  public constructor(options: {
    readonly request: ApprovalRequest;
    readonly policy: ApprovalPolicy;
    readonly startedAt: TimestampString;
  }) {
    this.request = options.request;
    this.policy = options.policy;
    this.startedAt = options.startedAt;
  }

  public readonly request: ApprovalRequest;
  public readonly policy: ApprovalPolicy;
  public readonly startedAt: TimestampString;
}

export class TrustEvaluation {
  public constructor(options: {
    readonly level: TrustLevel;
    readonly score: number;
    readonly explanation: string;
    readonly metadata?: SerializableValueObject;
  }) {
    this.level = options.level;
    this.score = Math.max(0, Math.min(1, options.score));
    this.explanation = options.explanation;
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }

  public readonly level: TrustLevel;
  public readonly score: number;
  public readonly explanation: string;
  public readonly metadata?: Readonly<SerializableValueObject>;
}

export class TrustPolicy {
  public constructor(
    options: {
      readonly minimumLevel?: TrustLevel;
      readonly minimumScore?: number;
    } = {},
  ) {
    this.minimumLevel = options.minimumLevel ?? TrustLevel.Medium;
    this.minimumScore = options.minimumScore ?? 0.5;
  }

  public readonly minimumLevel: TrustLevel;
  public readonly minimumScore: number;
}

export class ComplianceEvidence {
  public constructor(options: {
    readonly id: Identifier;
    readonly label: string;
    readonly detail: string;
    readonly score: number;
  }) {
    this.id = options.id;
    this.label = options.label;
    this.detail = options.detail;
    this.score = Math.max(0, Math.min(1, options.score));
  }

  public readonly id: Identifier;
  public readonly label: string;
  public readonly detail: string;
  public readonly score: number;
}

export class ComplianceRule {
  public constructor(options: {
    readonly id: Identifier;
    readonly name: string;
    readonly description: string;
    readonly required: boolean;
    readonly status?: ComplianceStatus;
  }) {
    this.id = options.id;
    this.name = options.name;
    this.description = options.description;
    this.required = options.required;
    this.status = options.status ?? ComplianceStatus.Compliant;
  }

  public readonly id: Identifier;
  public readonly name: string;
  public readonly description: string;
  public readonly required: boolean;
  public readonly status: ComplianceStatus;
}

export class ComplianceProfile {
  public constructor(options: {
    readonly profileId: Identifier;
    readonly tenant?: string;
    readonly jurisdiction?: string;
    readonly regulations?: readonly string[];
    readonly rules?: readonly ComplianceRule[];
    readonly metadata?: SerializableValueObject;
  }) {
    this.profileId = options.profileId;
    this.tenant = options.tenant;
    this.jurisdiction = options.jurisdiction;
    this.regulations = [...(options.regulations ?? [])];
    this.rules = [...(options.rules ?? [])];
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }

  public readonly profileId: Identifier;
  public readonly tenant?: string;
  public readonly jurisdiction?: string;
  public readonly regulations: readonly string[];
  public readonly rules: readonly ComplianceRule[];
  public readonly metadata?: Readonly<SerializableValueObject>;
}

export class ComplianceEvaluation {
  public constructor(options: {
    readonly status: ComplianceStatus;
    readonly score: number;
    readonly explanation: string;
    readonly evidence: readonly ComplianceEvidence[];
    readonly profile?: ComplianceProfile;
  }) {
    this.status = options.status;
    this.score = Math.max(0, Math.min(1, options.score));
    this.explanation = options.explanation;
    this.evidence = [...options.evidence];
    this.profile = options.profile;
  }

  public readonly status: ComplianceStatus;
  public readonly score: number;
  public readonly explanation: string;
  public readonly evidence: readonly ComplianceEvidence[];
  public readonly profile?: ComplianceProfile;
}

export class ComplianceResult {
  public constructor(options: {
    readonly status: ComplianceStatus;
    readonly score: number;
    readonly explanation: string;
    readonly evidence: readonly ComplianceEvidence[];
    readonly profile?: ComplianceProfile;
  }) {
    this.status = options.status;
    this.score = Math.max(0, Math.min(1, options.score));
    this.explanation = options.explanation;
    this.evidence = [...options.evidence];
    this.profile = options.profile;
  }

  public readonly status: ComplianceStatus;
  public readonly score: number;
  public readonly explanation: string;
  public readonly evidence: readonly ComplianceEvidence[];
  public readonly profile?: ComplianceProfile;
}

export class ExecutionGuardrail {
  public constructor(options: {
    readonly id: Identifier;
    readonly reason: string;
    readonly budget?: ExecutionBudget;
    readonly limits?: readonly ExecutionLimit[];
    readonly restrictions?: readonly ExecutionRestriction[];
    readonly triggered: boolean;
    readonly metadata?: SerializableValueObject;
  }) {
    this.id = options.id;
    this.reason = options.reason;
    this.budget = options.budget;
    this.limits = [...(options.limits ?? [])];
    this.restrictions = [...(options.restrictions ?? [])];
    this.triggered = options.triggered;
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }

  public readonly id: Identifier;
  public readonly reason: string;
  public readonly budget?: ExecutionBudget;
  public readonly limits: readonly ExecutionLimit[];
  public readonly restrictions: readonly ExecutionRestriction[];
  public readonly triggered: boolean;
  public readonly metadata?: Readonly<SerializableValueObject>;
}

export class ExecutionBudget {
  public constructor(options: {
    readonly maxTokens?: number;
    readonly maxDurationMs?: number;
    readonly maxToolCalls?: number;
    readonly maxMemoryMb?: number;
  }) {
    this.maxTokens = options.maxTokens;
    this.maxDurationMs = options.maxDurationMs;
    this.maxToolCalls = options.maxToolCalls;
    this.maxMemoryMb = options.maxMemoryMb;
  }

  public readonly maxTokens?: number;
  public readonly maxDurationMs?: number;
  public readonly maxToolCalls?: number;
  public readonly maxMemoryMb?: number;
}

export class ExecutionLimit {
  public constructor(options: {
    readonly id: Identifier;
    readonly name: string;
    readonly value: number;
    readonly unit: 'tokens' | 'milliseconds' | 'calls' | 'mb';
  }) {
    this.id = options.id;
    this.name = options.name;
    this.value = options.value;
    this.unit = options.unit;
  }

  public readonly id: Identifier;
  public readonly name: string;
  public readonly value: number;
  public readonly unit: 'tokens' | 'milliseconds' | 'calls' | 'mb';
}

export class ExecutionRestriction {
  public constructor(options: {
    readonly id: Identifier;
    readonly name: string;
    readonly value: string;
    readonly scope: 'tool' | 'memory' | 'workflow' | 'delegation' | 'ai-model';
  }) {
    this.id = options.id;
    this.name = options.name;
    this.value = options.value;
    this.scope = options.scope;
  }

  public readonly id: Identifier;
  public readonly name: string;
  public readonly value: string;
  public readonly scope: 'tool' | 'memory' | 'workflow' | 'delegation' | 'ai-model';
}

export class ExecutionQuota {
  public constructor(options: {
    readonly limit: number;
    readonly consumed: number;
    readonly window: 'daily' | 'hourly' | 'per-execution';
  }) {
    this.limit = options.limit;
    this.consumed = options.consumed;
    this.window = options.window;
  }

  public readonly limit: number;
  public readonly consumed: number;
  public readonly window: 'daily' | 'hourly' | 'per-execution';
}

export class GovernanceRegistry {
  public constructor() {
    this.entries = new Map<Identifier, GovernancePolicy>();
  }

  private readonly entries: Map<Identifier, GovernancePolicy>;

  public register(policy: GovernancePolicy): void {
    this.entries.set(policy.id, policy);
  }

  public get(policyId: Identifier): GovernancePolicy | undefined {
    return this.entries.get(policyId);
  }

  public list(): readonly GovernancePolicy[] {
    return [...this.entries.values()];
  }
}

export class GovernanceEngine implements IGovernanceEngine, IApprovalEngine {
  public constructor(
    options: {
      readonly policy?: GovernancePolicy;
      readonly registry?: GovernanceRegistry;
      readonly audit?: IGovernanceAudit;
      readonly trustEvaluator?: ITrustEvaluator;
      readonly complianceEvaluator?: IComplianceEvaluator;
    } = {},
  ) {
    this.policy = options.policy ?? new GovernancePolicy();
    this.registry = options.registry ?? new GovernanceRegistry();
    this.audit = options.audit ?? new InMemoryGovernanceAudit();
    this.trustEvaluator = options.trustEvaluator ?? new DefaultTrustEvaluator();
    this.complianceEvaluator = options.complianceEvaluator ?? new DefaultComplianceEvaluator();
  }

  public readonly policy: GovernancePolicy;
  public readonly registry: GovernanceRegistry;
  public readonly audit: IGovernanceAudit;
  public readonly trustEvaluator: ITrustEvaluator;
  public readonly complianceEvaluator: IComplianceEvaluator;

  public evaluate(context: GovernanceContext): GovernanceResult {
    const policy = context.policy ?? this.policy;
    const matched = this.matchPolicy(policy, context);
    const risk = this.evaluateRisk(context, matched);
    const trust = this.trustEvaluator.evaluate(context);
    const compliance = this.complianceEvaluator.evaluate(context);
    const approval = this.shouldRequireApproval(context, matched, risk, trust, compliance)
      ? this.request(context)
      : undefined;
    const execution = this.evaluateGuardrails(context, matched, risk, trust, compliance);
    const decision = this.resolveDecision(
      context,
      matched,
      risk,
      trust,
      compliance,
      approval,
      execution,
    );

    const result = new GovernanceResult({
      decision,
      approved: decision !== GovernanceDecision.Deny,
      reason: this.describeDecision(decision, risk, approval, execution),
      policy,
      risk,
      recommendations: this.buildRecommendations(
        context,
        matched,
        risk,
        trust,
        compliance,
        approval,
        execution,
      ),
      violations: matched.violations,
      approval,
      execution,
      audit: undefined,
    });

    const auditEntry = new GovernanceAudit({
      id: `audit-${context.id}`,
      actor: context.actor,
      action: context.action,
      reason: result.reason,
      decision: result.decision,
      policyId: policy.id,
      risk,
      approval,
      execution,
      outcome: result.approved ? 'approved' : 'rejected',
      occurredAt: new Date().toISOString(),
    });
    this.audit.record(auditEntry);

    return new GovernanceResult({
      ...result,
      audit: auditEntry,
    });
  }

  public request(context: GovernanceContext): ApprovalResult {
    const policy = context.policy ?? this.policy;
    const approvalPolicy = policy.approvalPolicy ?? new ApprovalPolicy();
    const stages = this.createStages(approvalPolicy);
    const request = new ApprovalRequest({
      id: `approval-${context.id}`,
      actor: context.actor,
      action: context.action,
      resource: context.resource,
      reason: 'approval required by governance policy',
      policy: approvalPolicy,
      stages,
    });

    if (approvalPolicy.mode === 'automatic') {
      return this.decide(request, ApprovalDecision.Approved);
    }

    if (approvalPolicy.mode === 'delegated') {
      return this.decide(request, ApprovalDecision.Delegated);
    }

    if (approvalPolicy.mode === 'multi-stage') {
      return new ApprovalResult({
        id: `approval-result-${request.id}`,
        requestId: request.id,
        decision: ApprovalDecision.Pending,
        approved: false,
        reason: 'multi-stage approval pending',
        stages,
        completedAt: new Date().toISOString(),
      });
    }

    return new ApprovalResult({
      id: `approval-result-${request.id}`,
      requestId: request.id,
      decision: ApprovalDecision.Pending,
      approved: false,
      reason: 'human approval required',
      stages,
      completedAt: new Date().toISOString(),
    });
  }

  public decide(request: ApprovalRequest, decision: ApprovalDecision): ApprovalResult {
    const approved =
      decision === ApprovalDecision.Approved || decision === ApprovalDecision.Delegated;
    return new ApprovalResult({
      id: `approval-result-${request.id}`,
      requestId: request.id,
      decision,
      approved,
      reason: `approval ${decision}`,
      stages: request.stages,
      completedAt: new Date().toISOString(),
    });
  }

  public evaluateTrust(context: GovernanceContext): TrustEvaluation {
    return this.trustEvaluator.evaluate(context);
  }

  public evaluateCompliance(context: GovernanceContext): ComplianceEvaluation {
    return this.complianceEvaluator.evaluate(context);
  }

  private createStages(policy: ApprovalPolicy): ApprovalStage[] {
    if (policy.mode === 'multi-stage') {
      return [
        new ApprovalStage({
          id: 'stage-1',
          name: 'initial',
          approver: 'human-operator',
          required: true,
        }),
        new ApprovalStage({
          id: 'stage-2',
          name: 'escalation',
          approver: 'security-review',
          required: false,
        }),
      ];
    }

    if (policy.mode === 'delegated') {
      return [
        new ApprovalStage({
          id: 'stage-delegated',
          name: 'delegated',
          approver: 'delegate',
          required: true,
          delegated: true,
        }),
      ];
    }

    return [
      new ApprovalStage({
        id: 'stage-1',
        name: 'human',
        approver: 'human-operator',
        required: true,
      }),
    ];
  }

  private matchPolicy(
    policy: GovernancePolicy,
    context: GovernanceContext,
  ): { matched: GovernanceRule[]; violations: GovernanceViolation[] } {
    const matched: GovernanceRule[] = [];
    const violations: GovernanceViolation[] = [];

    for (const rule of policy.rules) {
      if (this.ruleMatches(rule, context)) {
        matched.push(rule);
        if (rule.decision === GovernanceDecision.Deny) {
          violations.push(
            new GovernanceViolation({
              id: `violation-${rule.id}`,
              ruleId: rule.id,
              message: rule.name,
              severity: 'critical',
            }),
          );
        }
      }
    }

    return { matched, violations };
  }

  private ruleMatches(rule: GovernanceRule, context: GovernanceContext): boolean {
    if (rule.scopes.length > 0 && !rule.scopes.some((scope) => this.scopeMatches(scope, context))) {
      return false;
    }
    return rule.conditions.every((condition) => this.conditionMatches(condition, context));
  }

  private scopeMatches(scope: GovernanceScope, context: GovernanceContext): boolean {
    if (scope.tenant && context.tenant && scope.tenant !== context.tenant) {
      return false;
    }
    if (scope.resource && context.resource !== scope.resource) {
      return false;
    }
    if (scope.action && context.action !== scope.action) {
      return false;
    }
    return true;
  }

  private conditionMatches(condition: GovernanceCondition, context: GovernanceContext): boolean {
    const metadata = context.metadata as Record<string, unknown> | undefined;
    const value = metadata?.[condition.attribute];
    if (value === undefined) {
      return false;
    }

    switch (condition.operator) {
      case 'eq':
        return value === condition.value;
      case 'neq':
        return value !== condition.value;
      case 'gt':
        return Number(value) > Number(condition.value);
      case 'gte':
        return Number(value) >= Number(condition.value);
      case 'lt':
        return Number(value) < Number(condition.value);
      case 'lte':
        return Number(value) <= Number(condition.value);
      case 'contains':
        return String(value).includes(String(condition.value));
      case 'in': {
        if (!Array.isArray(condition.value) || !Array.isArray(value)) {
          return false;
        }

        const allowedValues = condition.value.map((item) => String(item));
        return value.some((item) => allowedValues.includes(String(item)));
      }
      default:
        return false;
    }
  }

  private evaluateRisk(
    context: GovernanceContext,
    policyMatches: { matched: GovernanceRule[]; violations: GovernanceViolation[] },
  ): GovernanceRisk {
    const score = Math.min(
      1,
      context.riskScore +
        policyMatches.violations.length * 0.2 +
        (context.approvalRequired ? 0.1 : 0),
    );
    return new GovernanceRisk({
      category: GovernanceCategory.Risk,
      score,
      confidence: 0.9,
      explanation: 'risk evaluated from policy violations and context',
      policyViolations: policyMatches.violations,
    });
  }

  private shouldRequireApproval(
    context: GovernanceContext,
    policyMatches: { matched: GovernanceRule[]; violations: GovernanceViolation[] },
    risk: GovernanceRisk,
    trust: TrustEvaluation,
    compliance: ComplianceEvaluation,
  ): boolean {
    const denyMatch = policyMatches.matched.some(
      (rule) => rule.decision === GovernanceDecision.Deny,
    );
    const highRisk = risk.score > 0.7;
    const lowTrust = trust.score < 0.5;
    const nonCompliant = compliance.status !== ComplianceStatus.Compliant;
    return denyMatch || highRisk || lowTrust || nonCompliant || context.approvalRequired;
  }

  private evaluateGuardrails(
    context: GovernanceContext,
    policyMatches: { matched: GovernanceRule[]; violations: GovernanceViolation[] },
    risk: GovernanceRisk,
    trust: TrustEvaluation,
    compliance: ComplianceEvaluation,
  ): ExecutionGuardrail {
    const triggered =
      risk.score > 0.8 || trust.score < 0.3 || compliance.status !== ComplianceStatus.Compliant;
    return new ExecutionGuardrail({
      id: `guardrail-${context.id}`,
      reason: triggered ? 'risk or compliance threshold exceeded' : 'no guardrail triggered',
      budget: new ExecutionBudget({
        maxTokens: 5000,
        maxDurationMs: 60000,
        maxToolCalls: 10,
        maxMemoryMb: 512,
      }),
      limits: [
        new ExecutionLimit({
          id: 'limit-timeout',
          name: 'timeout',
          value: 60000,
          unit: 'milliseconds',
        }),
      ],
      restrictions: [
        new ExecutionRestriction({
          id: 'restriction-tool',
          name: 'tool',
          value: 'safe-tools-only',
          scope: 'tool',
        }),
      ],
      triggered,
    });
  }

  private resolveDecision(
    context: GovernanceContext,
    policyMatches: { matched: GovernanceRule[]; violations: GovernanceViolation[] },
    risk: GovernanceRisk,
    trust: TrustEvaluation,
    compliance: ComplianceEvaluation,
    approval: ApprovalResult | undefined,
    execution: ExecutionGuardrail,
  ): GovernanceDecision {
    if (policyMatches.violations.length > 0) {
      return GovernanceDecision.Deny;
    }
    if (risk.score > 0.8) {
      return GovernanceDecision.Escalate;
    }
    if (approval?.decision === ApprovalDecision.Pending) {
      return GovernanceDecision.RequireApproval;
    }
    if (execution.triggered) {
      return GovernanceDecision.RequireApproval;
    }
    return GovernanceDecision.Allow;
  }

  private describeDecision(
    decision: GovernanceDecision,
    risk: GovernanceRisk,
    approval: ApprovalResult | undefined,
    _execution: ExecutionGuardrail,
  ): string {
    if (decision === GovernanceDecision.Allow) {
      return 'execution allowed';
    }
    if (decision === GovernanceDecision.RequireApproval) {
      return approval ? `approval ${approval.decision}` : 'approval required';
    }
    if (decision === GovernanceDecision.Escalate) {
      return `risk ${risk.score.toFixed(2)}`;
    }
    return 'execution denied';
  }

  private buildRecommendations(
    context: GovernanceContext,
    policyMatches: { matched: GovernanceRule[]; violations: GovernanceViolation[] },
    risk: GovernanceRisk,
    trust: TrustEvaluation,
    compliance: ComplianceEvaluation,
    approval: ApprovalResult | undefined,
    execution: ExecutionGuardrail,
  ): GovernanceRecommendation[] {
    const recommendations: GovernanceRecommendation[] = [];
    if (risk.score > 0.5) {
      recommendations.push(
        new GovernanceRecommendation({
          id: 'recommendation-risk',
          title: 'Reduce risk',
          detail: 'lower the risk profile before execution',
          decision: GovernanceDecision.RequireApproval,
          score: risk.score,
        }),
      );
    }
    if (approval?.decision === ApprovalDecision.Pending) {
      recommendations.push(
        new GovernanceRecommendation({
          id: 'recommendation-approval',
          title: 'Await approval',
          detail: 'wait for human or delegated approval',
          decision: GovernanceDecision.RequireApproval,
          score: 0.9,
        }),
      );
    }
    if (execution.triggered) {
      recommendations.push(
        new GovernanceRecommendation({
          id: 'recommendation-guardrail',
          title: 'Activate guardrails',
          detail: 'enforce execution budget and restrictions',
          decision: GovernanceDecision.RequireApproval,
          score: 0.85,
        }),
      );
    }
    return recommendations;
  }
}

export class InMemoryGovernanceAudit implements IGovernanceAudit {
  public constructor() {
    this.entries = [];
  }

  private readonly entries: GovernanceAudit[];

  public record(entry: GovernanceAudit): void {
    this.entries.push(entry);
  }

  public list(): readonly GovernanceAudit[] {
    return [...this.entries];
  }

  public snapshot(): GovernanceSnapshot {
    const last = this.entries[this.entries.length - 1];
    return new GovernanceSnapshot({
      id: `snapshot-${this.entries.length}`,
      policyId: last?.policyId ?? 'default-policy',
      decision: last?.decision ?? GovernanceDecision.Allow,
      approved: last?.outcome === 'approved',
      riskScore: last?.risk.score ?? 0,
      violations: last?.risk.policyViolations ?? [],
      recommendations: [],
      createdAt: new Date().toISOString(),
    });
  }
}

export class DefaultTrustEvaluator implements ITrustEvaluator {
  public evaluate(context: GovernanceContext): TrustEvaluation {
    const score = Math.max(0, Math.min(1, 1 - Math.min(context.riskScore, 1)));
    const level = score > 0.8 ? TrustLevel.High : score > 0.5 ? TrustLevel.Medium : TrustLevel.Low;
    return new TrustEvaluation({
      level,
      score,
      explanation: 'default trust evaluation',
    });
  }
}

export class DefaultComplianceEvaluator implements IComplianceEvaluator {
  public evaluate(context: GovernanceContext): ComplianceEvaluation {
    const status =
      context.requiredCompliance === ComplianceStatus.NonCompliant
        ? ComplianceStatus.NonCompliant
        : ComplianceStatus.Compliant;
    return new ComplianceEvaluation({
      status,
      score: 0.9,
      explanation: 'default compliance evaluation',
      evidence: [
        new ComplianceEvidence({
          id: 'evidence-default',
          label: 'default check',
          detail: 'governance policy satisfied',
          score: 0.9,
        }),
      ],
    });
  }
}
