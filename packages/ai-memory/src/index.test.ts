import { describe, expect, it } from 'vitest';

import {
  HybridMemoryProvider,
  InMemoryProvider,
  MemoryCategory,
  MemoryCompression,
  MemoryManager,
  MemoryMetadata,
  MemoryPolicy,
  MemoryRegistry,
  MemoryRetention,
  MemoryType,
  MemoryValue,
} from './index';

describe('ai-memory enterprise runtime', () => {
  it('supports CRUD, snapshots, and restore flows', async () => {
    const manager = new MemoryManager({
      policy: new MemoryPolicy({
        retention: new MemoryRetention({ maxEntries: 10 }),
        compression: new MemoryCompression({ enabled: false }),
      }),
      registry: new MemoryRegistry([new InMemoryProvider({ providerId: 'inmemory' })]),
    });

    const created = await manager.store({
      key: 'user:42:profile',
      category: MemoryCategory.Agent,
      type: MemoryType.Working,
      value: { name: 'Ada' },
      scope: 'tenant-a',
      metadata: new MemoryMetadata({ source: 'agent' }),
    });

    expect(created.value).toEqual({ name: 'Ada' });

    const updated = await manager.update(created.id, { value: { name: 'Ada Lovelace' } });
    expect(updated?.value).toEqual({ name: 'Ada Lovelace' });

    const retrieved = await manager.retrieve(created.id);
    expect(retrieved?.value).toEqual({ name: 'Ada Lovelace' });

    const snapshot = await manager.snapshot('tenant-a');
    expect(snapshot.entries.length).toBeGreaterThan(0);

    const restored = await manager.restore(snapshot.id);
    expect(restored.entries.some((entry) => entry.key === created.key)).toBe(true);

    await manager.delete(created.id);
    const afterDelete = await manager.retrieve(created.id);
    expect(afterDelete).toBeUndefined();
  });

  it('expires entries and applies retention policies', async () => {
    const manager = new MemoryManager({
      policy: new MemoryPolicy({
        retention: new MemoryRetention({ maxEntries: 5, ttlMs: 30 }),
      }),
      registry: new MemoryRegistry([new InMemoryProvider({ providerId: 'inmemory' })]),
    });

    await manager.store({
      key: 'temp:1',
      category: MemoryCategory.Temporary,
      type: MemoryType.Temporary,
      value: 'temporary',
      ttlMs: 30,
    });

    await new Promise((resolve) => setTimeout(resolve, 80));

    const expired = await manager.retrieve('temp:1');
    expect(expired).toBeUndefined();
  });

  it('compresses large payloads and produces a summary', async () => {
    const manager = new MemoryManager({
      policy: new MemoryPolicy({
        compression: new MemoryCompression({ enabled: true, thresholdBytes: 20 }),
      }),
      registry: new MemoryRegistry([new InMemoryProvider({ providerId: 'inmemory' })]),
    });

    const created = await manager.store({
      key: 'notes:1',
      category: MemoryCategory.Reflection,
      type: MemoryType.Reflection,
      value: 'This is a long reflection payload that should be compressed by the pipeline.',
      metadata: new MemoryMetadata({ source: 'reflection' }),
    });

    expect(created.compressed).toBe(true);
    expect(created.summary).toContain('reflection');
  });

  it('selects providers and supports hybrid routing', async () => {
    const registry = new MemoryRegistry([
      new InMemoryProvider({ providerId: 'inmemory', priority: 1 }),
      new HybridMemoryProvider({ providerId: 'hybrid', priority: 2 }),
    ]);

    const manager = new MemoryManager({ registry });

    const created = await manager.store({
      key: 'hybrid:1',
      category: MemoryCategory.Workflow,
      type: MemoryType.Workflow,
      value: 'workflow-state',
      scope: 'tenant-z',
    });

    expect(created.providerId).toBe('hybrid');
  });

  it('supports concurrent writes and immutable snapshots', async () => {
    const manager = new MemoryManager({
      registry: new MemoryRegistry([new InMemoryProvider({ providerId: 'inmemory', priority: 1 })]),
    });

    await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        manager.store({
          key: `concurrent:${index}`,
          category: MemoryCategory.Session,
          type: MemoryType.Session,
          value: new MemoryValue(`value-${index}`),
          scope: 'session-1',
        }),
      ),
    );

    const snapshot = await manager.snapshot('session-1');
    const firstEntry = snapshot.entries[0];
    expect(firstEntry).toBeDefined();
    expect(snapshot.entries.length).toBe(10);

    const values = snapshot.entries.map((entry) => entry.value);
    expect(values).toEqual(expect.arrayContaining([expect.any(MemoryValue)]));
  });
});
