import type {
  Identifier,
  SerializableValue,
  SerializableValueObject,
  TimestampString,
} from '@infrashield/contracts';

export type KnowledgeEntityType =
  | 'infrastructure'
  | 'application'
  | 'service'
  | 'cluster'
  | 'namespace'
  | 'node'
  | 'pod'
  | 'container'
  | 'vm'
  | 'hypervisor'
  | 'database'
  | 'storage'
  | 'network'
  | 'firewall'
  | 'identity'
  | 'user'
  | 'group'
  | 'role'
  | 'policy'
  | 'certificate'
  | 'secretReference'
  | 'workflow'
  | 'agent'
  | 'tool'
  | 'task'
  | 'incident'
  | 'alert'
  | 'sbom'
  | 'package'
  | 'vulnerability'
  | 'threat'
  | 'complianceControl'
  | 'asset'
  | 'custom';

export type KnowledgeRelationshipType =
  | 'dependsOn'
  | 'runsOn'
  | 'connectsTo'
  | 'owns'
  | 'uses'
  | 'hosts'
  | 'contains'
  | 'executes'
  | 'protects'
  | 'monitors'
  | 'communicatesWith'
  | 'impacts'
  | 'causes'
  | 'mitigates'
  | 'references'
  | 'derivedFrom'
  | 'managedBy'
  | 'custom';

export class KnowledgeLabel {
  public constructor(
    options: { readonly value: string; readonly category?: string } = { value: '' },
  ) {
    this.value = options.value;
    this.category = options.category;
  }

  public readonly value: string;
  public readonly category?: string;
}

export class KnowledgeProperty {
  public constructor(
    options: { readonly key: string; readonly value: SerializableValue } = { key: '', value: null },
  ) {
    this.key = options.key;
    this.value = options.value;
  }

  public readonly key: string;
  public readonly value: SerializableValue;
}

export class KnowledgeMetadata {
  public constructor(options: SerializableValueObject = {}) {
    this.values = Object.freeze({ ...options });
  }

  public readonly values: Readonly<SerializableValueObject>;

  public get<T>(key: string): T | undefined {
    return this.values[key] as T | undefined;
  }
}

export class KnowledgeReference {
  public constructor(
    options: { readonly id: Identifier; readonly kind?: string; readonly source?: string } = {
      id: '',
    },
  ) {
    this.id = options.id;
    this.kind = options.kind;
    this.source = options.source;
  }

  public readonly id: Identifier;
  public readonly kind?: string;
  public readonly source?: string;
}

export class KnowledgeEvidence {
  public constructor(
    options: { readonly source: string; readonly confidence?: number; readonly detail?: string } = {
      source: '',
    },
  ) {
    this.source = options.source;
    this.confidence = options.confidence ?? 1;
    this.detail = options.detail;
  }

  public readonly source: string;
  public readonly confidence: number;
  public readonly detail?: string;
}

export class KnowledgeSource {
  public constructor(
    options: {
      readonly name: string;
      readonly type?: string;
      readonly metadata?: KnowledgeMetadata;
    } = { name: '' },
  ) {
    this.name = options.name;
    this.type = options.type;
    this.metadata = options.metadata ?? new KnowledgeMetadata();
  }

  public readonly name: string;
  public readonly type?: string;
  public readonly metadata: KnowledgeMetadata;
}

export class KnowledgeConstraint {
  public constructor(
    options: { readonly name: string; readonly expression?: string } = { name: '' },
  ) {
    this.name = options.name;
    this.expression = options.expression;
  }

  public readonly name: string;
  public readonly expression?: string;
}

export class KnowledgeCategory {
  public constructor(
    options: { readonly name: string; readonly description?: string } = { name: '' },
  ) {
    this.name = options.name;
    this.description = options.description;
  }

  public readonly name: string;
  public readonly description?: string;
}

export class KnowledgeNode {
  public constructor(options: {
    readonly id: Identifier;
    readonly name: string;
    readonly type: KnowledgeEntityType;
    readonly labels?: readonly string[];
    readonly tenantId?: Identifier;
    readonly properties?: readonly KnowledgeProperty[];
    readonly metadata?: KnowledgeMetadata;
    readonly createdAt?: TimestampString;
    readonly updatedAt?: TimestampString;
    readonly securityLabels?: readonly string[];
  }) {
    this.id = options.id;
    this.name = options.name;
    this.type = options.type;
    this.labels = [...(options.labels ?? [])];
    this.tenantId = options.tenantId;
    this.properties = [...(options.properties ?? [])];
    this.metadata = options.metadata ?? new KnowledgeMetadata();
    this.createdAt = options.createdAt ?? new Date().toISOString();
    this.updatedAt = options.updatedAt ?? this.createdAt;
    this.securityLabels = [...(options.securityLabels ?? [])];
  }

  public readonly id: Identifier;
  public readonly name: string;
  public readonly type: KnowledgeEntityType;
  public readonly labels: readonly string[];
  public readonly tenantId?: Identifier;
  public readonly properties: readonly KnowledgeProperty[];
  public readonly metadata: KnowledgeMetadata;
  public readonly createdAt: TimestampString;
  public readonly updatedAt: TimestampString;
  public readonly securityLabels: readonly string[];
}

export class KnowledgeEdge {
  public constructor(options: {
    readonly id: Identifier;
    readonly type: KnowledgeRelationshipType;
    readonly fromId: Identifier;
    readonly toId: Identifier;
    readonly tenantId?: Identifier;
    readonly properties?: readonly KnowledgeProperty[];
    readonly metadata?: KnowledgeMetadata;
    readonly createdAt?: TimestampString;
    readonly updatedAt?: TimestampString;
    readonly securityLabels?: readonly string[];
  }) {
    this.id = options.id;
    this.type = options.type;
    this.fromId = options.fromId;
    this.toId = options.toId;
    this.tenantId = options.tenantId;
    this.properties = [...(options.properties ?? [])];
    this.metadata = options.metadata ?? new KnowledgeMetadata();
    this.createdAt = options.createdAt ?? new Date().toISOString();
    this.updatedAt = options.updatedAt ?? this.createdAt;
    this.securityLabels = [...(options.securityLabels ?? [])];
  }

  public readonly id: Identifier;
  public readonly type: KnowledgeRelationshipType;
  public readonly fromId: Identifier;
  public readonly toId: Identifier;
  public readonly tenantId?: Identifier;
  public readonly properties: readonly KnowledgeProperty[];
  public readonly metadata: KnowledgeMetadata;
  public readonly createdAt: TimestampString;
  public readonly updatedAt: TimestampString;
  public readonly securityLabels: readonly string[];
}

export class KnowledgeEntity extends KnowledgeNode {}
export class KnowledgeRelationship extends KnowledgeEdge {}

export class KnowledgeQuery {
  public constructor(
    options: {
      readonly type?: KnowledgeEntityType;
      readonly labels?: readonly string[];
      readonly tenantId?: Identifier;
      readonly metadata?: SerializableValueObject;
      readonly securityLabels?: readonly string[];
    } = {},
  ) {
    this.type = options.type;
    this.labels = [...(options.labels ?? [])];
    this.tenantId = options.tenantId;
    this.metadata = options.metadata ?? {};
    this.securityLabels = [...(options.securityLabels ?? [])];
  }

  public readonly type?: KnowledgeEntityType;
  public readonly labels: readonly string[];
  public readonly tenantId?: Identifier;
  public readonly metadata: SerializableValueObject;
  public readonly securityLabels: readonly string[];
}

export class KnowledgeTraversal {
  public constructor(options: {
    readonly sourceId: Identifier;
    readonly maxDepth?: number;
    readonly includeOutbound?: boolean;
    readonly includeInbound?: boolean;
    readonly tenantId?: Identifier;
    readonly labels?: readonly string[];
    readonly securityLabels?: readonly string[];
  }) {
    this.sourceId = options.sourceId;
    this.maxDepth = options.maxDepth ?? 1;
    this.includeOutbound = options.includeOutbound ?? true;
    this.includeInbound = options.includeInbound ?? false;
    this.tenantId = options.tenantId;
    this.labels = [...(options.labels ?? [])];
    this.securityLabels = [...(options.securityLabels ?? [])];
  }

  public readonly sourceId: Identifier;
  public readonly maxDepth: number;
  public readonly includeOutbound: boolean;
  public readonly includeInbound: boolean;
  public readonly tenantId?: Identifier;
  public readonly labels: readonly string[];
  public readonly securityLabels: readonly string[];
}

export class KnowledgeTraversalResult {
  public constructor(options: {
    readonly nodes: readonly KnowledgeNode[];
    readonly edges: readonly KnowledgeEdge[];
    readonly results: readonly { id: Identifier; score: number; reason: string }[];
  }) {
    this.nodes = [...options.nodes];
    this.edges = [...options.edges];
    this.results = [...options.results];
  }

  public readonly nodes: readonly KnowledgeNode[];
  public readonly edges: readonly KnowledgeEdge[];
  public readonly results: readonly { id: Identifier; score: number; reason: string }[];
}

export class KnowledgeSearchRequest {
  public constructor(options: {
    readonly query: KnowledgeQuery;
    readonly filter?: KnowledgeFilter;
    readonly ranking?: KnowledgeRankingPolicy;
    readonly projection?: KnowledgeProjection;
  }) {
    this.query = options.query;
    this.filter = options.filter ?? new KnowledgeFilter();
    this.ranking = options.ranking ?? new KnowledgeRankingPolicy();
    this.projection = options.projection ?? new KnowledgeProjection();
  }

  public readonly query: KnowledgeQuery;
  public readonly filter: KnowledgeFilter;
  public readonly ranking: KnowledgeRankingPolicy;
  public readonly projection: KnowledgeProjection;
}

export class KnowledgeSearchResult {
  public constructor(options: {
    readonly results: readonly {
      id: Identifier;
      score: number;
      reason: string;
      node: KnowledgeNode;
    }[];
  }) {
    this.results = [...options.results];
  }

  public readonly results: readonly {
    id: Identifier;
    score: number;
    reason: string;
    node: KnowledgeNode;
  }[];
}

export class KnowledgeRankingPolicy {
  public constructor(
    options: { readonly maxResults?: number; readonly minimumScore?: number } = {},
  ) {
    this.maxResults = options.maxResults ?? 10;
    this.minimumScore = options.minimumScore ?? 0;
  }

  public readonly maxResults: number;
  public readonly minimumScore: number;
}

export class KnowledgeFilter {
  public constructor(
    options: {
      readonly tenantId?: Identifier;
      readonly labels?: readonly string[];
      readonly securityLabels?: readonly string[];
      readonly metadata?: SerializableValueObject;
    } = {},
  ) {
    this.tenantId = options.tenantId;
    this.labels = [...(options.labels ?? [])];
    this.securityLabels = [...(options.securityLabels ?? [])];
    this.metadata = options.metadata ?? {};
  }

  public readonly tenantId?: Identifier;
  public readonly labels: readonly string[];
  public readonly securityLabels: readonly string[];
  public readonly metadata: SerializableValueObject;
}

export class KnowledgeProjection {
  public constructor(
    options: {
      readonly includeProperties?: boolean;
      readonly includeMetadata?: boolean;
      readonly includeSecurityLabels?: boolean;
    } = {},
  ) {
    this.includeProperties = options.includeProperties ?? false;
    this.includeMetadata = options.includeMetadata ?? false;
    this.includeSecurityLabels = options.includeSecurityLabels ?? false;
  }

  public readonly includeProperties: boolean;
  public readonly includeMetadata: boolean;
  public readonly includeSecurityLabels: boolean;
}

export class KnowledgeSubgraph {
  public constructor(options: {
    readonly nodes: readonly KnowledgeNode[];
    readonly edges: readonly KnowledgeEdge[];
  }) {
    this.nodes = [...options.nodes];
    this.edges = [...options.edges];
  }

  public readonly nodes: readonly KnowledgeNode[];
  public readonly edges: readonly KnowledgeEdge[];
}

export class KnowledgePath {
  public constructor(options: {
    readonly nodes: readonly KnowledgeNode[];
    readonly edges: readonly KnowledgeEdge[];
  }) {
    this.nodes = [...options.nodes];
    this.edges = [...options.edges];
  }

  public readonly nodes: readonly KnowledgeNode[];
  public readonly edges: readonly KnowledgeEdge[];
}

export class KnowledgeInference {
  public constructor(options: {
    readonly type: string;
    readonly confidence: number;
    readonly description: string;
    readonly query: KnowledgeQuery;
    readonly evidence?: readonly KnowledgeEvidence[];
  }) {
    this.type = options.type;
    this.confidence = options.confidence;
    this.description = options.description;
    this.query = options.query;
    this.evidence = [...(options.evidence ?? [])];
  }

  public readonly type: string;
  public readonly confidence: number;
  public readonly description: string;
  public readonly query: KnowledgeQuery;
  public readonly evidence: readonly KnowledgeEvidence[];
}

export class KnowledgeObservation {
  public constructor(options: { readonly message: string; readonly confidence?: number }) {
    this.message = options.message;
    this.confidence = options.confidence ?? 1;
  }

  public readonly message: string;
  public readonly confidence: number;
}

export class KnowledgeAnnotation {
  public constructor(options: { readonly key: string; readonly value: SerializableValue }) {
    this.key = options.key;
    this.value = options.value;
  }

  public readonly key: string;
  public readonly value: SerializableValue;
}

export class KnowledgeTag {
  public constructor(options: { readonly value: string }) {
    this.value = options.value;
  }

  public readonly value: string;
}

export class KnowledgeCollection {
  public constructor(options: {
    readonly name: string;
    readonly items: readonly KnowledgeNode[];
    readonly metadata?: KnowledgeMetadata;
  }) {
    this.name = options.name;
    this.items = [...options.items];
    this.metadata = options.metadata ?? new KnowledgeMetadata();
  }

  public readonly name: string;
  public readonly items: readonly KnowledgeNode[];
  public readonly metadata: KnowledgeMetadata;
}

export class KnowledgeVersion {
  public constructor(options: { readonly value: string } = { value: '1.0.0' }) {
    this.value = options.value;
  }

  public readonly value: string;
}

export class KnowledgePolicy {
  public constructor(
    options: {
      readonly enableInference?: boolean;
      readonly maxDepth?: number;
      readonly maxResults?: number;
      readonly tenantIsolation?: boolean;
      readonly enableSecurityLabels?: boolean;
      readonly enableMetadataFiltering?: boolean;
    } = {},
  ) {
    this.enableInference = options.enableInference ?? false;
    this.maxDepth = options.maxDepth ?? 3;
    this.maxResults = options.maxResults ?? 25;
    this.tenantIsolation = options.tenantIsolation ?? true;
    this.enableSecurityLabels = options.enableSecurityLabels ?? true;
    this.enableMetadataFiltering = options.enableMetadataFiltering ?? true;
  }

  public readonly enableInference: boolean;
  public readonly maxDepth: number;
  public readonly maxResults: number;
  public readonly tenantIsolation: boolean;
  public readonly enableSecurityLabels: boolean;
  public readonly enableMetadataFiltering: boolean;
}

export class KnowledgeMetrics {
  public constructor(
    options: {
      readonly nodeCount?: number;
      readonly relationshipCount?: number;
      readonly traversalLatencyMs?: number;
      readonly queryLatencyMs?: number;
      readonly inferenceLatencyMs?: number;
      readonly growth?: number;
    } = {},
  ) {
    this.nodeCount = options.nodeCount ?? 0;
    this.relationshipCount = options.relationshipCount ?? 0;
    this.traversalLatencyMs = options.traversalLatencyMs ?? 0;
    this.queryLatencyMs = options.queryLatencyMs ?? 0;
    this.inferenceLatencyMs = options.inferenceLatencyMs ?? 0;
    this.growth = options.growth ?? 0;
  }

  public nodeCount: number;
  public relationshipCount: number;
  public traversalLatencyMs: number;
  public queryLatencyMs: number;
  public inferenceLatencyMs: number;
  public queryCount: number = 0;
  public traversalCount: number = 0;
  public inferenceCount: number = 0;
  public growth: number;
}

export class KnowledgeStatistics {
  public constructor(
    options: {
      readonly nodeCount?: number;
      readonly relationshipCount?: number;
      readonly traversalCount?: number;
      readonly queryCount?: number;
      readonly inferenceCount?: number;
      readonly snapshotCount?: number;
    } = {},
  ) {
    this.nodeCount = options.nodeCount ?? 0;
    this.relationshipCount = options.relationshipCount ?? 0;
    this.traversalCount = options.traversalCount ?? 0;
    this.queryCount = options.queryCount ?? 0;
    this.inferenceCount = options.inferenceCount ?? 0;
    this.snapshotCount = options.snapshotCount ?? 0;
  }

  public readonly nodeCount: number;
  public readonly relationshipCount: number;
  public readonly traversalCount: number;
  public readonly queryCount: number;
  public readonly inferenceCount: number;
  public readonly snapshotCount: number;
}

export class KnowledgeAudit {
  public constructor(
    options: {
      readonly event: string;
      readonly details?: SerializableValueObject;
      readonly timestamp?: TimestampString;
    } = { event: '' },
  ) {
    this.event = options.event;
    this.details = options.details ?? {};
    this.timestamp = options.timestamp ?? new Date().toISOString();
  }

  public readonly event: string;
  public readonly details: SerializableValueObject;
  public readonly timestamp: TimestampString;
}

export class KnowledgeSnapshot {
  public constructor(
    options: {
      readonly name: string;
      readonly nodeCount: number;
      readonly relationshipCount: number;
      readonly createdAt?: TimestampString;
      readonly version?: KnowledgeVersion;
      readonly metadata?: KnowledgeMetadata;
    } = { name: '', nodeCount: 0, relationshipCount: 0 },
  ) {
    this.name = options.name;
    this.nodeCount = options.nodeCount;
    this.relationshipCount = options.relationshipCount;
    this.createdAt = options.createdAt ?? new Date().toISOString();
    this.version = options.version ?? new KnowledgeVersion();
    this.metadata = options.metadata ?? new KnowledgeMetadata();
  }

  public readonly name: string;
  public readonly nodeCount: number;
  public readonly relationshipCount: number;
  public readonly createdAt: TimestampString;
  public readonly version: KnowledgeVersion;
  public readonly metadata: KnowledgeMetadata;
}

export interface IKnowledgeGraph {
  createEntity(
    entity: Omit<KnowledgeNode, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<KnowledgeNode>;
  createRelationship(
    relationship: Omit<KnowledgeEdge, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<KnowledgeEdge>;
  updateEntity(id: Identifier, changes: Partial<KnowledgeNode>): Promise<KnowledgeNode | undefined>;
  deleteEntity(id: Identifier): Promise<void>;
  mergeEntity(entity: KnowledgeNode): Promise<KnowledgeNode>;
  traverse(traversal: KnowledgeTraversal): Promise<KnowledgeTraversalResult>;
  search(request: KnowledgeSearchRequest): Promise<KnowledgeSearchResult>;
  snapshot(name: string): Promise<KnowledgeSnapshot>;
  getStatistics(): Promise<KnowledgeStatistics>;
  infer(query: KnowledgeQuery): Promise<readonly KnowledgeInference[]>;
}

export interface IKnowledgeRepository {
  storeNode(node: KnowledgeNode): Promise<KnowledgeNode>;
  storeEdge(edge: KnowledgeEdge): Promise<KnowledgeEdge>;
  listNodes(query?: KnowledgeQuery): Promise<readonly KnowledgeNode[]>;
  listEdges(query?: KnowledgeQuery): Promise<readonly KnowledgeEdge[]>;
}

export interface IKnowledgeTraversal {
  traverse(
    graph: KnowledgeGraphManager,
    traversal: KnowledgeTraversal,
  ): Promise<KnowledgeTraversalResult>;
}

export interface IKnowledgeQuery {
  execute(
    graph: KnowledgeGraphManager,
    request: KnowledgeSearchRequest,
  ): Promise<KnowledgeSearchResult>;
}

export interface IKnowledgeInference {
  infer(
    graph: KnowledgeGraphManager,
    query: KnowledgeQuery,
  ): Promise<readonly KnowledgeInference[]>;
}

export interface IKnowledgeProvider {
  readonly providerId: string;
  readonly name: string;
  readonly version: string;
  readonly supportsInference: boolean;
  readonly supportsTraversal: boolean;
  readonly supportsSearch: boolean;
}

export interface IKnowledgeSearch {
  search(
    graph: KnowledgeGraphManager,
    request: KnowledgeSearchRequest,
  ): Promise<KnowledgeSearchResult>;
}

export class KnowledgeGraphPipeline {
  public constructor(
    options: {
      readonly policy?: KnowledgePolicy;
      readonly metrics?: KnowledgeMetrics;
      readonly audit?: (entry: KnowledgeAudit) => void;
    } = {},
  ) {
    this.policy = options.policy ?? new KnowledgePolicy();
    this.metrics = options.metrics ?? new KnowledgeMetrics();
    this.audit = options.audit;
  }

  public readonly policy: KnowledgePolicy;
  public readonly metrics: KnowledgeMetrics;
  public readonly audit?: (entry: KnowledgeAudit) => void;

  public async createEntity(
    graph: KnowledgeGraphManager,
    node: KnowledgeNode,
  ): Promise<KnowledgeNode> {
    const started = Date.now();
    const created = await graph.storeNode(node);
    if (this.audit) {
      this.audit(new KnowledgeAudit({ event: 'EntityCreated', details: { nodeId: created.id } }));
    }
    this.metrics.nodeCount = Math.max(this.metrics.nodeCount, graph.nodeCount);
    this.metrics.growth += 1;
    this.metrics.traversalLatencyMs += Date.now() - started;
    return created;
  }

  public async createRelationship(
    graph: KnowledgeGraphManager,
    edge: KnowledgeEdge,
  ): Promise<KnowledgeEdge> {
    const started = Date.now();
    const created = await graph.storeEdge(edge);
    if (this.audit) {
      this.audit(
        new KnowledgeAudit({ event: 'RelationshipCreated', details: { edgeId: created.id } }),
      );
    }
    this.metrics.relationshipCount = Math.max(this.metrics.relationshipCount, graph.edgeCount);
    this.metrics.growth += 1;
    this.metrics.queryLatencyMs += Date.now() - started;
    return created;
  }
}

export class KnowledgeGraphManager implements IKnowledgeGraph, IKnowledgeRepository {
  public constructor(
    options: {
      readonly policy?: KnowledgePolicy;
      readonly pipeline?: KnowledgeGraphPipeline;
      readonly inferenceHook?: (query: KnowledgeQuery) => Promise<readonly KnowledgeInference[]>;
      readonly provider?: IKnowledgeProvider;
    } = {},
  ) {
    this.policy = options.policy ?? new KnowledgePolicy();
    this.pipeline = options.pipeline ?? new KnowledgeGraphPipeline({ policy: this.policy });
    this.inferenceHook = options.inferenceHook;
    this.provider = options.provider;
    this.nodes = [];
    this.edges = [];
    this.auditTrail = [];
  }

  public readonly policy: KnowledgePolicy;
  public readonly pipeline: KnowledgeGraphPipeline;
  public readonly provider?: IKnowledgeProvider;
  public nodes: KnowledgeNode[];
  public edges: KnowledgeEdge[];
  private readonly auditTrail: KnowledgeAudit[];
  private readonly inferenceHook?: (
    query: KnowledgeQuery,
  ) => Promise<readonly KnowledgeInference[]>;

  public get nodeCount(): number {
    return this.nodes.length;
  }

  public get edgeCount(): number {
    return this.edges.length;
  }

  public async createEntity(
    entity: Omit<KnowledgeNode, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<KnowledgeNode> {
    const node = new KnowledgeNode({
      id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...entity,
    });
    return this.pipeline.createEntity(this, node);
  }

  public async createRelationship(
    relationship: Omit<KnowledgeEdge, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<KnowledgeEdge> {
    const edge = new KnowledgeEdge({
      id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...relationship,
    });
    return this.pipeline.createRelationship(this, edge);
  }

  public async updateEntity(
    id: Identifier,
    changes: Partial<KnowledgeNode>,
  ): Promise<KnowledgeNode | undefined> {
    const existing = this.nodes.find((node) => node.id === id);
    if (!existing) {
      return undefined;
    }
    const updated = new KnowledgeNode({
      ...existing,
      ...changes,
      id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    });
    const index = this.nodes.findIndex((node) => node.id === id);
    this.nodes[index] = updated;
    return updated;
  }

  public async deleteEntity(id: Identifier): Promise<void> {
    this.nodes = this.nodes.filter((node) => node.id !== id);
    this.edges = this.edges.filter((edge) => edge.fromId !== id && edge.toId !== id);
  }

  public async mergeEntity(entity: KnowledgeNode): Promise<KnowledgeNode> {
    const existing = this.nodes.find((node) => node.id === entity.id);
    if (existing) {
      const updated = new KnowledgeNode({
        ...existing,
        ...entity,
        id: entity.id,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      });
      const index = this.nodes.findIndex((node) => node.id === entity.id);
      this.nodes[index] = updated;
      return updated;
    }
    this.nodes.push(entity);
    return entity;
  }

  public async traverse(traversal: KnowledgeTraversal): Promise<KnowledgeTraversalResult> {
    const started = Date.now();
    const source = this.nodes.find((node) => node.id === traversal.sourceId);
    if (!source) {
      return new KnowledgeTraversalResult({ nodes: [], edges: [], results: [] });
    }

    const visited = new Set<Identifier>();
    const queue: { node: KnowledgeNode; depth: number }[] = [{ node: source, depth: 0 }];
    const pathNodes: KnowledgeNode[] = [];
    const pathEdges: KnowledgeEdge[] = [];
    const results: { id: Identifier; score: number; reason: string }[] = [];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }
      if (visited.has(current.node.id)) {
        continue;
      }
      visited.add(current.node.id);
      pathNodes.push(current.node);
      results.push({
        id: current.node.id,
        score: Math.max(1 - current.depth * 0.1, 0),
        reason: 'traversal',
      });

      if (current.depth >= traversal.maxDepth) {
        continue;
      }

      const neighbors = this.edges.filter((edge) => {
        if (edge.tenantId && traversal.tenantId && edge.tenantId !== traversal.tenantId) {
          return false;
        }
        if (traversal.includeOutbound && edge.fromId === current.node.id) {
          return true;
        }
        if (traversal.includeInbound && edge.toId === current.node.id) {
          return true;
        }
        return false;
      });

      for (const edge of neighbors) {
        const nextNode = this.nodes.find(
          (node) => node.id === (edge.fromId === current.node.id ? edge.toId : edge.fromId),
        );
        if (nextNode && !visited.has(nextNode.id)) {
          pathEdges.push(edge);
          queue.push({ node: nextNode, depth: current.depth + 1 });
        }
      }
    }

    this.pipeline.metrics.traversalCount += 1;
    this.pipeline.metrics.traversalLatencyMs += Date.now() - started;
    return new KnowledgeTraversalResult({ nodes: pathNodes, edges: pathEdges, results });
  }

  public async search(request: KnowledgeSearchRequest): Promise<KnowledgeSearchResult> {
    const started = Date.now();
    const matches = this.nodes.filter((node) => {
      if (request.filter.tenantId && node.tenantId && request.filter.tenantId !== node.tenantId) {
        return false;
      }
      if (request.filter.tenantId && !node.tenantId) {
        return false;
      }
      if (request.query.type && node.type !== request.query.type) {
        return false;
      }
      if (
        request.query.labels.length > 0 &&
        !request.query.labels.every((label) => node.labels.includes(label))
      ) {
        return false;
      }
      if (
        request.filter.labels.length > 0 &&
        !request.filter.labels.every((label) => node.labels.includes(label))
      ) {
        return false;
      }
      if (
        request.filter.securityLabels.length > 0 &&
        !request.filter.securityLabels.every((label) => node.securityLabels.includes(label))
      ) {
        return false;
      }
      if (request.query.metadata && Object.keys(request.query.metadata).length > 0) {
        for (const [key, value] of Object.entries(request.query.metadata)) {
          if ((node.metadata.get<SerializableValue>(key) ?? undefined) !== value) {
            return false;
          }
        }
      }
      if (request.filter.metadata && Object.keys(request.filter.metadata).length > 0) {
        for (const [key, value] of Object.entries(request.filter.metadata)) {
          if ((node.metadata.get<SerializableValue>(key) ?? undefined) !== value) {
            return false;
          }
        }
      }
      return true;
    });

    const ranked = matches
      .map((node) => ({
        id: node.id,
        score: node.labels.includes('service') ? 1 : 0.5,
        reason: 'match',
        node,
      }))
      .filter((item) => item.score >= request.ranking.minimumScore)
      .slice(0, request.ranking.maxResults);

    this.pipeline.metrics.queryCount += 1;
    this.pipeline.metrics.queryLatencyMs += Date.now() - started;
    return new KnowledgeSearchResult({ results: ranked });
  }

  public async snapshot(name: string): Promise<KnowledgeSnapshot> {
    const snapshot = new KnowledgeSnapshot({
      name,
      nodeCount: this.nodeCount,
      relationshipCount: this.edgeCount,
      version: new KnowledgeVersion({ value: '1.0.0' }),
    });
    this.pipeline.metrics.growth = Math.max(this.pipeline.metrics.growth, this.nodeCount);
    return snapshot;
  }

  public async getStatistics(): Promise<KnowledgeStatistics> {
    return new KnowledgeStatistics({
      nodeCount: this.nodeCount,
      relationshipCount: this.edgeCount,
      traversalCount: this.pipeline.metrics.traversalCount,
      queryCount: this.pipeline.metrics.queryCount,
      inferenceCount: this.pipeline.metrics.inferenceCount,
      snapshotCount: 1,
    });
  }

  public async infer(query: KnowledgeQuery): Promise<readonly KnowledgeInference[]> {
    const started = Date.now();
    const results = this.inferenceHook ? await this.inferenceHook(query) : [];
    this.pipeline.metrics.inferenceCount += results.length;
    this.pipeline.metrics.inferenceLatencyMs += Date.now() - started;
    return results;
  }

  public async storeNode(node: KnowledgeNode): Promise<KnowledgeNode> {
    const existing = this.nodes.find((item) => item.id === node.id);
    if (existing) {
      const updated = new KnowledgeNode({
        ...existing,
        ...node,
        id: node.id,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      });
      const index = this.nodes.findIndex((item) => item.id === node.id);
      this.nodes[index] = updated;
      return updated;
    }
    this.nodes.push(node);
    return node;
  }

  public async storeEdge(edge: KnowledgeEdge): Promise<KnowledgeEdge> {
    const existing = this.edges.find((item) => item.id === edge.id);
    if (existing) {
      const updated = new KnowledgeEdge({
        ...existing,
        ...edge,
        id: edge.id,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      });
      const index = this.edges.findIndex((item) => item.id === edge.id);
      this.edges[index] = updated;
      return updated;
    }
    this.edges.push(edge);
    return edge;
  }

  public async listNodes(query?: KnowledgeQuery): Promise<readonly KnowledgeNode[]> {
    if (!query) {
      return this.nodes;
    }
    return this.nodes.filter((node) => {
      if (query.tenantId && node.tenantId && query.tenantId !== node.tenantId) {
        return false;
      }
      if (query.tenantId && !node.tenantId) {
        return false;
      }
      if (query.type && node.type !== query.type) {
        return false;
      }
      return query.labels.every((label) => node.labels.includes(label));
    });
  }

  public async listEdges(query?: KnowledgeQuery): Promise<readonly KnowledgeEdge[]> {
    if (!query) {
      return this.edges;
    }
    return this.edges.filter((edge) => {
      if (query.tenantId && edge.tenantId && query.tenantId !== edge.tenantId) {
        return false;
      }
      if (query.tenantId && !edge.tenantId) {
        return false;
      }
      return true;
    });
  }
}

export class KnowledgeGraphRegistry {
  public constructor() {
    this.graphs = [];
  }

  public readonly graphs: KnowledgeGraphManager[];

  public register(graph: KnowledgeGraphManager): void {
    this.graphs.push(graph);
  }

  public getById(id: string): KnowledgeGraphManager | undefined {
    return this.graphs.find((graph) => graph.nodes[0]?.id === id);
  }
}

export class KnowledgeGraphContext {
  public constructor(
    options: {
      readonly graph?: KnowledgeGraphManager;
      readonly registry?: KnowledgeGraphRegistry;
    } = {},
  ) {
    this.graph = options.graph;
    this.registry = options.registry;
  }

  public readonly graph?: KnowledgeGraphManager;
  public readonly registry?: KnowledgeGraphRegistry;
}

export class KnowledgeGraphSnapshot extends KnowledgeSnapshot {}
export class KnowledgeGraphStatistics extends KnowledgeStatistics {}
export class KnowledgeGraphMetrics extends KnowledgeMetrics {}
export class KnowledgeGraphAudit extends KnowledgeAudit {}
export class KnowledgeGraphPolicy extends KnowledgePolicy {}
export class KnowledgeGraphVersion extends KnowledgeVersion {}
export class KnowledgeGraphContextContainer extends KnowledgeGraphContext {}

export class KnowledgeGraph {
  public constructor(
    options: {
      readonly graph?: KnowledgeGraphManager;
      readonly manager?: KnowledgeGraphManager;
    } = {},
  ) {
    this.graph = options.graph ?? options.manager;
  }

  public readonly graph?: KnowledgeGraphManager;
}

export class KnowledgeGraphManagerFacade extends KnowledgeGraphManager {}
