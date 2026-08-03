import { describe, expect, it } from 'vitest';

import {
  ChangeDetector,
  DiscoveryAudit,
  DiscoveryContext,
  DiscoveryEngine,
  DiscoveryInventory,
  DiscoveryManager,
  DiscoveryManifest,
  DiscoveryMetrics,
  DiscoveryPolicy,
  DiscoveryScheduler,
  DiscoverySnapshot,
  DiscoveryStatistics,
  DiscoveryVersion,
  InventoryCollector,
  InventoryComparer,
  InventoryMerger,
  InventoryNormalizer,
  InventoryValidator,
  InventoryVersionManager,
  ResourceFingerprint,
  SynchronizationResult,
  type IDiscoveryProvider,
} from './index';

class TestProvider implements IDiscoveryProvider {
  public constructor(private readonly id = 'test-provider') {}

  public get providerId(): string {
    return this.id;
  }

  public async collect(_context: DiscoveryContext): Promise<DiscoveryInventory> {
    return new DiscoveryInventory({
      providerId: this.id,
      resources: [
        {
          id: 'resource-1',
          kind: 'service',
          tenantId: 'tenant-a',
          metadata: { name: 'api' },
          relationships: [],
        },
      ],
    });
  }

  public async discover(_context: DiscoveryContext): Promise<DiscoveryInventory> {
    return this.collect(_context);
  }

  public async isReadOnly(): Promise<boolean> {
    return true;
  }
}

describe('discovery platform', () => {
  it('executes the full discovery pipeline and emits a snapshot', async () => {
    const provider = new TestProvider();
    const engine = new DiscoveryEngine({ provider });
    const context = new DiscoveryContext({
      providerId: provider.providerId,
      tenantId: 'tenant-a',
      mode: 'full',
      readOnly: true,
      policy: new DiscoveryPolicy(),
    });

    const execution = await engine.discover(context);

    expect(execution.snapshot).toBeInstanceOf(DiscoverySnapshot);
    expect(execution.snapshot.inventory.resources).toHaveLength(1);
    expect(execution.statistics.inventorySize).toBe(1);
    expect(execution.changes.some((change) => change.kind === 'added')).toBe(true);
  });

  it('merges inventories and detects added and removed resources', () => {
    const previous = new DiscoveryInventory({
      providerId: 'prov',
      resources: [
        {
          id: 'old',
          kind: 'service',
          tenantId: 'tenant-a',
          metadata: { name: 'old' },
          relationships: [],
        },
      ],
    });
    const current = new DiscoveryInventory({
      providerId: 'prov',
      resources: [
        {
          id: 'new',
          kind: 'service',
          tenantId: 'tenant-a',
          metadata: { name: 'new' },
          relationships: [],
        },
      ],
    });

    const merger = new InventoryMerger();
    const merged = merger.merge(previous, current);
    const detector = new ChangeDetector();
    const changes = detector.detect(previous, current);

    expect(merged.resources).toHaveLength(1);
    expect(changes.some((change) => change.kind === 'added')).toBe(true);
    expect(changes.some((change) => change.kind === 'removed')).toBe(true);
  });

  it('schedules discovery runs and recovers from failures', async () => {
    const scheduler = new DiscoveryScheduler();
    const first = scheduler.schedule({ providerId: 'a', kind: 'full' });
    const second = scheduler.schedule({ providerId: 'b', kind: 'incremental' });

    expect(scheduler.next()?.id).toBe(first.id);
    expect(scheduler.next()?.id).toBe(second.id);

    const manager = new DiscoveryManager();
    const checkpoint = manager.createCheckpoint('prov', { mode: 'incremental' });
    expect(checkpoint.providerId).toBe('prov');

    const result = await manager.recover(
      { providerId: 'prov', mode: 'incremental' },
      { success: false, error: 'timeout' },
    );
    expect(result).toBeInstanceOf(SynchronizationResult);
  });

  it('normalizes, validates, versions, and fingerprints resources', () => {
    const collector = new InventoryCollector();
    const normalizer = new InventoryNormalizer();
    const validator = new InventoryValidator();
    const versionManager = new InventoryVersionManager();
    const comparer = new InventoryComparer();
    const fingerprint = new ResourceFingerprint();

    const inventory = collector.collect({
      providerId: 'prov',
      resources: [
        {
          id: 'resource-2',
          kind: 'service',
          tenantId: 'tenant-a',
          metadata: { name: 'Api' },
          relationships: [],
        },
      ],
    });
    const normalized = normalizer.normalize(inventory);
    const valid = validator.validate(normalized);
    const versioned = versionManager.version(valid);
    const compared = comparer.compare(previousVersionInventory(), versioned);
    const hash = fingerprint.compute(versioned.resources[0]!);

    expect(valid.resources).toHaveLength(1);
    expect(versioned.version).toBeDefined();
    expect(compared.changed).toBe(true);
    expect(hash).toMatch(/^[a-f0-9]{8,}$/);
  });

  it('tracks metrics, audit entries, and manifests', () => {
    const metrics = new DiscoveryMetrics();
    const statistics = new DiscoveryStatistics();
    const audit = new DiscoveryAudit({ providerId: 'prov', action: 'inspect' });
    const manifest = new DiscoveryManifest({
      providerId: 'prov',
      version: new DiscoveryVersion(1, 0, 0),
      inventorySize: 3,
      checksum: 'abc123',
    });

    metrics.recordDuration(25);
    metrics.recordInventorySize(3);
    statistics.incrementFailures();
    statistics.incrementRetries();

    expect(metrics.averageDuration).toBe(25);
    expect(statistics.failureRate).toBeGreaterThanOrEqual(0);
    expect(audit.providerId).toBe('prov');
    expect(manifest.version.toString()).toBe('1.0.0');
  });
});

function previousVersionInventory(): DiscoveryInventory {
  return new DiscoveryInventory({
    providerId: 'prov',
    resources: [
      {
        id: 'resource-2',
        kind: 'service',
        tenantId: 'tenant-a',
        metadata: { name: 'api' },
        relationships: [],
      },
    ],
  });
}
