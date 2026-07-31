import { AISelectionReason, AIRejectedCandidate } from './candidate';
import { hasCapabilityKind, hasFeatureFlag } from './capability-utils';
import type { AIRoutingContext } from './context';
import type { AIRoutingPolicy } from './policy';
import type { IAIModel, IAIProvider } from './ai-core-compat';

export interface AIProviderSelectionResult {
  readonly eligible: readonly IAIProvider[];
  readonly rejected: readonly AIRejectedCandidate[];
}

export interface AIModelSelectionResult {
  readonly eligible: readonly IAIModel[];
  readonly rejected: readonly AIRejectedCandidate[];
}

/** Selects the providers eligible for a routing request. */
export interface IAIProviderSelector {
  selectProviders(
    context: AIRoutingContext,
    policy: AIRoutingPolicy,
    providers: readonly IAIProvider[],
  ): Promise<AIProviderSelectionResult>;
}

/** Selects the models eligible for a routing request, scoped to already-eligible providers. */
export interface IAIModelSelector {
  selectModels(
    context: AIRoutingContext,
    policy: AIRoutingPolicy,
    eligibleProviders: readonly IAIProvider[],
    models: readonly IAIModel[],
  ): Promise<AIModelSelectionResult>;
}

const FEATURE_FLAGS: readonly {
  readonly contextFlag: keyof Pick<
    AIRoutingContext,
    'reasoning' | 'vision' | 'streaming' | 'toolCalling' | 'embeddings' | 'structuredOutput'
  >;
  readonly capabilityFlag:
    | 'supportsReasoning'
    | 'supportsVision'
    | 'supportsStreaming'
    | 'supportsFunctionCalling'
    | 'supportsEmbeddings'
    | 'supportsStructuredOutput';
}[] = [
  { contextFlag: 'reasoning', capabilityFlag: 'supportsReasoning' },
  { contextFlag: 'vision', capabilityFlag: 'supportsVision' },
  { contextFlag: 'streaming', capabilityFlag: 'supportsStreaming' },
  { contextFlag: 'toolCalling', capabilityFlag: 'supportsFunctionCalling' },
  { contextFlag: 'embeddings', capabilityFlag: 'supportsEmbeddings' },
  { contextFlag: 'structuredOutput', capabilityFlag: 'supportsStructuredOutput' },
];

/**
 * Default provider selector. Applies policy allow/deny lists, region and
 * data-residency constraints, confidential-workload requirements,
 * environment matching, capability requirements and provider health.
 */
export class AIProviderSelector implements IAIProviderSelector {
  public async selectProviders(
    context: AIRoutingContext,
    policy: AIRoutingPolicy,
    providers: readonly IAIProvider[],
  ): Promise<AIProviderSelectionResult> {
    const eligible: IAIProvider[] = [];
    const rejected: AIRejectedCandidate[] = [];

    for (const provider of providers) {
      const rejection = await this.evaluate(context, policy, provider);
      if (rejection) {
        rejected.push(rejection);
        continue;
      }
      eligible.push(provider);
    }

    return { eligible: Object.freeze(eligible), rejected: Object.freeze(rejected) };
  }

  private async evaluate(
    context: AIRoutingContext,
    policy: AIRoutingPolicy,
    provider: IAIProvider,
  ): Promise<AIRejectedCandidate | undefined> {
    const providerId = provider.descriptor.id;
    const metadata = provider.descriptor.metadata as Record<string, unknown> | undefined;

    if (policy.deniedProviders?.includes(providerId)) {
      return this.reject(
        providerId,
        'provider-denied',
        `Provider '${providerId}' is explicitly denied by policy`,
      );
    }

    if (policy.allowedProviders && !policy.allowedProviders.includes(providerId)) {
      return this.reject(
        providerId,
        'provider-not-allowed',
        `Provider '${providerId}' is not in the allowed-provider list`,
      );
    }

    const region = metadata?.region as string | undefined;

    if (policy.allowedRegions && policy.allowedRegions.length > 0) {
      if (!region || !policy.allowedRegions.includes(region)) {
        return this.reject(
          providerId,
          'region-not-allowed',
          `Provider '${providerId}' is outside the allowed regions`,
        );
      }
    }

    if (policy.dataResidency && policy.dataResidency.length > 0) {
      if (!region || !policy.dataResidency.includes(region)) {
        return this.reject(
          providerId,
          'data-residency-violation',
          `Provider '${providerId}' does not satisfy data-residency requirements`,
        );
      }
    }

    if (policy.confidentialWorkloads && context.classification === 'confidential') {
      if (metadata?.confidential !== true) {
        return this.reject(
          providerId,
          'confidentiality-required',
          `Provider '${providerId}' is not certified for confidential workloads`,
        );
      }
    }

    if (
      context.environment &&
      metadata?.environment &&
      metadata.environment !== context.environment
    ) {
      return this.reject(
        providerId,
        'environment-mismatch',
        `Provider '${providerId}' does not match the requested environment`,
      );
    }

    if (
      context.requiredCapability &&
      !hasCapabilityKind(provider.descriptor.capabilities, context.requiredCapability)
    ) {
      return this.reject(
        providerId,
        'capability-mismatch',
        `Provider '${providerId}' does not support capability '${context.requiredCapability}'`,
      );
    }

    for (const { contextFlag, capabilityFlag } of FEATURE_FLAGS) {
      if (
        context[contextFlag] &&
        !hasFeatureFlag(provider.descriptor.capabilities, capabilityFlag)
      ) {
        return this.reject(
          providerId,
          'feature-unsupported',
          `Provider '${providerId}' does not support required feature '${contextFlag}'`,
        );
      }
    }

    const health = await provider.healthCheck();
    if (health.status === 'unhealthy') {
      return this.reject(
        providerId,
        'provider-unavailable',
        `Provider '${providerId}' is currently unhealthy`,
      );
    }

    if (policy.latencySlaMs !== undefined && health.latencyMs > policy.latencySlaMs) {
      return this.reject(
        providerId,
        'health-degraded',
        `Provider '${providerId}' exceeds the latency SLA`,
      );
    }

    return undefined;
  }

  private reject(providerId: string, code: string, message: string): AIRejectedCandidate {
    return new AIRejectedCandidate({
      providerId,
      reason: new AISelectionReason({ code, message }),
    });
  }
}

/**
 * Default model selector. Delegates provider-level scoping to whichever
 * providers survived {@link IAIProviderSelector}, then filters models by
 * capability requirements, context-window constraints and lifecycle status.
 */
export class AIModelSelector implements IAIModelSelector {
  public async selectModels(
    context: AIRoutingContext,
    _policy: AIRoutingPolicy,
    eligibleProviders: readonly IAIProvider[],
    models: readonly IAIModel[],
  ): Promise<AIModelSelectionResult> {
    const eligibleProviderIds = new Set(
      eligibleProviders.map((provider) => provider.descriptor.id),
    );
    const eligible: IAIModel[] = [];
    const rejected: AIRejectedCandidate[] = [];

    for (const model of models) {
      if (!eligibleProviderIds.has(model.providerId)) {
        continue;
      }

      const rejection = this.evaluate(context, model);
      if (rejection) {
        rejected.push(rejection);
        continue;
      }
      eligible.push(model);
    }

    return { eligible: Object.freeze(eligible), rejected: Object.freeze(rejected) };
  }

  private evaluate(context: AIRoutingContext, model: IAIModel): AIRejectedCandidate | undefined {
    if (model.deprecated) {
      return this.reject(model, 'model-deprecated', `Model '${model.id}' is deprecated`);
    }

    if (model.status && model.status === 'unavailable') {
      return this.reject(model, 'model-unavailable', `Model '${model.id}' is marked unavailable`);
    }

    if (
      context.requiredCapability &&
      !hasCapabilityKind(model.capabilities, context.requiredCapability)
    ) {
      return this.reject(
        model,
        'capability-mismatch',
        `Model '${model.id}' does not support capability '${context.requiredCapability}'`,
      );
    }

    for (const { contextFlag, capabilityFlag } of FEATURE_FLAGS) {
      if (context[contextFlag] && !hasFeatureFlag(model.capabilities, capabilityFlag)) {
        return this.reject(
          model,
          'feature-unsupported',
          `Model '${model.id}' does not support required feature '${contextFlag}'`,
        );
      }
    }

    if (
      context.minContextTokens !== undefined &&
      model.constraints?.maxContextTokens !== undefined &&
      model.constraints.maxContextTokens < context.minContextTokens
    ) {
      return this.reject(
        model,
        'context-insufficient',
        `Model '${model.id}' does not meet the minimum context window`,
      );
    }

    return undefined;
  }

  private reject(model: IAIModel, code: string, message: string): AIRejectedCandidate {
    return new AIRejectedCandidate({
      providerId: model.providerId,
      modelId: model.id,
      reason: new AISelectionReason({ code, message }),
    });
  }
}
