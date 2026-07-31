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
export declare class AIGatewayException extends Error {
  constructor(message: string);
}
export declare class AIProviderException extends AIGatewayException {
  constructor(message: string);
}
export declare class AIModelException extends AIGatewayException {
  constructor(message: string);
}
export declare class AIExecutionException extends AIGatewayException {
  constructor(message: string);
}
export declare class AIRegistryException extends AIGatewayException {
  constructor(message: string);
}
export declare class AIProviderDescriptor {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly capabilities: readonly AIProviderCapabilities[];
  readonly metadata?: SerializableValueObject;
  constructor(options: {
    readonly id: string;
    readonly name: string;
    readonly version: string;
    readonly capabilities: readonly AIProviderCapabilities[];
    readonly metadata?: SerializableValueObject;
  });
}
export declare class AIProviderCapabilities {
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
  constructor(options: {
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
  });
}
export declare class AIModelCapability {
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
  constructor(options: {
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
  });
}
export declare class AIModelCapabilities {
  readonly contextLength?: number;
  readonly supportsStreaming?: boolean;
  readonly supportsVision?: boolean;
  readonly supportsFunctionCalling?: boolean;
  readonly supportsStructuredOutput?: boolean;
  readonly supportsReasoning?: boolean;
  readonly supportsEmbeddings?: boolean;
  readonly supportsImageGeneration?: boolean;
  readonly supportsAudio?: boolean;
  constructor(options: {
    readonly contextLength?: number;
    readonly supportsStreaming?: boolean;
    readonly supportsVision?: boolean;
    readonly supportsFunctionCalling?: boolean;
    readonly supportsStructuredOutput?: boolean;
    readonly supportsReasoning?: boolean;
    readonly supportsEmbeddings?: boolean;
    readonly supportsImageGeneration?: boolean;
    readonly supportsAudio?: boolean;
  });
}
export declare class AIModelConstraints {
  readonly maxContextTokens?: number;
  readonly maxOutputTokens?: number;
  readonly maxInputTokens?: number;
  constructor(options: {
    readonly maxContextTokens?: number;
    readonly maxOutputTokens?: number;
    readonly maxInputTokens?: number;
  });
}
export declare class AIModelRequirements {
  readonly supportsStreaming?: boolean;
  readonly supportsVision?: boolean;
  readonly supportsFunctionCalling?: boolean;
  readonly supportsStructuredOutput?: boolean;
  readonly supportsReasoning?: boolean;
  readonly supportsEmbeddings?: boolean;
  readonly supportsImageGeneration?: boolean;
  readonly supportsAudio?: boolean;
  constructor(options: {
    readonly supportsStreaming?: boolean;
    readonly supportsVision?: boolean;
    readonly supportsFunctionCalling?: boolean;
    readonly supportsStructuredOutput?: boolean;
    readonly supportsReasoning?: boolean;
    readonly supportsEmbeddings?: boolean;
    readonly supportsImageGeneration?: boolean;
    readonly supportsAudio?: boolean;
  });
}
export declare class AIModelVersion {
  readonly value: string;
  constructor(value: string);
  toString(): string;
}
export declare class AIModelFilter {
  readonly capability?: string;
  readonly status?: string;
  readonly providerId?: string;
  readonly contextTokens?: number;
  readonly includeDeprecated?: boolean;
  constructor(options?: {
    readonly capability?: string;
    readonly status?: string;
    readonly providerId?: string;
    readonly contextTokens?: number;
    readonly includeDeprecated?: boolean;
  });
}
export declare class AIModelQuery {
  readonly filter?: AIModelFilter;
  readonly limit?: number;
  constructor(options?: { readonly filter?: AIModelFilter; readonly limit?: number });
}
export declare class AIModelDescriptor implements IAIModel {
  readonly id: string;
  readonly providerId: string;
  readonly family: string;
  readonly name: string;
  readonly version: string;
  readonly status: string;
  readonly deprecated: boolean;
  readonly capabilities: readonly AIModelCapability[];
  readonly constraints?: AIModelConstraints;
  readonly requirements?: AIModelRequirements;
  readonly aliases: readonly string[];
  readonly metadata?: SerializableValueObject;
  constructor(options: {
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
  });
  private normalizeCapabilities;
}
export declare class AIModelSnapshot {
  readonly generatedAt: string;
  readonly models: readonly AIModelDescriptor[];
  constructor(models: readonly IAIModel[]);
}
export declare class AIModel implements IAIModel {
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
  constructor(options: {
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
  });
  private normalizeCapabilities;
}
export declare class AIExecutionOptions {
  readonly stream: boolean;
  readonly timeoutMs?: number;
  readonly metadata?: SerializableValueObject;
  constructor(options?: {
    readonly stream?: boolean;
    readonly timeoutMs?: number;
    readonly metadata?: SerializableValueObject;
  });
}
export declare class AIExecutionRequest implements IAIExecutionRequest {
  readonly id: string;
  readonly providerId: string;
  readonly modelId?: string;
  readonly input: string;
  readonly operation: AICapabilityKind;
  readonly options?: AIExecutionOptions;
  readonly metadata?: SerializableValueObject;
  constructor(options: {
    readonly id: string;
    readonly providerId: string;
    readonly modelId?: string;
    readonly input: string;
    readonly operation: AICapabilityKind;
    readonly options?: AIExecutionOptions;
    readonly metadata?: SerializableValueObject;
  });
}
export declare class AIExecutionResponse implements IAIExecutionResponse {
  readonly id: string;
  readonly providerId: string;
  readonly modelId?: string;
  readonly status: 'success' | 'error';
  readonly output?: SerializableValueObject;
  readonly error?: string;
  readonly metadata?: SerializableValueObject;
  constructor(options: {
    readonly id: string;
    readonly providerId: string;
    readonly modelId?: string;
    readonly status: 'success' | 'error';
    readonly output?: SerializableValueObject;
    readonly error?: string;
    readonly metadata?: SerializableValueObject;
  });
}
export declare class AIExecutionContext implements IAIExecutionContext {
  readonly request: AIExecutionRequest;
  readonly provider: AIProvider;
  readonly startedAt: TimestampString;
  readonly completedAt?: TimestampString;
  readonly latencyMs?: number;
  constructor(options: {
    readonly request: AIExecutionRequest;
    readonly provider: AIProvider;
    readonly startedAt: TimestampString;
    readonly completedAt?: TimestampString;
    readonly latencyMs?: number;
  });
}
export declare class AIProviderHealth {
  readonly providerId: string;
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly availability: number;
  readonly latencyMs: number;
  readonly successRate: number;
  readonly failureRate: number;
  readonly lastHealthCheck: TimestampString;
  readonly metadata?: SerializableValueObject;
  constructor(options: {
    readonly providerId: string;
    readonly status: 'healthy' | 'degraded' | 'unhealthy';
    readonly availability?: number;
    readonly latencyMs?: number;
    readonly successRate?: number;
    readonly failureRate?: number;
    readonly lastHealthCheck?: TimestampString;
    readonly metadata?: SerializableValueObject;
  });
}
export declare class AIProviderStatistics {
  readonly requestCount: number;
  readonly responseCount: number;
  readonly latencyMs: number;
  readonly providerUsage: Readonly<Record<string, number>>;
  readonly modelUsage: Readonly<Record<string, number>>;
  readonly capabilityUsage: Readonly<Record<string, number>>;
  readonly errorRate: number;
  readonly initializationTimeMs: number;
  constructor(options?: {
    readonly requestCount?: number;
    readonly responseCount?: number;
    readonly latencyMs?: number;
    readonly providerUsage?: Readonly<Record<string, number>>;
    readonly modelUsage?: Readonly<Record<string, number>>;
    readonly capabilityUsage?: Readonly<Record<string, number>>;
    readonly errorRate?: number;
    readonly initializationTimeMs?: number;
  });
}
export declare class AIProviderFactory implements IAIProviderFactory {
  private readonly factory;
  constructor(factory: (descriptor: AIProviderDescriptor) => IAIProvider);
  create(descriptor: AIProviderDescriptor): IAIProvider;
}
export declare class AIProviderRegistry implements IAIProviderRegistry {
  private readonly providers;
  register(provider: IAIProvider): Promise<void>;
  unregister(providerId: string): Promise<void>;
  get(providerId: string): IAIProvider | undefined;
  list(): readonly IAIProvider[];
}
export declare class AIModelRegistry implements IAIModelRegistry {
  private readonly models;
  private readonly aliases;
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
  private normalizeModel;
  private normalizeCapabilities;
  private indexAliases;
  private compareVersions;
}
export declare abstract class AIProvider implements IAIProvider {
  readonly descriptor: AIProviderDescriptor;
  private _initialized;
  constructor(descriptor: AIProviderDescriptor);
  initialize(): Promise<void>;
  validate(): Promise<void>;
  healthCheck(): Promise<AIProviderHealth>;
  abstract execute(request: IAIExecutionRequest): Promise<IAIExecutionResponse>;
  abstract stream(request: IAIExecutionRequest): Promise<IAIExecutionResponse>;
  shutdown(): Promise<void>;
  discoverCapabilities(): Promise<readonly AIProviderCapabilities[]>;
  discoverModels(): Promise<readonly IAIModel[]>;
  estimateTokens(request: IAIExecutionRequest): Promise<number>;
  estimateCost(request: IAIExecutionRequest): Promise<number>;
}
export declare class AIGateway implements IAIGateway {
  readonly providerRegistry: IAIProviderRegistry;
  readonly modelRegistry: IAIModelRegistry;
  private readonly eventBus?;
  private readonly statisticsState;
  private initialized;
  constructor(options?: {
    readonly providerRegistry?: IAIProviderRegistry;
    readonly modelRegistry?: IAIModelRegistry;
    readonly eventBus?: IEventBus;
  });
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  registerProvider(provider: IAIProvider): Promise<void>;
  unregisterProvider(providerId: string): Promise<void>;
  execute(request: IAIExecutionRequest): Promise<IAIExecutionResponse>;
  stream(request: IAIExecutionRequest): Promise<IAIExecutionResponse>;
  discoverCapabilities(providerId: string): Promise<readonly AIProviderCapabilities[]>;
  healthCheck(providerId: string): Promise<AIProviderHealth>;
  statistics(): AIProviderStatistics;
  private recordUsage;
  private recordError;
  private publishEvent;
}
export declare class ProviderRegisteredEvent implements IEvent {
  readonly eventId: string;
  readonly correlationId?: string;
  readonly timestamp: string;
  readonly source: string;
  readonly category: 'domain' | 'integration' | 'application' | 'system';
  readonly priority: 'low' | 'normal' | 'high' | 'critical';
  readonly version: number;
  readonly tags: readonly string[];
  readonly eventType: string;
  readonly payload: {
    readonly provider: IAIProvider;
  };
  readonly metadata: EventMetadata;
  constructor(provider: IAIProvider, correlationId?: string);
  toEnvelope(): EventEnvelope;
}
export declare class ProviderRemovedEvent implements IEvent {
  readonly eventId: string;
  readonly correlationId?: string;
  readonly timestamp: string;
  readonly source: string;
  readonly category: 'domain' | 'integration' | 'application' | 'system';
  readonly priority: 'low' | 'normal' | 'high' | 'critical';
  readonly version: number;
  readonly tags: readonly string[];
  readonly eventType: string;
  readonly payload: {
    readonly providerId: string;
  };
  readonly metadata: EventMetadata;
  constructor(providerId: string, correlationId?: string);
  toEnvelope(): EventEnvelope;
}
export declare class ProviderHealthyEvent implements IEvent {
  readonly eventId: string;
  readonly correlationId?: string;
  readonly timestamp: string;
  readonly source: string;
  readonly category: 'domain' | 'integration' | 'application' | 'system';
  readonly priority: 'low' | 'normal' | 'high' | 'critical';
  readonly version: number;
  readonly tags: readonly string[];
  readonly eventType: string;
  readonly payload: {
    readonly provider: IAIProvider;
  };
  readonly metadata: EventMetadata;
  constructor(provider: IAIProvider, correlationId?: string);
  toEnvelope(): EventEnvelope;
}
export declare class ProviderUnhealthyEvent implements IEvent {
  readonly eventId: string;
  readonly correlationId?: string;
  readonly timestamp: string;
  readonly source: string;
  readonly category: 'domain' | 'integration' | 'application' | 'system';
  readonly priority: 'low' | 'normal' | 'high' | 'critical';
  readonly version: number;
  readonly tags: readonly string[];
  readonly eventType: string;
  readonly payload: {
    readonly provider: IAIProvider;
  };
  readonly metadata: EventMetadata;
  constructor(provider: IAIProvider, correlationId?: string);
  toEnvelope(): EventEnvelope;
}
export declare class ModelRegisteredEvent implements IEvent {
  readonly eventId: string;
  readonly correlationId?: string;
  readonly timestamp: string;
  readonly source: string;
  readonly category: 'domain' | 'integration' | 'application' | 'system';
  readonly priority: 'low' | 'normal' | 'high' | 'critical';
  readonly version: number;
  readonly tags: readonly string[];
  readonly eventType: string;
  readonly payload: {
    readonly model: IAIModel;
  };
  readonly metadata: EventMetadata;
  constructor(model: IAIModel, correlationId?: string);
  toEnvelope(): EventEnvelope;
}
export declare class GatewayInitializedEvent implements IEvent {
  readonly eventId: string;
  readonly correlationId?: string;
  readonly timestamp: string;
  readonly source: string;
  readonly category: 'domain' | 'integration' | 'application' | 'system';
  readonly priority: 'low' | 'normal' | 'high' | 'critical';
  readonly version: number;
  readonly tags: readonly string[];
  readonly eventType: string;
  readonly payload: {
    readonly gateway: AIGateway;
  };
  readonly metadata: EventMetadata;
  constructor(gateway: AIGateway, correlationId?: string);
  toEnvelope(): EventEnvelope;
}
export declare class GatewayShutdownEvent implements IEvent {
  readonly eventId: string;
  readonly correlationId?: string;
  readonly timestamp: string;
  readonly source: string;
  readonly category: 'domain' | 'integration' | 'application' | 'system';
  readonly priority: 'low' | 'normal' | 'high' | 'critical';
  readonly version: number;
  readonly tags: readonly string[];
  readonly eventType: string;
  readonly payload: {
    readonly gateway: AIGateway;
  };
  readonly metadata: EventMetadata;
  constructor(gateway: AIGateway, correlationId?: string);
  toEnvelope(): EventEnvelope;
}
//# sourceMappingURL=ai-gateway.d.ts.map
