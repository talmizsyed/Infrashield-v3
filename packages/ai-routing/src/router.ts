import type { IEventBus } from '@infrashield/core-infrastructure';
import {
  AISelectionReason,
  type AIRejectedCandidate,
  type AISelectionCandidate,
} from './candidate';
import type { AIRoutingContext } from './context';
import { AIRoutingDecision, AIRoutingResult, AIRoutingSnapshot } from './decision';
import { AIRoutingEngine, type IAIRoutingEngine } from './engine';
import {
  AIModelSelectionException,
  AIProviderSelectionException,
  AISelectionException,
} from './errors';
import {
  FallbackTriggeredEvent,
  ModelSelectedEvent,
  ProviderSelectedEvent,
  RoutingDecisionCreatedEvent,
  RoutingPolicyAppliedEvent,
} from './events';
import { AIRoutingPolicy, type AIRoutingRule } from './policy';
import {
  AIModelSelector,
  AIProviderSelector,
  type AIProviderSelectionResult,
  type IAIModelSelector,
  type IAIProviderSelector,
} from './selectors';
import { AIRoutingStrategy } from './strategy';
import type { IAIModelRegistry, IAIProvider, IAIProviderRegistry } from './ai-core-compat';

const APPLIED_POLICY_FIELDS: readonly (keyof AIRoutingPolicy)[] = [
  'preferredProviders',
  'deniedProviders',
  'allowedProviders',
  'allowedRegions',
  'dataResidency',
  'confidentialWorkloads',
  'maxCost',
  'latencySlaMs',
  'preferredModelFamily',
  'fallbackOrder',
  'rules',
];

const APPLIED_CONSTRAINT_FIELDS: readonly (keyof AIRoutingContext)[] = [
  'requiredCapability',
  'maxLatencyMs',
  'maxCost',
  'minContextTokens',
  'reasoning',
  'vision',
  'streaming',
  'toolCalling',
  'embeddings',
  'structuredOutput',
  'region',
  'environment',
  'classification',
];

export interface IAIRouter {
  route(context: AIRoutingContext): Promise<AIRoutingResult>;
  snapshot(): AIRoutingSnapshot;
}

interface AIRouterState {
  decisionCount: number;
  providerUsage: Record<string, number>;
  modelUsage: Record<string, number>;
  policyUsage: Record<string, number>;
  fallbackCount: number;
}

/**
 * The public entry point applications use to obtain a provider/model
 * decision. `AIRouter` never talks to provider SDKs directly - it composes
 * an {@link IAIProviderSelector}, {@link IAIModelSelector} and
 * {@link IAIRoutingEngine} over the AI Gateway's provider and model
 * registries, then publishes the resulting decision to the shared event bus.
 */
export class AIRouter implements IAIRouter {
  private readonly providerRegistry: IAIProviderRegistry;
  private readonly modelRegistry: IAIModelRegistry;
  private readonly policy: AIRoutingPolicy;
  private readonly providerSelector: IAIProviderSelector;
  private readonly modelSelector: IAIModelSelector;
  private readonly engine: IAIRoutingEngine;
  private readonly eventBus?: IEventBus;
  private readonly state: AIRouterState;

  public constructor(options: {
    readonly providerRegistry: IAIProviderRegistry;
    readonly modelRegistry: IAIModelRegistry;
    readonly policy?: AIRoutingPolicy;
    readonly providerSelector?: IAIProviderSelector;
    readonly modelSelector?: IAIModelSelector;
    readonly engine?: IAIRoutingEngine;
    readonly eventBus?: IEventBus;
  }) {
    this.providerRegistry = options.providerRegistry;
    this.modelRegistry = options.modelRegistry;
    this.policy =
      options.policy ?? new AIRoutingPolicy({ strategy: AIRoutingStrategy.capabilityFirst() });
    this.providerSelector = options.providerSelector ?? new AIProviderSelector();
    this.modelSelector = options.modelSelector ?? new AIModelSelector();
    this.engine = options.engine ?? new AIRoutingEngine();
    this.eventBus = options.eventBus;
    this.state = {
      decisionCount: 0,
      providerUsage: {},
      modelUsage: {},
      policyUsage: {},
      fallbackCount: 0,
    };
  }

  public async route(context: AIRoutingContext): Promise<AIRoutingResult> {
    const providers = this.providerRegistry.list();
    const models = this.modelRegistry.list();

    const providerSelection = await this.providerSelector.selectProviders(
      context,
      this.policy,
      providers,
    );
    if (providerSelection.eligible.length === 0) {
      throw new AIProviderSelectionException(
        `No provider satisfies the routing request for capability '${context.requiredCapability ?? 'default'}'`,
        providerSelection.rejected,
      );
    }

    const modelSelection = await this.modelSelector.selectModels(
      context,
      this.policy,
      providerSelection.eligible,
      models,
    );
    if (modelSelection.eligible.length === 0) {
      throw new AIModelSelectionException(
        `No model satisfies the routing request for capability '${context.requiredCapability ?? 'default'}'`,
        modelSelection.rejected,
      );
    }

    const evaluation = await this.engine.evaluate(
      context,
      this.policy,
      providerSelection.eligible,
      modelSelection.eligible,
    );

    const allRejected: readonly AIRejectedCandidate[] = [
      ...providerSelection.rejected,
      ...modelSelection.rejected,
      ...evaluation.rejected,
    ];

    const selected = evaluation.ranked[0];
    if (!selected) {
      throw new AISelectionException(
        `No provider/model pairing survived routing constraints for capability '${context.requiredCapability ?? 'default'}'`,
        allRejected,
      );
    }

    const appliedRules = [...evaluation.matchedRules].sort(
      (left, right) => left.priority - right.priority,
    );
    const fallbackPlan = this.buildFallbackPlan(evaluation.ranked, selected.providerId);
    const fallback = this.detectFallback(providers, providerSelection, selected.providerId);

    const reasons = [
      ...selected.reasons,
      ...appliedRules.map(
        (rule: AIRoutingRule) =>
          new AISelectionReason({
            code: 'policy-rule',
            message: rule.description,
            scoreDelta: 1000,
          }),
      ),
    ];

    const decision = new AIRoutingDecision({
      providerId: selected.providerId,
      modelId: selected.modelId,
      reasons,
      estimatedLatencyMs: selected.estimatedLatencyMs,
      estimatedCost: selected.estimatedCost,
      confidence: this.computeConfidence(evaluation.ranked, selected),
      rejectedCandidates: allRejected,
      appliedPolicies: this.appliedPolicies(),
      appliedConstraints: this.appliedConstraints(context),
      metadata: {
        appliedRules: appliedRules.map((rule) => rule.id),
        region: context.region ?? null,
      },
    });

    this.recordSelection(
      selected.providerId,
      selected.modelId,
      appliedRules,
      fallback !== undefined,
    );

    await this.publishEvent(new ProviderSelectedEvent(context.requestId, selected.providerId));
    await this.publishEvent(
      new ModelSelectedEvent(context.requestId, selected.providerId, selected.modelId),
    );
    if (appliedRules.length > 0) {
      await this.publishEvent(
        new RoutingPolicyAppliedEvent(
          context.requestId,
          appliedRules.map((rule) => rule.id),
        ),
      );
    }
    if (fallback) {
      await this.publishEvent(
        new FallbackTriggeredEvent(context.requestId, fallback.from, fallback.to),
      );
    }
    await this.publishEvent(new RoutingDecisionCreatedEvent(context.requestId, decision));

    return new AIRoutingResult({ decision, context, appliedRules, fallbackPlan });
  }

  public snapshot(): AIRoutingSnapshot {
    return new AIRoutingSnapshot({
      decisionCount: this.state.decisionCount,
      providerUsage: { ...this.state.providerUsage },
      modelUsage: { ...this.state.modelUsage },
      policyUsage: { ...this.state.policyUsage },
      fallbackCount: this.state.fallbackCount,
    });
  }

  private buildFallbackPlan(
    ranked: readonly AISelectionCandidate[],
    selectedProviderId: string,
  ): readonly string[] {
    const remaining = ranked
      .map((candidate) => candidate.providerId)
      .filter(
        (providerId, index, all) =>
          providerId !== selectedProviderId && all.indexOf(providerId) === index,
      );

    if (this.policy.fallbackOrder) {
      const ordered = this.policy.fallbackOrder.filter((providerId) =>
        remaining.includes(providerId),
      );
      const rest = remaining.filter((providerId) => !ordered.includes(providerId));
      const plan = [...ordered, ...rest];
      return this.policy.maxFallbacks !== undefined
        ? plan.slice(0, this.policy.maxFallbacks)
        : plan;
    }

    return this.policy.maxFallbacks !== undefined
      ? remaining.slice(0, this.policy.maxFallbacks)
      : remaining;
  }

  private detectFallback(
    allProviders: readonly IAIProvider[],
    providerSelection: AIProviderSelectionResult,
    selectedProviderId: string,
  ): { readonly from: string; readonly to: string } | undefined {
    const fallbackOrder = this.policy.fallbackOrder;
    if (!fallbackOrder || fallbackOrder.length === 0) {
      return undefined;
    }

    const primary = fallbackOrder[0];
    if (!primary || primary === selectedProviderId) {
      return undefined;
    }

    const existed = allProviders.some((provider) => provider.descriptor.id === primary);
    const stillEligible = providerSelection.eligible.some(
      (provider) => provider.descriptor.id === primary,
    );
    if (existed && !stillEligible) {
      return { from: primary, to: selectedProviderId };
    }

    return undefined;
  }

  private computeConfidence(
    ranked: readonly AISelectionCandidate[],
    selected: AISelectionCandidate,
  ): number {
    const runnerUp = ranked[1];
    if (!runnerUp || selected.score <= 0) {
      return 1;
    }
    const margin = (selected.score - runnerUp.score) / Math.max(selected.score, 1);
    return Math.min(1, Math.max(0.5, 0.5 + margin / 2));
  }

  private appliedPolicies(): readonly string[] {
    return APPLIED_POLICY_FIELDS.filter((field) => this.policy[field] !== undefined);
  }

  private appliedConstraints(context: AIRoutingContext): readonly string[] {
    return APPLIED_CONSTRAINT_FIELDS.filter((field) => {
      const value = context[field];
      return value !== undefined && value !== false;
    });
  }

  private recordSelection(
    providerId: string,
    modelId: string,
    appliedRules: readonly AIRoutingRule[],
    fallbackTriggered: boolean,
  ): void {
    this.state.decisionCount += 1;
    this.state.providerUsage = {
      ...this.state.providerUsage,
      [providerId]: (this.state.providerUsage[providerId] ?? 0) + 1,
    };
    this.state.modelUsage = {
      ...this.state.modelUsage,
      [modelId]: (this.state.modelUsage[modelId] ?? 0) + 1,
    };
    for (const rule of appliedRules) {
      this.state.policyUsage = {
        ...this.state.policyUsage,
        [rule.id]: (this.state.policyUsage[rule.id] ?? 0) + 1,
      };
    }
    if (fallbackTriggered) {
      this.state.fallbackCount += 1;
    }
  }

  private async publishEvent(event: Parameters<IEventBus['publish']>[0]): Promise<void> {
    if (this.eventBus) {
      await this.eventBus.publish(event);
    }
  }
}
