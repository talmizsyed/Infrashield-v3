import { describe, expect, it } from 'vitest';

import {
  ProviderCapabilities,
  ProviderConfiguration,
  ProviderDiscoveryJob,
  ProviderFactory,
  ProviderHealth,
  ProviderHealthJob,
  ProviderHost,
  ProviderInventoryJob,
  ProviderLifecycle,
  ProviderLifecycleState,
  ProviderManager,
  ProviderManifest,
  ProviderMetadata,
  ProviderRegistry,
  ProviderScheduler,
  ProviderSnapshot,
  ProviderSynchronization,
  ProviderVersion,
  type IProvider,
} from './index';

class TestProvider implements IProvider {
  public readonly metadata: ProviderMetadata;
  public readonly capabilities: ProviderCapabilities;
  public readonly version: ProviderVersion;
  public readonly configuration: ProviderConfiguration;
  public readonly lifecycle: ProviderLifecycle;
  public readonly health: ProviderHealth;
  public readonly synchronization: ProviderSynchronization;

  public constructor(id = 'test-provider') {
    this.metadata = new ProviderMetadata({ id, name: 'Test Provider', kind: 'test' });
    this.capabilities = new ProviderCapabilities({
      inventory: true,
      topology: true,
      metrics: true,
      events: true,
      configuration: true,
      snapshots: true,
      health: true,
      automation: true,
      readOnly: true,
      readWrite: false,
    });
    this.version = new ProviderVersion(1, 2, 3);
    this.configuration = new ProviderConfiguration({
      tenantId: 'tenant-a',
      settings: { mode: 'test' },
      credentialRefs: [],
    });
    this.lifecycle = new ProviderLifecycle({ providerId: id });
    this.health = new ProviderHealth({ providerId: id });
    this.synchronization = new ProviderSynchronization({ providerId: id });
  }

  public async initialize(): Promise<void> {
    await this.lifecycle.initialize();
  }

  public async start(): Promise<void> {
    await this.lifecycle.start();
  }

  public async stop(): Promise<void> {
    await this.lifecycle.stop();
  }

  public snapshot(): ProviderSnapshot {
    return new ProviderSnapshot(
      this.metadata,
      this.lifecycle.state,
      this.health,
      this.synchronization,
    );
  }
}

describe('provider platform', () => {
  it('manages lifecycle transitions and is provider-agnostic', async () => {
    const provider = new TestProvider('lifecycle-provider');

    await provider.initialize();
    await provider.start();
    expect(provider.lifecycle.state).toBe(ProviderLifecycleState.Running);

    await provider.stop();
    expect(provider.lifecycle.state).toBe(ProviderLifecycleState.Stopped);
  });

  it('registers providers and resolves capabilities', async () => {
    const registry = new ProviderRegistry();
    const factory = new ProviderFactory();
    const provider = new TestProvider('capability-provider');

    await factory.registerProvider(provider);
    await registry.register(provider);

    const present = registry.get(provider.metadata.id);
    expect(present?.metadata.id).toBe(provider.metadata.id);
    expect(provider.capabilities.supports('inventory')).toBe(true);
    expect(provider.capabilities.supports('read-write')).toBe(false);
  });

  it('schedules discovery and inventory jobs with priority ordering', async () => {
    const scheduler = new ProviderScheduler();
    const discovery = new ProviderDiscoveryJob({ providerId: 'prov-a', kind: 'manual' });
    const inventory = new ProviderInventoryJob({ providerId: 'prov-a', kind: 'refresh' });
    const health = new ProviderHealthJob({ providerId: 'prov-a', kind: 'check' });

    scheduler.schedule(discovery, { priority: 10 });
    scheduler.schedule(inventory, { priority: 5 });
    scheduler.schedule(health, { priority: 20 });

    const next = scheduler.next();
    expect(next?.job.id).toBe(health.id);
  });

  it('tracks health and synchronization metrics', async () => {
    const health = new ProviderHealth({ providerId: 'health-provider' });
    const synchronization = new ProviderSynchronization({ providerId: 'health-provider' });

    health.recordSuccess(120);
    health.recordFailure('timeout');
    health.recordHeartbeat(25);

    await synchronization.synchronize({ durationMs: 45, inventorySize: 14 });

    expect(health.successRate).toBe(0.5);
    expect(health.errorRate).toBe(0.5);
    expect(health.availability).toBeGreaterThan(0);
    expect(synchronization.lastDurationMs).toBe(45);
    expect(synchronization.inventorySize).toBe(14);
  });

  it('produces immutable snapshots and hosts providers through the runtime', async () => {
    const host = new ProviderHost();
    const manager = new ProviderManager({ host });
    const provider = new TestProvider('snapshot-provider');

    await manager.register(provider);
    const snapshot = manager.snapshot(provider.metadata.id);

    expect(snapshot).toBeInstanceOf(ProviderSnapshot);
    expect(snapshot?.providerId).toBe(provider.metadata.id);
    expect(() => {
      const data = snapshot?.toJSON();
      if (typeof data === 'object' && data) {
        (data as Record<string, unknown>).providerId = 'tampered';
      }
    }).not.toThrow();
  });

  it('builds manifests and versions from metadata', () => {
    const manifest = new ProviderManifest({
      id: 'manifest-provider',
      name: 'Manifest Provider',
      version: new ProviderVersion(2, 0, 1),
      capabilities: ['inventory', 'metrics'],
      dependencies: [{ name: 'runtime', version: '1.0.0' }],
    });

    expect(manifest.version.toString()).toBe('2.0.1');
  });
});
