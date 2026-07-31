import type { SerializableValueObject } from '@infrashield/contracts';
import type { AIRejectedCandidate, AISelectionReason } from './candidate';
import type { AIRoutingContext } from './context';
import type { AIRoutingRule } from './policy';

/**
 * The immutable outcome of a routing decision: which provider and model
 * were chosen, why, what was rejected, and which policy constraints and
 * routing-input constraints were applied while reaching the decision.
 */
export class AIRoutingDecision {
  public readonly providerId: string;
  public readonly modelId: string;
  public readonly reasons: readonly AISelectionReason[];
  public readonly estimatedLatencyMs: number;
  public readonly estimatedCost: number;
  public readonly confidence: number;
  public readonly rejectedCandidates: readonly AIRejectedCandidate[];
  public readonly appliedPolicies: readonly string[];
  public readonly appliedConstraints: readonly string[];
  public readonly metadata?: SerializableValueObject;

  public constructor(options: {
    readonly providerId: string;
    readonly modelId: string;
    readonly reasons: readonly AISelectionReason[];
    readonly estimatedLatencyMs: number;
    readonly estimatedCost: number;
    readonly confidence?: number;
    readonly rejectedCandidates?: readonly AIRejectedCandidate[];
    readonly appliedPolicies?: readonly string[];
    readonly appliedConstraints?: readonly string[];
    readonly metadata?: SerializableValueObject;
  }) {
    this.providerId = options.providerId;
    this.modelId = options.modelId;
    this.reasons = Object.freeze([...options.reasons]);
    this.estimatedLatencyMs = options.estimatedLatencyMs;
    this.estimatedCost = options.estimatedCost;
    this.confidence = options.confidence ?? 1;
    this.rejectedCandidates = Object.freeze([...(options.rejectedCandidates ?? [])]);
    this.appliedPolicies = Object.freeze([...(options.appliedPolicies ?? [])]);
    this.appliedConstraints = Object.freeze([...(options.appliedConstraints ?? [])]);
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
    Object.freeze(this);
  }
}

/** A routing decision bundled with the request context and the ordered fallback plan. */
export class AIRoutingResult {
  public readonly decision: AIRoutingDecision;
  public readonly context: AIRoutingContext;
  public readonly appliedRules: readonly AIRoutingRule[];
  public readonly fallbackPlan: readonly string[];

  public constructor(options: {
    readonly decision: AIRoutingDecision;
    readonly context: AIRoutingContext;
    readonly appliedRules?: readonly AIRoutingRule[];
    readonly fallbackPlan?: readonly string[];
  }) {
    this.decision = options.decision;
    this.context = options.context;
    this.appliedRules = Object.freeze([...(options.appliedRules ?? [])]);
    this.fallbackPlan = Object.freeze([...(options.fallbackPlan ?? [])]);
    Object.freeze(this);
  }
}

/** An immutable, point-in-time view of router observability data. */
export class AIRoutingSnapshot {
  public readonly generatedAt: string;
  public readonly decisionCount: number;
  public readonly providerUsage: Readonly<Record<string, number>>;
  public readonly modelUsage: Readonly<Record<string, number>>;
  public readonly policyUsage: Readonly<Record<string, number>>;
  public readonly fallbackCount: number;

  public constructor(options: {
    readonly decisionCount: number;
    readonly providerUsage: Readonly<Record<string, number>>;
    readonly modelUsage: Readonly<Record<string, number>>;
    readonly policyUsage?: Readonly<Record<string, number>>;
    readonly fallbackCount: number;
  }) {
    this.generatedAt = new Date().toISOString();
    this.decisionCount = options.decisionCount;
    this.providerUsage = Object.freeze({ ...options.providerUsage });
    this.modelUsage = Object.freeze({ ...options.modelUsage });
    this.policyUsage = Object.freeze({ ...(options.policyUsage ?? {}) });
    this.fallbackCount = options.fallbackCount;
    Object.freeze(this);
  }
}
