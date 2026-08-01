import type { Identifier, SerializableValueObject, TimestampString } from '@infrashield/contracts';

export class SemanticEmbeddingMetadata {
  public constructor(
    options: {
      readonly provider?: string;
      readonly version?: string;
      readonly model?: string;
      readonly dimensions?: number;
      readonly batchSize?: number;
      readonly generatedAt?: TimestampString;
      readonly tenant?: string;
      readonly labels?: readonly string[];
      readonly metadata?: SerializableValueObject;
    } = {},
  ) {
    this.provider = options.provider ?? 'deterministic';
    this.version = options.version ?? '1.0.0';
    this.model = options.model ?? 'deterministic';
    this.dimensions = options.dimensions ?? 16;
    this.batchSize = options.batchSize ?? 1;
    this.generatedAt = options.generatedAt ?? new Date().toISOString();
    this.tenant = options.tenant;
    this.labels = [...(options.labels ?? [])];
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }

  public readonly provider: string;
  public readonly version: string;
  public readonly model: string;
  public readonly dimensions: number;
  public readonly batchSize: number;
  public readonly generatedAt: TimestampString;
  public readonly tenant?: string;
  public readonly labels: readonly string[];
  public readonly metadata?: Readonly<SerializableValueObject>;
}

export class SemanticEmbedding {
  public constructor(options: {
    readonly id: Identifier;
    readonly values: readonly number[];
    readonly metadata: SemanticEmbeddingMetadata;
  }) {
    this.id = options.id;
    this.values = Object.freeze([...options.values]);
    this.metadata = options.metadata;
  }

  public readonly id: Identifier;
  public readonly values: readonly number[];
  public readonly metadata: SemanticEmbeddingMetadata;
}

export class SemanticChunk {
  public constructor(options: {
    readonly id: Identifier;
    readonly content: string;
    readonly index: number;
    readonly documentId: Identifier;
    readonly metadata: SemanticChunkMetadata;
  }) {
    this.id = options.id;
    this.content = options.content;
    this.index = options.index;
    this.documentId = options.documentId;
    this.metadata = options.metadata;
  }

  public readonly id: Identifier;
  public readonly content: string;
  public readonly index: number;
  public readonly documentId: Identifier;
  public readonly metadata: SemanticChunkMetadata;
}

export class SemanticChunkMetadata {
  public constructor(
    options: {
      readonly labels?: readonly string[];
      readonly source?: string;
      readonly tenant?: string;
      readonly version?: string;
      readonly securityLabels?: readonly string[];
      readonly metadata?: SerializableValueObject;
    } = {},
  ) {
    this.labels = [...(options.labels ?? [])];
    this.source = options.source;
    this.tenant = options.tenant;
    this.version = options.version ?? '1.0.0';
    this.securityLabels = [...(options.securityLabels ?? [])];
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }

  public readonly labels: readonly string[];
  public readonly source?: string;
  public readonly tenant?: string;
  public readonly version: string;
  public readonly securityLabels: readonly string[];
  public readonly metadata?: Readonly<SerializableValueObject>;
}

export class SemanticDocument {
  public constructor(options: {
    readonly id: Identifier;
    readonly content: string;
    readonly tenant?: string;
    readonly source?: string;
    readonly labels?: readonly string[];
    readonly version?: string;
    readonly metadata?: SerializableValueObject;
    readonly securityLabels?: readonly string[];
  }) {
    this.id = options.id;
    this.content = options.content;
    this.tenant = options.tenant;
    this.source = options.source;
    this.labels = [...(options.labels ?? [])];
    this.version = options.version ?? '1.0.0';
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
    this.securityLabels = [...(options.securityLabels ?? [])];
  }

  public readonly id: Identifier;
  public readonly content: string;
  public readonly tenant?: string;
  public readonly source?: string;
  public readonly labels: readonly string[];
  public readonly version: string;
  public readonly metadata?: Readonly<SerializableValueObject>;
  public readonly securityLabels: readonly string[];
}

export class SemanticQuery {
  public constructor(options: {
    readonly text: string;
    readonly tenant?: string;
    readonly metadataFilter?: SerializableValueObject;
    readonly labels?: readonly string[];
    readonly securityLabels?: readonly string[];
  }) {
    this.text = options.text;
    this.tenant = options.tenant;
    this.metadataFilter = options.metadataFilter
      ? Object.freeze({ ...options.metadataFilter })
      : undefined;
    this.labels = [...(options.labels ?? [])];
    this.securityLabels = [...(options.securityLabels ?? [])];
  }

  public readonly text: string;
  public readonly tenant?: string;
  public readonly metadataFilter?: Readonly<SerializableValueObject>;
  public readonly labels: readonly string[];
  public readonly securityLabels: readonly string[];
}

export class SemanticSearchRequest {
  public constructor(options: {
    readonly query: SemanticQuery;
    readonly topK?: number;
    readonly threshold?: number;
    readonly includeMetadata?: boolean;
    readonly reRank?: boolean;
  }) {
    this.query = options.query;
    this.topK = options.topK ?? 5;
    this.threshold = options.threshold ?? 0.1;
    this.includeMetadata = options.includeMetadata ?? true;
    this.reRank = options.reRank ?? false;
  }

  public readonly query: SemanticQuery;
  public readonly topK: number;
  public readonly threshold: number;
  public readonly includeMetadata: boolean;
  public readonly reRank: boolean;
}

export class SemanticScore {
  public constructor(options: {
    readonly similarity: number;
    readonly rank: number;
    readonly reason?: string;
  }) {
    this.similarity = options.similarity;
    this.rank = options.rank;
    this.reason = options.reason ?? 'default';
  }

  public readonly similarity: number;
  public readonly rank: number;
  public readonly reason: string;
}

export class SemanticSearchResultEntry {
  public constructor(options: {
    readonly document: SemanticDocument;
    readonly chunk: SemanticChunk;
    readonly score: SemanticScore;
  }) {
    this.document = options.document;
    this.chunk = options.chunk;
    this.score = options.score;
  }

  public readonly document: SemanticDocument;
  public readonly chunk: SemanticChunk;
  public readonly score: SemanticScore;
}

export class SemanticSearchResult {
  public constructor(options: {
    readonly results: readonly SemanticSearchResultEntry[];
    readonly tookMs: number;
    readonly query: SemanticQuery;
    readonly threshold: number;
  }) {
    this.results = Object.freeze([...options.results]);
    this.tookMs = options.tookMs;
    this.query = options.query;
    this.threshold = options.threshold;
  }

  public readonly results: readonly SemanticSearchResultEntry[];
  public readonly tookMs: number;
  public readonly query: SemanticQuery;
  public readonly threshold: number;
}

export class SemanticRankingPolicy {
  public constructor(
    options: {
      readonly topK?: number;
      readonly threshold?: number;
      readonly boostLabels?: readonly string[];
      readonly reRank?: boolean;
    } = {},
  ) {
    this.topK = options.topK ?? 5;
    this.threshold = options.threshold ?? 0.1;
    this.boostLabels = [...(options.boostLabels ?? [])];
    this.reRank = options.reRank ?? false;
  }

  public readonly topK: number;
  public readonly threshold: number;
  public readonly boostLabels: readonly string[];
  public readonly reRank: boolean;
}

export interface ISemanticIndex {
  add(document: SemanticDocument, chunks: readonly SemanticChunk[]): void;
  remove(documentId: Identifier): void;
  list(): readonly SemanticDocument[];
  find(query: SemanticQuery): readonly SemanticSearchResultEntry[];
}

export interface IEmbeddingProvider {
  readonly providerId: Identifier;
  readonly name: string;
  readonly version: string;
  createEmbedding(text: string, metadata?: SemanticEmbeddingMetadata): Promise<SemanticEmbedding>;
  createEmbeddings(
    texts: readonly string[],
    metadata?: SemanticEmbeddingMetadata,
  ): Promise<readonly SemanticEmbedding[]>;
}

export interface ISemanticRetriever {
  retrieve(request: SemanticSearchRequest): Promise<SemanticSearchResult>;
}

export interface ISemanticRanking {
  rank(
    results: readonly SemanticSearchResultEntry[],
    policy: SemanticRankingPolicy,
  ): readonly SemanticSearchResultEntry[];
}

export interface ISemanticProvider extends IEmbeddingProvider, ISemanticRetriever {}

export interface ISemanticMemory {
  indexDocument(document: SemanticDocument): Promise<SemanticDocumentIndexResult>;
  search(request: SemanticSearchRequest): Promise<SemanticSearchResult>;
  createSnapshot(): SemanticSnapshot;
  getStatistics(): SemanticStatistics;
  getMetrics(): SemanticMetrics;
}

export class SemanticMetrics {
  public constructor(
    options: {
      readonly embeddingLatencyMs?: number;
      readonly searchLatencyMs?: number;
      readonly similarityScore?: number;
      readonly recall?: number;
      readonly precision?: number;
      readonly rankingStats?: number;
      readonly cacheHits?: number;
      readonly cacheMisses?: number;
    } = {},
  ) {
    this.embeddingLatencyMs = options.embeddingLatencyMs ?? 0;
    this.searchLatencyMs = options.searchLatencyMs ?? 0;
    this.similarityScore = options.similarityScore ?? 0;
    this.recall = options.recall ?? 0;
    this.precision = options.precision ?? 0;
    this.rankingStats = options.rankingStats ?? 0;
    this.cacheHits = options.cacheHits ?? 0;
    this.cacheMisses = options.cacheMisses ?? 0;
  }

  public embeddingLatencyMs: number;
  public searchLatencyMs: number;
  public similarityScore: number;
  public recall: number;
  public precision: number;
  public rankingStats: number;
  public cacheHits: number;
  public cacheMisses: number;
}

export class SemanticStatistics {
  public constructor(
    options: {
      readonly documentCount?: number;
      readonly chunkCount?: number;
      readonly embeddingCount?: number;
      readonly snapshotCount?: number;
      readonly searchCount?: number;
    } = {},
  ) {
    this.documentCount = options.documentCount ?? 0;
    this.chunkCount = options.chunkCount ?? 0;
    this.embeddingCount = options.embeddingCount ?? 0;
    this.snapshotCount = options.snapshotCount ?? 0;
    this.searchCount = options.searchCount ?? 0;
  }

  public documentCount: number;
  public chunkCount: number;
  public embeddingCount: number;
  public snapshotCount: number;
  public searchCount: number;
}

export class SemanticSnapshot {
  public constructor(options: {
    readonly id: Identifier;
    readonly documents: readonly SemanticDocument[];
    readonly chunks: readonly SemanticChunk[];
    readonly takenAt: TimestampString;
  }) {
    this.id = options.id;
    this.documents = Object.freeze([...options.documents]);
    this.chunks = Object.freeze([...options.chunks]);
    this.takenAt = options.takenAt;
  }

  public readonly id: Identifier;
  public readonly documents: readonly SemanticDocument[];
  public readonly chunks: readonly SemanticChunk[];
  public readonly takenAt: TimestampString;
}

export class SemanticCache {
  public constructor(private readonly results = new Map<string, SemanticSearchResult>()) {}

  public get(key: string): SemanticSearchResult | undefined {
    return this.results.get(key);
  }

  public set(key: string, result: SemanticSearchResult): void {
    this.results.set(key, result);
  }
}

export class SemanticRetrievalContext {
  public constructor(options: {
    readonly query: SemanticQuery;
    readonly documents: readonly SemanticDocument[];
    readonly chunks: readonly SemanticChunk[];
    readonly metrics: SemanticMetrics;
  }) {
    this.query = options.query;
    this.documents = Object.freeze([...options.documents]);
    this.chunks = Object.freeze([...options.chunks]);
    this.metrics = options.metrics;
  }

  public readonly query: SemanticQuery;
  public readonly documents: readonly SemanticDocument[];
  public readonly chunks: readonly SemanticChunk[];
  public readonly metrics: SemanticMetrics;
}

export class SemanticRetrieval {
  public constructor(private readonly provider: ISemanticProvider) {}

  public async retrieve(request: SemanticSearchRequest): Promise<SemanticSearchResult> {
    return this.provider.retrieve(request);
  }
}

export class SemanticRanking {
  public constructor(private readonly policy: SemanticRankingPolicy) {}

  public rank(
    results: readonly SemanticSearchResultEntry[],
    policy: SemanticRankingPolicy,
  ): readonly SemanticSearchResultEntry[] {
    const effectivePolicy = policy ?? this.policy;
    return [...results]
      .filter((entry) => entry.score.similarity >= effectivePolicy.threshold)
      .sort((left, right) => right.score.similarity - left.score.similarity)
      .slice(0, effectivePolicy.topK);
  }
}

export class SemanticPipeline {
  public constructor(
    private readonly provider: ISemanticProvider,
    private readonly ranking: SemanticRanking,
    private readonly cache: SemanticCache,
    private readonly metrics?: SemanticMetrics,
  ) {}

  public async search(
    request: SemanticSearchRequest,
    policy: SemanticRankingPolicy,
  ): Promise<SemanticSearchResult> {
    const key = `${request.query.tenant ?? 'global'}:${request.query.text}:${request.topK}`;
    const cached = this.cache.get(key);
    if (cached) {
      if (this.metrics) {
        this.metrics.cacheHits += 1;
      }
      return cached;
    }

    if (this.metrics) {
      this.metrics.cacheMisses += 1;
    }
    const raw = await this.provider.retrieve(request);
    const ranked = this.ranking.rank(raw.results, policy);
    const result = new SemanticSearchResult({
      results: ranked,
      tookMs: raw.tookMs,
      query: request.query,
      threshold: policy.threshold,
    });
    this.cache.set(key, result);
    return result;
  }
}

export class SemanticDocumentIndexResult {
  public constructor(options: {
    readonly document: SemanticDocument;
    readonly chunks: readonly SemanticChunk[];
    readonly embeddings: readonly SemanticEmbedding[];
  }) {
    this.document = options.document;
    this.chunks = Object.freeze([...options.chunks]);
    this.embeddings = Object.freeze([...options.embeddings]);
  }

  public readonly document: SemanticDocument;
  public readonly chunks: readonly SemanticChunk[];
  public readonly embeddings: readonly SemanticEmbedding[];
}

export class DeterministicSemanticProvider implements ISemanticProvider {
  public readonly providerId = 'deterministic';
  public readonly name = 'DeterministicSemanticProvider';
  public readonly version = '1.0.0';

  public async createEmbedding(text: string): Promise<SemanticEmbedding> {
    return new SemanticEmbedding({
      id: `embed-${text.length}`,
      values: Array.from(text.toLowerCase()).map((character) => character.charCodeAt(0) % 7),
      metadata: new SemanticEmbeddingMetadata({ provider: this.name, version: this.version }),
    });
  }

  public async createEmbeddings(texts: readonly string[]): Promise<readonly SemanticEmbedding[]> {
    return Promise.all(texts.map((text) => this.createEmbedding(text)));
  }

  public async retrieve(request: SemanticSearchRequest): Promise<SemanticSearchResult> {
    const queryTokens = request.query.text.toLowerCase().split(/\s+/).filter(Boolean);
    const startedAt = Date.now();
    const results: SemanticSearchResultEntry[] = [];

    for (const entry of this.documents) {
      const tenantMatches = !request.query.tenant || entry.tenant === request.query.tenant;
      const metadataMatches =
        !request.query.metadataFilter ||
        Object.entries(request.query.metadataFilter).every(
          ([key, value]) => entry.metadata?.[key] === value,
        );
      const labelsMatch =
        request.query.labels.length === 0 ||
        request.query.labels.every((label) => entry.labels.includes(label));
      const securityMatches =
        request.query.securityLabels.length === 0 ||
        request.query.securityLabels.every((label) => entry.securityLabels.includes(label));

      if (!tenantMatches || !metadataMatches || !labelsMatch || !securityMatches) {
        continue;
      }

      const contentTokens = entry.content.toLowerCase().split(/\s+/).filter(Boolean);
      const overlap = queryTokens.filter((token) => contentTokens.includes(token)).length;
      const similarity = overlap / Math.max(queryTokens.length, 1);
      if (similarity >= request.threshold) {
        const chunk = new SemanticChunk({
          id: `${entry.id}:chunk-0`,
          content: entry.content,
          index: 0,
          documentId: entry.id,
          metadata: new SemanticChunkMetadata({
            labels: entry.labels,
            source: entry.source,
            tenant: entry.tenant,
            securityLabels: entry.securityLabels,
            metadata: entry.metadata ? { ...entry.metadata } : undefined,
          }),
        });
        results.push(
          new SemanticSearchResultEntry({
            document: entry,
            chunk,
            score: new SemanticScore({
              similarity,
              rank: results.length + 1,
              reason: 'token-overlap',
            }),
          }),
        );
      }
    }

    return new SemanticSearchResult({
      results,
      tookMs: Date.now() - startedAt,
      query: request.query,
      threshold: request.threshold,
    });
  }

  private readonly documents: SemanticDocument[] = [];

  public addDocument(document: SemanticDocument): void {
    this.documents.push(document);
  }
}

export class SemanticMemoryManager implements ISemanticMemory {
  public constructor(
    options: {
      readonly provider?: ISemanticProvider;
      readonly rankingPolicy?: SemanticRankingPolicy;
      readonly cache?: SemanticCache;
    } = {},
  ) {
    this.provider = options.provider ?? new DeterministicSemanticProvider();
    this.rankingPolicy = options.rankingPolicy ?? new SemanticRankingPolicy();
    this.cache = options.cache ?? new SemanticCache();
    this.metrics = new SemanticMetrics();
    this.ranking = new SemanticRanking(this.rankingPolicy);
    this.pipeline = new SemanticPipeline(this.provider, this.ranking, this.cache, this.metrics);
    this.statistics = new SemanticStatistics();
    this.documents = [];
  }

  private readonly provider: ISemanticProvider;
  private readonly rankingPolicy: SemanticRankingPolicy;
  private readonly cache: SemanticCache;
  private readonly ranking: SemanticRanking;
  private readonly pipeline: SemanticPipeline;
  private readonly metrics: SemanticMetrics;
  private readonly statistics: SemanticStatistics;
  private readonly documents: SemanticDocument[];

  public async indexDocument(document: SemanticDocument): Promise<SemanticDocumentIndexResult> {
    const chunks = this.chunkDocument(document);
    const embeddings = await this.provider.createEmbeddings(chunks.map((chunk) => chunk.content));
    const indexed = new SemanticDocumentIndexResult({ document, chunks, embeddings });
    this.documents.push(document);
    this.statistics.documentCount += 1;
    this.statistics.chunkCount += chunks.length;
    this.statistics.embeddingCount += embeddings.length;
    if (this.provider instanceof DeterministicSemanticProvider) {
      this.provider.addDocument(document);
    }
    return indexed;
  }

  public async search(request: SemanticSearchRequest): Promise<SemanticSearchResult> {
    const startedAt = Date.now();
    const result = await this.pipeline.search(request, this.rankingPolicy);
    this.metrics.searchLatencyMs = Date.now() - startedAt;
    this.statistics.searchCount += 1;
    return result;
  }

  public createSnapshot(): SemanticSnapshot {
    return new SemanticSnapshot({
      id: `snapshot-${Date.now()}`,
      documents: [...this.documents],
      chunks: this.documents.flatMap((document) => this.chunkDocument(document)),
      takenAt: new Date().toISOString(),
    });
  }

  public getStatistics(): SemanticStatistics {
    return this.statistics;
  }

  public getMetrics(): SemanticMetrics {
    return this.metrics;
  }

  private chunkDocument(document: SemanticDocument): SemanticChunk[] {
    const words = document.content.split(/\s+/).filter(Boolean);
    const chunks: SemanticChunk[] = [];
    const size = Math.max(3, Math.min(8, words.length));
    for (let index = 0; index < words.length; index += size) {
      const segment = words.slice(index, index + size).join(' ');
      if (segment) {
        chunks.push(
          new SemanticChunk({
            id: `${document.id}:chunk-${chunks.length}`,
            content: segment,
            index: chunks.length,
            documentId: document.id,
            metadata: new SemanticChunkMetadata({
              labels: document.labels,
              source: document.source,
              tenant: document.tenant,
              securityLabels: document.securityLabels,
              metadata: document.metadata ? { ...document.metadata } : undefined,
            }),
          }),
        );
      }
    }
    return chunks;
  }
}
