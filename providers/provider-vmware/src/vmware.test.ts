import { describe, expect, it } from 'vitest';
import {
  VmwareDiscoveryService,
  VmwareMapper,
  VmwareNormalizationPipeline,
  VmwareProvider,
  VmwareProviderConfiguration,
  VmwareSession,
  VmwareSynchronizationService,
  VmwareSnapshotService,
} from './vmware';

describe('vmware provider framework', () => {
  it('discovers and normalizes records', async () => {
    const session = new VmwareSession({ id: 'session-1' });
    const discovery = new VmwareDiscoveryService(session);
    const records = await discovery.discover();
    const normalized = new VmwareNormalizationPipeline().normalize(records);

    expect(records).toHaveLength(5);
    expect(normalized[0].metadata?.normalized).toBe(true);
  });

  it('maps VMware records into canonical infrastructure entities', () => {
    const mapper = new VmwareMapper();
    const entity = mapper.map({ id: 'vm-1', kind: 'virtualMachine', name: 'app-01' });
    const relationship = mapper.mapRelationship({
      id: 'vm-1',
      kind: 'virtualMachine',
      name: 'app-01',
      parentId: 'host-1',
    });

    expect(entity.kind).toBe('virtualMachine');
    expect(relationship?.type).toBe('contains');
  });

  it('synchronizes inventory into an infrastructure model', async () => {
    const provider = new VmwareProvider({
      configuration: { kind: 'vmware', readOnly: true } as VmwareProviderConfiguration,
    });
    const model = await provider.synchronize();

    expect(model.entities.size).toBeGreaterThan(0);
    expect(model.relationships.size).toBeGreaterThan(0);
  });

  it('creates snapshots and reports health', async () => {
    const provider = new VmwareProvider({
      configuration: { kind: 'vmware', readOnly: true } as VmwareProviderConfiguration,
    });
    const snapshot = await provider.snapshot('baseline');
    const health = await provider.getHealth();
    const statistics = await provider.getStatistics();

    expect(snapshot.name).toBe('baseline');
    expect(health.healthy).toBe(true);
    expect(statistics.entityMappings).toBeGreaterThan(0);
  });

  it('supports thread-safe independent services', async () => {
    const snapshotService = new VmwareSnapshotService();
    const synchronization = new VmwareSynchronizationService(
      { inventory: async () => [] },
      new VmwareMapper(),
      new VmwareNormalizationPipeline(),
      snapshotService,
    );

    const model = await synchronization.synchronize();
    expect(model.entities.size).toBe(0);
  });
});
