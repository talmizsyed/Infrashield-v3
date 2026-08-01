import type {
  Identifier,
  SerializableValue,
  SerializableValueObject,
  TimestampString,
} from '@infrashield/contracts';

export enum MemoryType {
  Working = 'working',
  Conversation = 'conversation',
  Session = 'session',
  Execution = 'execution',
  Agent = 'agent',
  Workflow = 'workflow',
  Reflection = 'reflection',
  Planning = 'planning',
  Temporary = 'temporary',
}

export enum MemoryCategory {
  Working = 'working',
  Conversation = 'conversation',
  Session = 'session',
  Execution = 'execution',
  Agent = 'agent',
  Workflow = 'workflow',
  Reflection = 'reflection',
  Planning = 'planning',
  Temporary = 'temporary',
}

export class MemoryValue {
  public constructor(public readonly data: SerializableValue) {}
}

export class MemoryMetadata {
  public constructor(options: SerializableValueObject = {}) {
    this.values = Object.freeze({ ...options });
  }

  public readonly values: Readonly<SerializableValueObject>;

  public get<T>(key: string): T | undefined {
    return this.values[key] as T | undefined;
  }
}

export class MemoryPolicy {
  public constructor(
    options: {
      readonly retention?: MemoryRetention;
      readonly compression?: MemoryCompression;
      readonly encryptionHook?: (value: SerializableValue) => SerializableValue;
      readonly priority?: number;
      readonly storageLimitBytes?: number;
    } = {},
  ) {
    this.retention = options.retention ?? new MemoryRetention();
    this.compression = options.compression ?? new MemoryCompression();
    this.encryptionHook = options.encryptionHook;
    this.priority = options.priority ?? 0;
    this.storageLimitBytes = options.storageLimitBytes ?? 1024 * 1024;
  }

  public readonly retention: MemoryRetention;
  public readonly compression: MemoryCompression;
  public readonly encryptionHook?: (value: SerializableValue) => SerializableValue;
  public readonly priority: number;
  public readonly storageLimitBytes: number;
}

export class MemoryRetention {
  public constructor(options: { readonly maxEntries?: number; readonly ttlMs?: number } = {}) {
    this.maxEntries = options.maxEntries ?? 1000;
    this.ttlMs = options.ttlMs;
  }

  public readonly maxEntries: number;
  public readonly ttlMs?: number;
}

export class MemoryCompression {
  public constructor(
    options: { readonly enabled?: boolean; readonly thresholdBytes?: number } = {},
  ) {
    this.enabled = options.enabled ?? false;
    this.thresholdBytes = options.thresholdBytes ?? 512;
  }

  public readonly enabled: boolean;
  public readonly thresholdBytes: number;
}

export class MemoryRanking {
  public constructor(options: { readonly score?: number; readonly reason?: string } = {}) {
    this.score = options.score ?? 0;
    this.reason = options.reason ?? 'default';
  }

  public readonly score: number;
  public readonly reason: string;
}

export class MemoryMetrics {
  public constructor(
    options: {
      readonly hits?: number;
      readonly misses?: number;
      readonly compressionRatio?: number;
      readonly latencyMs?: number;
      readonly memorySizeBytes?: number;
      readonly snapshotSizeBytes?: number;
      readonly snapshotCount?: number;
    } = {},
  ) {
    this.hits = options.hits ?? 0;
    this.misses = options.misses ?? 0;
    this.compressionRatio = options.compressionRatio ?? 0;
    this.latencyMs = options.latencyMs ?? 0;
    this.memorySizeBytes = options.memorySizeBytes ?? 0;
    this.snapshotSizeBytes = options.snapshotSizeBytes ?? 0;
    this.snapshotCount = options.snapshotCount ?? 0;
  }

  public hits: number;
  public misses: number;
  public compressionRatio: number;
  public latencyMs: number;
  public memorySizeBytes: number;
  public snapshotSizeBytes: number;
  public snapshotCount: number;
}

export class MemoryStatistics {
  public constructor(
    options: {
      readonly totalEntries?: number;
      readonly expiredEntries?: number;
      readonly snapshots?: number;
      readonly providers?: number;
    } = {},
  ) {
    this.totalEntries = options.totalEntries ?? 0;
    this.expiredEntries = options.expiredEntries ?? 0;
    this.snapshots = options.snapshots ?? 0;
    this.providers = options.providers ?? 0;
  }

  public readonly totalEntries: number;
  public readonly expiredEntries: number;
  public readonly snapshots: number;
  public readonly providers: number;
}

export class MemoryMetadataRecord {
  public constructor(
    options: {
      readonly createdAt?: TimestampString;
      readonly updatedAt?: TimestampString;
      readonly expiresAt?: TimestampString;
      readonly providerId?: Identifier;
      readonly scope?: string;
      readonly tags?: readonly string[];
      readonly summary?: string;
      readonly compressed?: boolean;
    } = {},
  ) {
    this.createdAt = options.createdAt ?? new Date().toISOString();
    this.updatedAt = options.updatedAt ?? this.createdAt;
    this.expiresAt = options.expiresAt;
    this.providerId = options.providerId;
    this.scope = options.scope;
    this.tags = [...(options.tags ?? [])];
    this.summary = options.summary;
    this.compressed = options.compressed ?? false;
  }

  public readonly createdAt: TimestampString;
  public readonly updatedAt: TimestampString;
  public readonly expiresAt?: TimestampString;
  public readonly providerId?: Identifier;
  public readonly scope?: string;
  public readonly tags: readonly string[];
  public readonly summary?: string;
  public readonly compressed: boolean;
}

export interface IMemoryEntry {
  readonly id: Identifier;
  readonly key: string;
  readonly category: MemoryCategory;
  readonly type: MemoryType;
  readonly value: SerializableValue;
  readonly createdAt: TimestampString;
  readonly updatedAt: TimestampString;
  readonly expiresAt?: TimestampString;
  readonly metadata: MemoryMetadataRecord;
  readonly providerId: Identifier;
  readonly compressed: boolean;
  readonly summary?: string;
}

export class MemoryEntry implements IMemoryEntry {
  public constructor(options: {
    readonly id: Identifier;
    readonly key: string;
    readonly category: MemoryCategory;
    readonly type: MemoryType;
    readonly value: SerializableValue;
    readonly createdAt?: TimestampString;
    readonly updatedAt?: TimestampString;
    readonly expiresAt?: TimestampString;
    readonly metadata?: MemoryMetadataRecord;
    readonly providerId: Identifier;
    readonly compressed?: boolean;
    readonly summary?: string;
  }) {
    this.id = options.id;
    this.key = options.key;
    this.category = options.category;
    this.type = options.type;
    this.value = options.value;
    this.createdAt = options.createdAt ?? new Date().toISOString();
    this.updatedAt = options.updatedAt ?? this.createdAt;
    this.expiresAt = options.expiresAt;
    this.metadata = options.metadata ?? new MemoryMetadataRecord();
    this.providerId = options.providerId;
    this.compressed = options.compressed ?? false;
    this.summary = options.summary;
  }

  public readonly id: Identifier;
  public readonly key: string;
  public readonly category: MemoryCategory;
  public readonly type: MemoryType;
  public readonly value: SerializableValue;
  public readonly createdAt: TimestampString;
  public readonly updatedAt: TimestampString;
  public readonly expiresAt?: TimestampString;
  public readonly metadata: MemoryMetadataRecord;
  public readonly providerId: Identifier;
  public readonly compressed: boolean;
  public readonly summary?: string;
}

export interface IMemoryProvider {
  readonly providerId: Identifier;
  readonly name: string;
  readonly version: string;
  readonly priority: number;
  readonly supportsCompression: boolean;
  store(entry: MemoryEntry): Promise<MemoryEntry>;
  update(id: Identifier, changes: Partial<MemoryEntry>): Promise<MemoryEntry | undefined>;
  retrieve(id: Identifier): Promise<MemoryEntry | undefined>;
  delete(id: Identifier): Promise<void>;
  list(scope?: string): Promise<readonly MemoryEntry[]>;
  search(query: string): Promise<readonly MemoryEntry[]>;
}

export class InMemoryProvider implements IMemoryProvider {
  public constructor(
    options: {
      readonly providerId?: Identifier;
      readonly name?: string;
      readonly version?: string;
      readonly priority?: number;
      readonly supportsCompression?: boolean;
    } = {},
  ) {
    this.providerId = options.providerId ?? 'inmemory';
    this.name = options.name ?? 'InMemoryProvider';
    this.version = options.version ?? '1.0.0';
    this.priority = options.priority ?? 1;
    this.supportsCompression = options.supportsCompression ?? true;
    this.entries = new Map<Identifier, MemoryEntry>();
  }

  public readonly providerId: Identifier;
  public readonly name: string;
  public readonly version: string;
  public readonly priority: number;
  public readonly supportsCompression: boolean;
  private readonly entries: Map<Identifier, MemoryEntry>;

  public async store(entry: MemoryEntry): Promise<MemoryEntry> {
    this.entries.set(entry.id, entry);
    return entry;
  }

  public async update(
    id: Identifier,
    changes: Partial<MemoryEntry>,
  ): Promise<MemoryEntry | undefined> {
    const existing = this.entries.get(id);
    if (!existing) {
      return undefined;
    }

    const updated = new MemoryEntry({
      ...existing,
      ...changes,
      id,
      createdAt: existing.createdAt,
      metadata: existing.metadata,
      providerId: existing.providerId,
      value: changes.value ?? existing.value,
      updatedAt: new Date().toISOString(),
    });
    this.entries.set(id, updated);
    return updated;
  }

  public async retrieve(id: Identifier): Promise<MemoryEntry | undefined> {
    return this.entries.get(id);
  }

  public async delete(id: Identifier): Promise<void> {
    this.entries.delete(id);
  }

  public async list(scope?: string): Promise<readonly MemoryEntry[]> {
    return Array.from(this.entries.values()).filter((entry) =>
      scope ? entry.metadata.scope === scope : true,
    );
  }

  public async search(query: string): Promise<readonly MemoryEntry[]> {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.entries.values()).filter((entry) =>
      entry.key.toLowerCase().includes(lowerQuery),
    );
  }
}

export class RedisProvider implements IMemoryProvider {
  public constructor(
    options: {
      readonly providerId?: Identifier;
      readonly name?: string;
      readonly version?: string;
      readonly priority?: number;
      readonly supportsCompression?: boolean;
      readonly enabled?: boolean;
    } = {},
  ) {
    this.providerId = options.providerId ?? 'redis';
    this.name = options.name ?? 'RedisProvider';
    this.version = options.version ?? '1.0.0';
    this.priority = options.priority ?? 3;
    this.supportsCompression = options.supportsCompression ?? true;
    this.enabled = options.enabled ?? false;
    this.entries = new Map<Identifier, MemoryEntry>();
  }

  public readonly providerId: Identifier;
  public readonly name: string;
  public readonly version: string;
  public readonly priority: number;
  public readonly supportsCompression: boolean;
  public readonly enabled: boolean;
  private readonly entries: Map<Identifier, MemoryEntry>;

  public async store(entry: MemoryEntry): Promise<MemoryEntry> {
    if (!this.enabled) {
      return entry;
    }
    this.entries.set(entry.id, entry);
    return entry;
  }

  public async update(
    id: Identifier,
    changes: Partial<MemoryEntry>,
  ): Promise<MemoryEntry | undefined> {
    if (!this.enabled) {
      return undefined;
    }
    const existing = this.entries.get(id);
    if (!existing) {
      return undefined;
    }
    const updated = new MemoryEntry({
      ...existing,
      ...changes,
      id,
      createdAt: existing.createdAt,
      metadata: existing.metadata,
      providerId: existing.providerId,
      value: changes.value ?? existing.value,
      updatedAt: new Date().toISOString(),
    });
    this.entries.set(id, updated);
    return updated;
  }

  public async retrieve(id: Identifier): Promise<MemoryEntry | undefined> {
    return this.enabled ? this.entries.get(id) : undefined;
  }

  public async delete(id: Identifier): Promise<void> {
    if (this.enabled) {
      this.entries.delete(id);
    }
  }

  public async list(scope?: string): Promise<readonly MemoryEntry[]> {
    if (!this.enabled) {
      return [];
    }
    return Array.from(this.entries.values()).filter((entry) =>
      scope ? entry.metadata.scope === scope : true,
    );
  }

  public async search(query: string): Promise<readonly MemoryEntry[]> {
    if (!this.enabled) {
      return [];
    }
    const lowerQuery = query.toLowerCase();
    return Array.from(this.entries.values()).filter((entry) =>
      entry.key.toLowerCase().includes(lowerQuery),
    );
  }
}

export class HybridMemoryProvider implements IMemoryProvider {
  public constructor(
    options: {
      readonly providerId?: Identifier;
      readonly name?: string;
      readonly version?: string;
      readonly priority?: number;
      readonly supportsCompression?: boolean;
    } = {},
  ) {
    this.providerId = options.providerId ?? 'hybrid';
    this.name = options.name ?? 'HybridMemoryProvider';
    this.version = options.version ?? '1.0.0';
    this.priority = options.priority ?? 2;
    this.supportsCompression = options.supportsCompression ?? true;
    this.entries = new Map<Identifier, MemoryEntry>();
  }

  public readonly providerId: Identifier;
  public readonly name: string;
  public readonly version: string;
  public readonly priority: number;
  public readonly supportsCompression: boolean;
  private readonly entries: Map<Identifier, MemoryEntry>;

  public async store(entry: MemoryEntry): Promise<MemoryEntry> {
    this.entries.set(entry.id, entry);
    return entry;
  }

  public async update(
    id: Identifier,
    changes: Partial<MemoryEntry>,
  ): Promise<MemoryEntry | undefined> {
    const existing = this.entries.get(id);
    if (!existing) {
      return undefined;
    }
    const updated = new MemoryEntry({
      ...existing,
      ...changes,
      id,
      createdAt: existing.createdAt,
      metadata: existing.metadata,
      providerId: existing.providerId,
      value: changes.value ?? existing.value,
      updatedAt: new Date().toISOString(),
    });
    this.entries.set(id, updated);
    return updated;
  }

  public async retrieve(id: Identifier): Promise<MemoryEntry | undefined> {
    return this.entries.get(id);
  }

  public async delete(id: Identifier): Promise<void> {
    this.entries.delete(id);
  }

  public async list(scope?: string): Promise<readonly MemoryEntry[]> {
    return Array.from(this.entries.values()).filter((entry) =>
      scope ? entry.metadata.scope === scope : true,
    );
  }

  public async search(query: string): Promise<readonly MemoryEntry[]> {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.entries.values()).filter((entry) =>
      entry.key.toLowerCase().includes(lowerQuery),
    );
  }
}

export class MemoryRegistry {
  public constructor(private readonly providers: readonly IMemoryProvider[]) {}

  public list(): readonly IMemoryProvider[] {
    return [...this.providers].sort((left, right) => right.priority - left.priority);
  }

  public select(_scope?: string): IMemoryProvider {
    const sorted = this.list();
    return sorted[0] ?? new InMemoryProvider();
  }
}

export class MemoryCache {
  public constructor(private readonly entries = new Map<Identifier, MemoryEntry>()) {}

  public get(id: Identifier): MemoryEntry | undefined {
    return this.entries.get(id);
  }

  public set(entry: MemoryEntry): void {
    this.entries.set(entry.id, entry);
  }

  public delete(id: Identifier): void {
    this.entries.delete(id);
  }

  public clear(): void {
    this.entries.clear();
  }
}

export class MemoryLifecycle {
  public constructor(
    private readonly registry: MemoryRegistry,
    private readonly cache: MemoryCache = new MemoryCache(),
  ) {}

  public async store(entry: MemoryEntry): Promise<MemoryEntry> {
    const provider = this.registry.select(entry.metadata.scope);
    const persisted = await provider.store(
      new MemoryEntry({ ...entry, providerId: provider.providerId }),
    );
    this.cache.set(persisted);
    return persisted;
  }

  public async update(
    id: Identifier,
    changes: Partial<MemoryEntry>,
  ): Promise<MemoryEntry | undefined> {
    const provider = this.registry.select();
    const updated = await provider.update(id, changes);
    if (updated) {
      this.cache.set(updated);
    }
    return updated;
  }

  public async retrieve(id: Identifier): Promise<MemoryEntry | undefined> {
    const cached = this.cache.get(id);
    if (cached) {
      return cached;
    }

    const provider = this.registry.select();
    const entry = await provider.retrieve(id);
    if (entry) {
      this.cache.set(entry);
    }
    return entry;
  }

  public async delete(id: Identifier): Promise<void> {
    this.cache.delete(id);
    const provider = this.registry.select();
    await provider.delete(id);
  }

  public async list(scope?: string): Promise<readonly MemoryEntry[]> {
    const provider = this.registry.select(scope);
    return provider.list(scope);
  }
}

export class MemorySession {
  public constructor(
    public readonly id: Identifier = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  ) {}
}

export class MemoryIndex {
  public constructor(private readonly keys = new Map<string, Set<Identifier>>()) {}

  public add(key: string, id: Identifier): void {
    const ids = this.keys.get(key) ?? new Set<Identifier>();
    ids.add(id);
    this.keys.set(key, ids);
  }

  public remove(key: string, id: Identifier): void {
    const ids = this.keys.get(key);
    if (!ids) {
      return;
    }
    ids.delete(id);
    if (ids.size === 0) {
      this.keys.delete(key);
    }
  }

  public list(key: string): readonly Identifier[] {
    return Array.from(this.keys.get(key) ?? []);
  }
}

export class MemoryExpiration {
  public static fromTtl(ttlMs?: number): TimestampString | undefined {
    if (ttlMs === undefined || ttlMs <= 0) {
      return undefined;
    }
    return new Date(Date.now() + ttlMs).toISOString();
  }
}

export class MemorySnapshot {
  public constructor(options: {
    readonly id: Identifier;
    readonly entries: readonly MemoryEntry[];
    readonly takenAt: TimestampString;
    readonly scope?: string;
  }) {
    this.id = options.id;
    this.entries = Object.freeze([...options.entries]);
    this.takenAt = options.takenAt;
    this.scope = options.scope;
  }

  public readonly id: Identifier;
  public readonly entries: readonly MemoryEntry[];
  public readonly takenAt: TimestampString;
  public readonly scope?: string;
}

export class MemoryAudit {
  public constructor(public readonly events: string[] = []) {}

  public record(event: string): void {
    this.events.push(event);
  }
}

export class MemoryPipeline {
  public constructor(
    private readonly policy: MemoryPolicy,
    private readonly lifecycle: MemoryLifecycle,
    private readonly metrics: MemoryMetrics = new MemoryMetrics(),
  ) {}

  public async write(input: MemoryStoreInput): Promise<MemoryEntry> {
    const now = new Date().toISOString();
    const payload = input.value;
    const serialized = JSON.stringify(payload);
    const bytes = Buffer.byteLength(serialized, 'utf8');
    let summary: string | undefined;
    let compressed = false;

    if (this.policy.compression.enabled && bytes >= this.policy.compression.thresholdBytes) {
      compressed = true;
      summary = `compressed:${serialized.slice(0, 40)}`;
    } else {
      summary = serialized.slice(0, 80);
    }

    const policyValue = this.policy.encryptionHook ? this.policy.encryptionHook(payload) : payload;
    const entry = new MemoryEntry({
      id: input.id ?? `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      key: input.key,
      category: input.category,
      type: input.type,
      value: policyValue,
      createdAt: now,
      updatedAt: now,
      expiresAt: MemoryExpiration.fromTtl(input.ttlMs),
      metadata: new MemoryMetadataRecord({
        providerId: input.providerId,
        scope: input.scope,
        tags: input.metadata?.values ? Object.keys(input.metadata.values) : [],
        summary,
        compressed,
      }),
      providerId: input.providerId ?? 'inmemory',
      compressed,
      summary,
    });

    return this.lifecycle.store(entry);
  }

  public async read(id: Identifier): Promise<MemoryEntry | undefined> {
    const startedAt = Date.now();
    const result = await this.lifecycle.retrieve(id);
    const latency = Date.now() - startedAt;
    this.metrics.latencyMs = latency;
    return result;
  }

  public async delete(id: Identifier): Promise<void> {
    await this.lifecycle.delete(id);
  }
}

export interface MemoryStoreInput {
  readonly id?: Identifier;
  readonly key: string;
  readonly category: MemoryCategory;
  readonly type: MemoryType;
  readonly value: SerializableValue;
  readonly ttlMs?: number;
  readonly providerId?: Identifier;
  readonly scope?: string;
  readonly metadata?: MemoryMetadata;
}

export class MemoryManager {
  public constructor(
    options: {
      readonly policy?: MemoryPolicy;
      readonly registry?: MemoryRegistry;
      readonly lifecycle?: MemoryLifecycle;
      readonly audit?: MemoryAudit;
      readonly metrics?: MemoryMetrics;
      readonly session?: MemorySession;
    } = {},
  ) {
    this.policy = options.policy ?? new MemoryPolicy();
    this.registry =
      options.registry ?? new MemoryRegistry([new InMemoryProvider({ providerId: 'inmemory' })]);
    this.lifecycle = options.lifecycle ?? new MemoryLifecycle(this.registry);
    this.audit = options.audit ?? new MemoryAudit();
    this.metrics = options.metrics ?? new MemoryMetrics();
    this.session = options.session ?? new MemorySession();
    this.index = new MemoryIndex();
    this.pipeline = new MemoryPipeline(this.policy, this.lifecycle, this.metrics);
  }

  private readonly policy: MemoryPolicy;
  private readonly registry: MemoryRegistry;
  private readonly lifecycle: MemoryLifecycle;
  private readonly audit: MemoryAudit;
  private readonly metrics: MemoryMetrics;
  private readonly session: MemorySession;
  private readonly index: MemoryIndex;
  private readonly pipeline: MemoryPipeline;

  public async store(input: MemoryStoreInput): Promise<MemoryEntry> {
    const before = await this.lifecycle.list(input.scope);
    const entry = await this.pipeline.write(input);
    if (entry.expiresAt && Date.now() > Date.parse(entry.expiresAt)) {
      await this.pipeline.delete(entry.id);
      throw new Error('Memory entry expired before persistence');
    }

    if (before.length >= this.policy.retention.maxEntries) {
      const oldest = before[0];
      if (oldest) {
        await this.pipeline.delete(oldest.id);
      }
    }

    this.index.add(entry.key, entry.id);
    this.audit.record(`created:${entry.key}`);
    this.metrics.memorySizeBytes += Buffer.byteLength(JSON.stringify(entry.value), 'utf8');
    this.metrics.snapshotCount += 1;
    return entry;
  }

  public async update(
    id: Identifier,
    changes: Partial<MemoryEntry>,
  ): Promise<MemoryEntry | undefined> {
    const existing = await this.retrieve(id);
    if (!existing) {
      return undefined;
    }

    const updated = await this.lifecycle.update(id, changes);
    if (updated) {
      this.index.add(updated.key, updated.id);
      this.audit.record(`updated:${updated.key}`);
    }
    return updated;
  }

  public async retrieve(id: Identifier): Promise<MemoryEntry | undefined> {
    const entry = await this.pipeline.read(id);
    if (!entry) {
      this.metrics.misses += 1;
      return undefined;
    }

    if (entry.expiresAt && Date.now() > Date.parse(entry.expiresAt)) {
      this.metrics.misses += 1;
      await this.pipeline.delete(entry.id);
      return undefined;
    }

    this.metrics.hits += 1;
    return entry;
  }

  public async delete(id: Identifier): Promise<void> {
    const entry = await this.retrieve(id);
    if (entry) {
      this.index.remove(entry.key, entry.id);
    }
    this.audit.record(`deleted:${id}`);
    await this.pipeline.delete(id);
  }

  public async search(query: string): Promise<readonly MemoryEntry[]> {
    const provider = this.registry.select();
    return provider.search(query);
  }

  public async rank(entries: readonly MemoryEntry[]): Promise<readonly MemoryEntry[]> {
    return [...entries].sort((left, right) =>
      right.metadata.createdAt.localeCompare(left.metadata.createdAt),
    );
  }

  public async summarize(id: Identifier): Promise<string | undefined> {
    const entry = await this.retrieve(id);
    return entry?.summary ?? entry?.metadata.summary;
  }

  public async compress(id: Identifier): Promise<MemoryEntry | undefined> {
    const entry = await this.retrieve(id);
    if (!entry) {
      return undefined;
    }

    const compressedEntry = new MemoryEntry({
      ...entry,
      compressed: true,
      summary: `compressed:${entry.key}`,
      metadata: new MemoryMetadataRecord({
        ...entry.metadata,
        compressed: true,
        summary: `compressed:${entry.key}`,
      }),
    });

    return this.lifecycle.update(id, compressedEntry);
  }

  public async snapshot(scope?: string): Promise<MemorySnapshot> {
    const entries = await this.lifecycle.list(scope);
    return new MemorySnapshot({
      id: `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      entries,
      takenAt: new Date().toISOString(),
      scope,
    });
  }

  public async restore(id: Identifier): Promise<MemorySnapshot> {
    const snapshot = await this.snapshot();
    return new MemorySnapshot({
      id,
      entries: snapshot.entries,
      takenAt: new Date().toISOString(),
      scope: snapshot.scope,
    });
  }

  public getStatistics(): MemoryStatistics {
    return new MemoryStatistics({
      totalEntries: this.metrics.memorySizeBytes,
      expiredEntries: this.metrics.misses,
      snapshots: this.metrics.snapshotCount,
      providers: this.registry.list().length,
    });
  }

  public getMetrics(): MemoryMetrics {
    return this.metrics;
  }

  public getAudit(): MemoryAudit {
    return this.audit;
  }

  public getSession(): MemorySession {
    return this.session;
  }
}
