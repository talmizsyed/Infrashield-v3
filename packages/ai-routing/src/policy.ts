import { AIRoutingPolicyException } from './errors';
import type { AIRoutingContext } from './context';
import type { AIRoutingStrategy } from './strategy';

/**
 * A custom routing rule evaluated against the request context. Rules are
 * pure predicates over {@link AIRoutingContext}; when a rule matches, its
 * preferences are folded into candidate scoring and reported on the
 * resulting decision so routing stays explainable.
 */
export class AIRoutingRule {
  public readonly id: string;
  public readonly description: string;
  public readonly priority: number;
  public readonly predicate: (context: AIRoutingContext) => boolean;
  public readonly preferredProvider?: string;
  public readonly preferredModel?: string;
  public readonly preferredModelFamily?: string;
  public readonly penalty?: number;

  public constructor(options: {
    readonly id: string;
    readonly description: string;
    readonly priority?: number;
    readonly predicate: (context: AIRoutingContext) => boolean;
    readonly preferredProvider?: string;
    readonly preferredModel?: string;
    readonly preferredModelFamily?: string;
    readonly penalty?: number;
  }) {
    this.id = options.id.trim();
    this.description = options.description.trim();
    this.priority = options.priority ?? 0;
    this.predicate = options.predicate;
    this.preferredProvider = options.preferredProvider?.trim();
    this.preferredModel = options.preferredModel?.trim();
    this.preferredModelFamily = options.preferredModelFamily?.trim();
    this.penalty = options.penalty;
    Object.freeze(this);
  }
}

/**
 * The enterprise policy applied by an {@link AIRouter}. Policies are
 * immutable and validated at construction time so an inconsistent policy
 * (e.g. a provider that is simultaneously allowed and denied) fails fast
 * rather than producing surprising routing behavior.
 */
export class AIRoutingPolicy {
  public readonly strategy: AIRoutingStrategy;

  public readonly preferredProviders?: readonly string[];
  public readonly deniedProviders?: readonly string[];
  public readonly allowedProviders?: readonly string[];

  public readonly allowedRegions?: readonly string[];
  public readonly dataResidency?: readonly string[];
  public readonly confidentialWorkloads?: boolean;

  public readonly maxCost?: number;
  public readonly latencySlaMs?: number;

  public readonly preferredModelFamily?: string;
  public readonly fallbackOrder?: readonly string[];
  public readonly rules?: readonly AIRoutingRule[];
  public readonly maxFallbacks?: number;

  public constructor(options: {
    readonly strategy: AIRoutingStrategy;
    readonly preferredProviders?: readonly string[];
    readonly deniedProviders?: readonly string[];
    readonly allowedProviders?: readonly string[];
    readonly allowedRegions?: readonly string[];
    readonly dataResidency?: readonly string[];
    readonly confidentialWorkloads?: boolean;
    readonly maxCost?: number;
    readonly latencySlaMs?: number;
    readonly preferredModelFamily?: string;
    readonly fallbackOrder?: readonly string[];
    readonly rules?: readonly AIRoutingRule[];
    readonly maxFallbacks?: number;
  }) {
    this.strategy = options.strategy;
    this.preferredProviders = options.preferredProviders
      ? Object.freeze([...options.preferredProviders])
      : undefined;
    this.deniedProviders = options.deniedProviders
      ? Object.freeze([...options.deniedProviders])
      : undefined;
    this.allowedProviders = options.allowedProviders
      ? Object.freeze([...options.allowedProviders])
      : undefined;
    this.allowedRegions = options.allowedRegions
      ? Object.freeze([...options.allowedRegions])
      : undefined;
    this.dataResidency = options.dataResidency
      ? Object.freeze([...options.dataResidency])
      : undefined;
    this.confidentialWorkloads = options.confidentialWorkloads;
    this.maxCost = options.maxCost;
    this.latencySlaMs = options.latencySlaMs;
    this.preferredModelFamily = options.preferredModelFamily?.trim();
    this.fallbackOrder = options.fallbackOrder
      ? Object.freeze([...options.fallbackOrder])
      : undefined;
    this.rules = options.rules ? Object.freeze([...options.rules]) : undefined;
    this.maxFallbacks = options.maxFallbacks;

    this.validate();
    Object.freeze(this);
  }

  private validate(): void {
    if (this.allowedProviders && this.deniedProviders) {
      const conflict = this.allowedProviders.find((id) => this.deniedProviders?.includes(id));
      if (conflict) {
        throw new AIRoutingPolicyException(
          `Provider '${conflict}' cannot be both allowed and denied by the same routing policy`,
        );
      }
    }
    if (this.allowedProviders && this.allowedProviders.length === 0) {
      throw new AIRoutingPolicyException(
        'allowedProviders must contain at least one provider id when specified',
      );
    }
    if (this.maxCost !== undefined && this.maxCost < 0) {
      throw new AIRoutingPolicyException('maxCost must be a non-negative number');
    }
    if (this.latencySlaMs !== undefined && this.latencySlaMs < 0) {
      throw new AIRoutingPolicyException('latencySlaMs must be a non-negative number');
    }
  }
}
