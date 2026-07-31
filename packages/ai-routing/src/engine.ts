import { AISelectionCandidate, AISelectionReason, AIRejectedCandidate } from './candidate';
import type { AIRoutingContext } from './context';
import type { AIRoutingPolicy } from './policy';
import type { AIRoutingRule } from './policy';
import type { AICapabilityKind, IAIModel, IAIProvider } from './ai-core-compat';

export interface AIRoutingEvaluation {
  /** Candidates ranked from best (index 0) to worst. Empty when nothing is eligible. */
  readonly ranked: readonly AISelectionCandidate[];
  /** Pairings that were evaluated but excluded by a hard constraint. */
  readonly rejected: readonly AIRejectedCandidate[];
  /** Policy rules whose predicate matched the context, regardless of whether they affected the winner. */
  readonly matchedRules: readonly AIRoutingRule[];
}

/**
 * The deterministic scoring core of the routing engine. Given a set of
 * already-eligible providers and models, it builds every viable pairing,
 * applies hard cost/latency/context constraints, scores the survivors
 * according to the active {@link AIRoutingStrategy} and policy rules, and
 * returns a fully-ranked, explainable result.
 */
export interface IAIRoutingEngine {
  evaluate(
    context: AIRoutingContext,
    policy: AIRoutingPolicy,
    providers: readonly IAIProvider[],
    models: readonly IAIModel[],
  ): Promise<AIRoutingEvaluation>;
}

export class AIRoutingEngine implements IAIRoutingEngine {
  public async evaluate(
    context: AIRoutingContext,
    policy: AIRoutingPolicy,
    providers: readonly IAIProvider[],
    models: readonly IAIModel[],
  ): Promise<AIRoutingEvaluation> {
    const providerById = new Map(providers.map((provider) => [provider.descriptor.id, provider]));
    const healthCache = new Map<string, { latencyMs: number; availability: number }>();

    const candidates: AISelectionCandidate[] = [];
    const rejected: AIRejectedCandidate[] = [];

    for (const model of models) {
      const provider = providerById.get(model.providerId);
      if (!provider) {
        continue;
      }

      let health = healthCache.get(provider.descriptor.id);
      if (!health) {
        const checked = await provider.healthCheck();
        health = { latencyMs: checked.latencyMs, availability: checked.availability };
        healthCache.set(provider.descriptor.id, health);
      }

      const cost = await provider.estimateCost({
        id: `${context.requestId}-${model.id}`,
        providerId: provider.descriptor.id,
        modelId: model.id,
        input: context.input ?? '',
        operation: (context.requiredCapability ?? 'chat') as AICapabilityKind,
        metadata: context.metadata,
      });

      if (context.maxLatencyMs !== undefined && health.latencyMs > context.maxLatencyMs) {
        rejected.push(
          this.reject(
            provider.descriptor.id,
            model.id,
            'latency-exceeded',
            `Estimated latency exceeds the request's maximum latency`,
          ),
        );
        continue;
      }

      if (context.maxCost !== undefined && cost > context.maxCost) {
        rejected.push(
          this.reject(
            provider.descriptor.id,
            model.id,
            'cost-exceeded',
            `Estimated cost exceeds the request's maximum cost`,
          ),
        );
        continue;
      }

      if (policy.maxCost !== undefined && cost > policy.maxCost) {
        rejected.push(
          this.reject(
            provider.descriptor.id,
            model.id,
            'policy-cost-exceeded',
            `Estimated cost exceeds the policy cost ceiling`,
          ),
        );
        continue;
      }

      const reasons: AISelectionReason[] = [];
      if (context.requiredCapability) {
        reasons.push(
          new AISelectionReason({
            code: 'capability-match',
            message: `Matched required capability '${context.requiredCapability}'`,
            scoreDelta: 100,
          }),
        );
      }
      if (context.preferredCapability) {
        reasons.push(
          new AISelectionReason({
            code: 'preferred-capability-match',
            message: `Matched preferred capability '${context.preferredCapability}'`,
            scoreDelta: 25,
          }),
        );
      }

      const candidate = new AISelectionCandidate({
        provider,
        model,
        estimatedLatencyMs: health.latencyMs,
        estimatedCost: cost,
        availability: health.availability,
        score: 0,
        reasons,
      });

      candidates.push(this.withScore(candidate, this.score(context, policy, candidate)));
    }

    const matchedRules = (policy.rules ?? []).filter((rule) => rule.predicate(context));

    const ranked = [...candidates].sort((left, right) => this.compare(left, right));

    return { ranked, rejected, matchedRules };
  }

  private withScore(candidate: AISelectionCandidate, score: number): AISelectionCandidate {
    return new AISelectionCandidate({
      provider: candidate.provider,
      model: candidate.model,
      estimatedLatencyMs: candidate.estimatedLatencyMs,
      estimatedCost: candidate.estimatedCost,
      availability: candidate.availability,
      score,
      reasons: candidate.reasons,
    });
  }

  private compare(left: AISelectionCandidate, right: AISelectionCandidate): number {
    if (left.score !== right.score) {
      return right.score - left.score;
    }
    if (left.estimatedLatencyMs !== right.estimatedLatencyMs) {
      return left.estimatedLatencyMs - right.estimatedLatencyMs;
    }
    if (left.estimatedCost !== right.estimatedCost) {
      return left.estimatedCost - right.estimatedCost;
    }
    return left.modelId.localeCompare(right.modelId);
  }

  private score(
    context: AIRoutingContext,
    policy: AIRoutingPolicy,
    candidate: AISelectionCandidate,
  ): number {
    if (policy.strategy.scorer) {
      return policy.strategy.scorer(candidate);
    }

    let score = candidate.reasons.reduce((total, reason) => total + reason.scoreDelta, 0);

    switch (policy.strategy.kind) {
      case 'capability-first':
        score += 1000;
        break;
      case 'lowest-latency':
        score += Math.max(0, 10000 - candidate.estimatedLatencyMs);
        break;
      case 'lowest-cost':
        score += Math.max(0, 10000 - candidate.estimatedCost * 1000);
        break;
      case 'highest-availability':
        score += candidate.availability * 10000;
        break;
      case 'preferred-provider':
        score += policy.strategy.preferredProviderId === candidate.providerId ? 10000 : 0;
        break;
      case 'preferred-model-family':
        score += policy.strategy.preferredModelFamily === candidate.model.family ? 10000 : 0;
        break;
      case 'enterprise-policy':
        score += 200;
        break;
      case 'balanced':
      default:
        score += 500;
        break;
    }

    score += Math.max(0, 100 - candidate.estimatedLatencyMs);
    score += Math.max(0, 50 - candidate.estimatedCost * 100);
    score += candidate.availability * 10;

    if (policy.preferredProviders?.includes(candidate.providerId)) {
      score += 100000;
    }
    if (policy.preferredModelFamily && candidate.model.family === policy.preferredModelFamily) {
      score += 100000;
    }

    for (const rule of policy.rules ?? []) {
      if (!rule.predicate(context)) {
        continue;
      }
      if (rule.preferredProvider && candidate.providerId === rule.preferredProvider) {
        score += 250000;
      }
      if (rule.preferredModelFamily && candidate.model.family === rule.preferredModelFamily) {
        score += 250000;
      }
      if (rule.preferredModel && candidate.modelId === rule.preferredModel) {
        score += 250000;
      }
      if (rule.penalty) {
        score -= rule.penalty;
      }
    }

    return score;
  }

  private reject(
    providerId: string,
    modelId: string,
    code: string,
    message: string,
  ): AIRejectedCandidate {
    return new AIRejectedCandidate({
      providerId,
      modelId,
      reason: new AISelectionReason({ code, message }),
    });
  }
}
