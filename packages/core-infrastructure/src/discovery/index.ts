import { EventBase } from '../event-bus/core';
import { toTimestampString, type SerializableObject, type TimestampString } from '../primitives';

export type DiscoveryMode = 'full' | 'incremental' | 'delta' | 'continuous';
export type DiscoveryChangeKind =
  'added' | 'removed' | 'modified' | 'relationship' | 'metadata' | 'topology';

export interface DiscoveryRelationship {
  readonly type: string;
  readonly targetId: string;
  readonly metadata?: SerializableObject;
}

export interface DiscoveryResourceInput {
  readonly id: string;
  readonly kind: string;
  readonly tenantId: string;
  readonly metadata?: SerializableObject;
  readonly relationships?: readonly DiscoveryRelationship[];
}

export interface DiscoveryInventoryInput {
  readonly providerId: string;
  readonly resources: readonly DiscoveryResourceInput[];
  readonly version?: DiscoveryVersion;
  readonly timestamp?: TimestampString;
}

export interface DiscoveryResource extends DiscoveryResourceInput {
  readonly metadata: SerializableObject;
  readonly relationships: readonly DiscoveryRelationship[];
}

export class DiscoveryVersion {
  public constructor(
    public readonly major: number,
    public readonly minor: number,
    public readonly patch: number,
  ) {}

  public toString(): string {
    return `${this.major}.${this.minor}.${this.patch}`;
  }
}

export class DiscoveryPolicy {
  public constructor(
    public readonly options: {
      readonly readOnly?: boolean;
      readonly tenantIsolation?: boolean;
      readonly providerIsolation?: boolean;
      readonly auditTrail?: boolean;
      readonly maxRetries?: number;
      readonly allowPartial?: boolean;
      readonly requireValidation?: boolean;
    } = {},
  ) {}

  public get readOnly(): boolean {
    return this.options.readOnly ?? true;
  }

  public get tenantIsolation(): boolean {
    return this.options.tenantIsolation ?? true;
  }

  public get providerIsolation(): boolean {
    return this.options.providerIsolation ?? true;
  }

  public get auditTrail(): boolean {
    return this.options.auditTrail ?? true;
  }

  public get maxRetries(): number {
    return this.options.maxRetries ?? 3;
  }

  public get allowPartial(): boolean {
    return this.options.allowPartial ?? false;
  }

  public get requireValidation(): boolean {
    return this.options.requireValidation ?? true;
  }
}

export class DiscoveryContext {
  public constructor(
    public readonly options: {
      readonly providerId: string;
      readonly tenantId: string;
      readonly mode: DiscoveryMode;
      readonly readOnly: boolean;
      readonly policy?: DiscoveryPolicy;
      readonly correlationId?: string;
      readonly previousSnapshot?: DiscoverySnapshot;
    },
  ) {}

  public get providerId(): string {
    return this.options.providerId;
  }

  public get tenantId(): string {
    return this.options.tenantId;
  }

  public get mode(): DiscoveryMode {
    return this.options.mode;
  }

  public get readOnly(): boolean {
    return this.options.readOnly;
  }

  public get policy(): DiscoveryPolicy {
    return this.options.policy ?? new DiscoveryPolicy();
  }

  public get correlationId(): string | undefined {
    return this.options.correlationId;
  }

  public get previousSnapshot(): DiscoverySnapshot | undefined {
    return this.options.previousSnapshot;
  }
}

export class DiscoveryInventory {
  public readonly providerId: string;
  public readonly resources: readonly DiscoveryResource[];
  public readonly version: DiscoveryVersion | undefined;
  public readonly timestamp: TimestampString;

  public constructor(options: DiscoveryInventoryInput) {
    this.providerId = options.providerId;
    this.resources = Object.freeze(
      options.resources.map((resource) => normalizeResource(resource)),
    );
    this.version = options.version;
    this.timestamp = options.timestamp ?? toTimestampString(new Date().toISOString());
  }

  public get size(): number {
    return this.resources.length;
  }

  public getResource(resourceId: string): DiscoveryResource | undefined {
    return this.resources.find((resource) => resource.id === resourceId);
  }
}

export class DiscoveryStatistics {
  private failures = 0;
  private retries = 0;
  private readonly durations: number[] = [];
  private readonly inventorySizes: number[] = [];
  private readonly latencies: number[] = [];

  public durationMs = 0;
  public inventorySize = 0;
  public synchronizationLatencyMs = 0;
  public changeCount = 0;
  public retryCount = 0;
  public discoveryCount = 0;
  public lastUpdated: TimestampString = toTimestampString(new Date().toISOString());

  public recordDuration(durationMs: number): void {
    this.durationMs = durationMs;
    this.durations.push(durationMs);
    this.lastUpdated = toTimestampString(new Date().toISOString());
  }

  public recordInventorySize(size: number): void {
    this.inventorySize = size;
    this.inventorySizes.push(size);
    this.lastUpdated = toTimestampString(new Date().toISOString());
  }

  public recordSynchronizationLatency(durationMs: number): void {
    this.synchronizationLatencyMs = durationMs;
    this.latencies.push(durationMs);
    this.lastUpdated = toTimestampString(new Date().toISOString());
  }

  public recordChangeCount(count: number): void {
    this.changeCount = count;
    this.lastUpdated = toTimestampString(new Date().toISOString());
  }

  public incrementFailures(): void {
    this.failures += 1;
    this.discoveryCount += 1;
    this.lastUpdated = toTimestampString(new Date().toISOString());
  }

  public incrementRetries(): void {
    this.retries += 1;
    this.retryCount = this.retries;
    this.lastUpdated = toTimestampString(new Date().toISOString());
  }

  public get averageDuration(): number {
    return this.durations.length === 0
      ? 0
      : this.durations.reduce((sum, value) => sum + value, 0) / this.durations.length;
  }

  public get averageInventorySize(): number {
    return this.inventorySizes.length === 0
      ? 0
      : this.inventorySizes.reduce((sum, value) => sum + value, 0) / this.inventorySizes.length;
  }

  public get averageSynchronizationLatency(): number {
    return this.latencies.length === 0
      ? 0
      : this.latencies.reduce((sum, value) => sum + value, 0) / this.latencies.length;
  }

  public get failureRate(): number {
    return this.discoveryCount === 0 ? 0 : this.failures / this.discoveryCount;
  }
}

export class DiscoveryMetrics {
  private readonly durations: number[] = [];
  private readonly inventorySizes: number[] = [];
  private readonly latencies: number[] = [];

  public recordDuration(durationMs: number): void {
    this.durations.push(durationMs);
  }

  public recordInventorySize(size: number): void {
    this.inventorySizes.push(size);
  }

  public recordSynchronizationLatency(durationMs: number): void {
    this.latencies.push(durationMs);
  }

  public get averageDuration(): number {
    return this.durations.length === 0
      ? 0
      : this.durations.reduce((sum, value) => sum + value, 0) / this.durations.length;
  }

  public get averageInventorySize(): number {
    return this.inventorySizes.length === 0
      ? 0
      : this.inventorySizes.reduce((sum, value) => sum + value, 0) / this.inventorySizes.length;
  }

  public get averageSynchronizationLatency(): number {
    return this.latencies.length === 0
      ? 0
      : this.latencies.reduce((sum, value) => sum + value, 0) / this.latencies.length;
  }
}

export class DiscoveryAudit {
  public readonly providerId: string;
  public readonly action: string;
  public readonly message: string;
  public readonly timestamp: TimestampString;

  public constructor(options: {
    readonly providerId: string;
    readonly action: string;
    readonly message?: string;
    readonly timestamp?: TimestampString;
  }) {
    this.providerId = options.providerId;
    this.action = options.action;
    this.message = options.message ?? 'discovery audit';
    this.timestamp = options.timestamp ?? toTimestampString(new Date().toISOString());
  }
}

export class DiscoveryManifest {
  public readonly providerId: string;
  public readonly version: DiscoveryVersion;
  public readonly inventorySize: number;
  public readonly checksum: string;
  public readonly timestamp: TimestampString;

  public constructor(options: {
    readonly providerId: string;
    readonly version: DiscoveryVersion;
    readonly inventorySize: number;
    readonly checksum: string;
    readonly timestamp?: TimestampString;
  }) {
    this.providerId = options.providerId;
    this.version = options.version;
    this.inventorySize = options.inventorySize;
    this.checksum = options.checksum;
    this.timestamp = options.timestamp ?? toTimestampString(new Date().toISOString());
  }
}

export class DiscoveryCheckpoint {
  public readonly providerId: string;
  public readonly mode: DiscoveryMode;
  public readonly timestamp: TimestampString;
  public readonly inventorySize: number;

  public constructor(options: {
    readonly providerId: string;
    readonly mode: DiscoveryMode;
    readonly inventorySize?: number;
    readonly timestamp?: TimestampString;
  }) {
    this.providerId = options.providerId;
    this.mode = options.mode;
    this.inventorySize = options.inventorySize ?? 0;
    this.timestamp = options.timestamp ?? toTimestampString(new Date().toISOString());
  }
}

export class DiscoverySnapshot {
  public readonly providerId: string;
  public readonly inventory: DiscoveryInventory;
  public readonly statistics: DiscoveryStatistics;
  public readonly changes: readonly DiscoveryChange[];
  public readonly timestamp: TimestampString;

  public constructor(options: {
    readonly providerId: string;
    readonly inventory: DiscoveryInventory;
    readonly statistics: DiscoveryStatistics;
    readonly changes: readonly DiscoveryChange[];
    readonly timestamp?: TimestampString;
  }) {
    this.providerId = options.providerId;
    this.inventory = options.inventory;
    this.statistics = options.statistics;
    this.changes = Object.freeze([...options.changes]);
    this.timestamp = options.timestamp ?? toTimestampString(new Date().toISOString());
  }
}

export class DiscoverySession {
  public readonly id: string;
  public readonly providerId: string;
  public readonly kind: DiscoveryMode;
  public readonly priority: number;
  public readonly createdAt: TimestampString;
  public state: 'queued' | 'running' | 'completed' | 'failed' = 'queued';

  public constructor(options: {
    readonly providerId: string;
    readonly kind: DiscoveryMode;
    readonly priority?: number;
    readonly id?: string;
    readonly createdAt?: TimestampString;
  }) {
    this.id = options.id ?? `discovery-${options.providerId}-${Date.now().toString(36)}`;
    this.providerId = options.providerId;
    this.kind = options.kind;
    this.priority = options.priority ?? 0;
    this.createdAt = options.createdAt ?? toTimestampString(new Date().toISOString());
  }
}

export class DiscoveryChange {
  public constructor(
    public readonly kind: DiscoveryChangeKind,
    public readonly resourceId: string,
    public readonly previous?: DiscoveryResource,
    public readonly current?: DiscoveryResource,
    public readonly detail?: string,
  ) {}
}

export class InventoryCollector implements IInventoryCollector {
  public collect(input: DiscoveryInventoryInput): DiscoveryInventory {
    return new DiscoveryInventory(input);
  }
}

export class InventoryNormalizer {
  public normalize(inventory: DiscoveryInventory): DiscoveryInventory {
    const resources = inventory.resources.map((resource) => {
      const metadata = Object.fromEntries(
        Object.entries(resource.metadata).map(([key, value]) => [key.toLowerCase(), value]),
      );
      return {
        ...resource,
        metadata: Object.freeze(metadata) as SerializableObject,
        relationships: Object.freeze(
          [...resource.relationships].sort((left, right) =>
            left.targetId.localeCompare(right.targetId),
          ),
        ),
      } satisfies DiscoveryResource;
    });

    return new DiscoveryInventory({
      providerId: inventory.providerId,
      resources,
      version: inventory.version,
      timestamp: inventory.timestamp,
    });
  }
}

export class InventoryValidator {
  public validate(inventory: DiscoveryInventory): DiscoveryInventory {
    for (const resource of inventory.resources) {
      if (!resource.id || !resource.kind || !resource.tenantId) {
        throw new Error(`Invalid discovery resource ${resource.id}`);
      }
      if (!resource.metadata || typeof resource.metadata !== 'object') {
        throw new Error(`Invalid discovery metadata for ${resource.id}`);
      }
    }
    return inventory;
  }
}

export class InventoryMerger {
  public merge(previous: DiscoveryInventory, current: DiscoveryInventory): DiscoveryInventory {
    const currentResources = current.resources.map((resource) => resource);
    return new DiscoveryInventory({
      providerId: current.providerId,
      resources: currentResources,
      version: current.version,
      timestamp: toTimestampString(new Date().toISOString()),
    });
  }
}

export class InventoryComparer {
  public compare(
    previous: DiscoveryInventory,
    current: DiscoveryInventory,
  ): { readonly changed: boolean; readonly differences: readonly string[] } {
    const previousById = new Map(previous.resources.map((resource) => [resource.id, resource]));
    const currentById = new Map(current.resources.map((resource) => [resource.id, resource]));
    const differences: string[] = [];

    for (const [id, currentResource] of currentById) {
      const previousResource = previousById.get(id);
      if (!previousResource) {
        differences.push(`added:${id}`);
        continue;
      }
      if (
        previousResource.kind !== currentResource.kind ||
        JSON.stringify(previousResource.metadata) !== JSON.stringify(currentResource.metadata) ||
        previousResource.relationships.length !== currentResource.relationships.length
      ) {
        differences.push(`modified:${id}`);
      }
    }

    for (const id of previousById.keys()) {
      if (!currentById.has(id)) {
        differences.push(`removed:${id}`);
      }
    }

    return {
      changed: differences.length > 0,
      differences,
    };
  }
}

export class InventoryVersionManager {
  public version(inventory: DiscoveryInventory): DiscoveryInventory {
    const nextVersion = new DiscoveryVersion(1, 0, inventory.size);
    return new DiscoveryInventory({
      providerId: inventory.providerId,
      resources: inventory.resources,
      version: nextVersion,
      timestamp: inventory.timestamp,
    });
  }
}

export class ChangeDetector implements IChangeDetector {
  public detect(
    previous: DiscoveryInventory,
    current: DiscoveryInventory,
  ): readonly DiscoveryChange[] {
    const previousById = new Map(previous.resources.map((resource) => [resource.id, resource]));
    const currentById = new Map(current.resources.map((resource) => [resource.id, resource]));
    const changes: DiscoveryChange[] = [];

    for (const [id, currentResource] of currentById) {
      const previousResource = previousById.get(id);
      if (!previousResource) {
        changes.push(
          new DiscoveryChange('added', id, undefined, currentResource, 'resource added'),
        );
        continue;
      }
      if (JSON.stringify(previousResource.metadata) !== JSON.stringify(currentResource.metadata)) {
        changes.push(
          new DiscoveryChange(
            'modified',
            id,
            previousResource,
            currentResource,
            'resource metadata changed',
          ),
        );
      }
    }

    for (const [id] of previousById) {
      if (!currentById.has(id)) {
        changes.push(
          new DiscoveryChange('removed', id, previousById.get(id), undefined, 'resource removed'),
        );
      }
    }

    return changes;
  }
}

export class ResourceFingerprint {
  public compute(resource: DiscoveryResource): string {
    const value = `${resource.kind}:${resource.id}:${JSON.stringify(resource.metadata)}`;
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  }
}

export class SynchronizationPlanner implements ISynchronizationPlanner {
  public plan(
    context: DiscoveryContext,
    inventory: DiscoveryInventory,
    changes: readonly DiscoveryChange[],
  ): SynchronizationResult {
    return new SynchronizationResult({
      providerId: context.providerId,
      mode: context.mode,
      success: true,
      changes,
      inventorySize: inventory.size,
      durationMs: changes.length * 5,
      retries: context.policy.maxRetries,
    });
  }
}

export class SynchronizationResult {
  public readonly providerId: string;
  public readonly mode: DiscoveryMode;
  public readonly success: boolean;
  public readonly changes: readonly DiscoveryChange[];
  public readonly inventorySize: number;
  public readonly durationMs: number;
  public readonly retries: number;
  public readonly timestamp: TimestampString;

  public constructor(options: {
    readonly providerId: string;
    readonly mode: DiscoveryMode;
    readonly success: boolean;
    readonly changes: readonly DiscoveryChange[];
    readonly inventorySize: number;
    readonly durationMs: number;
    readonly retries: number;
    readonly timestamp?: TimestampString;
  }) {
    this.providerId = options.providerId;
    this.mode = options.mode;
    this.success = options.success;
    this.changes = Object.freeze([...options.changes]);
    this.inventorySize = options.inventorySize;
    this.durationMs = options.durationMs;
    this.retries = options.retries;
    this.timestamp = options.timestamp ?? toTimestampString(new Date().toISOString());
  }
}

export interface IDiscoveryEngine {
  discover(context: DiscoveryContext): Promise<DiscoveryExecution>;
}

export interface IDiscoveryProvider {
  readonly providerId: string;
  discover(context: DiscoveryContext): Promise<DiscoveryInventory>;
  collect(context: DiscoveryContext): Promise<DiscoveryInventory>;
  isReadOnly(): Promise<boolean>;
}

export interface IInventoryCollector {
  collect(input: DiscoveryInventoryInput): DiscoveryInventory;
}

export interface IChangeDetector {
  detect(previous: DiscoveryInventory, current: DiscoveryInventory): readonly DiscoveryChange[];
}

export interface ISynchronizationPlanner {
  plan(
    context: DiscoveryContext,
    inventory: DiscoveryInventory,
    changes: readonly DiscoveryChange[],
  ): SynchronizationResult;
}

export class DiscoveryExecution {
  public constructor(
    public readonly context: DiscoveryContext,
    public readonly snapshot: DiscoverySnapshot,
    public readonly statistics: DiscoveryStatistics,
    public readonly changes: readonly DiscoveryChange[],
    public readonly result: SynchronizationResult,
    public readonly audit: DiscoveryAudit,
  ) {}
}

export class DiscoveryEngine implements IDiscoveryEngine {
  private readonly provider: IDiscoveryProvider;
  private readonly collector: IInventoryCollector;
  private readonly normalizer: InventoryNormalizer;
  private readonly validator: InventoryValidator;
  private readonly merger: InventoryMerger;
  private readonly detector: IChangeDetector;
  private readonly versionManager: InventoryVersionManager;
  private readonly planner: ISynchronizationPlanner;

  public constructor(options: {
    readonly provider: IDiscoveryProvider;
    readonly collector?: IInventoryCollector;
    readonly normalizer?: InventoryNormalizer;
    readonly validator?: InventoryValidator;
    readonly merger?: InventoryMerger;
    readonly detector?: IChangeDetector;
    readonly versionManager?: InventoryVersionManager;
    readonly planner?: ISynchronizationPlanner;
  }) {
    this.provider = options.provider;
    this.collector = options.collector ?? new InventoryCollector();
    this.normalizer = options.normalizer ?? new InventoryNormalizer();
    this.validator = options.validator ?? new InventoryValidator();
    this.merger = options.merger ?? new InventoryMerger();
    this.detector = options.detector ?? new ChangeDetector();
    this.versionManager = options.versionManager ?? new InventoryVersionManager();
    this.planner = options.planner ?? new SynchronizationPlanner();
  }

  public async discover(context: DiscoveryContext): Promise<DiscoveryExecution> {
    const startedAt = Date.now();
    const statistics = new DiscoveryStatistics();
    const audit = new DiscoveryAudit({ providerId: context.providerId, action: 'discover' });

    const inventory = await this.provider.collect(context);
    const normalized = this.normalizer.normalize(inventory);
    const validated = this.validator.validate(normalized);
    const previous =
      context.previousSnapshot?.inventory ??
      new DiscoveryInventory({ providerId: context.providerId, resources: [] });
    this.merger.merge(previous, validated);
    const changes = this.detector.detect(previous, validated);
    const versioned = this.versionManager.version(validated);
    const result = this.planner.plan(context, versioned, changes);

    statistics.recordDuration(Date.now() - startedAt);
    statistics.recordInventorySize(versioned.size);
    statistics.recordSynchronizationLatency(result.durationMs);
    statistics.recordChangeCount(changes.length);
    if (!result.success) {
      statistics.incrementFailures();
    }

    const snapshot = new DiscoverySnapshot({
      providerId: context.providerId,
      inventory: versioned,
      statistics,
      changes,
    });

    return new DiscoveryExecution(context, snapshot, statistics, changes, result, audit);
  }
}

export class DiscoveryScheduler {
  private readonly queue: DiscoverySession[] = [];

  public schedule(options: {
    readonly providerId: string;
    readonly kind: DiscoveryMode;
    readonly priority?: number;
  }): DiscoverySession {
    const session = new DiscoverySession(options);
    this.queue.push(session);
    this.queue.sort((left, right) => right.priority - left.priority);
    return session;
  }

  public next(): DiscoverySession | undefined {
    return this.queue.shift();
  }
}

export class DiscoveryManager {
  public createCheckpoint(
    providerId: string,
    context: { readonly mode: DiscoveryMode; readonly inventorySize?: number },
  ): DiscoveryCheckpoint {
    return new DiscoveryCheckpoint({
      providerId,
      mode: context.mode,
      inventorySize: context.inventorySize ?? 0,
    });
  }

  public async recover(
    context: { readonly providerId: string; readonly mode: DiscoveryMode },
    outcome: { readonly success: boolean; readonly error?: string },
  ): Promise<SynchronizationResult> {
    const retries = outcome.success ? 0 : 1;
    return new SynchronizationResult({
      providerId: context.providerId,
      mode: context.mode,
      success: outcome.success,
      changes: [],
      inventorySize: 0,
      durationMs: 10,
      retries,
    });
  }
}

export class DiscoveryCoordinator {
  public constructor(private readonly engine: DiscoveryEngine) {}

  public async coordinate(context: DiscoveryContext): Promise<DiscoveryExecution> {
    return this.engine.discover(context);
  }
}

function normalizeResource(resource: DiscoveryResourceInput): DiscoveryResource {
  const metadata = Object.freeze({ ...(resource.metadata ?? {}) }) as SerializableObject;
  const relationships = Object.freeze([...(resource.relationships ?? [])]);
  return {
    id: resource.id,
    kind: resource.kind,
    tenantId: resource.tenantId,
    metadata,
    relationships,
  };
}

export class DiscoveryEvent extends EventBase<Record<string, unknown>> {}
export class DiscoveryStartedNotificationEvent extends DiscoveryEvent {
  public constructor(providerId: string, mode: DiscoveryMode) {
    super(
      { providerId, mode },
      {
        source: 'core-infrastructure.discovery',
        category: 'system',
        priority: 'normal',
        version: 1,
      },
    );
  }
}

export class DiscoveryCompletedNotificationEvent extends DiscoveryEvent {
  public constructor(providerId: string, mode: DiscoveryMode) {
    super(
      { providerId, mode },
      {
        source: 'core-infrastructure.discovery',
        category: 'system',
        priority: 'normal',
        version: 1,
      },
    );
  }
}

export class InventoryCollectedEvent extends DiscoveryEvent {
  public constructor(providerId: string, inventorySize: number) {
    super(
      { providerId, inventorySize },
      {
        source: 'core-infrastructure.discovery',
        category: 'system',
        priority: 'normal',
        version: 1,
      },
    );
  }
}

export class InventoryMergedEvent extends DiscoveryEvent {
  public constructor(providerId: string, changeCount: number) {
    super(
      { providerId, changeCount },
      {
        source: 'core-infrastructure.discovery',
        category: 'system',
        priority: 'normal',
        version: 1,
      },
    );
  }
}

export class ChangesDetectedEvent extends DiscoveryEvent {
  public constructor(providerId: string, changeCount: number) {
    super(
      { providerId, changeCount },
      {
        source: 'core-infrastructure.discovery',
        category: 'system',
        priority: 'normal',
        version: 1,
      },
    );
  }
}

export class SynchronizationCompletedNotificationEvent extends DiscoveryEvent {
  public constructor(providerId: string, durationMs: number) {
    super(
      { providerId, durationMs },
      {
        source: 'core-infrastructure.discovery',
        category: 'system',
        priority: 'normal',
        version: 1,
      },
    );
  }
}
