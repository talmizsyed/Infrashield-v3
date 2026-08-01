import { describe, expect, it } from 'vitest';
import {
  KubernetesDiscoveryService,
  KubernetesMapper,
  KubernetesNormalizationPipeline,
  KubernetesProvider,
  KubernetesProviderConfiguration,
  KubernetesSession,
  KubernetesSnapshotService,
  KubernetesSynchronizationService,
} from './kubernetes';

describe('kubernetes provider framework', () => {
  it('discovers and normalizes records', async () => {
    const session = new KubernetesSession({ id: 'session-1' });
    const discovery = new KubernetesDiscoveryService(session);
    const records = await discovery.discover();
    const normalized = new KubernetesNormalizationPipeline().normalize(records);

    expect(records).toHaveLength(6);
    expect(normalized[0].metadata?.normalized).toBe(true);
  });

  it('maps kubernetes records into canonical infrastructure entities', () => {
    const mapper = new KubernetesMapper();
    const entity = mapper.map({ id: 'deployment-1', kind: 'deployment', name: 'payments' });
    const relationship = mapper.mapRelationship({
      id: 'pod-1',
      kind: 'pod',
      name: 'payments-abc123',
      parentId: 'deployment-1',
    });

    expect(entity.kind).toBe('deployment');
    expect(relationship?.type).toBe('contains');
  });

  it('synchronizes inventory into an infrastructure model', async () => {
    const provider = new KubernetesProvider({
      configuration: { kind: 'kubernetes', readOnly: true } as KubernetesProviderConfiguration,
    });
    const model = await provider.synchronize();

    expect(model.entities.size).toBeGreaterThan(0);
    expect(model.relationships.size).toBeGreaterThan(0);
  });

  it('creates snapshots and reports health', async () => {
    const provider = new KubernetesProvider({
      configuration: { kind: 'kubernetes', readOnly: true } as KubernetesProviderConfiguration,
    });
    const snapshot = await provider.snapshot('baseline');
    const health = await provider.getHealth();
    const statistics = await provider.getStatistics();

    expect(snapshot.name).toBe('baseline');
    expect(health.healthy).toBe(true);
    expect(statistics.entityMappings).toBeGreaterThan(0);
  });

  it('supports independent services', async () => {
    const snapshotService = new KubernetesSnapshotService();
    const synchronization = new KubernetesSynchronizationService(
      { inventory: async () => [] },
      new KubernetesMapper(),
      new KubernetesNormalizationPipeline(),
      snapshotService,
    );

    const model = await synchronization.synchronize();
    expect(model.entities.size).toBe(0);
  });
});
