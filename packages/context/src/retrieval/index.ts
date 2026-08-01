import type { Identifier, SerializableValueObject, TimestampString } from '@infrashield/contracts';

export type ContextSourceType =
  | 'working'
  | 'conversation'
  | 'session'
  | 'execution'
  | 'semantic'
  | 'graph'
  | 'workflow'
  | 'planning'
  | 'reflection'
  | 'governance'
  | 'runtime'
  | 'custom';

export class ContextEvidence {
  public constructor(options: {
    readonly source: string;
    readonly confidence?: number;
    readonly detail?: string;
    readonly metadata?: SerializableValueObject;
  }) {
    this.source = options.source;
    this.confidence = options.confidence ?? 1;
    this.detail = options.detail;
    this.metadata = options.metadata ?? {};
  }

  public readonly source: string;
  public readonly confidence: number;
  public readonly detail?: string;
  public readonly metadata: SerializableValueObject;
}

export class ContextReference {
  public constructor(options: {
    readonly id: Identifier;
    readonly source?: string;
    readonly kind?: string;
  }) {
    this.id = options.id;
    this.source = options.source;
    this.kind = options.kind;
  }

  public readonly id: Identifier;
  public readonly source?: string;
  public readonly kind?: string;
}

export class ContextCitation {
  public constructor(options: { readonly reference: ContextReference; readonly excerpt?: string }) {
    this.reference = options.reference;
    this.excerpt = options.excerpt;
  }

  public readonly reference: ContextReference;
  public readonly excerpt?: string;
}

export class ContextChunk {
  public constructor(options: {
    readonly id: Identifier;
    readonly content: string;
    readonly source: ContextSourceType;
    readonly tenantId?: Identifier;
    readonly securityLabels?: readonly string[];
    readonly relevance?: number;
    readonly recency?: number;
    readonly confidence?: number;
    readonly importance?: number;
    readonly metadata?: SerializableValueObject;
    readonly evidence?: readonly ContextEvidence[];
    readonly citations?: readonly ContextCitation[];
    readonly createdAt?: TimestampString;
  }) {
    this.id = options.id;
    this.content = options.content;
    this.source = options.source;
    this.tenantId = options.tenantId;
    this.securityLabels = [...(options.securityLabels ?? [])];
    this.relevance = options.relevance ?? 0;
    this.recency = options.recency ?? 0;
    this.confidence = options.confidence ?? 0;
    this.importance = options.importance ?? 0;
    this.metadata = options.metadata ?? {};
    this.evidence = [...(options.evidence ?? [])];
    this.citations = [...(options.citations ?? [])];
    this.createdAt = options.createdAt ?? new Date().toISOString();
  }

  public readonly id: Identifier;
  public readonly content: string;
  public readonly source: ContextSourceType;
  public readonly tenantId?: Identifier;
  public readonly securityLabels: readonly string[];
  public readonly relevance: number;
  public readonly recency: number;
  public readonly confidence: number;
  public readonly importance: number;
  public readonly metadata: SerializableValueObject;
  public readonly evidence: readonly ContextEvidence[];
  public readonly citations: readonly ContextCitation[];
  public readonly createdAt: TimestampString;
}

export class ContextRankingPolicy {
  public constructor(
    options: { readonly maxResults?: number; readonly minimumScore?: number } = {},
  ) {
    this.maxResults = options.maxResults ?? 10;
    this.minimumScore = options.minimumScore ?? 0;
  }

  public readonly maxResults: number;
  public readonly minimumScore: number;
}

export class ContextWindow {
  public constructor(
    options: { readonly maxTokens?: number; readonly maxCharacters?: number } = {},
  ) {
    this.maxTokens = options.maxTokens ?? 512;
    this.maxCharacters = options.maxCharacters ?? 4096;
  }

  public readonly maxTokens: number;
  public readonly maxCharacters: number;
}

export class ContextBudget {
  public constructor(
    options: { readonly maxTokens?: number; readonly maxCharacters?: number } = {},
  ) {
    this.maxTokens = options.maxTokens ?? 512;
    this.maxCharacters = options.maxCharacters ?? 4096;
  }

  public readonly maxTokens: number;
  public readonly maxCharacters: number;

  public enforce(chunks: readonly ContextChunk[], window: ContextWindow): readonly ContextChunk[] {
    const withinCharacters = chunks.filter((chunk) => chunk.content.length <= window.maxCharacters);
    return withinCharacters.slice(0, Math.max(1, Math.floor(this.maxTokens / 8)));
  }
}

export class ContextCompression {
  public compress(chunks: readonly ContextChunk[]): readonly ContextChunk[] {
    return chunks.map((chunk) => new ContextChunk({ ...chunk, content: chunk.content.trim() }));
  }
}

export class ContextDeduplication {
  public deduplicate(chunks: readonly ContextChunk[]): readonly ContextChunk[] {
    const seen = new Set<string>();
    return chunks.filter((chunk) => {
      const key = `${chunk.id}:${chunk.content}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}

export class ContextFiltering {
  public filter(
    chunks: readonly ContextChunk[],
    options: { readonly tenantId?: Identifier; readonly securityLabels?: readonly string[] } = {},
  ): readonly ContextChunk[] {
    return chunks.filter((chunk) => {
      if (options.tenantId && chunk.tenantId && options.tenantId !== chunk.tenantId) {
        return false;
      }
      if (options.securityLabels && options.securityLabels.length > 0) {
        return chunk.securityLabels.some((label) => options.securityLabels?.includes(label));
      }
      return true;
    });
  }
}

export class ContextScoring {
  public score(chunk: ContextChunk): number {
    return (
      chunk.relevance * 0.4 + chunk.recency * 0.2 + chunk.confidence * 0.2 + chunk.importance * 0.2
    );
  }
}

export class ContextRanking {
  public constructor(options: { readonly policy?: ContextRankingPolicy } = {}) {
    this.policy = options.policy ?? new ContextRankingPolicy();
  }

  public readonly policy: ContextRankingPolicy;

  public rank(chunks: readonly ContextChunk[]): readonly ContextChunk[] {
    const ranked = [...chunks].sort((left, right) => {
      const leftScore = new ContextScoring().score(left);
      const rightScore = new ContextScoring().score(right);
      return rightScore - leftScore;
    });

    return ranked
      .filter((chunk) => chunk.relevance >= this.policy.minimumScore)
      .slice(0, this.policy.maxResults);
  }
}

export class ContextPolicy {
  public constructor(
    options: { readonly maxTokens?: number; readonly maxCharacters?: number } = {},
  ) {
    this.maxTokens = options.maxTokens ?? 512;
    this.maxCharacters = options.maxCharacters ?? 4096;
  }

  public readonly maxTokens: number;
  public readonly maxCharacters: number;
}

export class ContextMetrics {
  public constructor(
    options: {
      readonly retrievalLatencyMs?: number;
      readonly compressionRatio?: number;
      readonly rankingLatencyMs?: number;
      readonly size?: number;
      readonly budgetUtilization?: number;
      readonly sourceUtilization?: number;
    } = {},
  ) {
    this.retrievalLatencyMs = options.retrievalLatencyMs ?? 0;
    this.compressionRatio = options.compressionRatio ?? 0;
    this.rankingLatencyMs = options.rankingLatencyMs ?? 0;
    this.size = options.size ?? 0;
    this.budgetUtilization = options.budgetUtilization ?? 0;
    this.sourceUtilization = options.sourceUtilization ?? 0;
  }

  public retrievalLatencyMs: number;
  public compressionRatio: number;
  public rankingLatencyMs: number;
  public size: number;
  public budgetUtilization: number;
  public sourceUtilization: number;
}

export class ContextStatistics {
  public constructor(
    options: { readonly packages?: number; readonly size?: number; readonly sources?: number } = {},
  ) {
    this.packages = options.packages ?? 0;
    this.size = options.size ?? 0;
    this.sources = options.sources ?? 0;
  }

  public readonly packages: number;
  public readonly size: number;
  public readonly sources: number;
}

export class ContextSnapshot {
  public constructor(options: {
    readonly name: string;
    readonly size: number;
    readonly sources: number;
    readonly createdAt?: TimestampString;
  }) {
    this.name = options.name;
    this.size = options.size;
    this.sources = options.sources;
    this.createdAt = options.createdAt ?? new Date().toISOString();
  }

  public readonly name: string;
  public readonly size: number;
  public readonly sources: number;
  public readonly createdAt: TimestampString;
}

export class ContextAudit {
  public constructor(options: {
    readonly event: string;
    readonly details?: SerializableValueObject;
    readonly timestamp?: TimestampString;
  }) {
    this.event = options.event;
    this.details = options.details ?? {};
    this.timestamp = options.timestamp ?? new Date().toISOString();
  }

  public readonly event: string;
  public readonly details: SerializableValueObject;
  public readonly timestamp: TimestampString;
}

export class ContextPackage {
  public constructor(options: {
    readonly id: Identifier;
    readonly items: readonly ContextChunk[];
    readonly size: number;
    readonly createdAt?: TimestampString;
    readonly metadata?: SerializableValueObject;
  }) {
    this.id = options.id;
    this.items = [...options.items];
    this.size = options.size;
    this.createdAt = options.createdAt ?? new Date().toISOString();
    this.metadata = options.metadata ?? {};
  }

  public readonly id: Identifier;
  public readonly items: readonly ContextChunk[];
  public readonly size: number;
  public readonly createdAt: TimestampString;
  public readonly metadata: SerializableValueObject;
}

export interface IContextOrchestrator {
  orchestrate(request: ContextOrchestrationRequest): Promise<ContextOrchestrationResult>;
}

export interface IContextAssembler {
  assemble(chunks: readonly ContextChunk[]): Promise<readonly ContextChunk[]>;
}

export interface IContextResolver {
  resolve(request: ContextOrchestrationRequest): Promise<readonly ContextChunk[]>;
}

export interface IContextSelector {
  select(chunks: readonly ContextChunk[]): readonly ContextChunk[];
}

export interface IContextRanking {
  rank(chunks: readonly ContextChunk[]): readonly ContextChunk[];
}

export interface IContextCompression {
  compress(chunks: readonly ContextChunk[]): readonly ContextChunk[];
}

export interface ContextOrchestrationRequest {
  readonly requestId: Identifier;
  readonly tenantId?: Identifier;
  readonly sources?: readonly ContextSourceInput[];
}

export interface ContextSourceInput {
  readonly id: Identifier;
  readonly source: ContextSourceType;
  readonly content: string;
  readonly relevance?: number;
  readonly recency?: number;
  readonly confidence?: number;
  readonly importance?: number;
  readonly tenantId?: Identifier;
  readonly securityLabels?: readonly string[];
  readonly metadata?: SerializableValueObject;
}

export interface ContextOrchestrationResult {
  readonly package: ContextPackage;
  readonly metrics: ContextMetrics;
  readonly snapshot: ContextSnapshot;
}

export class ContextResolver implements IContextResolver {
  public async resolve(request: ContextOrchestrationRequest): Promise<readonly ContextChunk[]> {
    return (request.sources ?? []).map(
      (source) =>
        new ContextChunk({
          id: source.id,
          content: source.content,
          source: source.source,
          tenantId: source.tenantId,
          securityLabels: source.securityLabels,
          relevance: source.relevance ?? 0,
          recency: source.recency ?? 0,
          confidence: source.confidence ?? 0,
          importance: source.importance ?? 0,
          metadata: source.metadata ?? {},
        }),
    );
  }
}

export class ContextAssembler implements IContextAssembler {
  public async assemble(chunks: readonly ContextChunk[]): Promise<readonly ContextChunk[]> {
    return [...chunks];
  }
}

export class ContextBuilder {
  public build(chunks: readonly ContextChunk[]): ContextPackage {
    const size = chunks.reduce((sum, chunk) => sum + chunk.content.length, 0);
    return new ContextPackage({
      id: `context-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      items: chunks,
      size,
    });
  }
}

export class ContextSelector implements IContextSelector {
  public select(chunks: readonly ContextChunk[]): readonly ContextChunk[] {
    return [...chunks];
  }
}

export class ContextOrchestrator implements IContextOrchestrator {
  public constructor(
    options: {
      readonly policy?: ContextPolicy;
      readonly resolver?: ContextResolver;
      readonly assembler?: ContextAssembler;
      readonly ranking?: ContextRanking;
      readonly compression?: ContextCompression;
      readonly deduplication?: ContextDeduplication;
      readonly filtering?: ContextFiltering;
      readonly selector?: ContextSelector;
      readonly builder?: ContextBuilder;
    } = {},
  ) {
    this.policy = options.policy ?? new ContextPolicy();
    this.resolver = options.resolver ?? new ContextResolver();
    this.assembler = options.assembler ?? new ContextAssembler();
    this.ranking = options.ranking ?? new ContextRanking();
    this.compression = options.compression ?? new ContextCompression();
    this.deduplication = options.deduplication ?? new ContextDeduplication();
    this.filtering = options.filtering ?? new ContextFiltering();
    this.selector = options.selector ?? new ContextSelector();
    this.builder = options.builder ?? new ContextBuilder();
  }

  public readonly policy: ContextPolicy;
  public readonly resolver: ContextResolver;
  public readonly assembler: ContextAssembler;
  public readonly ranking: ContextRanking;
  public readonly compression: ContextCompression;
  public readonly deduplication: ContextDeduplication;
  public readonly filtering: ContextFiltering;
  public readonly selector: ContextSelector;
  public readonly builder: ContextBuilder;
  private readonly snapshots: ContextSnapshot[] = [];
  private readonly metrics: ContextMetrics = new ContextMetrics();

  public async orchestrate(
    request: ContextOrchestrationRequest,
  ): Promise<ContextOrchestrationResult> {
    const resolved = await this.resolver.resolve(request);
    const assembled = await this.assembler.assemble(resolved);
    const selected = this.selector.select(assembled);
    const ranked = this.ranking.rank(selected);
    const filtered = this.filtering.filter(ranked, {
      tenantId: request.tenantId,
      securityLabels: ['restricted'],
    });
    const deduped = this.deduplication.deduplicate(filtered);
    const compressed = this.compression.compress(deduped);
    const budgeted = new ContextBudget({
      maxTokens: this.policy.maxTokens,
      maxCharacters: this.policy.maxCharacters,
    }).enforce(
      compressed,
      new ContextWindow({
        maxTokens: this.policy.maxTokens,
        maxCharacters: this.policy.maxCharacters,
      }),
    );
    const packageResult = this.builder.build(budgeted);

    this.metrics.retrievalLatencyMs += 1;
    const firstCompressed = compressed[0];
    this.metrics.compressionRatio = Math.max(
      this.metrics.compressionRatio,
      firstCompressed ? firstCompressed.content.length : 0,
    );
    this.metrics.size = packageResult.size;
    this.metrics.budgetUtilization = Math.min(
      1,
      packageResult.size / Math.max(this.policy.maxCharacters, 1),
    );
    this.metrics.sourceUtilization = budgeted.length;

    const snapshot = new ContextSnapshot({
      name: `snapshot-${this.snapshots.length + 1}`,
      size: packageResult.size,
      sources: packageResult.items.length,
    });

    this.snapshots.push(snapshot);
    return {
      package: packageResult,
      metrics: this.metrics,
      snapshot,
    };
  }

  public async snapshot(name: string): Promise<ContextSnapshot> {
    const snapshot = new ContextSnapshot({
      name,
      size: this.metrics.size,
      sources: this.metrics.sourceUtilization,
    });
    this.snapshots.push(snapshot);
    return snapshot;
  }

  public async getStatistics(): Promise<ContextStatistics> {
    return new ContextStatistics({
      packages: this.snapshots.length,
      size: this.metrics.size,
      sources: this.metrics.sourceUtilization,
    });
  }
}
