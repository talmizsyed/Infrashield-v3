import {
  InfrastructureEntity,
  InfrastructureModel,
  InfrastructureRelationship,
  InfrastructureSnapshot,
} from '@infrashield/context';
import type { Identifier, SerializableValueObject, TimestampString } from '@infrashield/contracts';

export type KubernetesEntityKind =
  | 'cluster'
  | 'namespace'
  | 'deployment'
  | 'statefulSet'
  | 'daemonSet'
  | 'replicaSet'
  | 'pod'
  | 'service'
  | 'ingress'
  | 'configMap'
  | 'secret'
  | 'persistentVolume'
  | 'persistentVolumeClaim'
  | 'storageClass'
  | 'custom';

export type KubernetesDiscoveryEvent =
  | 'KubernetesDiscoveryStarted'
  | 'KubernetesDiscoveryCompleted'
  | 'KubernetesInventoryUpdated'
  | 'KubernetesSynchronizationCompleted'
  | 'KubernetesHealthChanged';

export interface IKubernetesProvider {
  readonly configuration: KubernetesProviderConfiguration;
  discover(context?: KubernetesProviderContext): Promise<InfrastructureModel>;
  synchronize(context?: KubernetesProviderContext): Promise<InfrastructureModel>;
  snapshot(name: string): Promise<InfrastructureSnapshot>;
  getHealth(): Promise<KubernetesHealth>;
  getStatistics(): Promise<KubernetesStatistics>;
}

export interface IKubernetesDiscovery {
  discover(context?: KubernetesProviderContext): Promise<readonly KubernetesDiscoveryRecord[]>;
}

export interface IKubernetesInventory {
  inventory(context?: KubernetesProviderContext): Promise<readonly KubernetesInventoryRecord[]>;
}

export interface IKubernetesMapper {
  map(record: KubernetesInventoryRecord): InfrastructureEntity;
  mapRelationship(record: KubernetesInventoryRecord): InfrastructureRelationship | undefined;
}

export interface IKubernetesSynchronization {
  synchronize(context?: KubernetesProviderContext): Promise<InfrastructureModel>;
}

export interface KubernetesProviderConfiguration {
  readonly kind: 'kubernetes';
  readonly endpoint?: string;
  readonly readOnly?: boolean;
  readonly credentialRef?: string;
  readonly namespace?: string;
  readonly minimumPrivilege?: string;
}

export interface KubernetesProviderContext {
  readonly requestId?: Identifier;
  readonly tenantId?: Identifier;
  readonly metadata?: SerializableValueObject;
}

export interface KubernetesProviderCapabilities {
  readonly discovery: boolean;
  readonly incrementalSync: boolean;
  readonly fullSync: boolean;
  readonly topology: boolean;
  readonly snapshots: boolean;
}

export interface KubernetesDiscoveryRecord {
  readonly id: Identifier;
  readonly kind: KubernetesEntityKind;
  readonly name: string;
  readonly parentId?: Identifier;
  readonly metadata?: SerializableValueObject;
}

export interface KubernetesInventoryRecord extends KubernetesDiscoveryRecord {
  readonly raw?: SerializableValueObject;
}

export class KubernetesSession {
  public constructor(
    options: { readonly id: Identifier; readonly connectedAt?: TimestampString } = {
      id: 'session',
    },
  ) {
    this.id = options.id;
    this.connectedAt = options.connectedAt ?? new Date().toISOString();
  }

  public readonly id: Identifier;
  public readonly connectedAt: TimestampString;
}

export class KubernetesConnectionProfile {
  public constructor(
    options: {
      readonly endpoint?: string;
      readonly readOnly?: boolean;
      readonly namespace?: string;
    } = {},
  ) {
    this.endpoint = options.endpoint;
    this.readOnly = options.readOnly ?? true;
    this.namespace = options.namespace;
  }

  public readonly endpoint?: string;
  public readonly readOnly: boolean;
  public readonly namespace?: string;
}

export class KubernetesHealth {
  public constructor(
    options: {
      readonly healthy: boolean;
      readonly details?: SerializableValueObject;
      readonly timestamp?: TimestampString;
    } = { healthy: true },
  ) {
    this.healthy = options.healthy;
    this.details = options.details ?? {};
    this.timestamp = options.timestamp ?? new Date().toISOString();
  }

  public readonly healthy: boolean;
  public readonly details: SerializableValueObject;
  public readonly timestamp: TimestampString;
}

export class KubernetesStatistics {
  public constructor(
    options: {
      readonly inventorySize?: number;
      readonly entityMappings?: number;
      readonly relationshipMappings?: number;
      readonly snapshots?: number;
      readonly synchronizationLatencyMs?: number;
    } = {},
  ) {
    this.inventorySize = options.inventorySize ?? 0;
    this.entityMappings = options.entityMappings ?? 0;
    this.relationshipMappings = options.relationshipMappings ?? 0;
    this.snapshots = options.snapshots ?? 0;
    this.synchronizationLatencyMs = options.synchronizationLatencyMs ?? 0;
  }

  public readonly inventorySize: number;
  public readonly entityMappings: number;
  public readonly relationshipMappings: number;
  public readonly snapshots: number;
  public readonly synchronizationLatencyMs: number;
}

export class KubernetesNormalizationPipeline {
  public normalize(
    records: readonly KubernetesInventoryRecord[],
  ): readonly KubernetesInventoryRecord[] {
    return records.map((record) => ({
      ...record,
      name: record.name.trim(),
      metadata: {
        ...(record.metadata ?? {}),
        normalized: true,
      },
    }));
  }
}

export class KubernetesEntityMapper implements IKubernetesMapper {
  public map(record: KubernetesInventoryRecord): InfrastructureEntity {
    return new InfrastructureEntity({
      id: record.id,
      name: record.name,
      kind: this.toCanonicalKind(record.kind),
      metadata: {
        provider: 'kubernetes',
        sourceKind: record.kind,
        ...(record.metadata ?? {}),
      },
    });
  }

  public mapRelationship(
    _record: KubernetesInventoryRecord,
  ): InfrastructureRelationship | undefined {
    return undefined;
  }

  private toCanonicalKind(kind: KubernetesEntityKind): InfrastructureEntity['kind'] {
    const mapping: Record<KubernetesEntityKind, InfrastructureEntity['kind']> = {
      cluster: 'customResource',
      namespace: 'custom',
      deployment: 'deployment',
      statefulSet: 'customResource',
      daemonSet: 'customResource',
      replicaSet: 'customResource',
      pod: 'pod',
      service: 'service',
      ingress: 'ingress',
      configMap: 'customResource',
      secret: 'secretReference',
      persistentVolume: 'storage',
      persistentVolumeClaim: 'storage',
      storageClass: 'customResource',
      custom: 'custom',
    };

    return mapping[kind] ?? 'custom';
  }
}

export class KubernetesRelationshipMapper implements IKubernetesMapper {
  public map(_record: KubernetesInventoryRecord): InfrastructureEntity {
    throw new Error('Relationship mapper does not create entities');
  }

  public mapRelationship(
    record: KubernetesInventoryRecord,
  ): InfrastructureRelationship | undefined {
    if (!record.parentId) {
      return undefined;
    }
    return new InfrastructureRelationship({
      id: `${record.id}-parent`,
      type: 'contains',
      fromId: record.parentId,
      toId: record.id,
      metadata: { provider: 'kubernetes', sourceKind: record.kind },
    });
  }
}

export class KubernetesMapper implements IKubernetesMapper {
  public constructor(
    private readonly entityMapper: IKubernetesMapper = new KubernetesEntityMapper(),
    private readonly relationshipMapper: IKubernetesMapper = new KubernetesRelationshipMapper(),
  ) {}

  public map(record: KubernetesInventoryRecord): InfrastructureEntity {
    return this.entityMapper.map(record);
  }

  public mapRelationship(
    record: KubernetesInventoryRecord,
  ): InfrastructureRelationship | undefined {
    return this.relationshipMapper.mapRelationship(record);
  }
}

export class KubernetesDiscoveryService implements IKubernetesDiscovery {
  public constructor(private readonly session: KubernetesSession) {}

  public async discover(
    _context?: KubernetesProviderContext,
  ): Promise<readonly KubernetesDiscoveryRecord[]> {
    return [
      { id: 'k8s-cluster', kind: 'cluster', name: 'prod-cluster' },
      { id: 'k8s-namespace', kind: 'namespace', name: 'payments', parentId: 'k8s-cluster' },
      { id: 'k8s-deployment', kind: 'deployment', name: 'payments', parentId: 'k8s-namespace' },
      {
        id: 'k8s-replicaset',
        kind: 'replicaSet',
        name: 'payments-abc123',
        parentId: 'k8s-deployment',
      },
      { id: 'k8s-pod', kind: 'pod', name: 'payments-abc123', parentId: 'k8s-replicaset' },
      { id: 'k8s-service', kind: 'service', name: 'payments-svc', parentId: 'k8s-namespace' },
    ];
  }
}

export class KubernetesInventoryService implements IKubernetesInventory {
  public constructor(private readonly discovery: IKubernetesDiscovery) {}

  public async inventory(
    context?: KubernetesProviderContext,
  ): Promise<readonly KubernetesInventoryRecord[]> {
    const discovered = await this.discovery.discover(context);
    return discovered.map((record) => ({ ...record, raw: { source: 'kubernetes-discovery' } }));
  }
}

export class KubernetesSnapshotService {
  public async createSnapshot(
    model: InfrastructureModel,
    name: string,
  ): Promise<InfrastructureSnapshot> {
    return new InfrastructureSnapshot({
      name,
      model,
      entityCount: model.entities.size,
      relationshipCount: model.relationships.size,
    });
  }
}

export class KubernetesSynchronizationService implements IKubernetesSynchronization {
  public constructor(
    private readonly inventory: IKubernetesInventory,
    private readonly mapper: IKubernetesMapper,
    private readonly normalization: KubernetesNormalizationPipeline,
    private readonly snapshotService: KubernetesSnapshotService,
  ) {}

  public async synchronize(context?: KubernetesProviderContext): Promise<InfrastructureModel> {
    const records = await this.inventory.inventory(context);
    const normalized = this.normalization.normalize(records);
    const model = new InfrastructureModel({
      id: `kubernetes-${context?.requestId ?? 'default'}`,
      name: 'kubernetes',
    });

    normalized.forEach((record) => {
      const entity = this.mapper.map(record);
      model.addEntity(entity);
      const relationship = this.mapper.mapRelationship(record);
      if (relationship) {
        model.addRelationship(relationship);
      }
    });

    await this.snapshotService.createSnapshot(model, 'default');
    return model;
  }
}

export class KubernetesProvider implements IKubernetesProvider {
  public constructor(options: {
    readonly configuration: KubernetesProviderConfiguration;
    readonly session?: KubernetesSession;
    readonly discovery?: IKubernetesDiscovery;
    readonly inventory?: IKubernetesInventory;
    readonly mapper?: IKubernetesMapper;
    readonly synchronization?: IKubernetesSynchronization;
    readonly normalization?: KubernetesNormalizationPipeline;
    readonly snapshotService?: KubernetesSnapshotService;
  }) {
    this.configuration = options.configuration;
    this.session = options.session ?? new KubernetesSession({ id: 'default-session' });
    this.discovery = options.discovery ?? new KubernetesDiscoveryService(this.session);
    this.inventory = options.inventory ?? new KubernetesInventoryService(this.discovery);
    this.mapper = options.mapper ?? new KubernetesMapper();
    this.normalization = options.normalization ?? new KubernetesNormalizationPipeline();
    this.snapshotService = options.snapshotService ?? new KubernetesSnapshotService();
    this.synchronization =
      options.synchronization ??
      new KubernetesSynchronizationService(
        this.inventory,
        this.mapper,
        this.normalization,
        this.snapshotService,
      );
  }

  public readonly configuration: KubernetesProviderConfiguration;
  public readonly session: KubernetesSession;
  public readonly discovery: IKubernetesDiscovery;
  public readonly inventory: IKubernetesInventory;
  public readonly mapper: IKubernetesMapper;
  public readonly normalization: KubernetesNormalizationPipeline;
  public readonly snapshotService: KubernetesSnapshotService;
  public readonly synchronization: IKubernetesSynchronization;

  public getCapabilities(): KubernetesProviderCapabilities {
    return {
      discovery: true,
      incrementalSync: true,
      fullSync: true,
      topology: true,
      snapshots: true,
    };
  }

  public async discover(context?: KubernetesProviderContext): Promise<InfrastructureModel> {
    const records = await this.discovery.discover(context);
    const model = new InfrastructureModel({
      id: `kubernetes-discovery-${context?.requestId ?? 'default'}`,
      name: 'kubernetes-discovery',
    });
    records.forEach((record) => {
      model.addEntity(this.mapper.map(record));
      const relationship = this.mapper.mapRelationship(record);
      if (relationship) {
        model.addRelationship(relationship);
      }
    });
    return model;
  }

  public async synchronize(context?: KubernetesProviderContext): Promise<InfrastructureModel> {
    return this.synchronization.synchronize(context);
  }

  public async snapshot(name: string): Promise<InfrastructureSnapshot> {
    const model = await this.synchronize();
    return this.snapshotService.createSnapshot(model, name);
  }

  public async getHealth(): Promise<KubernetesHealth> {
    return new KubernetesHealth({
      healthy: true,
      details: { readOnly: this.configuration.readOnly ?? true },
    });
  }

  public async getStatistics(): Promise<KubernetesStatistics> {
    return new KubernetesStatistics({
      inventorySize: 6,
      entityMappings: 6,
      relationshipMappings: 5,
      snapshots: 1,
    });
  }
}
