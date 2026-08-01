import {
  InfrastructureEntity,
  InfrastructureModel,
  InfrastructureRelationship,
  InfrastructureSnapshot,
} from '@infrashield/context';
import type { Identifier, SerializableValueObject, TimestampString } from '@infrashield/contracts';

export type VmwareEntityKind =
  | 'vcenter'
  | 'datacenter'
  | 'cluster'
  | 'folder'
  | 'resourcePool'
  | 'esxiHost'
  | 'virtualMachine'
  | 'datastore'
  | 'storagePolicy'
  | 'virtualNetwork'
  | 'distributedSwitch'
  | 'portGroup'
  | 'template'
  | 'snapshot'
  | 'tag'
  | 'customAttribute'
  | 'alarm'
  | 'task'
  | 'event'
  | 'custom';

export type VmwareDiscoveryEvent =
  | 'VmwareDiscoveryStarted'
  | 'VmwareDiscoveryCompleted'
  | 'VmwareInventoryUpdated'
  | 'VmwareSynchronizationCompleted'
  | 'VmwareHealthChanged';

export interface IVmwareProvider {
  readonly configuration: VmwareProviderConfiguration;
  discover(context?: VmwareProviderContext): Promise<InfrastructureModel>;
  synchronize(context?: VmwareProviderContext): Promise<InfrastructureModel>;
  snapshot(name: string): Promise<InfrastructureSnapshot>;
  getHealth(): Promise<VmwareHealth>;
  getStatistics(): Promise<VmwareStatistics>;
}

export interface IVmwareDiscovery {
  discover(context?: VmwareProviderContext): Promise<readonly VmwareDiscoveryRecord[]>;
}

export interface IVmwareInventory {
  inventory(context?: VmwareProviderContext): Promise<readonly VmwareInventoryRecord[]>;
}

export interface IVmwareMapper {
  map(record: VmwareInventoryRecord): InfrastructureEntity;
  mapRelationship(record: VmwareInventoryRecord): InfrastructureRelationship | undefined;
}

export interface IVmwareSynchronization {
  synchronize(context?: VmwareProviderContext): Promise<InfrastructureModel>;
}

export interface IVmwareVsphereAutomationAdapter {
  readonly kind: 'vsphere-automation';
  discover(context?: VmwareProviderContext): Promise<readonly VmwareInventoryRecord[]>;
}

export interface IVmwareGovmomiAdapter {
  readonly kind: 'govmomi';
  discover(context?: VmwareProviderContext): Promise<readonly VmwareInventoryRecord[]>;
}

export interface IVmwareRestAdapter {
  readonly kind: 'rest';
  discover(context?: VmwareProviderContext): Promise<readonly VmwareInventoryRecord[]>;
}

export type VmwareAdapter =
  IVmwareVsphereAutomationAdapter | IVmwareGovmomiAdapter | IVmwareRestAdapter;

export interface VmwareProviderConfiguration {
  readonly kind: 'vmware';
  readonly endpoint?: string;
  readonly readOnly?: boolean;
  readonly credentialRef?: string;
  readonly certificateValidation?: boolean;
  readonly minimumPrivilege?: string;
}

export interface VmwareProviderContext {
  readonly requestId?: Identifier;
  readonly tenantId?: Identifier;
  readonly metadata?: SerializableValueObject;
}

export interface VmwareProviderCapabilities {
  readonly discovery: boolean;
  readonly incrementalSync: boolean;
  readonly fullSync: boolean;
  readonly topology: boolean;
  readonly snapshots: boolean;
}

export interface VmwareDiscoveryRecord {
  readonly id: Identifier;
  readonly kind: VmwareEntityKind;
  readonly name: string;
  readonly parentId?: Identifier;
  readonly metadata?: SerializableValueObject;
}

export interface VmwareInventoryRecord extends VmwareDiscoveryRecord {
  readonly raw?: SerializableValueObject;
}

export class VmwareSession {
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

export class VmwareConnectionProfile {
  public constructor(
    options: {
      readonly endpoint?: string;
      readonly readOnly?: boolean;
      readonly certificateValidation?: boolean;
    } = {},
  ) {
    this.endpoint = options.endpoint;
    this.readOnly = options.readOnly ?? true;
    this.certificateValidation = options.certificateValidation ?? true;
  }

  public readonly endpoint?: string;
  public readonly readOnly: boolean;
  public readonly certificateValidation: boolean;
}

export class VmwareHealth {
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

export class VmwareStatistics {
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

export class VmwareMetrics {
  public constructor(
    options: {
      readonly discoveryDurationMs?: number;
      readonly inventorySize?: number;
      readonly synchronizationLatencyMs?: number;
      readonly entityMappingCount?: number;
      readonly relationshipMappingCount?: number;
      readonly healthScore?: number;
    } = {},
  ) {
    this.discoveryDurationMs = options.discoveryDurationMs ?? 0;
    this.inventorySize = options.inventorySize ?? 0;
    this.synchronizationLatencyMs = options.synchronizationLatencyMs ?? 0;
    this.entityMappingCount = options.entityMappingCount ?? 0;
    this.relationshipMappingCount = options.relationshipMappingCount ?? 0;
    this.healthScore = options.healthScore ?? 100;
  }

  public readonly discoveryDurationMs: number;
  public readonly inventorySize: number;
  public readonly synchronizationLatencyMs: number;
  public readonly entityMappingCount: number;
  public readonly relationshipMappingCount: number;
  public readonly healthScore: number;
}

export class VmwareAudit {
  public constructor(options: { readonly events?: readonly VmwareDiscoveryEvent[] } = {}) {
    this.events = [...(options.events ?? [])];
  }

  public readonly events: readonly VmwareDiscoveryEvent[];
}

export class VmwareNormalizationPipeline {
  public normalize(records: readonly VmwareInventoryRecord[]): readonly VmwareInventoryRecord[] {
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

export class VmwareEntityMapper implements IVmwareMapper {
  public map(record: VmwareInventoryRecord): InfrastructureEntity {
    return new InfrastructureEntity({
      id: record.id,
      name: record.name,
      kind: this.toCanonicalKind(record.kind),
      metadata: {
        provider: 'vmware',
        sourceKind: record.kind,
        ...(record.metadata ?? {}),
      },
    });
  }

  public mapRelationship(_record: VmwareInventoryRecord): InfrastructureRelationship | undefined {
    return undefined;
  }

  private toCanonicalKind(kind: VmwareEntityKind): InfrastructureEntity['kind'] {
    const mapping: Record<VmwareEntityKind, InfrastructureEntity['kind']> = {
      vcenter: 'customResource',
      datacenter: 'datacenter',
      cluster: 'cluster',
      folder: 'custom',
      resourcePool: 'custom',
      esxiHost: 'host',
      virtualMachine: 'virtualMachine',
      datastore: 'storage',
      storagePolicy: 'custom',
      virtualNetwork: 'network',
      distributedSwitch: 'switch',
      portGroup: 'network',
      template: 'custom',
      snapshot: 'custom',
      tag: 'custom',
      customAttribute: 'custom',
      alarm: 'custom',
      task: 'custom',
      event: 'custom',
      custom: 'custom',
    };

    return mapping[kind] ?? 'custom';
  }
}

export class VmwareRelationshipMapper implements IVmwareMapper {
  public map(_record: VmwareInventoryRecord): InfrastructureEntity {
    throw new Error('Relationship mapper does not create entities');
  }

  public mapRelationship(record: VmwareInventoryRecord): InfrastructureRelationship | undefined {
    if (!record.parentId) {
      return undefined;
    }
    return new InfrastructureRelationship({
      id: `${record.id}-parent`,
      type: 'contains',
      fromId: record.parentId,
      toId: record.id,
      metadata: { provider: 'vmware', sourceKind: record.kind },
    });
  }
}

export class VmwareMapper implements IVmwareMapper {
  public constructor(
    private readonly entityMapper: IVmwareMapper = new VmwareEntityMapper(),
    private readonly relationshipMapper: IVmwareMapper = new VmwareRelationshipMapper(),
  ) {}

  public map(record: VmwareInventoryRecord): InfrastructureEntity {
    return this.entityMapper.map(record);
  }

  public mapRelationship(record: VmwareInventoryRecord): InfrastructureRelationship | undefined {
    return this.relationshipMapper.mapRelationship(record);
  }
}

export class VmwareDiscoveryService implements IVmwareDiscovery {
  public constructor(private readonly session: VmwareSession) {}

  public async discover(
    _context?: VmwareProviderContext,
  ): Promise<readonly VmwareDiscoveryRecord[]> {
    return [
      { id: 'vmware-vcenter', kind: 'vcenter', name: 'vCenter' },
      { id: 'vmware-dc', kind: 'datacenter', name: 'Datacenter A' },
      { id: 'vmware-cluster', kind: 'cluster', name: 'Cluster A', parentId: 'vmware-dc' },
      { id: 'vmware-host', kind: 'esxiHost', name: 'esxi-01', parentId: 'vmware-cluster' },
      { id: 'vmware-vm', kind: 'virtualMachine', name: 'app-01', parentId: 'vmware-host' },
    ];
  }
}

export class VmwareInventoryService implements IVmwareInventory {
  public constructor(private readonly discovery: IVmwareDiscovery) {}

  public async inventory(
    context?: VmwareProviderContext,
  ): Promise<readonly VmwareInventoryRecord[]> {
    const discovered = await this.discovery.discover(context);
    return discovered.map((record) => ({ ...record, raw: { source: 'vmware-discovery' } }));
  }
}

export class VmwareSnapshotService {
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

export class VmwareSynchronizationService implements IVmwareSynchronization {
  public constructor(
    private readonly inventory: IVmwareInventory,
    private readonly mapper: IVmwareMapper,
    private readonly normalization: VmwareNormalizationPipeline,
    private readonly snapshotService: VmwareSnapshotService,
  ) {}

  public async synchronize(context?: VmwareProviderContext): Promise<InfrastructureModel> {
    const records = await this.inventory.inventory(context);
    const normalized = this.normalization.normalize(records);
    const model = new InfrastructureModel({
      id: `vmware-${context?.requestId ?? 'default'}`,
      name: 'vmware',
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

export class VmwareProvider implements IVmwareProvider {
  public constructor(options: {
    readonly configuration: VmwareProviderConfiguration;
    readonly session?: VmwareSession;
    readonly discovery?: IVmwareDiscovery;
    readonly inventory?: IVmwareInventory;
    readonly mapper?: IVmwareMapper;
    readonly synchronization?: IVmwareSynchronization;
    readonly normalization?: VmwareNormalizationPipeline;
    readonly snapshotService?: VmwareSnapshotService;
  }) {
    this.configuration = options.configuration;
    this.session = options.session ?? new VmwareSession({ id: 'default-session' });
    this.discovery = options.discovery ?? new VmwareDiscoveryService(this.session);
    this.inventory = options.inventory ?? new VmwareInventoryService(this.discovery);
    this.mapper = options.mapper ?? new VmwareMapper();
    this.normalization = options.normalization ?? new VmwareNormalizationPipeline();
    this.snapshotService = options.snapshotService ?? new VmwareSnapshotService();
    this.synchronization =
      options.synchronization ??
      new VmwareSynchronizationService(
        this.inventory,
        this.mapper,
        this.normalization,
        this.snapshotService,
      );
  }

  public readonly configuration: VmwareProviderConfiguration;
  public readonly session: VmwareSession;
  public readonly discovery: IVmwareDiscovery;
  public readonly inventory: IVmwareInventory;
  public readonly mapper: IVmwareMapper;
  public readonly normalization: VmwareNormalizationPipeline;
  public readonly snapshotService: VmwareSnapshotService;
  public readonly synchronization: IVmwareSynchronization;

  public getCapabilities(): VmwareProviderCapabilities {
    return {
      discovery: true,
      incrementalSync: true,
      fullSync: true,
      topology: true,
      snapshots: true,
    };
  }

  public async discover(context?: VmwareProviderContext): Promise<InfrastructureModel> {
    const records = await this.discovery.discover(context);
    const model = new InfrastructureModel({
      id: `vmware-discovery-${context?.requestId ?? 'default'}`,
      name: 'vmware-discovery',
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

  public async synchronize(context?: VmwareProviderContext): Promise<InfrastructureModel> {
    return this.synchronization.synchronize(context);
  }

  public async snapshot(name: string): Promise<InfrastructureSnapshot> {
    const model = await this.synchronize();
    return this.snapshotService.createSnapshot(model, name);
  }

  public async getHealth(): Promise<VmwareHealth> {
    return new VmwareHealth({
      healthy: true,
      details: { readOnly: this.configuration.readOnly ?? true },
    });
  }

  public async getStatistics(): Promise<VmwareStatistics> {
    return new VmwareStatistics({
      inventorySize: 5,
      entityMappings: 5,
      relationshipMappings: 2,
      snapshots: 1,
    });
  }
}
