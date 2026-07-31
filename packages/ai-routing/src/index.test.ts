import { describe, expect, it } from 'vitest';

import type { IEvent, IEventBus, IEventHandler } from '@infrashield/core-infrastructure';
import type { SerializableValueObject } from '@infrashield/contracts';

import {
  AIModelCapability,
  AIModelConstraints,
  AIModelDescriptor,
  AIModelRegistry,
  AIProvider,
  AIProviderCapabilities,
  AIProviderDescriptor,
  AIProviderHealth,
  AIProviderRegistry,
  type IAIModel,
} from './ai-core-compat';

import {
  AIModelSelectionException,
  AIProviderSelectionException,
  AIRejectedCandidate,
  AIRoutingContext,
  AIRoutingException,
  AIRoutingPolicy,
  AIRoutingPolicyException,
  AIRoutingRule,
  AIRoutingStrategy,
  AIRouter,
  type AISelectionCandidate,
  AISelectionException,
  AISelectionReason,
  FallbackTriggeredEvent,
  ModelSelectedEvent,
  ProviderSelectedEvent,
  RoutingDecisionCreatedEvent,
  RoutingPolicyAppliedEvent,
} from './index.js';

class TestProvider extends AIProvider {
  private readonly status: 'healthy' | 'degraded' | 'unhealthy';
  private readonly latencyMs: number;
  private readonly availability: number;
  private readonly cost: number;

  public constructor(
    id: string,
    capabilities: readonly AIProviderCapabilities[],
    options: {
      readonly metadata?: SerializableValueObject;
      readonly status?: 'healthy' | 'degraded' | 'unhealthy';
      readonly latencyMs?: number;
      readonly availability?: number;
      readonly cost?: number;
    } = {},
  ) {
    super(
      new AIProviderDescriptor({
        id,
        name: id,
        version: '1.0.0',
        capabilities,
        metadata: options.metadata,
      }),
    );
    this.status = options.status ?? 'healthy';
    this.latencyMs = options.latencyMs ?? 80;
    this.availability = options.availability ?? 1;
    this.cost = options.cost ?? 0.1;
  }

  public override async execute(): Promise<never> {
    throw new Error('not used');
  }

  public override async stream(): Promise<never> {
    throw new Error('not used');
  }

  public override async healthCheck(): Promise<AIProviderHealth> {
    return new AIProviderHealth({
      providerId: this.descriptor.id,
      status: this.status,
      availability: this.availability,
      latencyMs: this.latencyMs,
      successRate: 1,
      failureRate: 0,
    });
  }

  public override async discoverModels(): Promise<readonly IAIModel[]> {
    return [];
  }

  public override async estimateTokens(): Promise<number> {
    return 1024;
  }

  public override async estimateCost(): Promise<number> {
    return this.cost;
  }
}

class RecordingEventBus implements IEventBus {
  public readonly published: IEvent[] = [];

  public async publish<TEvent extends IEvent>(event: TEvent): Promise<void> {
    this.published.push(event);
  }

  public subscribe<TEvent extends IEvent>(_handler: IEventHandler<TEvent>): void {
    // not exercised by these tests
  }
}

describe('ai routing engine', () => {
  it('selects a provider and model for capability-first routing', async () => {
    const providerRegistry = new AIProviderRegistry();
    const modelRegistry = new AIModelRegistry();

    await providerRegistry.register(
      new TestProvider('provider-a', [
        new AIProviderCapabilities({ kind: 'chat', supported: true }),
      ]),
    );
    await providerRegistry.register(
      new TestProvider('provider-b', [
        new AIProviderCapabilities({ kind: 'reasoning', supported: true }),
      ]),
    );

    modelRegistry.register(
      new AIModelDescriptor({
        id: 'model-a',
        providerId: 'provider-a',
        family: 'general',
        name: 'Model A',
        version: '1.0.0',
        status: 'stable',
        capabilities: [new AIModelCapability({ kind: 'chat', supported: true })],
        constraints: new AIModelConstraints({ maxContextTokens: 4096 }),
      }),
    );

    modelRegistry.register(
      new AIModelDescriptor({
        id: 'model-b',
        providerId: 'provider-b',
        family: 'reasoning',
        name: 'Model B',
        version: '1.0.0',
        status: 'stable',
        capabilities: [new AIModelCapability({ kind: 'reasoning', supported: true })],
        constraints: new AIModelConstraints({ maxContextTokens: 8192 }),
      }),
    );

    const router = new AIRouter({
      providerRegistry,
      modelRegistry,
      policy: new AIRoutingPolicy({
        strategy: AIRoutingStrategy.capabilityFirst(),
      }),
    });

    const result = await router.route(
      new AIRoutingContext({
        requestId: 'req-1',
        requiredCapability: 'chat',
      }),
    );

    expect(result.decision.providerId).toBe('provider-a');
    expect(result.decision.modelId).toBe('model-a');
    expect(result.decision.reasons[0]).toBeInstanceOf(AISelectionReason);
    expect(result.decision.appliedConstraints).toContain('requiredCapability');
  });

  it('rejects providers and models missing a required feature flag', async () => {
    const providerRegistry = new AIProviderRegistry();
    const modelRegistry = new AIModelRegistry();

    await providerRegistry.register(
      new TestProvider('provider-plain', [
        new AIProviderCapabilities({ kind: 'chat', supported: true }),
      ]),
    );
    await providerRegistry.register(
      new TestProvider('provider-vision', [
        new AIProviderCapabilities({ kind: 'chat', supported: true, supportsVision: true }),
      ]),
    );

    modelRegistry.register(
      new AIModelDescriptor({
        id: 'model-plain',
        providerId: 'provider-plain',
        family: 'general',
        name: 'Plain',
        version: '1.0.0',
        status: 'stable',
        capabilities: [new AIModelCapability({ kind: 'chat', supported: true })],
      }),
    );
    modelRegistry.register(
      new AIModelDescriptor({
        id: 'model-vision',
        providerId: 'provider-vision',
        family: 'general',
        name: 'Vision',
        version: '1.0.0',
        status: 'stable',
        capabilities: [
          new AIModelCapability({ kind: 'chat', supported: true, supportsVision: true }),
        ],
      }),
    );

    const router = new AIRouter({ providerRegistry, modelRegistry });
    const result = await router.route(
      new AIRoutingContext({ requestId: 'req-vision', requiredCapability: 'chat', vision: true }),
    );

    expect(result.decision.providerId).toBe('provider-vision');
    expect(result.decision.modelId).toBe('model-vision');
    expect(result.decision.appliedConstraints).toContain('vision');
  });

  it('routes by lowest latency', async () => {
    const providerRegistry = new AIProviderRegistry();
    const modelRegistry = new AIModelRegistry();

    await providerRegistry.register(
      new TestProvider(
        'fast-provider',
        [new AIProviderCapabilities({ kind: 'chat', supported: true })],
        {
          latencyMs: 20,
        },
      ),
    );
    await providerRegistry.register(
      new TestProvider(
        'slow-provider',
        [new AIProviderCapabilities({ kind: 'chat', supported: true })],
        {
          latencyMs: 400,
        },
      ),
    );

    modelRegistry.register(
      new AIModelDescriptor({
        id: 'fast-model',
        providerId: 'fast-provider',
        family: 'general',
        name: 'Fast Model',
        version: '1.0.0',
        status: 'stable',
        capabilities: [new AIModelCapability({ kind: 'chat', supported: true })],
        constraints: new AIModelConstraints({ maxContextTokens: 4096 }),
      }),
    );
    modelRegistry.register(
      new AIModelDescriptor({
        id: 'slow-model',
        providerId: 'slow-provider',
        family: 'general',
        name: 'Slow Model',
        version: '1.0.0',
        status: 'stable',
        capabilities: [new AIModelCapability({ kind: 'chat', supported: true })],
        constraints: new AIModelConstraints({ maxContextTokens: 4096 }),
      }),
    );

    const router = new AIRouter({
      providerRegistry,
      modelRegistry,
      policy: new AIRoutingPolicy({
        strategy: AIRoutingStrategy.lowestLatency(),
      }),
    });

    const result = await router.route(
      new AIRoutingContext({ requestId: 'req-2', requiredCapability: 'chat' }),
    );

    expect(result.decision.providerId).toBe('fast-provider');
    expect(result.decision.estimatedLatencyMs).toBeLessThanOrEqual(100);
  });

  it('routes by lowest estimated cost', async () => {
    const providerRegistry = new AIProviderRegistry();
    const modelRegistry = new AIModelRegistry();

    await providerRegistry.register(
      new TestProvider(
        'cheap-provider',
        [new AIProviderCapabilities({ kind: 'chat', supported: true })],
        {
          cost: 0.01,
        },
      ),
    );
    await providerRegistry.register(
      new TestProvider(
        'expensive-provider',
        [new AIProviderCapabilities({ kind: 'chat', supported: true })],
        {
          cost: 0.9,
        },
      ),
    );

    modelRegistry.register(
      new AIModelDescriptor({
        id: 'cheap-model',
        providerId: 'cheap-provider',
        family: 'general',
        name: 'Cheap Model',
        version: '1.0.0',
        status: 'stable',
        capabilities: [new AIModelCapability({ kind: 'chat', supported: true })],
        constraints: new AIModelConstraints({ maxContextTokens: 4096 }),
      }),
    );
    modelRegistry.register(
      new AIModelDescriptor({
        id: 'cost-model',
        providerId: 'expensive-provider',
        family: 'general',
        name: 'Cost Model',
        version: '1.0.0',
        status: 'stable',
        capabilities: [new AIModelCapability({ kind: 'chat', supported: true })],
        constraints: new AIModelConstraints({ maxContextTokens: 4096 }),
      }),
    );

    const router = new AIRouter({
      providerRegistry,
      modelRegistry,
      policy: new AIRoutingPolicy({ strategy: AIRoutingStrategy.lowestCost() }),
    });

    const result = await router.route(
      new AIRoutingContext({ requestId: 'req-cost', requiredCapability: 'chat' }),
    );

    expect(result.decision.providerId).toBe('cheap-provider');
  });

  it('routes by highest availability', async () => {
    const providerRegistry = new AIProviderRegistry();
    const modelRegistry = new AIModelRegistry();

    await providerRegistry.register(
      new TestProvider(
        'reliable-provider',
        [new AIProviderCapabilities({ kind: 'chat', supported: true })],
        {
          availability: 0.999,
          status: 'healthy',
        },
      ),
    );
    await providerRegistry.register(
      new TestProvider(
        'flaky-provider',
        [new AIProviderCapabilities({ kind: 'chat', supported: true })],
        {
          availability: 0.8,
          status: 'degraded',
        },
      ),
    );

    modelRegistry.register(
      new AIModelDescriptor({
        id: 'reliable-model',
        providerId: 'reliable-provider',
        family: 'general',
        name: 'Reliable',
        version: '1.0.0',
        status: 'stable',
        capabilities: [new AIModelCapability({ kind: 'chat', supported: true })],
      }),
    );
    modelRegistry.register(
      new AIModelDescriptor({
        id: 'flaky-model',
        providerId: 'flaky-provider',
        family: 'general',
        name: 'Flaky',
        version: '1.0.0',
        status: 'stable',
        capabilities: [new AIModelCapability({ kind: 'chat', supported: true })],
      }),
    );

    const router = new AIRouter({
      providerRegistry,
      modelRegistry,
      policy: new AIRoutingPolicy({ strategy: AIRoutingStrategy.highestAvailability() }),
    });

    const result = await router.route(
      new AIRoutingContext({ requestId: 'req-avail', requiredCapability: 'chat' }),
    );

    expect(result.decision.providerId).toBe('reliable-provider');
  });

  it('rejects candidates that exceed the request maximum latency and cost', async () => {
    const providerRegistry = new AIProviderRegistry();
    const modelRegistry = new AIModelRegistry();

    await providerRegistry.register(
      new TestProvider(
        'within-budget',
        [new AIProviderCapabilities({ kind: 'chat', supported: true })],
        {
          latencyMs: 50,
          cost: 0.05,
        },
      ),
    );
    await providerRegistry.register(
      new TestProvider(
        'over-budget',
        [new AIProviderCapabilities({ kind: 'chat', supported: true })],
        {
          latencyMs: 900,
          cost: 5,
        },
      ),
    );

    modelRegistry.register(
      new AIModelDescriptor({
        id: 'within-budget-model',
        providerId: 'within-budget',
        family: 'general',
        name: 'Within budget',
        version: '1.0.0',
        status: 'stable',
        capabilities: [new AIModelCapability({ kind: 'chat', supported: true })],
      }),
    );
    modelRegistry.register(
      new AIModelDescriptor({
        id: 'over-budget-model',
        providerId: 'over-budget',
        family: 'general',
        name: 'Over budget',
        version: '1.0.0',
        status: 'stable',
        capabilities: [new AIModelCapability({ kind: 'chat', supported: true })],
      }),
    );

    const router = new AIRouter({ providerRegistry, modelRegistry });
    const result = await router.route(
      new AIRoutingContext({
        requestId: 'req-budget',
        requiredCapability: 'chat',
        maxLatencyMs: 100,
        maxCost: 1,
      }),
    );

    expect(result.decision.providerId).toBe('within-budget');
    const rejectedCodes = result.decision.rejectedCandidates.map(
      (rejection) => rejection.reason.code,
    );
    expect(rejectedCodes).toContain('latency-exceeded');
  });

  it('rejects models that do not meet the minimum context window', async () => {
    const providerRegistry = new AIProviderRegistry();
    const modelRegistry = new AIModelRegistry();

    await providerRegistry.register(
      new TestProvider('provider-a', [
        new AIProviderCapabilities({ kind: 'chat', supported: true }),
      ]),
    );

    modelRegistry.register(
      new AIModelDescriptor({
        id: 'small-context',
        providerId: 'provider-a',
        family: 'general',
        name: 'Small context',
        version: '1.0.0',
        status: 'stable',
        capabilities: [new AIModelCapability({ kind: 'chat', supported: true })],
        constraints: new AIModelConstraints({ maxContextTokens: 1024 }),
      }),
    );
    modelRegistry.register(
      new AIModelDescriptor({
        id: 'large-context',
        providerId: 'provider-a',
        family: 'general',
        name: 'Large context',
        version: '1.0.0',
        status: 'stable',
        capabilities: [new AIModelCapability({ kind: 'chat', supported: true })],
        constraints: new AIModelConstraints({ maxContextTokens: 32000 }),
      }),
    );

    const router = new AIRouter({ providerRegistry, modelRegistry });
    const result = await router.route(
      new AIRoutingContext({
        requestId: 'req-context',
        requiredCapability: 'chat',
        minContextTokens: 8000,
      }),
    );

    expect(result.decision.modelId).toBe('large-context');
  });

  it('applies policy rules, honors allowed regions, and records snapshots', async () => {
    const providerRegistry = new AIProviderRegistry();
    const modelRegistry = new AIModelRegistry();

    await providerRegistry.register(
      new TestProvider(
        'allowed-provider',
        [new AIProviderCapabilities({ kind: 'chat', supported: true })],
        {
          metadata: { region: 'us' },
        },
      ),
    );
    await providerRegistry.register(
      new TestProvider(
        'blocked-provider',
        [new AIProviderCapabilities({ kind: 'chat', supported: true })],
        {
          metadata: { region: 'eu' },
        },
      ),
    );

    modelRegistry.register(
      new AIModelDescriptor({
        id: 'policy-model',
        providerId: 'allowed-provider',
        family: 'general',
        name: 'Policy Model',
        version: '1.0.0',
        status: 'stable',
        capabilities: [new AIModelCapability({ kind: 'chat', supported: true })],
        constraints: new AIModelConstraints({ maxContextTokens: 2048 }),
      }),
    );

    const policy = new AIRoutingPolicy({
      strategy: AIRoutingStrategy.balanced(),
      allowedRegions: ['us'],
      fallbackOrder: ['allowed-provider'],
      rules: [
        new AIRoutingRule({
          id: 'region-rule',
          description: 'Prefer us region',
          priority: 1,
          predicate: (context) => context.region === 'us',
          preferredProvider: 'allowed-provider',
        }),
      ],
    });

    const router = new AIRouter({ providerRegistry, modelRegistry, policy });
    const result = await router.route(
      new AIRoutingContext({ requestId: 'req-3', requiredCapability: 'chat', region: 'us' }),
    );

    const snapshot = router.snapshot();

    expect(result.decision.providerId).toBe('allowed-provider');
    expect(result.decision.appliedPolicies).toContain('allowedRegions');
    expect(snapshot.decisionCount).toBe(1);
    expect(snapshot.providerUsage['allowed-provider']).toBe(1);
    expect(snapshot.policyUsage['region-rule']).toBe(1);
    expect(snapshot.fallbackCount).toBe(0);
  });

  it('enforces denied and allowed provider lists', async () => {
    const providerRegistry = new AIProviderRegistry();
    const modelRegistry = new AIModelRegistry();

    await providerRegistry.register(
      new TestProvider('provider-a', [
        new AIProviderCapabilities({ kind: 'chat', supported: true }),
      ]),
    );
    await providerRegistry.register(
      new TestProvider('provider-b', [
        new AIProviderCapabilities({ kind: 'chat', supported: true }),
      ]),
    );

    modelRegistry.register(
      new AIModelDescriptor({
        id: 'model-a',
        providerId: 'provider-a',
        family: 'general',
        name: 'A',
        version: '1.0.0',
        status: 'stable',
        capabilities: [new AIModelCapability({ kind: 'chat', supported: true })],
      }),
    );
    modelRegistry.register(
      new AIModelDescriptor({
        id: 'model-b',
        providerId: 'provider-b',
        family: 'general',
        name: 'B',
        version: '1.0.0',
        status: 'stable',
        capabilities: [new AIModelCapability({ kind: 'chat', supported: true })],
      }),
    );

    const router = new AIRouter({
      providerRegistry,
      modelRegistry,
      policy: new AIRoutingPolicy({
        strategy: AIRoutingStrategy.capabilityFirst(),
        deniedProviders: ['provider-a'],
      }),
    });

    const result = await router.route(
      new AIRoutingContext({ requestId: 'req-deny', requiredCapability: 'chat' }),
    );

    expect(result.decision.providerId).toBe('provider-b');
  });

  it('enforces confidential workload and data residency requirements', async () => {
    const providerRegistry = new AIProviderRegistry();
    const modelRegistry = new AIModelRegistry();

    await providerRegistry.register(
      new TestProvider(
        'certified-provider',
        [new AIProviderCapabilities({ kind: 'chat', supported: true })],
        {
          metadata: { region: 'us', confidential: true },
        },
      ),
    );
    await providerRegistry.register(
      new TestProvider(
        'uncertified-provider',
        [new AIProviderCapabilities({ kind: 'chat', supported: true })],
        {
          metadata: { region: 'us' },
        },
      ),
    );

    modelRegistry.register(
      new AIModelDescriptor({
        id: 'certified-model',
        providerId: 'certified-provider',
        family: 'general',
        name: 'Certified',
        version: '1.0.0',
        status: 'stable',
        capabilities: [new AIModelCapability({ kind: 'chat', supported: true })],
      }),
    );
    modelRegistry.register(
      new AIModelDescriptor({
        id: 'uncertified-model',
        providerId: 'uncertified-provider',
        family: 'general',
        name: 'Uncertified',
        version: '1.0.0',
        status: 'stable',
        capabilities: [new AIModelCapability({ kind: 'chat', supported: true })],
      }),
    );

    const router = new AIRouter({
      providerRegistry,
      modelRegistry,
      policy: new AIRoutingPolicy({
        strategy: AIRoutingStrategy.capabilityFirst(),
        confidentialWorkloads: true,
        dataResidency: ['us'],
      }),
    });

    const result = await router.route(
      new AIRoutingContext({
        requestId: 'req-confidential',
        requiredCapability: 'chat',
        classification: 'confidential',
      }),
    );

    expect(result.decision.providerId).toBe('certified-provider');
  });

  it('throws AIRoutingPolicyException when allow/deny lists conflict', () => {
    expect(
      () =>
        new AIRoutingPolicy({
          strategy: AIRoutingStrategy.capabilityFirst(),
          allowedProviders: ['provider-a'],
          deniedProviders: ['provider-a'],
        }),
    ).toThrow(AIRoutingPolicyException);
  });

  it('produces a fallback plan ordered by policy.fallbackOrder', async () => {
    const providerRegistry = new AIProviderRegistry();
    const modelRegistry = new AIModelRegistry();

    await providerRegistry.register(
      new TestProvider('provider-a', [
        new AIProviderCapabilities({ kind: 'chat', supported: true }),
      ]),
    );
    await providerRegistry.register(
      new TestProvider('provider-b', [
        new AIProviderCapabilities({ kind: 'chat', supported: true }),
      ]),
    );
    await providerRegistry.register(
      new TestProvider('provider-c', [
        new AIProviderCapabilities({ kind: 'chat', supported: true }),
      ]),
    );

    for (const providerId of ['provider-a', 'provider-b', 'provider-c']) {
      modelRegistry.register(
        new AIModelDescriptor({
          id: `${providerId}-model`,
          providerId,
          family: 'general',
          name: providerId,
          version: '1.0.0',
          status: 'stable',
          capabilities: [new AIModelCapability({ kind: 'chat', supported: true })],
        }),
      );
    }

    const router = new AIRouter({
      providerRegistry,
      modelRegistry,
      policy: new AIRoutingPolicy({
        strategy: AIRoutingStrategy.preferredProvider('provider-a'),
        fallbackOrder: ['provider-c', 'provider-b'],
      }),
    });

    const result = await router.route(
      new AIRoutingContext({ requestId: 'req-fallback', requiredCapability: 'chat' }),
    );

    expect(result.decision.providerId).toBe('provider-a');
    expect(result.fallbackPlan).toEqual(['provider-c', 'provider-b']);
  });

  it('emits FallbackTriggered when the primary fallback provider becomes unavailable', async () => {
    const providerRegistry = new AIProviderRegistry();
    const modelRegistry = new AIModelRegistry();

    await providerRegistry.register(
      new TestProvider(
        'primary-provider',
        [new AIProviderCapabilities({ kind: 'chat', supported: true })],
        {
          status: 'unhealthy',
        },
      ),
    );
    await providerRegistry.register(
      new TestProvider('secondary-provider', [
        new AIProviderCapabilities({ kind: 'chat', supported: true }),
      ]),
    );

    modelRegistry.register(
      new AIModelDescriptor({
        id: 'primary-model',
        providerId: 'primary-provider',
        family: 'general',
        name: 'Primary',
        version: '1.0.0',
        status: 'stable',
        capabilities: [new AIModelCapability({ kind: 'chat', supported: true })],
      }),
    );
    modelRegistry.register(
      new AIModelDescriptor({
        id: 'secondary-model',
        providerId: 'secondary-provider',
        family: 'general',
        name: 'Secondary',
        version: '1.0.0',
        status: 'stable',
        capabilities: [new AIModelCapability({ kind: 'chat', supported: true })],
      }),
    );

    const eventBus = new RecordingEventBus();
    const router = new AIRouter({
      providerRegistry,
      modelRegistry,
      policy: new AIRoutingPolicy({
        strategy: AIRoutingStrategy.capabilityFirst(),
        fallbackOrder: ['primary-provider', 'secondary-provider'],
      }),
      eventBus,
    });

    const result = await router.route(
      new AIRoutingContext({ requestId: 'req-failover', requiredCapability: 'chat' }),
    );
    const snapshot = router.snapshot();

    expect(result.decision.providerId).toBe('secondary-provider');
    expect(snapshot.fallbackCount).toBe(1);

    const fallbackEvent = eventBus.published.find(
      (event): event is FallbackTriggeredEvent => event instanceof FallbackTriggeredEvent,
    );
    expect(fallbackEvent).toBeDefined();
    expect(fallbackEvent?.payload.fromProviderId).toBe('primary-provider');
    expect(fallbackEvent?.payload.toProviderId).toBe('secondary-provider');
  });

  it('supports custom strategy scoring and immutable snapshots', async () => {
    const providerRegistry = new AIProviderRegistry();
    const modelRegistry = new AIModelRegistry();

    await providerRegistry.register(
      new TestProvider('provider-c', [
        new AIProviderCapabilities({ kind: 'chat', supported: true }),
      ]),
    );

    modelRegistry.register(
      new AIModelDescriptor({
        id: 'custom-model',
        providerId: 'provider-c',
        family: 'general',
        name: 'Custom',
        version: '1.0.0',
        status: 'stable',
        capabilities: [new AIModelCapability({ kind: 'chat', supported: true })],
        constraints: new AIModelConstraints({ maxContextTokens: 4096 }),
      }),
    );

    const strategy = AIRoutingStrategy.custom(
      'prefer-provider-c',
      'Prefer provider-c',
      (candidate: AISelectionCandidate) => (candidate.providerId === 'provider-c' ? 999 : 0),
    );

    const router = new AIRouter({
      providerRegistry,
      modelRegistry,
      policy: new AIRoutingPolicy({ strategy }),
    });
    const result = await router.route(
      new AIRoutingContext({ requestId: 'req-5', requiredCapability: 'chat' }),
    );
    const snapshot = router.snapshot();

    expect(result.decision.providerId).toBe('provider-c');
    expect(snapshot).toBeDefined();
    expect(() => {
      (snapshot as { decisionCount: number }).decisionCount = 2;
    }).toThrow(TypeError);
  });

  it('uses policy overrides for preferred provider and model family', async () => {
    const providerRegistry = new AIProviderRegistry();
    const modelRegistry = new AIModelRegistry();

    await providerRegistry.register(
      new TestProvider('provider-d', [
        new AIProviderCapabilities({ kind: 'chat', supported: true }),
      ]),
    );
    await providerRegistry.register(
      new TestProvider('provider-e', [
        new AIProviderCapabilities({ kind: 'chat', supported: true }),
      ]),
    );

    modelRegistry.register(
      new AIModelDescriptor({
        id: 'family-a',
        providerId: 'provider-d',
        family: 'family-a',
        name: 'Family A',
        version: '1.0.0',
        status: 'stable',
        capabilities: [new AIModelCapability({ kind: 'chat', supported: true })],
        constraints: new AIModelConstraints({ maxContextTokens: 2048 }),
      }),
    );
    modelRegistry.register(
      new AIModelDescriptor({
        id: 'family-b',
        providerId: 'provider-e',
        family: 'family-b',
        name: 'Family B',
        version: '1.0.0',
        status: 'stable',
        capabilities: [new AIModelCapability({ kind: 'chat', supported: true })],
        constraints: new AIModelConstraints({ maxContextTokens: 2048 }),
      }),
    );

    const router = new AIRouter({
      providerRegistry,
      modelRegistry,
      policy: new AIRoutingPolicy({
        strategy: AIRoutingStrategy.capabilityFirst(),
        preferredProviders: ['provider-d'],
        preferredModelFamily: 'family-a',
      }),
    });

    const result = await router.route(
      new AIRoutingContext({ requestId: 'req-6', requiredCapability: 'chat' }),
    );

    expect(result.decision.providerId).toBe('provider-d');
    expect(result.decision.modelId).toBe('family-a');
  });

  it('produces the same decision across concurrent route() calls (deterministic, thread-safe selection)', async () => {
    const providerRegistry = new AIProviderRegistry();
    const modelRegistry = new AIModelRegistry();

    await providerRegistry.register(
      new TestProvider(
        'provider-a',
        [new AIProviderCapabilities({ kind: 'chat', supported: true })],
        {
          latencyMs: 30,
        },
      ),
    );
    await providerRegistry.register(
      new TestProvider(
        'provider-b',
        [new AIProviderCapabilities({ kind: 'chat', supported: true })],
        {
          latencyMs: 90,
        },
      ),
    );

    modelRegistry.register(
      new AIModelDescriptor({
        id: 'model-a',
        providerId: 'provider-a',
        family: 'general',
        name: 'A',
        version: '1.0.0',
        status: 'stable',
        capabilities: [new AIModelCapability({ kind: 'chat', supported: true })],
      }),
    );
    modelRegistry.register(
      new AIModelDescriptor({
        id: 'model-b',
        providerId: 'provider-b',
        family: 'general',
        name: 'B',
        version: '1.0.0',
        status: 'stable',
        capabilities: [new AIModelCapability({ kind: 'chat', supported: true })],
      }),
    );

    const router = new AIRouter({
      providerRegistry,
      modelRegistry,
      policy: new AIRoutingPolicy({ strategy: AIRoutingStrategy.lowestLatency() }),
    });

    const results = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        router.route(
          new AIRoutingContext({
            requestId: `req-concurrent-${index}`,
            requiredCapability: 'chat',
          }),
        ),
      ),
    );

    expect(results.every((result) => result.decision.providerId === 'provider-a')).toBe(true);
    expect(router.snapshot().decisionCount).toBe(20);
    expect(router.snapshot().providerUsage['provider-a']).toBe(20);
  });

  it('publishes provider, model and decision events in order', async () => {
    const providerRegistry = new AIProviderRegistry();
    const modelRegistry = new AIModelRegistry();

    await providerRegistry.register(
      new TestProvider('provider-a', [
        new AIProviderCapabilities({ kind: 'chat', supported: true }),
      ]),
    );
    modelRegistry.register(
      new AIModelDescriptor({
        id: 'model-a',
        providerId: 'provider-a',
        family: 'general',
        name: 'A',
        version: '1.0.0',
        status: 'stable',
        capabilities: [new AIModelCapability({ kind: 'chat', supported: true })],
      }),
    );

    const eventBus = new RecordingEventBus();
    const router = new AIRouter({
      providerRegistry,
      modelRegistry,
      policy: new AIRoutingPolicy({
        strategy: AIRoutingStrategy.capabilityFirst(),
        rules: [
          new AIRoutingRule({
            id: 'always-rule',
            description: 'Always matches',
            predicate: () => true,
          }),
        ],
      }),
      eventBus,
    });

    await router.route(
      new AIRoutingContext({ requestId: 'req-events', requiredCapability: 'chat' }),
    );

    const eventTypes = eventBus.published.map((event) => event.eventType);
    expect(eventTypes).toEqual([
      'ProviderSelected',
      'ModelSelected',
      'RoutingPolicyApplied',
      'RoutingDecisionCreated',
    ]);
    expect(eventBus.published[0]).toBeInstanceOf(ProviderSelectedEvent);
    expect(eventBus.published[1]).toBeInstanceOf(ModelSelectedEvent);
    expect(eventBus.published[2]).toBeInstanceOf(RoutingPolicyAppliedEvent);
    expect(eventBus.published[3]).toBeInstanceOf(RoutingDecisionCreatedEvent);
  });

  it('throws AIProviderSelectionException when no provider satisfies the request', async () => {
    const providerRegistry = new AIProviderRegistry();
    const modelRegistry = new AIModelRegistry();

    await providerRegistry.register(
      new TestProvider('provider-a', [
        new AIProviderCapabilities({ kind: 'chat', supported: true }),
      ]),
    );

    const router = new AIRouter({ providerRegistry, modelRegistry });

    await expect(
      router.route(new AIRoutingContext({ requestId: 'req-4', requiredCapability: 'reasoning' })),
    ).rejects.toBeInstanceOf(AIProviderSelectionException);
  });

  it('throws AIModelSelectionException when providers exist but no model satisfies the request', async () => {
    const providerRegistry = new AIProviderRegistry();
    const modelRegistry = new AIModelRegistry();

    await providerRegistry.register(
      new TestProvider('provider-a', [
        new AIProviderCapabilities({ kind: 'chat', supported: true }),
      ]),
    );
    modelRegistry.register(
      new AIModelDescriptor({
        id: 'model-a',
        providerId: 'provider-a',
        family: 'general',
        name: 'A',
        version: '1.0.0',
        status: 'stable',
        capabilities: [new AIModelCapability({ kind: 'embedding', supported: true })],
      }),
    );

    const router = new AIRouter({ providerRegistry, modelRegistry });

    await expect(
      router.route(
        new AIRoutingContext({ requestId: 'req-model-missing', requiredCapability: 'chat' }),
      ),
    ).rejects.toBeInstanceOf(AIModelSelectionException);
  });

  it('surfaces selection failures without masking the cause when no providers are registered', async () => {
    const providerRegistry = new AIProviderRegistry();
    const modelRegistry = new AIModelRegistry();

    const router = new AIRouter({ providerRegistry, modelRegistry });

    await expect(
      router.route(new AIRoutingContext({ requestId: 'req-7', requiredCapability: 'chat' })),
    ).rejects.toBeInstanceOf(AIRoutingException);
  });

  it('rejects all pairings via AISelectionException when maxCost is violated for every candidate', async () => {
    const providerRegistry = new AIProviderRegistry();
    const modelRegistry = new AIModelRegistry();

    await providerRegistry.register(
      new TestProvider(
        'provider-a',
        [new AIProviderCapabilities({ kind: 'chat', supported: true })],
        { cost: 5 },
      ),
    );
    modelRegistry.register(
      new AIModelDescriptor({
        id: 'model-a',
        providerId: 'provider-a',
        family: 'general',
        name: 'A',
        version: '1.0.0',
        status: 'stable',
        capabilities: [new AIModelCapability({ kind: 'chat', supported: true })],
      }),
    );

    const router = new AIRouter({ providerRegistry, modelRegistry });

    await expect(
      router.route(
        new AIRoutingContext({ requestId: 'req-maxcost', requiredCapability: 'chat', maxCost: 1 }),
      ),
    ).rejects.toBeInstanceOf(AISelectionException);
  });

  it('exposes rejected candidates as AIRejectedCandidate instances via the exception cause', async () => {
    const providerRegistry = new AIProviderRegistry();
    const modelRegistry = new AIModelRegistry();

    await providerRegistry.register(
      new TestProvider('provider-a', [
        new AIProviderCapabilities({ kind: 'chat', supported: true }),
      ]),
    );

    const router = new AIRouter({ providerRegistry, modelRegistry });

    try {
      await router.route(
        new AIRoutingContext({ requestId: 'req-cause', requiredCapability: 'reasoning' }),
      );
      expect.fail('expected route() to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AIRoutingException);
      const cause = (error as AIProviderSelectionException).cause as readonly AIRejectedCandidate[];
      expect(cause[0]).toBeInstanceOf(AIRejectedCandidate);
    }
  });
});
