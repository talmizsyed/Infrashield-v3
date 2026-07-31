import type { IAIModel, IAIProvider } from './ai-core-compat';

/**
 * A single, explainable factor that contributed to (or against) a
 * candidate's score.
 */
export class AISelectionReason {
  public readonly code: string;
  public readonly message: string;
  public readonly scoreDelta: number;
  public readonly details?: Record<string, unknown>;

  public constructor(options: {
    readonly code: string;
    readonly message: string;
    readonly scoreDelta?: number;
    readonly details?: Record<string, unknown>;
  }) {
    this.code = options.code;
    this.message = options.message;
    this.scoreDelta = options.scoreDelta ?? 0;
    this.details = options.details ? Object.freeze({ ...options.details }) : undefined;
    Object.freeze(this);
  }
}

/**
 * A provider/model pairing considered during routing, along with its
 * estimated cost, latency, availability and deterministic score.
 *
 * Instances are immutable: the score is computed before construction so
 * candidates can be safely shared and re-ranked without risk of
 * concurrent mutation.
 */
export class AISelectionCandidate {
  public readonly provider: IAIProvider;
  public readonly providerId: string;
  public readonly model: IAIModel;
  public readonly modelId: string;
  public readonly estimatedLatencyMs: number;
  public readonly estimatedCost: number;
  public readonly availability: number;
  public readonly score: number;
  public readonly reasons: readonly AISelectionReason[];

  public constructor(options: {
    readonly provider: IAIProvider;
    readonly model: IAIModel;
    readonly estimatedLatencyMs: number;
    readonly estimatedCost: number;
    readonly availability: number;
    readonly score: number;
    readonly reasons: readonly AISelectionReason[];
  }) {
    this.provider = options.provider;
    this.providerId = options.provider.descriptor.id;
    this.model = options.model;
    this.modelId = options.model.id;
    this.estimatedLatencyMs = options.estimatedLatencyMs;
    this.estimatedCost = options.estimatedCost;
    this.availability = options.availability;
    this.score = options.score;
    this.reasons = Object.freeze([...options.reasons]);
    Object.freeze(this);
  }
}

/**
 * A candidate that was evaluated but excluded from selection, with the
 * reason why. `modelId` is omitted for provider-level rejections that were
 * never paired with a specific model (e.g. a denied or unhealthy provider).
 */
export class AIRejectedCandidate {
  public readonly providerId: string;
  public readonly modelId?: string;
  public readonly reason: AISelectionReason;

  public constructor(options: {
    readonly providerId: string;
    readonly modelId?: string;
    readonly reason: AISelectionReason;
  }) {
    this.providerId = options.providerId;
    this.modelId = options.modelId;
    this.reason = options.reason;
    Object.freeze(this);
  }
}
