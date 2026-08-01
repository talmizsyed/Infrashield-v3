import type {
  Identifier,
  SerializableValueObject,
  TimestampString,
  VersionString,
} from '@infrashield/contracts';

export type InfrastructureEntityKind =
  | 'datacenter'
  | 'availabilityZone'
  | 'region'
  | 'cluster'
  | 'host'
  | 'hypervisor'
  | 'virtualMachine'
  | 'bareMetalServer'
  | 'operatingSystem'
  | 'namespace'
  | 'pod'
  | 'container'
  | 'deployment'
  | 'replicaSet'
  | 'daemonSet'
  | 'statefulSet'
  | 'service'
  | 'ingress'
  | 'loadBalancer'
  | 'storage'
  | 'volume'
  | 'disk'
  | 'network'
  | 'subnet'
  | 'vlan'
  | 'firewall'
  | 'router'
  | 'switch'
  | 'dns'
  | 'certificate'
  | 'secretReference'
  | 'database'
  | 'oracle'
  | 'postgresql'
  | 'mysql'
  | 'mongodb'
  | 'redis'
  | 'kafka'
  | 'rabbitmq'
  | 'application'
  | 'microservice'
  | 'api'
  | 'job'
  | 'cronJob'
  | 'storageArray'
  | 'backup'
  | 'customResource'
  | 'custom';

export type InfrastructureRelationshipType =
  | 'supports'
  | 'runsOn'
  | 'hostedBy'
  | 'dependsOn'
  | 'communicatesWith'
  | 'backedBy'
  | 'connectedTo'
  | 'protects'
  | 'monitoredBy'
  | 'replicatedTo'
  | 'owns'
  | 'consumes'
  | 'exposes'
  | 'contains'
  | 'belongsTo'
  | 'managedBy'
  | 'custom';

export type InfrastructureTopologyGraph =
  'topology' | 'dependency' | 'service' | 'network' | 'application' | 'storage' | 'execution';

export interface InfrastructureMetadata extends SerializableValueObject {}

export interface InfrastructureAuditEvent {
  readonly event: string;
  readonly details?: SerializableValueObject;
  readonly timestamp?: TimestampString;
}

export class InfrastructureVersion {
  public constructor(options: { readonly value: VersionString } = { value: '0.1.0' }) {
    this.value = options.value;
  }

  public readonly value: VersionString;
}

export class InfrastructureModel {
  public constructor(options: {
    readonly id: Identifier;
    readonly name: string;
    readonly version?: InfrastructureVersion;
    readonly tenantId?: Identifier;
    readonly metadata?: InfrastructureMetadata;
  }) {
    this.id = options.id;
    this.name = options.name;
    this.version = options.version ?? new InfrastructureVersion();
    this.tenantId = options.tenantId;
    this.metadata = options.metadata ?? {};
    this.entities = new Map();
    this.relationships = new Map();
  }

  public readonly id: Identifier;
  public readonly name: string;
  public readonly version: InfrastructureVersion;
  public readonly tenantId?: Identifier;
  public readonly metadata: InfrastructureMetadata;
  public readonly entities: Map<Identifier, InfrastructureEntity>;
  public readonly relationships: Map<Identifier, InfrastructureRelationship>;

  public addEntity(entity: InfrastructureEntity): InfrastructureModel {
    this.entities.set(entity.id, entity);
    return this;
  }

  public addRelationship(relationship: InfrastructureRelationship): InfrastructureModel {
    this.relationships.set(relationship.id, relationship);
    return this;
  }

  public getEntity(id: Identifier): InfrastructureEntity | undefined {
    return this.entities.get(id);
  }

  public getRelationships(): readonly InfrastructureRelationship[] {
    return Array.from(this.relationships.values());
  }

  public merge(other: InfrastructureModel): InfrastructureModel {
    other.entities.forEach((entity) => this.addEntity(entity));
    other.relationships.forEach((relationship) => this.addRelationship(relationship));
    return this;
  }
}

export class InfrastructureEntity {
  public constructor(options: {
    readonly id: Identifier;
    readonly name: string;
    readonly kind: InfrastructureEntityKind;
    readonly tenantId?: Identifier;
    readonly metadata?: InfrastructureMetadata;
    readonly labels?: readonly string[];
    readonly parentId?: Identifier;
    readonly createdAt?: TimestampString;
    readonly updatedAt?: TimestampString;
  }) {
    this.id = options.id;
    this.name = options.name;
    this.kind = options.kind;
    this.tenantId = options.tenantId;
    this.metadata = options.metadata ?? {};
    this.labels = [...(options.labels ?? [])];
    this.parentId = options.parentId;
    this.createdAt = options.createdAt ?? new Date().toISOString();
    this.updatedAt = options.updatedAt ?? this.createdAt;
  }

  public readonly id: Identifier;
  public readonly name: string;
  public readonly kind: InfrastructureEntityKind;
  public readonly tenantId?: Identifier;
  public readonly metadata: InfrastructureMetadata;
  public readonly labels: readonly string[];
  public readonly parentId?: Identifier;
  public readonly createdAt: TimestampString;
  public readonly updatedAt: TimestampString;
}

export class InfrastructureRelationship {
  public constructor(options: {
    readonly id: Identifier;
    readonly type: InfrastructureRelationshipType;
    readonly fromId: Identifier;
    readonly toId: Identifier;
    readonly tenantId?: Identifier;
    readonly metadata?: InfrastructureMetadata;
    readonly createdAt?: TimestampString;
  }) {
    this.id = options.id;
    this.type = options.type;
    this.fromId = options.fromId;
    this.toId = options.toId;
    this.tenantId = options.tenantId;
    this.metadata = options.metadata ?? {};
    this.createdAt = options.createdAt ?? new Date().toISOString();
  }

  public readonly id: Identifier;
  public readonly type: InfrastructureRelationshipType;
  public readonly fromId: Identifier;
  public readonly toId: Identifier;
  public readonly tenantId?: Identifier;
  public readonly metadata: InfrastructureMetadata;
  public readonly createdAt: TimestampString;
}

export class InfrastructureContext {
  public constructor(options: {
    readonly model: InfrastructureModel;
    readonly requestId?: Identifier;
  }) {
    this.model = options.model;
    this.requestId = options.requestId;
  }

  public readonly model: InfrastructureModel;
  public readonly requestId?: Identifier;
}

export class InfrastructureSnapshot {
  public constructor(options: {
    readonly name: string;
    readonly model: InfrastructureModel;
    readonly entityCount: number;
    readonly relationshipCount: number;
    readonly createdAt?: TimestampString;
  }) {
    this.name = options.name;
    this.model = options.model;
    this.entityCount = options.entityCount;
    this.relationshipCount = options.relationshipCount;
    this.createdAt = options.createdAt ?? new Date().toISOString();
  }

  public readonly name: string;
  public readonly model: InfrastructureModel;
  public readonly entityCount: number;
  public readonly relationshipCount: number;
  public readonly createdAt: TimestampString;
}

export class InfrastructureInventory {
  public constructor(options: { readonly entities?: readonly InfrastructureEntity[] } = {}) {
    this.entities = [...(options.entities ?? [])];
  }

  public readonly entities: readonly InfrastructureEntity[];
}

export class InfrastructureTopology {
  public constructor(
    options: {
      readonly graphs?: Partial<Record<InfrastructureTopologyGraph, readonly string[]>>;
    } = {},
  ) {
    this.graphs = {
      topology: [],
      dependency: [],
      service: [],
      network: [],
      application: [],
      storage: [],
      execution: [],
      ...(options.graphs ?? {}),
    };
  }

  public readonly graphs: Record<InfrastructureTopologyGraph, readonly string[]>;
}

export class InfrastructureMetrics {
  public constructor(
    options: {
      readonly entityCount?: number;
      readonly relationshipCount?: number;
      readonly topologyGrowth?: number;
      readonly snapshotLatencyMs?: number;
      readonly inventoryStatistics?: SerializableValueObject;
    } = {},
  ) {
    this.entityCount = options.entityCount ?? 0;
    this.relationshipCount = options.relationshipCount ?? 0;
    this.topologyGrowth = options.topologyGrowth ?? 0;
    this.snapshotLatencyMs = options.snapshotLatencyMs ?? 0;
    this.inventoryStatistics = options.inventoryStatistics ?? {};
  }

  public readonly entityCount: number;
  public readonly relationshipCount: number;
  public readonly topologyGrowth: number;
  public readonly snapshotLatencyMs: number;
  public readonly inventoryStatistics: SerializableValueObject;
}

export class InfrastructureStatistics {
  public constructor(
    options: {
      readonly entityCount?: number;
      readonly relationshipCount?: number;
      readonly topologySize?: number;
      readonly snapshots?: number;
    } = {},
  ) {
    this.entityCount = options.entityCount ?? 0;
    this.relationshipCount = options.relationshipCount ?? 0;
    this.topologySize = options.topologySize ?? 0;
    this.snapshots = options.snapshots ?? 0;
  }

  public readonly entityCount: number;
  public readonly relationshipCount: number;
  public readonly topologySize: number;
  public readonly snapshots: number;
}

export class InfrastructureAudit {
  public constructor(options: { readonly events?: readonly InfrastructureAuditEvent[] } = {}) {
    this.events = [...(options.events ?? [])];
  }

  public events: InfrastructureAuditEvent[];
}

export class InfrastructurePolicy {
  public constructor(
    options: {
      readonly allowCreate?: boolean;
      readonly allowUpdate?: boolean;
      readonly allowDelete?: boolean;
    } = {},
  ) {
    this.allowCreate = options.allowCreate ?? true;
    this.allowUpdate = options.allowUpdate ?? true;
    this.allowDelete = options.allowDelete ?? true;
  }

  public readonly allowCreate: boolean;
  public readonly allowUpdate: boolean;
  public readonly allowDelete: boolean;
}

export class InfrastructureFilter {
  public constructor(
    options: {
      readonly kind?: InfrastructureEntityKind;
      readonly tenantId?: Identifier;
      readonly labels?: readonly string[];
    } = {},
  ) {
    this.kind = options.kind;
    this.tenantId = options.tenantId;
    this.labels = [...(options.labels ?? [])];
  }

  public readonly kind?: InfrastructureEntityKind;
  public readonly tenantId?: Identifier;
  public readonly labels: readonly string[];

  public apply(entities: readonly InfrastructureEntity[]): readonly InfrastructureEntity[] {
    return entities.filter((entity) => {
      if (this.kind && entity.kind !== this.kind) {
        return false;
      }
      if (this.tenantId && entity.tenantId && this.tenantId !== entity.tenantId) {
        return false;
      }
      if (this.labels.length > 0) {
        return entity.labels.some((label) => this.labels.includes(label));
      }
      return true;
    });
  }
}

export class InfrastructureSearch {
  public constructor(
    options: {
      readonly kind?: InfrastructureEntityKind;
      readonly tenantId?: Identifier;
      readonly labels?: readonly string[];
    } = {},
  ) {
    this.kind = options.kind;
    this.tenantId = options.tenantId;
    this.labels = [...(options.labels ?? [])];
  }

  public readonly kind?: InfrastructureEntityKind;
  public readonly tenantId?: Identifier;
  public readonly labels: readonly string[];

  public search(entities: readonly InfrastructureEntity[]): readonly InfrastructureEntity[] {
    return entities.filter((entity) => {
      if (this.kind && entity.kind !== this.kind) {
        return false;
      }
      if (this.tenantId && entity.tenantId && this.tenantId !== entity.tenantId) {
        return false;
      }
      if (this.labels.length > 0) {
        return entity.labels.some((label) => this.labels.includes(label));
      }
      return true;
    });
  }
}

export class InfrastructureProjection {
  public constructor(options: { readonly kinds?: readonly InfrastructureEntityKind[] } = {}) {
    this.kinds = [...(options.kinds ?? [])];
  }

  public readonly kinds: readonly InfrastructureEntityKind[];

  public project(model: InfrastructureModel): {
    readonly entities: readonly InfrastructureEntity[];
    readonly relationships: readonly InfrastructureRelationship[];
  } {
    const entities = Array.from(model.entities.values()).filter(
      (entity) => this.kinds.length === 0 || this.kinds.includes(entity.kind),
    );
    const relationships = model
      .getRelationships()
      .filter((relationship) =>
        entities.some(
          (entity) => entity.id === relationship.fromId || entity.id === relationship.toId,
        ),
      );
    return { entities, relationships };
  }
}

export interface InfrastructureProviderContract {
  readonly kind: string;
  discover: (context?: InfrastructureContext) => Promise<InfrastructureModel>;
  sync: (
    model: InfrastructureModel,
    context?: InfrastructureContext,
  ) => Promise<InfrastructureModel>;
}

export class InfrastructureProviderRegistry {
  private readonly providers = new Map<string, InfrastructureProviderContract>();

  public register(provider: InfrastructureProviderContract): void {
    this.providers.set(provider.kind, provider);
  }

  public get(kind: string): InfrastructureProviderContract | undefined {
    return this.providers.get(kind);
  }

  public list(): readonly InfrastructureProviderContract[] {
    return Array.from(this.providers.values());
  }
}

export class InfrastructureRegistry {
  private readonly model: InfrastructureModel;
  private readonly snapshots: InfrastructureSnapshot[] = [];
  private readonly audit: InfrastructureAudit = new InfrastructureAudit();

  public constructor(
    options: {
      readonly name?: string;
      readonly tenantId?: Identifier;
      readonly policy?: InfrastructurePolicy;
    } = {},
  ) {
    this.model = new InfrastructureModel({
      id: `model-${options.name ?? 'default'}`,
      name: options.name ?? 'default',
      tenantId: options.tenantId,
    });
    this.policy = options.policy ?? new InfrastructurePolicy();
  }

  public readonly policy: InfrastructurePolicy;

  public async createEntity(entity: InfrastructureEntity): Promise<void> {
    if (!this.policy.allowCreate) {
      return;
    }
    this.model.addEntity(entity);
    this.audit.events = [
      ...this.audit.events,
      { event: 'InfrastructureDiscovered', details: { entityId: entity.id, kind: entity.kind } },
    ];
  }

  public async updateEntity(entity: InfrastructureEntity): Promise<void> {
    if (!this.policy.allowUpdate) {
      return;
    }
    this.model.addEntity(entity);
    this.audit.events = [
      ...this.audit.events,
      { event: 'InfrastructureUpdated', details: { entityId: entity.id, kind: entity.kind } },
    ];
  }

  public async deleteEntity(id: Identifier): Promise<void> {
    if (!this.policy.allowDelete) {
      return;
    }
    this.model.entities.delete(id);
    this.model.relationships.forEach((relationship, relationshipId) => {
      if (relationship.fromId === id || relationship.toId === id) {
        this.model.relationships.delete(relationshipId);
      }
    });
    this.audit.events = [
      ...this.audit.events,
      { event: 'InfrastructureUpdated', details: { entityId: id } },
    ];
  }

  public async createRelationship(relationship: InfrastructureRelationship): Promise<void> {
    if (!this.policy.allowCreate) {
      return;
    }
    this.model.addRelationship(relationship);
    this.audit.events = [
      ...this.audit.events,
      {
        event: 'RelationshipCreated',
        details: { relationshipId: relationship.id, type: relationship.type },
      },
    ];
  }

  public getModel(): InfrastructureModel {
    return this.model;
  }

  public snapshot(name: string): InfrastructureSnapshot {
    const snapshot = new InfrastructureSnapshot({
      name,
      model: this.model,
      entityCount: this.model.entities.size,
      relationshipCount: this.model.relationships.size,
    });
    this.snapshots.push(snapshot);
    return snapshot;
  }

  public getStatistics(): InfrastructureStatistics {
    return new InfrastructureStatistics({
      entityCount: this.model.entities.size,
      relationshipCount: this.model.relationships.size,
      topologySize: this.model.relationships.size,
      snapshots: this.snapshots.length,
    });
  }

  public traverseImpacts(
    id: Identifier,
    options: { readonly depth?: number } = {},
  ): readonly InfrastructureEntity[] {
    const depth = options.depth ?? 1;
    const visited = new Set<Identifier>();
    const queue: { id: Identifier; remaining: number }[] = [{ id, remaining: depth }];
    const impacted: InfrastructureEntity[] = [];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current.id)) {
        continue;
      }
      visited.add(current.id);
      const entity = this.model.getEntity(current.id);
      if (entity) {
        impacted.push(entity);
      }
      const outgoing = Array.from(this.model.relationships.values()).filter(
        (relationship) => relationship.fromId === current.id,
      );
      outgoing.forEach((relationship) => {
        if (current.remaining > 0) {
          queue.push({ id: relationship.toId, remaining: current.remaining - 1 });
        }
      });
    }

    return impacted;
  }

  public getAudit(): InfrastructureAudit {
    return this.audit;
  }
}
