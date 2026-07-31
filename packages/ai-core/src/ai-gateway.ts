import {
  EventEnvelope,
  EventMetadata,
  type IEvent,
  type IEventBus,
} from '@infrashield/core-infrastructure';
import type { SerializableValueObject, TimestampString } from '@infrashield/contracts';

export type AICapabilityKind =
  | 'chat'
  | 'completion'
  | 'embedding'
  | 'image'
  | 'audio'
  | 'reasoning'
  | 'tool-calling'
  | 'streaming'
  | 'structured-output'
  | 'multimodal';

export interface IAIGateway {
  readonly providerRegistry: IAIProviderRegistry;
  readonly modelRegistry: IAIModelRegistry;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  registerProvider(provider: IAIProvider): Promise<void>;
  unregisterProvider(providerId: string): Promise<void>;
  execute(request: IAIExecutionRequest): Promise<IAIExecutionResponse>;
  stream(request: IAIExecutionRequest): Promise<IAIExecutionResponse>;
  discoverCapabilities(providerId: string): Promise<readonly AIProviderCapabilities[]>;
  healthCheck(providerId: string): Promise<AIProviderHealth>;
  statistics(): AIProviderStatistics;
}

export interface IAIProvider {
  readonly descriptor: AIProviderDescriptor;
  initialize(): Promise<void>;
  validate(): Promise<void>;
  healthCheck(): Promise<AIProviderHealth>;
  execute(request: IAIExecutionRequest): Promise<IAIExecutionResponse>;
  stream(request: IAIExecutionRequest): Promise<IAIExecutionResponse>;
  shutdown(): Promise<void>;
  discoverCapabilities(): Promise<readonly AIProviderCapabilities[]>;
  discoverModels(): Promise<readonly IAIModel[]>;
  estimateTokens(request: IAIExecutionRequest): Promise<number>;
  estimateCost(request: IAIExecutionRequest): Promise<number>;
}

export interface IAIProviderFactory {
  create(descriptor: AIProviderDescriptor): IAIProvider;
}

export interface IAIProviderRegistry {
  register(provider: IAIProvider): Promise<void>;
  unregister(providerId: string): Promise<void>;
  get(providerId: string): IAIProvider | undefined;
  list(): readonly IAIProvider[];
}

export interface IAIModel {
  readonly id: string;
  readonly providerId: string;
  readonly name: string;
  readonly version: string;
  readonly capabilities: readonly AIModelCapability[];
  readonly family?: string;
  readonly status?: string;
  readonly deprecated?: boolean;
  readonly constraints?: AIModelConstraints;
  readonly requirements?: AIModelRequirements;
  readonly aliases?: readonly string[];
  readonly metadata?: SerializableValueObject;
}

export interface IAIExecutionRequest {
  readonly id: string;
  readonly providerId: string;
  readonly modelId?: string;
  readonly input: string;
  readonly operation: AICapabilityKind;
  readonly options?: AIExecutionOptions;
  readonly metadata?: SerializableValueObject;
}

export interface IAIExecutionResponse {
  readonly id: string;
  readonly providerId: string;
  readonly modelId?: string;
  readonly status: 'success' | 'error';
  readonly output?: SerializableValueObject;
  readonly error?: string;
  readonly metadata?: SerializableValueObject;
}

export interface IAIExecutionContext {
  readonly request: IAIExecutionRequest;
  readonly provider: IAIProvider;
  readonly startedAt: TimestampString;
  readonly completedAt?: TimestampString;
  readonly latencyMs?: number;
}

export interface IAIModelRegistry {
  register(model: IAIModel): void;
  update(model: IAIModel): void;
  unregister(modelId: string): void;
  get(modelId: string): IAIModel | undefined;
  list(): readonly IAIModel[];
  lookup(providerId: string, modelId: string): IAIModel | undefined;
  latestVersion(family: string): IAIModel | undefined;
  lookupFamily(family: string): readonly IAIModel[];
  query(query: AIModelQuery): readonly IAIModel[];
  snapshot(): AIModelSnapshot;
  lookupByAlias(alias: string): IAIModel | undefined;
  lookupVersion(
    providerId: string,
    modelIdOrAlias: string,
    version: AIModelVersion,
  ): IAIModel | undefined;
}

export class AIGatewayException extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'AIGatewayException';
  }
}

export class AIProviderException extends AIGatewayException {
  public constructor(message: string) {
    super(message);
    this.name = 'AIProviderException';
  }
}

export class AIModelException extends AIGatewayException {
  public constructor(message: string) {
    super(message);
    this.name = 'AIModelException';
  }
}

export class AIExecutionException extends AIGatewayException {
  public constructor(message: string) {
    super(message);
    this.name = 'AIExecutionException';
  }
}

export class AIRegistryException extends AIGatewayException {
  public constructor(message: string) {
    super(message);
    this.name = 'AIRegistryException';
  }
}

export class AIProviderDescriptor {
  public readonly id: string;
  public readonly name: string;
  public readonly version: string;
  public readonly capabilities: readonly AIProviderCapabilities[];
  public readonly metadata?: SerializableValueObject;

  public constructor(options: {
    readonly id: string;
    readonly name: string;
    readonly version: string;
    readonly capabilities: readonly AIProviderCapabilities[];
    readonly metadata?: SerializableValueObject;
  }) {
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

export class AIProviderCapabilities {
  public readonly kind: AICapabilityKind;
  public readonly supported: boolean;
  public readonly maxContextLength?: number;
  public readonly supportsStreaming?: boolean;
  public readonly supportsVision?: boolean;
  public readonly supportsFunctionCalling?: boolean;
  public readonly supportsStructuredOutput?: boolean;
  public readonly supportsReasoning?: boolean;
  public readonly supportsEmbeddings?: boolean;
  public readonly supportsImageGeneration?: boolean;
  public readonly supportsAudio?: boolean;

  public constructor(options: {
    readonly kind: AICapabilityKind;
    readonly supported: boolean;
    readonly maxContextLength?: number;
    readonly supportsStreaming?: boolean;
    readonly supportsVision?: boolean;
    readonly supportsFunctionCalling?: boolean;
    readonly supportsStructuredOutput?: boolean;
    readonly supportsReasoning?: boolean;
    readonly supportsEmbeddings?: boolean;
    readonly supportsImageGeneration?: boolean;
    readonly supportsAudio?: boolean;
  }) {
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

export class AIModelCapability {
  public readonly kind: string;
  public readonly supported: boolean;
  public readonly maxContextLength?: number;
  public readonly supportsStreaming?: boolean;
  public readonly supportsVision?: boolean;
  public readonly supportsFunctionCalling?: boolean;
  public readonly supportsStructuredOutput?: boolean;
  public readonly supportsReasoning?: boolean;
  public readonly supportsEmbeddings?: boolean;
  public readonly supportsImageGeneration?: boolean;
  public readonly supportsAudio?: boolean;

  public constructor(options: {
    readonly kind: string;
    readonly supported: boolean;
    readonly maxContextLength?: number;
    readonly supportsStreaming?: boolean;
    readonly supportsVision?: boolean;
    readonly supportsFunctionCalling?: boolean;
    readonly supportsStructuredOutput?: boolean;
    readonly supportsReasoning?: boolean;
    readonly supportsEmbeddings?: boolean;
    readonly supportsImageGeneration?: boolean;
    readonly supportsAudio?: boolean;
  }) {
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

export class AIModelCapabilities {
  public readonly contextLength?: number;
  public readonly supportsStreaming?: boolean;
  public readonly supportsVision?: boolean;
  public readonly supportsFunctionCalling?: boolean;
  public readonly supportsStructuredOutput?: boolean;
  public readonly supportsReasoning?: boolean;
  public readonly supportsEmbeddings?: boolean;
  public readonly supportsImageGeneration?: boolean;
  public readonly supportsAudio?: boolean;

  public constructor(options: {
    readonly contextLength?: number;
    readonly supportsStreaming?: boolean;
    readonly supportsVision?: boolean;
    readonly supportsFunctionCalling?: boolean;
    readonly supportsStructuredOutput?: boolean;
    readonly supportsReasoning?: boolean;
    readonly supportsEmbeddings?: boolean;
    readonly supportsImageGeneration?: boolean;
    readonly supportsAudio?: boolean;
  }) {
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

export class AIModelConstraints {
  public readonly maxContextTokens?: number;
  public readonly maxOutputTokens?: number;
  public readonly maxInputTokens?: number;

  public constructor(options: {
    readonly maxContextTokens?: number;
    readonly maxOutputTokens?: number;
    readonly maxInputTokens?: number;
  }) {
    this.maxContextTokens = options.maxContextTokens;
    this.maxOutputTokens = options.maxOutputTokens;
    this.maxInputTokens = options.maxInputTokens;
    Object.freeze(this);
  }
}

export class AIModelRequirements {
  public readonly supportsStreaming?: boolean;
  public readonly supportsVision?: boolean;
  public readonly supportsFunctionCalling?: boolean;
  public readonly supportsStructuredOutput?: boolean;
  public readonly supportsReasoning?: boolean;
  public readonly supportsEmbeddings?: boolean;
  public readonly supportsImageGeneration?: boolean;
  public readonly supportsAudio?: boolean;

  public constructor(options: {
    readonly supportsStreaming?: boolean;
    readonly supportsVision?: boolean;
    readonly supportsFunctionCalling?: boolean;
    readonly supportsStructuredOutput?: boolean;
    readonly supportsReasoning?: boolean;
    readonly supportsEmbeddings?: boolean;
    readonly supportsImageGeneration?: boolean;
    readonly supportsAudio?: boolean;
  }) {
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

export class AIModelVersion {
  public readonly value: string;

  public constructor(value: string) {
    this.value = value.trim();
    Object.freeze(this);
  }

  public toString(): string {
    return this.value;
  }
}

export class AIModelFilter {
  public readonly capability?: string;
  public readonly status?: string;
  public readonly providerId?: string;
  public readonly contextTokens?: number;
  public readonly includeDeprecated?: boolean;

  public constructor(
    options: {
      readonly capability?: string;
      readonly status?: string;
      readonly providerId?: string;
      readonly contextTokens?: number;
      readonly includeDeprecated?: boolean;
    } = {},
  ) {
    this.capability = options.capability?.trim();
    this.status = options.status?.trim();
    this.providerId = options.providerId?.trim();
    this.contextTokens = options.contextTokens;
    this.includeDeprecated = options.includeDeprecated;
    Object.freeze(this);
  }
}

export class AIModelQuery {
  public readonly filter?: AIModelFilter;
  public readonly limit?: number;

  public constructor(
    options: {
      readonly filter?: AIModelFilter;
      readonly limit?: number;
    } = {},
  ) {
    this.filter = options.filter;
    this.limit = options.limit;
    Object.freeze(this);
  }
}

export class AIModelDescriptor implements IAIModel {
  public readonly id: string;
  public readonly providerId: string;
  public readonly family: string;
  public readonly name: string;
  public readonly version: string;
  public readonly status: string;
  public readonly deprecated: boolean;
  public readonly capabilities: readonly AIModelCapability[];
  public readonly constraints?: AIModelConstraints;
  public readonly requirements?: AIModelRequirements;
  public readonly aliases: readonly string[];
  public readonly metadata?: SerializableValueObject;

  public constructor(options: {
    readonly id: string;
    readonly providerId: string;
    readonly family: string;
    readonly name: string;
    readonly version: string;
    readonly status?: string;
    readonly deprecated?: boolean;
    readonly capabilities: readonly (AIModelCapability | AIModelCapabilities)[];
    readonly constraints?: AIModelConstraints;
    readonly requirements?: AIModelRequirements;
    readonly aliases?: readonly string[];
    readonly metadata?: SerializableValueObject;
  }) {
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

  private normalizeCapabilities(
    capabilities: readonly (AIModelCapability | AIModelCapabilities)[],
  ): readonly AIModelCapability[] {
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

export class AIModelSnapshot {
  public readonly generatedAt: string;
  public readonly models: readonly AIModelDescriptor[];

  public constructor(models: readonly IAIModel[]) {
    this.generatedAt = new Date().toISOString();
    this.models = Object.freeze(models.map((model) => model as AIModelDescriptor));
    Object.freeze(this);
  }
}

export class AIModel implements IAIModel {
  public readonly id: string;
  public readonly providerId: string;
  public readonly name: string;
  public readonly version: string;
  public readonly capabilities: readonly AIModelCapability[];
  public readonly family?: string;
  public readonly status?: string;
  public readonly deprecated?: boolean;
  public readonly constraints?: AIModelConstraints;
  public readonly requirements?: AIModelRequirements;
  public readonly aliases?: readonly string[];
  public readonly metadata?: SerializableValueObject;

  public constructor(options: {
    readonly id: string;
    readonly providerId: string;
    readonly name: string;
    readonly version: string;
    readonly capabilities: readonly (AIModelCapability | AIModelCapabilities)[];
    readonly family?: string;
    readonly status?: string;
    readonly deprecated?: boolean;
    readonly constraints?: AIModelConstraints;
    readonly requirements?: AIModelRequirements;
    readonly aliases?: readonly string[];
    readonly metadata?: SerializableValueObject;
  }) {
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

  private normalizeCapabilities(
    capabilities: readonly (AIModelCapability | AIModelCapabilities)[],
  ): readonly AIModelCapability[] {
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

export class AIExecutionOptions {
  public readonly stream: boolean;
  public readonly timeoutMs?: number;
  public readonly metadata?: SerializableValueObject;

  public constructor(
    options: {
      readonly stream?: boolean;
      readonly timeoutMs?: number;
      readonly metadata?: SerializableValueObject;
    } = {},
  ) {
    this.stream = options.stream ?? false;
    this.timeoutMs = options.timeoutMs;
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }
}

export class AIExecutionRequest implements IAIExecutionRequest {
  public readonly id: string;
  public readonly providerId: string;
  public readonly modelId?: string;
  public readonly input: string;
  public readonly operation: AICapabilityKind;
  public readonly options?: AIExecutionOptions;
  public readonly metadata?: SerializableValueObject;

  public constructor(options: {
    readonly id: string;
    readonly providerId: string;
    readonly modelId?: string;
    readonly input: string;
    readonly operation: AICapabilityKind;
    readonly options?: AIExecutionOptions;
    readonly metadata?: SerializableValueObject;
  }) {
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

export class AIExecutionResponse implements IAIExecutionResponse {
  public readonly id: string;
  public readonly providerId: string;
  public readonly modelId?: string;
  public readonly status: 'success' | 'error';
  public readonly output?: SerializableValueObject;
  public readonly error?: string;
  public readonly metadata?: SerializableValueObject;

  public constructor(options: {
    readonly id: string;
    readonly providerId: string;
    readonly modelId?: string;
    readonly status: 'success' | 'error';
    readonly output?: SerializableValueObject;
    readonly error?: string;
    readonly metadata?: SerializableValueObject;
  }) {
    this.id = options.id;
    this.providerId = options.providerId;
    this.modelId = options.modelId;
    this.status = options.status;
    this.output = options.output ? Object.freeze({ ...options.output }) : undefined;
    this.error = options.error;
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }
}

export class AIExecutionContext implements IAIExecutionContext {
  public readonly request: AIExecutionRequest;
  public readonly provider: AIProvider;
  public readonly startedAt: TimestampString;
  public readonly completedAt?: TimestampString;
  public readonly latencyMs?: number;

  public constructor(options: {
    readonly request: AIExecutionRequest;
    readonly provider: AIProvider;
    readonly startedAt: TimestampString;
    readonly completedAt?: TimestampString;
    readonly latencyMs?: number;
  }) {
    this.request = options.request;
    this.provider = options.provider;
    this.startedAt = options.startedAt;
    this.completedAt = options.completedAt;
    this.latencyMs = options.latencyMs;
  }
}

export class AIProviderHealth {
  public readonly providerId: string;
  public readonly status: 'healthy' | 'degraded' | 'unhealthy';
  public readonly availability: number;
  public readonly latencyMs: number;
  public readonly successRate: number;
  public readonly failureRate: number;
  public readonly lastHealthCheck: TimestampString;
  public readonly metadata?: SerializableValueObject;

  public constructor(options: {
    readonly providerId: string;
    readonly status: 'healthy' | 'degraded' | 'unhealthy';
    readonly availability?: number;
    readonly latencyMs?: number;
    readonly successRate?: number;
    readonly failureRate?: number;
    readonly lastHealthCheck?: TimestampString;
    readonly metadata?: SerializableValueObject;
  }) {
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

export class AIProviderStatistics {
  public readonly requestCount: number;
  public readonly responseCount: number;
  public readonly latencyMs: number;
  public readonly providerUsage: Readonly<Record<string, number>>;
  public readonly modelUsage: Readonly<Record<string, number>>;
  public readonly capabilityUsage: Readonly<Record<string, number>>;
  public readonly errorRate: number;
  public readonly initializationTimeMs: number;

  public constructor(
    options: {
      readonly requestCount?: number;
      readonly responseCount?: number;
      readonly latencyMs?: number;
      readonly providerUsage?: Readonly<Record<string, number>>;
      readonly modelUsage?: Readonly<Record<string, number>>;
      readonly capabilityUsage?: Readonly<Record<string, number>>;
      readonly errorRate?: number;
      readonly initializationTimeMs?: number;
    } = {},
  ) {
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

export class AIProviderFactory implements IAIProviderFactory {
  private readonly factory: (descriptor: AIProviderDescriptor) => IAIProvider;

  public constructor(factory: (descriptor: AIProviderDescriptor) => IAIProvider) {
    this.factory = factory;
  }

  public create(descriptor: AIProviderDescriptor): IAIProvider {
    return this.factory(descriptor);
  }
}

export class AIProviderRegistry implements IAIProviderRegistry {
  private readonly providers = new Map<string, IAIProvider>();

  public async register(provider: IAIProvider): Promise<void> {
    if (this.providers.has(provider.descriptor.id)) {
      throw new AIRegistryException(`Provider '${provider.descriptor.id}' is already registered`);
    }
    this.providers.set(provider.descriptor.id, provider);
  }

  public async unregister(providerId: string): Promise<void> {
    this.providers.delete(providerId);
  }

  public get(providerId: string): IAIProvider | undefined {
    return this.providers.get(providerId);
  }

  public list(): readonly IAIProvider[] {
    return Object.freeze([...this.providers.values()]);
  }
}

export class AIModelRegistry implements IAIModelRegistry {
  private readonly models = new Map<string, IAIModel>();
  private readonly aliases = new Map<string, string>();

  public register(model: IAIModel): void {
    const normalized = this.normalizeModel(model);
    if (this.models.has(normalized.id)) {
      throw new AIRegistryException(`Model '${normalized.id}' is already registered`);
    }
    this.models.set(normalized.id, normalized);
    this.indexAliases(normalized);
  }

  public update(model: IAIModel): void {
    const normalized = this.normalizeModel(model);
    if (!this.models.has(normalized.id)) {
      this.register(normalized);
      return;
    }
    this.models.set(normalized.id, normalized);
    this.indexAliases(normalized);
  }

  public unregister(modelId: string): void {
    const model = this.models.get(modelId);
    if (model) {
      for (const alias of model.aliases ?? []) {
        this.aliases.delete(alias);
      }
    }
    this.models.delete(modelId);
  }

  public get(modelId: string): IAIModel | undefined {
    return this.models.get(modelId);
  }

  public list(): readonly IAIModel[] {
    return Object.freeze([...this.models.values()]);
  }

  public lookup(providerId: string, modelId: string): IAIModel | undefined {
    const candidates = [...this.models.values()].filter((model) => model.providerId === providerId);
    return candidates.find(
      (model) => model.id === modelId || (model.aliases ?? []).includes(modelId),
    );
  }

  public latestVersion(family: string): IAIModel | undefined {
    const candidates = [...this.models.values()].filter((model) => model.family === family);
    return candidates.sort((left, right) => this.compareVersions(left.version, right.version))[
      candidates.length - 1
    ];
  }

  public lookupFamily(family: string): readonly IAIModel[] {
    return Object.freeze([...this.models.values()].filter((model) => model.family === family));
  }

  public query(query: AIModelQuery): readonly IAIModel[] {
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

  public snapshot(): AIModelSnapshot {
    return new AIModelSnapshot(this.list());
  }

  public lookupByAlias(alias: string): IAIModel | undefined {
    const normalizedAlias = alias.trim();
    const modelId = this.aliases.get(normalizedAlias);
    return modelId ? this.models.get(modelId) : undefined;
  }

  public lookupVersion(
    providerId: string,
    modelIdOrAlias: string,
    version: AIModelVersion,
  ): IAIModel | undefined {
    const model = this.lookup(providerId, modelIdOrAlias) ?? this.lookupByAlias(modelIdOrAlias);
    if (!model || model.providerId !== providerId) {
      return undefined;
    }
    return model.version === version.value ? model : undefined;
  }

  private normalizeModel(model: IAIModel): IAIModel {
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
        capabilities: model.capabilities as readonly AIModelCapability[],
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

  private normalizeCapabilities(
    capabilities: readonly AIModelCapability[],
  ): readonly AIModelCapability[] {
    return capabilities.map((capability) => capability);
  }

  private indexAliases(model: IAIModel): void {
    for (const alias of model.aliases ?? []) {
      const normalizedAlias = alias.trim();
      if (!normalizedAlias) {
        continue;
      }
      this.aliases.set(normalizedAlias, model.id);
    }
  }

  private compareVersions(left: string, right: string): number {
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

export abstract class AIProvider implements IAIProvider {
  public readonly descriptor: AIProviderDescriptor;
  private _initialized = false;

  public constructor(descriptor: AIProviderDescriptor) {
    this.descriptor = descriptor;
  }

  public async initialize(): Promise<void> {
    this._initialized = true;
  }

  public async validate(): Promise<void> {
    if (!this._initialized) {
      throw new AIProviderException(`${this.descriptor.id} must be initialized before use`);
    }
  }

  public async healthCheck(): Promise<AIProviderHealth> {
    return new AIProviderHealth({
      providerId: this.descriptor.id,
      status: 'healthy',
      availability: 1,
      latencyMs: 1,
      successRate: 1,
      failureRate: 0,
    });
  }

  public abstract execute(request: IAIExecutionRequest): Promise<IAIExecutionResponse>;
  public abstract stream(request: IAIExecutionRequest): Promise<IAIExecutionResponse>;

  public async shutdown(): Promise<void> {
    this._initialized = false;
  }

  public async discoverCapabilities(): Promise<readonly AIProviderCapabilities[]> {
    return this.descriptor.capabilities;
  }

  public async discoverModels(): Promise<readonly IAIModel[]> {
    return [];
  }

  public async estimateTokens(request: IAIExecutionRequest): Promise<number> {
    return request.input.length;
  }

  public async estimateCost(request: IAIExecutionRequest): Promise<number> {
    return Math.max(0, request.input.length * 0.0001);
  }
}

export class AIGateway implements IAIGateway {
  public readonly providerRegistry: IAIProviderRegistry;
  public readonly modelRegistry: IAIModelRegistry;
  private readonly eventBus?: IEventBus;
  private readonly statisticsState: {
    requestCount: number;
    responseCount: number;
    latencyMs: number;
    providerUsage: Record<string, number>;
    modelUsage: Record<string, number>;
    capabilityUsage: Record<string, number>;
    errorRate: number;
    initializationTimeMs: number;
    errorCount: number;
  } = {
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
  private initialized = false;

  public constructor(
    options: {
      readonly providerRegistry?: IAIProviderRegistry;
      readonly modelRegistry?: IAIModelRegistry;
      readonly eventBus?: IEventBus;
    } = {},
  ) {
    this.providerRegistry = options.providerRegistry ?? new AIProviderRegistry();
    this.modelRegistry = options.modelRegistry ?? new AIModelRegistry();
    this.eventBus = options.eventBus;
  }

  public async initialize(): Promise<void> {
    this.initialized = true;
    if (this.eventBus) {
      await this.eventBus.publish(new GatewayInitializedEvent(this));
    }
  }

  public async shutdown(): Promise<void> {
    this.initialized = false;
    if (this.eventBus) {
      await this.eventBus.publish(new GatewayShutdownEvent(this));
    }
  }

  public async registerProvider(provider: IAIProvider): Promise<void> {
    await this.providerRegistry.register(provider);
    await provider.initialize();
    await provider.validate();
    await this.publishEvent(new ProviderRegisteredEvent(provider));
  }

  public async unregisterProvider(providerId: string): Promise<void> {
    await this.providerRegistry.unregister(providerId);
    await this.publishEvent(new ProviderRemovedEvent(providerId));
  }

  public async execute(request: IAIExecutionRequest): Promise<IAIExecutionResponse> {
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

  public async stream(request: IAIExecutionRequest): Promise<IAIExecutionResponse> {
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

  public async discoverCapabilities(
    providerId: string,
  ): Promise<readonly AIProviderCapabilities[]> {
    const provider = this.providerRegistry.get(providerId);
    if (!provider) {
      throw new AIExecutionException(`Provider '${providerId}' is not registered`);
    }
    return provider.discoverCapabilities();
  }

  public async healthCheck(providerId: string): Promise<AIProviderHealth> {
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

  public statistics(): AIProviderStatistics {
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

  private recordUsage(request: IAIExecutionRequest, _response: IAIExecutionResponse): void {
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

  private recordError(_request: IAIExecutionRequest, _message: string): void {
    this.statisticsState.requestCount += 1;
    this.statisticsState.errorCount += 1;
    this.statisticsState.errorRate =
      this.statisticsState.errorCount / this.statisticsState.requestCount;
  }

  private async publishEvent(event: IEvent): Promise<void> {
    if (this.eventBus) {
      await this.eventBus.publish(event);
    }
  }
}

export class ProviderRegisteredEvent implements IEvent {
  public readonly eventId: string;
  public readonly correlationId?: string;
  public readonly timestamp: string;
  public readonly source: string;
  public readonly category: 'domain' | 'integration' | 'application' | 'system';
  public readonly priority: 'low' | 'normal' | 'high' | 'critical';
  public readonly version: number;
  public readonly tags: readonly string[];
  public readonly eventType: string;
  public readonly payload: { readonly provider: IAIProvider };
  public readonly metadata: EventMetadata;

  public constructor(provider: IAIProvider, correlationId?: string) {
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
    this.metadata = EventMetadata.create({
      correlationId,
      source: this.source,
      category: this.category,
      priority: this.priority,
      tags: this.tags,
    });
  }

  public toEnvelope(): EventEnvelope {
    return new EventEnvelope(this, this.metadata);
  }
}

export class ProviderRemovedEvent implements IEvent {
  public readonly eventId: string;
  public readonly correlationId?: string;
  public readonly timestamp: string;
  public readonly source: string;
  public readonly category: 'domain' | 'integration' | 'application' | 'system';
  public readonly priority: 'low' | 'normal' | 'high' | 'critical';
  public readonly version: number;
  public readonly tags: readonly string[];
  public readonly eventType: string;
  public readonly payload: { readonly providerId: string };
  public readonly metadata: EventMetadata;

  public constructor(providerId: string, correlationId?: string) {
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
    this.metadata = EventMetadata.create({
      correlationId,
      source: this.source,
      category: this.category,
      priority: this.priority,
      tags: this.tags,
    });
  }

  public toEnvelope(): EventEnvelope {
    return new EventEnvelope(this, this.metadata);
  }
}

export class ProviderHealthyEvent implements IEvent {
  public readonly eventId: string;
  public readonly correlationId?: string;
  public readonly timestamp: string;
  public readonly source: string;
  public readonly category: 'domain' | 'integration' | 'application' | 'system';
  public readonly priority: 'low' | 'normal' | 'high' | 'critical';
  public readonly version: number;
  public readonly tags: readonly string[];
  public readonly eventType: string;
  public readonly payload: { readonly provider: IAIProvider };
  public readonly metadata: EventMetadata;

  public constructor(provider: IAIProvider, correlationId?: string) {
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
    this.metadata = EventMetadata.create({
      correlationId,
      source: this.source,
      category: this.category,
      priority: this.priority,
      tags: this.tags,
    });
  }

  public toEnvelope(): EventEnvelope {
    return new EventEnvelope(this, this.metadata);
  }
}

export class ProviderUnhealthyEvent implements IEvent {
  public readonly eventId: string;
  public readonly correlationId?: string;
  public readonly timestamp: string;
  public readonly source: string;
  public readonly category: 'domain' | 'integration' | 'application' | 'system';
  public readonly priority: 'low' | 'normal' | 'high' | 'critical';
  public readonly version: number;
  public readonly tags: readonly string[];
  public readonly eventType: string;
  public readonly payload: { readonly provider: IAIProvider };
  public readonly metadata: EventMetadata;

  public constructor(provider: IAIProvider, correlationId?: string) {
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
    this.metadata = EventMetadata.create({
      correlationId,
      source: this.source,
      category: this.category,
      priority: this.priority,
      tags: this.tags,
    });
  }

  public toEnvelope(): EventEnvelope {
    return new EventEnvelope(this, this.metadata);
  }
}

export class ModelRegisteredEvent implements IEvent {
  public readonly eventId: string;
  public readonly correlationId?: string;
  public readonly timestamp: string;
  public readonly source: string;
  public readonly category: 'domain' | 'integration' | 'application' | 'system';
  public readonly priority: 'low' | 'normal' | 'high' | 'critical';
  public readonly version: number;
  public readonly tags: readonly string[];
  public readonly eventType: string;
  public readonly payload: { readonly model: IAIModel };
  public readonly metadata: EventMetadata;

  public constructor(model: IAIModel, correlationId?: string) {
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
    this.metadata = EventMetadata.create({
      correlationId,
      source: this.source,
      category: this.category,
      priority: this.priority,
      tags: this.tags,
    });
  }

  public toEnvelope(): EventEnvelope {
    return new EventEnvelope(this, this.metadata);
  }
}

export class GatewayInitializedEvent implements IEvent {
  public readonly eventId: string;
  public readonly correlationId?: string;
  public readonly timestamp: string;
  public readonly source: string;
  public readonly category: 'domain' | 'integration' | 'application' | 'system';
  public readonly priority: 'low' | 'normal' | 'high' | 'critical';
  public readonly version: number;
  public readonly tags: readonly string[];
  public readonly eventType: string;
  public readonly payload: { readonly gateway: AIGateway };
  public readonly metadata: EventMetadata;

  public constructor(gateway: AIGateway, correlationId?: string) {
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
    this.metadata = EventMetadata.create({
      correlationId,
      source: this.source,
      category: this.category,
      priority: this.priority,
      tags: this.tags,
    });
  }

  public toEnvelope(): EventEnvelope {
    return new EventEnvelope(this, this.metadata);
  }
}

export class GatewayShutdownEvent implements IEvent {
  public readonly eventId: string;
  public readonly correlationId?: string;
  public readonly timestamp: string;
  public readonly source: string;
  public readonly category: 'domain' | 'integration' | 'application' | 'system';
  public readonly priority: 'low' | 'normal' | 'high' | 'critical';
  public readonly version: number;
  public readonly tags: readonly string[];
  public readonly eventType: string;
  public readonly payload: { readonly gateway: AIGateway };
  public readonly metadata: EventMetadata;

  public constructor(gateway: AIGateway, correlationId?: string) {
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
    this.metadata = EventMetadata.create({
      correlationId,
      source: this.source,
      category: this.category,
      priority: this.priority,
      tags: this.tags,
    });
  }

  public toEnvelope(): EventEnvelope {
    return new EventEnvelope(this, this.metadata);
  }
}
