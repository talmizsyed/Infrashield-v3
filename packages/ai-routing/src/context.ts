import type { SerializableValueObject } from '@infrashield/contracts';

/**
 * Routing input describing what a request needs from the AI Gateway.
 *
 * Applications never choose a provider or model directly - they describe
 * their requirement through an {@link AIRoutingContext} and let the
 * {@link AIRouter} pick the best candidate.
 */
export class AIRoutingContext {
  /** Correlates this routing decision with the originating request. */
  public readonly requestId: string;
  public readonly input?: string;

  /** A capability that MUST be supported by the selected provider and model (hard filter). */
  public readonly requiredCapability?: string;
  /** A capability that is preferred but not mandatory (soft scoring boost). */
  public readonly preferredCapability?: string;

  /** Feature requirements, matched against provider/model capability flags. */
  public readonly reasoning?: boolean;
  public readonly vision?: boolean;
  public readonly streaming?: boolean;
  public readonly toolCalling?: boolean;
  public readonly embeddings?: boolean;
  public readonly structuredOutput?: boolean;

  /** Hard constraints. */
  public readonly maxLatencyMs?: number;
  public readonly maxCost?: number;
  public readonly minContextTokens?: number;

  /** Tenancy, compliance and topology dimensions. */
  public readonly tenantId?: string;
  public readonly classification?: string;
  public readonly region?: string;
  public readonly environment?: string;

  public readonly preferredProviders?: readonly string[];
  public readonly preferredModelFamily?: string;
  public readonly metadata?: SerializableValueObject;

  public constructor(options: {
    readonly requestId: string;
    readonly input?: string;
    readonly requiredCapability?: string;
    readonly preferredCapability?: string;
    readonly reasoning?: boolean;
    readonly vision?: boolean;
    readonly streaming?: boolean;
    readonly toolCalling?: boolean;
    readonly embeddings?: boolean;
    readonly structuredOutput?: boolean;
    readonly maxLatencyMs?: number;
    readonly maxCost?: number;
    readonly minContextTokens?: number;
    readonly tenantId?: string;
    readonly classification?: string;
    readonly region?: string;
    readonly environment?: string;
    readonly preferredProviders?: readonly string[];
    readonly preferredModelFamily?: string;
    readonly metadata?: SerializableValueObject;
  }) {
    this.requestId = options.requestId.trim();
    this.input = options.input;
    this.requiredCapability = options.requiredCapability?.trim();
    this.preferredCapability = options.preferredCapability?.trim();
    this.reasoning = options.reasoning;
    this.vision = options.vision;
    this.streaming = options.streaming;
    this.toolCalling = options.toolCalling;
    this.embeddings = options.embeddings;
    this.structuredOutput = options.structuredOutput;
    this.maxLatencyMs = options.maxLatencyMs;
    this.maxCost = options.maxCost;
    this.minContextTokens = options.minContextTokens;
    this.tenantId = options.tenantId?.trim();
    this.classification = options.classification?.trim();
    this.region = options.region?.trim();
    this.environment = options.environment?.trim();
    this.preferredProviders = options.preferredProviders
      ? Object.freeze([...options.preferredProviders])
      : undefined;
    this.preferredModelFamily = options.preferredModelFamily?.trim();
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
    Object.freeze(this);
  }
}
