import type { AISelectionCandidate } from './candidate';

export type AIRoutingStrategyKind =
  | 'capability-first'
  | 'lowest-latency'
  | 'lowest-cost'
  | 'highest-availability'
  | 'preferred-provider'
  | 'preferred-model-family'
  | 'balanced'
  | 'enterprise-policy'
  | 'custom';

/**
 * A pluggable ranking strategy. Strategies never filter candidates - that is
 * the responsibility of {@link IAIProviderSelector}, {@link IAIModelSelector}
 * and policy constraints. A strategy only decides how eligible candidates
 * are scored relative to one another.
 */
export class AIRoutingStrategy {
  public readonly kind: AIRoutingStrategyKind;
  public readonly name: string;
  public readonly description: string;
  /** Optional custom scorer. When present, it fully determines the candidate's score. */
  public readonly scorer?: (candidate: AISelectionCandidate) => number;
  /** Preferred provider id, used by the 'preferred-provider' strategy. */
  public readonly preferredProviderId?: string;
  /** Preferred model family, used by the 'preferred-model-family' strategy. */
  public readonly preferredModelFamily?: string;

  public constructor(options: {
    readonly kind: AIRoutingStrategyKind;
    readonly name: string;
    readonly description: string;
    readonly scorer?: (candidate: AISelectionCandidate) => number;
    readonly preferredProviderId?: string;
    readonly preferredModelFamily?: string;
  }) {
    this.kind = options.kind;
    this.name = options.name.trim();
    this.description = options.description.trim();
    this.scorer = options.scorer;
    this.preferredProviderId = options.preferredProviderId?.trim();
    this.preferredModelFamily = options.preferredModelFamily?.trim();
    Object.freeze(this);
  }

  public static capabilityFirst(): AIRoutingStrategy {
    return new AIRoutingStrategy({
      kind: 'capability-first',
      name: 'capability-first',
      description: 'Prefer providers and models that satisfy the requested capability',
    });
  }

  public static lowestLatency(): AIRoutingStrategy {
    return new AIRoutingStrategy({
      kind: 'lowest-latency',
      name: 'lowest-latency',
      description: 'Prefer the lowest-latency provider and model combination',
    });
  }

  public static lowestCost(): AIRoutingStrategy {
    return new AIRoutingStrategy({
      kind: 'lowest-cost',
      name: 'lowest-cost',
      description: 'Prefer the lowest estimated-cost provider and model combination',
    });
  }

  public static highestAvailability(): AIRoutingStrategy {
    return new AIRoutingStrategy({
      kind: 'highest-availability',
      name: 'highest-availability',
      description: 'Prefer the provider with the highest reported availability',
    });
  }

  public static preferredProvider(providerId: string): AIRoutingStrategy {
    return new AIRoutingStrategy({
      kind: 'preferred-provider',
      name: 'preferred-provider',
      description: `Prefer provider '${providerId}' whenever it is eligible`,
      preferredProviderId: providerId,
    });
  }

  public static preferredModelFamily(family: string): AIRoutingStrategy {
    return new AIRoutingStrategy({
      kind: 'preferred-model-family',
      name: 'preferred-model-family',
      description: `Prefer model family '${family}' whenever it is eligible`,
      preferredModelFamily: family,
    });
  }

  public static balanced(): AIRoutingStrategy {
    return new AIRoutingStrategy({
      kind: 'balanced',
      name: 'balanced',
      description: 'Balance capability, latency, availability and cost',
    });
  }

  public static enterprisePolicy(): AIRoutingStrategy {
    return new AIRoutingStrategy({
      kind: 'enterprise-policy',
      name: 'enterprise-policy',
      description:
        'Defer ranking primarily to policy rules, using balanced scoring as a tiebreaker',
    });
  }

  public static custom(
    name: string,
    description: string,
    scorer: (candidate: AISelectionCandidate) => number,
  ): AIRoutingStrategy {
    return new AIRoutingStrategy({ kind: 'custom', name, description, scorer });
  }
}
