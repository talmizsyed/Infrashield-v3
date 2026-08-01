import { describe, expect, it } from 'vitest';
import {
  InfrastructureEntity,
  InfrastructureFilter,
  InfrastructureModel,
  InfrastructureProjection,
  InfrastructureProviderRegistry,
  InfrastructureRegistry,
  InfrastructureRelationship,
  InfrastructureSearch,
  InfrastructureTopology,
} from './index';

describe('infrastructure digital twin framework', () => {
  it('manages entity lifecycle and relationships', async () => {
    const registry = new InfrastructureRegistry({ name: 'platform' });
    const datacenter = new InfrastructureEntity({
      id: 'dc-1',
      name: 'Primary DC',
      kind: 'datacenter',
      tenantId: 'tenant-a',
    });
    const cluster = new InfrastructureEntity({
      id: 'cluster-1',
      name: 'Cluster A',
      kind: 'cluster',
      tenantId: 'tenant-a',
    });

    await registry.createEntity(datacenter);
    await registry.createEntity(cluster);
    await registry.createRelationship(
      new InfrastructureRelationship({
        id: 'rel-1',
        type: 'contains',
        fromId: datacenter.id,
        toId: cluster.id,
        tenantId: 'tenant-a',
      }),
    );

    const model = registry.getModel();
    expect(model.getEntity(datacenter.id)).toBeDefined();
    expect(model.getRelationships().length).toBe(1);

    await registry.deleteEntity(cluster.id);
    expect(registry.getModel().getEntity(cluster.id)).toBeUndefined();
  });

  it('creates snapshots and topology views', async () => {
    const registry = new InfrastructureRegistry();
    const topology = new InfrastructureTopology();
    const model = new InfrastructureModel({ id: 'model-1', name: 'core' });

    await registry.createEntity(
      new InfrastructureEntity({ id: 'svc-1', name: 'checkout', kind: 'service' }),
    );
    await registry.createEntity(
      new InfrastructureEntity({ id: 'db-1', name: 'orders-db', kind: 'database' }),
    );
    await registry.createRelationship(
      new InfrastructureRelationship({
        id: 'rel-2',
        type: 'dependsOn',
        fromId: 'svc-1',
        toId: 'db-1',
      }),
    );

    const snapshot = registry.snapshot('baseline');
    expect(snapshot.name).toBe('baseline');
    expect(snapshot.entityCount).toBeGreaterThan(0);
    expect(snapshot.relationshipCount).toBeGreaterThan(0);
    expect(topology.graphs.topology).toHaveLength(0);

    const merged = model.merge(registry.getModel());
    expect(merged.getEntity('svc-1')).toBeDefined();
  });

  it('filters and searches entities', () => {
    const entities = [
      new InfrastructureEntity({ id: 'app-1', name: 'gateway', kind: 'application' }),
      new InfrastructureEntity({ id: 'svc-2', name: 'auth', kind: 'service' }),
      new InfrastructureEntity({ id: 'db-2', name: 'auth-db', kind: 'database' }),
    ];

    const search = new InfrastructureSearch({ kind: 'service' });
    const filter = new InfrastructureFilter({ kind: 'application' });

    expect(search.search(entities)).toHaveLength(1);
    expect(filter.apply(entities)).toHaveLength(1);
  });

  it('supports projection and impact traversal', async () => {
    const registry = new InfrastructureRegistry({ name: 'impact' });
    await registry.createEntity(
      new InfrastructureEntity({ id: 'api-1', name: 'api', kind: 'api' }),
    );
    await registry.createEntity(
      new InfrastructureEntity({ id: 'svc-3', name: 'billing', kind: 'service' }),
    );
    await registry.createEntity(
      new InfrastructureEntity({ id: 'db-3', name: 'billing-db', kind: 'database' }),
    );
    await registry.createRelationship(
      new InfrastructureRelationship({
        id: 'rel-3',
        type: 'dependsOn',
        fromId: 'api-1',
        toId: 'svc-3',
      }),
    );
    await registry.createRelationship(
      new InfrastructureRelationship({
        id: 'rel-4',
        type: 'dependsOn',
        fromId: 'svc-3',
        toId: 'db-3',
      }),
    );

    const projection = new InfrastructureProjection({ kinds: ['api', 'service'] });
    const projected = projection.project(registry.getModel());
    expect(projected.entities).toHaveLength(2);

    const impacts = registry.traverseImpacts('api-1', { depth: 2 });
    expect(impacts.map((entity) => entity.id)).toContain('db-3');
  });

  it('registers providers and supports atomic updates', async () => {
    const providerRegistry = new InfrastructureProviderRegistry();
    const registry = new InfrastructureRegistry({ name: 'providers' });

    providerRegistry.register({
      kind: 'kubernetes',
      discover: async () => new InfrastructureModel({ id: 'k8s', name: 'k8s' }),
      sync: async () => new InfrastructureModel({ id: 'k8s', name: 'k8s' }),
    });

    await Promise.all([
      registry.createEntity(
        new InfrastructureEntity({ id: 'node-1', name: 'node-1', kind: 'host' }),
      ),
      registry.createEntity(
        new InfrastructureEntity({ id: 'node-2', name: 'node-2', kind: 'host' }),
      ),
    ]);

    expect(providerRegistry.get('kubernetes')).toBeDefined();
    expect(registry.getStatistics().entityCount).toBe(2);
  });
});
