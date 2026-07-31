import { describe, expect, it } from 'vitest';

import {
  AIGateway,
  AIExecutionException,
  AIExecutionOptions,
  AIExecutionRequest,
  AIExecutionResponse,
  AIModel,
  AIModelCapabilities,
  AIModelRegistry,
  AIProvider,
  AIProviderCapabilities,
  AIProviderDescriptor,
  AIProviderRegistry,
  AIProviderStatistics,
} from './index.js';

class TestProvider extends AIProvider {
  public constructor() {
    super(
      new AIProviderDescriptor({
        id: 'test-provider',
        name: 'Test Provider',
        version: '1.0.0',
        capabilities: [
          new AIProviderCapabilities({ kind: 'chat', supported: true, maxContextLength: 8192 }),
        ],
      }),
    );
  }

  public override async execute(request: AIExecutionRequest): Promise<AIExecutionResponse> {
    return new AIExecutionResponse({
      id: request.id,
      providerId: this.descriptor.id,
      modelId: request.modelId,
      status: 'success',
      output: { text: `handled:${request.input}` },
      metadata: { provider: this.descriptor.name },
    });
  }

  public override async stream(request: AIExecutionRequest): Promise<AIExecutionResponse> {
    return this.execute(request);
  }

  public override discoverModels(): Promise<readonly AIModel[]> {
    return Promise.resolve([
      new AIModel({
        id: 'test-model',
        providerId: this.descriptor.id,
        name: 'Test Model',
        version: '1.0.0',
        capabilities: [
          new AIModelCapabilities({
            contextLength: 4096,
            supportsStreaming: true,
            supportsVision: false,
            supportsFunctionCalling: true,
            supportsStructuredOutput: true,
            supportsReasoning: false,
            supportsEmbeddings: false,
            supportsImageGeneration: false,
            supportsAudio: false,
          }),
        ],
      }),
    ]);
  }
}

describe('ai gateway foundation', () => {
  it('registers providers and models and exposes capabilities', async () => {
    const provider = new TestProvider();
    const providerRegistry = new AIProviderRegistry();
    const modelRegistry = new AIModelRegistry();
    const gateway = new AIGateway({ providerRegistry, modelRegistry });

    await gateway.registerProvider(provider);
    await gateway.initialize();

    const registeredProvider = providerRegistry.get('test-provider');
    expect(registeredProvider?.descriptor.id).toBe('test-provider');

    const models = await provider.discoverModels();
    for (const model of models) {
      modelRegistry.register(model);
    }

    const discovered = await gateway.discoverCapabilities('test-provider');
    expect(discovered.length).toBeGreaterThan(0);
    expect(modelRegistry.get('test-model')?.id).toBe('test-model');
  });

  it('executes requests through the gateway and records statistics', async () => {
    const provider = new TestProvider();
    const gateway = new AIGateway({
      providerRegistry: new AIProviderRegistry(),
      modelRegistry: new AIModelRegistry(),
    });

    await gateway.registerProvider(provider);
    await gateway.initialize();

    const request = new AIExecutionRequest({
      id: 'req-1',
      providerId: 'test-provider',
      modelId: 'test-model',
      input: 'hello',
      operation: 'chat',
      options: new AIExecutionOptions({ stream: false, timeoutMs: 1000 }),
    });

    const response = await gateway.execute(request);

    expect(response.status).toBe('success');
    expect(response.output).toEqual({ text: 'handled:hello' });
    expect(gateway.statistics().requestCount).toBe(1);
    expect(gateway.statistics().providerUsage['test-provider']).toBe(1);
  });

  it('reports health and throws clear execution errors for unknown providers', async () => {
    const gateway = new AIGateway({
      providerRegistry: new AIProviderRegistry(),
      modelRegistry: new AIModelRegistry(),
    });

    const health = await gateway.healthCheck('missing-provider');
    expect(health.status).toBe('unhealthy');

    const request = new AIExecutionRequest({
      id: 'req-2',
      providerId: 'missing-provider',
      input: 'hello',
      operation: 'chat',
    });

    await expect(gateway.execute(request)).rejects.toBeInstanceOf(AIExecutionException);
  });

  it('keeps registries and statistics immutable', async () => {
    const gateway = new AIGateway({
      providerRegistry: new AIProviderRegistry(),
      modelRegistry: new AIModelRegistry(),
    });

    const provider = new TestProvider();
    await gateway.registerProvider(provider);

    const providers = gateway.providerRegistry.list();
    expect(() => {
      (providers as unknown as Array<AIProvider>).push(provider);
    }).toThrow();

    const stats = gateway.statistics();
    expect(stats).toBeInstanceOf(AIProviderStatistics);
    expect(stats.requestCount).toBe(0);
  });
});
