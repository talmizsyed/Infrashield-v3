'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.GatewayShutdownEvent =
  exports.GatewayInitializedEvent =
  exports.ModelRegisteredEvent =
  exports.ProviderUnhealthyEvent =
  exports.ProviderHealthyEvent =
  exports.ProviderRemovedEvent =
  exports.ProviderRegisteredEvent =
  exports.AIGateway =
  exports.AIProvider =
  exports.AIModelRegistry =
  exports.AIProviderRegistry =
  exports.AIProviderFactory =
  exports.AIProviderStatistics =
  exports.AIProviderHealth =
  exports.AIExecutionContext =
  exports.AIExecutionResponse =
  exports.AIExecutionRequest =
  exports.AIExecutionOptions =
  exports.AIModel =
  exports.AIModelSnapshot =
  exports.AIModelDescriptor =
  exports.AIModelQuery =
  exports.AIModelFilter =
  exports.AIModelVersion =
  exports.AIModelRequirements =
  exports.AIModelConstraints =
  exports.AIModelCapabilities =
  exports.AIModelCapability =
  exports.AIProviderCapabilities =
  exports.AIProviderDescriptor =
  exports.AIRegistryException =
  exports.AIExecutionException =
  exports.AIModelException =
  exports.AIProviderException =
  exports.AIGatewayException =
    void 0;
const core_infrastructure_1 = require('@infrashield/core-infrastructure');
class AIGatewayException extends Error {
  constructor(message) {
    super(message);
    this.name = 'AIGatewayException';
  }
}
exports.AIGatewayException = AIGatewayException;
class AIProviderException extends AIGatewayException {
  constructor(message) {
    super(message);
    this.name = 'AIProviderException';
  }
}
exports.AIProviderException = AIProviderException;
class AIModelException extends AIGatewayException {
  constructor(message) {
    super(message);
    this.name = 'AIModelException';
  }
}
exports.AIModelException = AIModelException;
class AIExecutionException extends AIGatewayException {
  constructor(message) {
    super(message);
    this.name = 'AIExecutionException';
  }
}
exports.AIExecutionException = AIExecutionException;
class AIRegistryException extends AIGatewayException {
  constructor(message) {
    super(message);
    this.name = 'AIRegistryException';
  }
}
exports.AIRegistryException = AIRegistryException;
class AIProviderDescriptor {
  constructor(options) {
    if (!options.id.trim()) {
      throw new AIProviderException('Provider identifier is required');
    }
    this.id = options.id.trim();
    this.name = options.name.trim();
    this.version = options.version.trim();
    this.capabilities = Object.freeze([...options.capabilities]);
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }
}
exports.AIProviderDescriptor = AIProviderDescriptor;
class AIProviderCapabilities {
  constructor(options) {
    this.kind = options.kind;
    this.supported = options.supported;
    this.maxContextLength = options.maxContextLength;
    this.supportsStreaming = options.supportsStreaming;
    this.supportsVision = options.supportsVision;
    this.supportsFunctionCalling = options.supportsFunctionCalling;
    this.supportsStructuredOutput = options.supportsStructuredOutput;
    this.supportsReasoning = options.supportsReasoning;
    this.supportsEmbeddings = options.supportsEmbeddings;
    this.supportsImageGeneration = options.supportsImageGeneration;
    this.supportsAudio = options.supportsAudio;
  }
}
exports.AIProviderCapabilities = AIProviderCapabilities;
class AIModelCapability {
  constructor(options) {
    this.kind = options.kind;
    this.supported = options.supported;
    this.maxContextLength = options.maxContextLength;
    this.supportsStreaming = options.supportsStreaming;
    this.supportsVision = options.supportsVision;
    this.supportsFunctionCalling = options.supportsFunctionCalling;
    this.supportsStructuredOutput = options.supportsStructuredOutput;
    this.supportsReasoning = options.supportsReasoning;
    this.supportsEmbeddings = options.supportsEmbeddings;
    this.supportsImageGeneration = options.supportsImageGeneration;
    this.supportsAudio = options.supportsAudio;
    Object.freeze(this);
  }
}
exports.AIModelCapability = AIModelCapability;
class AIModelCapabilities {
  constructor(options) {
    this.contextLength = options.contextLength;
    this.supportsStreaming = options.supportsStreaming;
    this.supportsVision = options.supportsVision;
    this.supportsFunctionCalling = options.supportsFunctionCalling;
    this.supportsStructuredOutput = options.supportsStructuredOutput;
    this.supportsReasoning = options.supportsReasoning;
    this.supportsEmbeddings = options.supportsEmbeddings;
    this.supportsImageGeneration = options.supportsImageGeneration;
    this.supportsAudio = options.supportsAudio;
  }
}
exports.AIModelCapabilities = AIModelCapabilities;
class AIModelConstraints {
  constructor(options) {
    this.maxContextTokens = options.maxContextTokens;
    this.maxOutputTokens = options.maxOutputTokens;
    this.maxInputTokens = options.maxInputTokens;
    Object.freeze(this);
  }
}
exports.AIModelConstraints = AIModelConstraints;
class AIModelRequirements {
  constructor(options) {
    this.supportsStreaming = options.supportsStreaming;
    this.supportsVision = options.supportsVision;
    this.supportsFunctionCalling = options.supportsFunctionCalling;
    this.supportsStructuredOutput = options.supportsStructuredOutput;
    this.supportsReasoning = options.supportsReasoning;
    this.supportsEmbeddings = options.supportsEmbeddings;
    this.supportsImageGeneration = options.supportsImageGeneration;
    this.supportsAudio = options.supportsAudio;
    Object.freeze(this);
  }
}
exports.AIModelRequirements = AIModelRequirements;
class AIModelVersion {
  constructor(value) {
    this.value = value.trim();
    Object.freeze(this);
  }
  toString() {
    return this.value;
  }
}
exports.AIModelVersion = AIModelVersion;
class AIModelFilter {
  constructor(options = {}) {
    this.capability = options.capability?.trim();
    this.status = options.status?.trim();
    this.providerId = options.providerId?.trim();
    this.contextTokens = options.contextTokens;
    this.includeDeprecated = options.includeDeprecated;
    Object.freeze(this);
  }
}
exports.AIModelFilter = AIModelFilter;
class AIModelQuery {
  constructor(options = {}) {
    this.filter = options.filter;
    this.limit = options.limit;
    Object.freeze(this);
  }
}
exports.AIModelQuery = AIModelQuery;
class AIModelDescriptor {
  constructor(options) {
    if (!options.id.trim()) {
      throw new AIModelException('Model identifier is required');
    }
    this.id = options.id.trim();
    this.providerId = options.providerId.trim();
    this.family = options.family.trim();
    this.name = options.name.trim();
    this.version = options.version.trim();
    this.status = options.status?.trim() ?? 'stable';
    this.deprecated = options.deprecated ?? false;
    this.capabilities = Object.freeze(this.normalizeCapabilities(options.capabilities));
    this.constraints = options.constraints ? Object.freeze({ ...options.constraints }) : undefined;
    this.requirements = options.requirements
      ? Object.freeze({ ...options.requirements })
      : undefined;
    this.aliases = Object.freeze(
      [...(options.aliases ?? [])].map((alias) => alias.trim()).filter(Boolean),
    );
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
    Object.freeze(this);
  }
  normalizeCapabilities(capabilities) {
    return capabilities.map((capability) => {
      if (capability instanceof AIModelCapability) {
        return capability;
      }
      return new AIModelCapability({
        kind: 'capability-profile',
        supported: true,
        maxContextLength: capability.contextLength,
        supportsStreaming: capability.supportsStreaming,
        supportsVision: capability.supportsVision,
        supportsFunctionCalling: capability.supportsFunctionCalling,
        supportsStructuredOutput: capability.supportsStructuredOutput,
        supportsReasoning: capability.supportsReasoning,
        supportsEmbeddings: capability.supportsEmbeddings,
        supportsImageGeneration: capability.supportsImageGeneration,
        supportsAudio: capability.supportsAudio,
      });
    });
  }
}
exports.AIModelDescriptor = AIModelDescriptor;
class AIModelSnapshot {
  constructor(models) {
    this.generatedAt = new Date().toISOString();
    this.models = Object.freeze(models.map((model) => model));
    Object.freeze(this);
  }
}
exports.AIModelSnapshot = AIModelSnapshot;
class AIModel {
  constructor(options) {
    if (!options.id.trim()) {
      throw new AIModelException('Model identifier is required');
    }
    this.id = options.id.trim();
    this.providerId = options.providerId.trim();
    this.name = options.name.trim();
    this.version = options.version.trim();
    this.capabilities = Object.freeze(this.normalizeCapabilities(options.capabilities));
    this.family = options.family?.trim();
    this.status = options.status?.trim();
    this.deprecated = options.deprecated ?? false;
    this.constraints = options.constraints ? Object.freeze({ ...options.constraints }) : undefined;
    this.requirements = options.requirements
      ? Object.freeze({ ...options.requirements })
      : undefined;
    this.aliases = options.aliases ? Object.freeze([...options.aliases]) : undefined;
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }
  normalizeCapabilities(capabilities) {
    return capabilities.map((capability) => {
      if (capability instanceof AIModelCapability) {
        return capability;
      }
      return new AIModelCapability({
        kind: 'capability-profile',
        supported: true,
        maxContextLength: capability.contextLength,
        supportsStreaming: capability.supportsStreaming,
        supportsVision: capability.supportsVision,
        supportsFunctionCalling: capability.supportsFunctionCalling,
        supportsStructuredOutput: capability.supportsStructuredOutput,
        supportsReasoning: capability.supportsReasoning,
        supportsEmbeddings: capability.supportsEmbeddings,
        supportsImageGeneration: capability.supportsImageGeneration,
        supportsAudio: capability.supportsAudio,
      });
    });
  }
}
exports.AIModel = AIModel;
class AIExecutionOptions {
  constructor(options = {}) {
    this.stream = options.stream ?? false;
    this.timeoutMs = options.timeoutMs;
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }
}
exports.AIExecutionOptions = AIExecutionOptions;
class AIExecutionRequest {
  constructor(options) {
    if (!options.id.trim()) {
      throw new AIExecutionException('Request identifier is required');
    }
    if (!options.providerId.trim()) {
      throw new AIExecutionException('Provider identifier is required');
    }
    if (!options.input.trim()) {
      throw new AIExecutionException('Request input is required');
    }
    this.id = options.id.trim();
    this.providerId = options.providerId.trim();
    this.modelId = options.modelId?.trim();
    this.input = options.input.trim();
    this.operation = options.operation;
    this.options = options.options;
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }
}
exports.AIExecutionRequest = AIExecutionRequest;
class AIExecutionResponse {
  constructor(options) {
    this.id = options.id;
    this.providerId = options.providerId;
    this.modelId = options.modelId;
    this.status = options.status;
    this.output = options.output ? Object.freeze({ ...options.output }) : undefined;
    this.error = options.error;
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }
}
exports.AIExecutionResponse = AIExecutionResponse;
class AIExecutionContext {
  constructor(options) {
    this.request = options.request;
    this.provider = options.provider;
    this.startedAt = options.startedAt;
    this.completedAt = options.completedAt;
    this.latencyMs = options.latencyMs;
  }
}
exports.AIExecutionContext = AIExecutionContext;
class AIProviderHealth {
  constructor(options) {
    this.providerId = options.providerId;
    this.status = options.status;
    this.availability = options.availability ?? 1;
    this.latencyMs = options.latencyMs ?? 0;
    this.successRate = options.successRate ?? 1;
    this.failureRate = options.failureRate ?? 0;
    this.lastHealthCheck = options.lastHealthCheck ?? new Date().toISOString();
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }
}
exports.AIProviderHealth = AIProviderHealth;
class AIProviderStatistics {
  constructor(options = {}) {
    this.requestCount = options.requestCount ?? 0;
    this.responseCount = options.responseCount ?? 0;
    this.latencyMs = options.latencyMs ?? 0;
    this.providerUsage = Object.freeze({ ...(options.providerUsage ?? {}) });
    this.modelUsage = Object.freeze({ ...(options.modelUsage ?? {}) });
    this.capabilityUsage = Object.freeze({ ...(options.capabilityUsage ?? {}) });
    this.errorRate = options.errorRate ?? 0;
    this.initializationTimeMs = options.initializationTimeMs ?? 0;
  }
}
exports.AIProviderStatistics = AIProviderStatistics;
class AIProviderFactory {
  constructor(factory) {
    this.factory = factory;
  }
  create(descriptor) {
    return this.factory(descriptor);
  }
}
exports.AIProviderFactory = AIProviderFactory;
class AIProviderRegistry {
  constructor() {
    this.providers = new Map();
  }
  async register(provider) {
    if (this.providers.has(provider.descriptor.id)) {
      throw new AIRegistryException(`Provider '${provider.descriptor.id}' is already registered`);
    }
    this.providers.set(provider.descriptor.id, provider);
  }
  async unregister(providerId) {
    this.providers.delete(providerId);
  }
  get(providerId) {
    return this.providers.get(providerId);
  }
  list() {
    return Object.freeze([...this.providers.values()]);
  }
}
exports.AIProviderRegistry = AIProviderRegistry;
class AIModelRegistry {
  constructor() {
    this.models = new Map();
    this.aliases = new Map();
  }
  register(model) {
    const normalized = this.normalizeModel(model);
    if (this.models.has(normalized.id)) {
      throw new AIRegistryException(`Model '${normalized.id}' is already registered`);
    }
    this.models.set(normalized.id, normalized);
    this.indexAliases(normalized);
  }
  update(model) {
    const normalized = this.normalizeModel(model);
    if (!this.models.has(normalized.id)) {
      this.register(normalized);
      return;
    }
    this.models.set(normalized.id, normalized);
    this.indexAliases(normalized);
  }
  unregister(modelId) {
    const model = this.models.get(modelId);
    if (model) {
      for (const alias of model.aliases ?? []) {
        this.aliases.delete(alias);
      }
    }
    this.models.delete(modelId);
  }
  get(modelId) {
    return this.models.get(modelId);
  }
  list() {
    return Object.freeze([...this.models.values()]);
  }
  lookup(providerId, modelId) {
    const candidates = [...this.models.values()].filter((model) => model.providerId === providerId);
    return candidates.find(
      (model) => model.id === modelId || (model.aliases ?? []).includes(modelId),
    );
  }
  latestVersion(family) {
    const candidates = [...this.models.values()].filter((model) => model.family === family);
    return candidates.sort((left, right) => this.compareVersions(left.version, right.version))[
      candidates.length - 1
    ];
  }
  lookupFamily(family) {
    return Object.freeze([...this.models.values()].filter((model) => model.family === family));
  }
  query(query) {
    const results = [...this.models.values()].filter((model) => {
      const filter = query.filter;
      if (!filter) {
        return true;
      }
      if (filter.providerId && model.providerId !== filter.providerId) {
        return false;
      }
      if (filter.status && model.status !== filter.status) {
        return false;
      }
      if (filter.capability) {
        const matchesCapability = (model.capabilities ?? []).some(
          (capability) => capability.kind === filter.capability,
        );
        if (!matchesCapability) {
          return false;
        }
      }
      if (
        filter.contextTokens &&
        model.constraints?.maxContextTokens &&
        model.constraints.maxContextTokens < filter.contextTokens
      ) {
        return false;
      }
      if (!filter.includeDeprecated && model.deprecated) {
        return false;
      }
      return true;
    });
    if (query.limit && query.limit > 0) {
      return Object.freeze(results.slice(0, query.limit));
    }
    return Object.freeze(results);
  }
  snapshot() {
    return new AIModelSnapshot(this.list());
  }
  lookupByAlias(alias) {
    const normalizedAlias = alias.trim();
    const modelId = this.aliases.get(normalizedAlias);
    return modelId ? this.models.get(modelId) : undefined;
  }
  lookupVersion(providerId, modelIdOrAlias, version) {
    const model = this.lookup(providerId, modelIdOrAlias) ?? this.lookupByAlias(modelIdOrAlias);
    if (!model || model.providerId !== providerId) {
      return undefined;
    }
    return model.version === version.value ? model : undefined;
  }
  normalizeModel(model) {
    if (!model.id?.trim()) {
      throw new AIModelException('Model identifier is required');
    }
    if (!model.providerId?.trim()) {
      throw new AIModelException('Model provider identifier is required');
    }
    if (!model.name?.trim()) {
      throw new AIModelException('Model name is required');
    }
    if (!model.version?.trim()) {
      throw new AIModelException('Model version is required');
    }
    if (model instanceof AIModelDescriptor) {
      return model;
    }
    if (model instanceof AIModel) {
      return new AIModel({
        id: model.id,
        providerId: model.providerId,
        name: model.name,
        version: model.version,
        capabilities: model.capabilities,
        family: model.family,
        status: model.status,
        deprecated: model.deprecated,
        constraints: model.constraints,
        requirements: model.requirements,
        aliases: model.aliases,
        metadata: model.metadata,
      });
    }
    return {
      ...model,
      id: model.id.trim(),
      providerId: model.providerId.trim(),
      name: model.name.trim(),
      version: model.version.trim(),
      family: model.family?.trim(),
      status: model.status?.trim(),
      deprecated: model.deprecated ?? false,
      capabilities: Object.freeze(this.normalizeCapabilities(model.capabilities)),
      constraints: model.constraints ? Object.freeze({ ...model.constraints }) : undefined,
      requirements: model.requirements ? Object.freeze({ ...model.requirements }) : undefined,
      aliases: model.aliases ? Object.freeze([...model.aliases]) : undefined,
      metadata: model.metadata ? Object.freeze({ ...model.metadata }) : undefined,
    };
  }
  normalizeCapabilities(capabilities) {
    return capabilities.map((capability) => capability);
  }
  indexAliases(model) {
    for (const alias of model.aliases ?? []) {
      const normalizedAlias = alias.trim();
      if (!normalizedAlias) {
        continue;
      }
      this.aliases.set(normalizedAlias, model.id);
    }
  }
  compareVersions(left, right) {
    const leftParts = left.split('.').map((part) => Number.parseInt(part, 10) || 0);
    const rightParts = right.split('.').map((part) => Number.parseInt(part, 10) || 0);
    const length = Math.max(leftParts.length, rightParts.length);
    for (let index = 0; index < length; index += 1) {
      const leftValue = leftParts[index] ?? 0;
      const rightValue = rightParts[index] ?? 0;
      if (leftValue > rightValue) {
        return 1;
      }
      if (leftValue < rightValue) {
        return -1;
      }
    }
    return 0;
  }
}
exports.AIModelRegistry = AIModelRegistry;
class AIProvider {
  constructor(descriptor) {
    this._initialized = false;
    this.descriptor = descriptor;
  }
  async initialize() {
    this._initialized = true;
  }
  async validate() {
    if (!this._initialized) {
      throw new AIProviderException(`${this.descriptor.id} must be initialized before use`);
    }
  }
  async healthCheck() {
    return new AIProviderHealth({
      providerId: this.descriptor.id,
      status: 'healthy',
      availability: 1,
      latencyMs: 1,
      successRate: 1,
      failureRate: 0,
    });
  }
  async shutdown() {
    this._initialized = false;
  }
  async discoverCapabilities() {
    return this.descriptor.capabilities;
  }
  async discoverModels() {
    return [];
  }
  async estimateTokens(request) {
    return request.input.length;
  }
  async estimateCost(request) {
    return Math.max(0, request.input.length * 0.0001);
  }
}
exports.AIProvider = AIProvider;
class AIGateway {
  constructor(options = {}) {
    this.statisticsState = {
      requestCount: 0,
      responseCount: 0,
      latencyMs: 0,
      providerUsage: {},
      modelUsage: {},
      capabilityUsage: {},
      errorRate: 0,
      initializationTimeMs: 0,
      errorCount: 0,
    };
    this.initialized = false;
    this.providerRegistry = options.providerRegistry ?? new AIProviderRegistry();
    this.modelRegistry = options.modelRegistry ?? new AIModelRegistry();
    this.eventBus = options.eventBus;
  }
  async initialize() {
    this.initialized = true;
    if (this.eventBus) {
      await this.eventBus.publish(new GatewayInitializedEvent(this));
    }
  }
  async shutdown() {
    this.initialized = false;
    if (this.eventBus) {
      await this.eventBus.publish(new GatewayShutdownEvent(this));
    }
  }
  async registerProvider(provider) {
    await this.providerRegistry.register(provider);
    await provider.initialize();
    await provider.validate();
    await this.publishEvent(new ProviderRegisteredEvent(provider));
  }
  async unregisterProvider(providerId) {
    await this.providerRegistry.unregister(providerId);
    await this.publishEvent(new ProviderRemovedEvent(providerId));
  }
  async execute(request) {
    if (!this.initialized) {
      throw new AIExecutionException('Gateway is not initialized');
    }
    const provider = this.providerRegistry.get(request.providerId);
    if (!provider) {
      throw new AIExecutionException(`Provider '${request.providerId}' is not registered`);
    }
    try {
      await provider.validate();
      const response = await provider.execute(request);
      this.recordUsage(request, response);
      await this.publishEvent(new ProviderHealthyEvent(provider));
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown execution error';
      this.recordError(request, message);
      await this.publishEvent(new ProviderUnhealthyEvent(provider));
      throw new AIExecutionException(message);
    }
  }
  async stream(request) {
    if (!this.initialized) {
      throw new AIExecutionException('Gateway is not initialized');
    }
    const provider = this.providerRegistry.get(request.providerId);
    if (!provider) {
      throw new AIExecutionException(`Provider '${request.providerId}' is not registered`);
    }
    try {
      await provider.validate();
      return await provider.stream(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown execution error';
      throw new AIExecutionException(message);
    }
  }
  async discoverCapabilities(providerId) {
    const provider = this.providerRegistry.get(providerId);
    if (!provider) {
      throw new AIExecutionException(`Provider '${providerId}' is not registered`);
    }
    return provider.discoverCapabilities();
  }
  async healthCheck(providerId) {
    const provider = this.providerRegistry.get(providerId);
    if (!provider) {
      return new AIProviderHealth({
        providerId,
        status: 'unhealthy',
        availability: 0,
        latencyMs: 0,
        successRate: 0,
        failureRate: 1,
      });
    }
    return provider.healthCheck();
  }
  statistics() {
    return new AIProviderStatistics({
      requestCount: this.statisticsState.requestCount,
      responseCount: this.statisticsState.responseCount,
      latencyMs: this.statisticsState.latencyMs,
      providerUsage: this.statisticsState.providerUsage,
      modelUsage: this.statisticsState.modelUsage,
      capabilityUsage: this.statisticsState.capabilityUsage,
      errorRate: this.statisticsState.errorRate,
      initializationTimeMs: this.statisticsState.initializationTimeMs,
    });
  }
  recordUsage(request, _response) {
    this.statisticsState.requestCount += 1;
    this.statisticsState.responseCount += 1;
    this.statisticsState.providerUsage = {
      ...this.statisticsState.providerUsage,
      [request.providerId]: (this.statisticsState.providerUsage[request.providerId] ?? 0) + 1,
    };
    this.statisticsState.modelUsage = {
      ...this.statisticsState.modelUsage,
      [request.modelId ?? 'default']:
        (this.statisticsState.modelUsage[request.modelId ?? 'default'] ?? 0) + 1,
    };
    this.statisticsState.capabilityUsage = {
      ...this.statisticsState.capabilityUsage,
      [request.operation]: (this.statisticsState.capabilityUsage[request.operation] ?? 0) + 1,
    };
  }
  recordError(_request, _message) {
    this.statisticsState.requestCount += 1;
    this.statisticsState.errorCount += 1;
    this.statisticsState.errorRate =
      this.statisticsState.errorCount / this.statisticsState.requestCount;
  }
  async publishEvent(event) {
    if (this.eventBus) {
      await this.eventBus.publish(event);
    }
  }
}
exports.AIGateway = AIGateway;
class ProviderRegisteredEvent {
  constructor(provider, correlationId) {
    this.eventId = `provider-registered-${provider.descriptor.id}`;
    this.correlationId = correlationId;
    this.timestamp = new Date().toISOString();
    this.source = 'ai-core';
    this.category = 'domain';
    this.priority = 'normal';
    this.version = 1;
    this.tags = ['ai', 'provider', 'gateway'];
    this.eventType = 'ProviderRegistered';
    this.payload = { provider };
    this.metadata = core_infrastructure_1.EventMetadata.create({
      correlationId,
      source: this.source,
      category: this.category,
      priority: this.priority,
      tags: this.tags,
    });
  }
  toEnvelope() {
    return new core_infrastructure_1.EventEnvelope(this, this.metadata);
  }
}
exports.ProviderRegisteredEvent = ProviderRegisteredEvent;
class ProviderRemovedEvent {
  constructor(providerId, correlationId) {
    this.eventId = `provider-removed-${providerId}`;
    this.correlationId = correlationId;
    this.timestamp = new Date().toISOString();
    this.source = 'ai-core';
    this.category = 'domain';
    this.priority = 'normal';
    this.version = 1;
    this.tags = ['ai', 'provider', 'gateway'];
    this.eventType = 'ProviderRemoved';
    this.payload = { providerId };
    this.metadata = core_infrastructure_1.EventMetadata.create({
      correlationId,
      source: this.source,
      category: this.category,
      priority: this.priority,
      tags: this.tags,
    });
  }
  toEnvelope() {
    return new core_infrastructure_1.EventEnvelope(this, this.metadata);
  }
}
exports.ProviderRemovedEvent = ProviderRemovedEvent;
class ProviderHealthyEvent {
  constructor(provider, correlationId) {
    this.eventId = `provider-healthy-${provider.descriptor.id}`;
    this.correlationId = correlationId;
    this.timestamp = new Date().toISOString();
    this.source = 'ai-core';
    this.category = 'domain';
    this.priority = 'normal';
    this.version = 1;
    this.tags = ['ai', 'provider', 'gateway'];
    this.eventType = 'ProviderHealthy';
    this.payload = { provider };
    this.metadata = core_infrastructure_1.EventMetadata.create({
      correlationId,
      source: this.source,
      category: this.category,
      priority: this.priority,
      tags: this.tags,
    });
  }
  toEnvelope() {
    return new core_infrastructure_1.EventEnvelope(this, this.metadata);
  }
}
exports.ProviderHealthyEvent = ProviderHealthyEvent;
class ProviderUnhealthyEvent {
  constructor(provider, correlationId) {
    this.eventId = `provider-unhealthy-${provider.descriptor.id}`;
    this.correlationId = correlationId;
    this.timestamp = new Date().toISOString();
    this.source = 'ai-core';
    this.category = 'domain';
    this.priority = 'normal';
    this.version = 1;
    this.tags = ['ai', 'provider', 'gateway'];
    this.eventType = 'ProviderUnhealthy';
    this.payload = { provider };
    this.metadata = core_infrastructure_1.EventMetadata.create({
      correlationId,
      source: this.source,
      category: this.category,
      priority: this.priority,
      tags: this.tags,
    });
  }
  toEnvelope() {
    return new core_infrastructure_1.EventEnvelope(this, this.metadata);
  }
}
exports.ProviderUnhealthyEvent = ProviderUnhealthyEvent;
class ModelRegisteredEvent {
  constructor(model, correlationId) {
    this.eventId = `model-registered-${model.id}`;
    this.correlationId = correlationId;
    this.timestamp = new Date().toISOString();
    this.source = 'ai-core';
    this.category = 'domain';
    this.priority = 'normal';
    this.version = 1;
    this.tags = ['ai', 'model', 'gateway'];
    this.eventType = 'ModelRegistered';
    this.payload = { model };
    this.metadata = core_infrastructure_1.EventMetadata.create({
      correlationId,
      source: this.source,
      category: this.category,
      priority: this.priority,
      tags: this.tags,
    });
  }
  toEnvelope() {
    return new core_infrastructure_1.EventEnvelope(this, this.metadata);
  }
}
exports.ModelRegisteredEvent = ModelRegisteredEvent;
class GatewayInitializedEvent {
  constructor(gateway, correlationId) {
    this.eventId = `gateway-initialized-${gateway.constructor.name}`;
    this.correlationId = correlationId;
    this.timestamp = new Date().toISOString();
    this.source = 'ai-core';
    this.category = 'domain';
    this.priority = 'normal';
    this.version = 1;
    this.tags = ['ai', 'gateway'];
    this.eventType = 'GatewayInitialized';
    this.payload = { gateway };
    this.metadata = core_infrastructure_1.EventMetadata.create({
      correlationId,
      source: this.source,
      category: this.category,
      priority: this.priority,
      tags: this.tags,
    });
  }
  toEnvelope() {
    return new core_infrastructure_1.EventEnvelope(this, this.metadata);
  }
}
exports.GatewayInitializedEvent = GatewayInitializedEvent;
class GatewayShutdownEvent {
  constructor(gateway, correlationId) {
    this.eventId = `gateway-shutdown-${gateway.constructor.name}`;
    this.correlationId = correlationId;
    this.timestamp = new Date().toISOString();
    this.source = 'ai-core';
    this.category = 'domain';
    this.priority = 'normal';
    this.version = 1;
    this.tags = ['ai', 'gateway'];
    this.eventType = 'GatewayShutdown';
    this.payload = { gateway };
    this.metadata = core_infrastructure_1.EventMetadata.create({
      correlationId,
      source: this.source,
      category: this.category,
      priority: this.priority,
      tags: this.tags,
    });
  }
  toEnvelope() {
    return new core_infrastructure_1.EventEnvelope(this, this.metadata);
  }
}
exports.GatewayShutdownEvent = GatewayShutdownEvent;
//# sourceMappingURL=ai-gateway.js.map
