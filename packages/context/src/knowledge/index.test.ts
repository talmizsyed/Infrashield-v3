import { describe, expect, it } from 'vitest';
import {
  KnowledgeFilter,
  KnowledgeGraphManager,
  KnowledgeInference,
  KnowledgePolicy,
  KnowledgeProjection,
  KnowledgeQuery,
  KnowledgeRankingPolicy,
  KnowledgeSearchRequest,
  KnowledgeTraversal,
} from './index';

describe('knowledge graph platform', () => {
  it('creates entities and relationships', async () => {
    const manager = new KnowledgeGraphManager();

    const entity = await manager.createEntity({
      name: 'payments-api',
      type: 'service',
      labels: ['service', 'application'],
      tenantId: 'tenant-a',
    });

    const relationship = await manager.createRelationship({
      type: 'dependsOn',
      fromId: entity.id,
      toId: entity.id,
      tenantId: 'tenant-a',
    });

    expect(entity.id).toBeTruthy();
    expect(entity.labels).toContain('service');
    expect(relationship.type).toBe('dependsOn');
    expect(relationship.fromId).toBe(entity.id);
    expect(relationship.toId).toBe(entity.id);
  });

  it('traverses and ranks neighbors', async () => {
    const manager = new KnowledgeGraphManager();

    const source = await manager.createEntity({
      name: 'gateway',
      type: 'service',
      labels: ['service'],
      tenantId: 'tenant-b',
    });
    const target = await manager.createEntity({
      name: 'database',
      type: 'database',
      labels: ['database'],
      tenantId: 'tenant-b',
    });

    await manager.createRelationship({
      type: 'dependsOn',
      fromId: source.id,
      toId: target.id,
      tenantId: 'tenant-b',
    });

    const traversal = await manager.traverse(
      new KnowledgeTraversal({
        sourceId: source.id,
        maxDepth: 2,
        includeOutbound: true,
        tenantId: 'tenant-b',
      }),
    );

    expect(traversal.nodes.some((node) => node.id === target.id)).toBe(true);
    expect(traversal.edges.length).toBeGreaterThan(0);
    expect(traversal.results[0]?.score ?? 0).toBeGreaterThanOrEqual(0);
  });

  it('filters and ranks search results', async () => {
    const manager = new KnowledgeGraphManager();

    await manager.createEntity({
      name: 'auth-service',
      type: 'service',
      labels: ['service', 'security'],
      tenantId: 'tenant-c',
    });
    await manager.createEntity({
      name: 'billing-service',
      type: 'service',
      labels: ['service', 'finance'],
      tenantId: 'tenant-c',
    });

    const result = await manager.search(
      new KnowledgeSearchRequest({
        query: new KnowledgeQuery({
          type: 'service',
          labels: ['service'],
          tenantId: 'tenant-c',
        }),
        filter: new KnowledgeFilter({
          tenantId: 'tenant-c',
        }),
        ranking: new KnowledgeRankingPolicy({
          maxResults: 5,
          minimumScore: 0,
        }),
        projection: new KnowledgeProjection({
          includeProperties: true,
        }),
      }),
    );

    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0]?.score ?? 0).toBeGreaterThanOrEqual(0);
  });

  it('creates snapshots and inference hooks', async () => {
    const manager = new KnowledgeGraphManager({
      policy: new KnowledgePolicy({
        enableInference: true,
      }),
      inferenceHook: async (query: KnowledgeQuery) => {
        if (query.type === 'service') {
          return [
            new KnowledgeInference({
              type: 'derived',
              confidence: 0.9,
              description: 'service derived observation',
              query,
            }),
          ];
        }

        return [];
      },
    });

    await manager.createEntity({
      name: 'workflow-service',
      type: 'service',
      labels: ['service'],
      tenantId: 'tenant-d',
    });

    const inference = await manager.infer(new KnowledgeQuery({ type: 'service' }));
    const snapshot = await manager.snapshot('baseline');

    expect(inference.length).toBeGreaterThan(0);
    expect(snapshot.name).toBe('baseline');
    expect(snapshot.nodeCount).toBeGreaterThan(0);
  });

  it('supports concurrent writes without corrupting the graph', async () => {
    const manager = new KnowledgeGraphManager();

    await Promise.all(
      Array.from({ length: 5 }).map((_, index) =>
        manager.createEntity({
          name: `entity-${index}`,
          type: 'asset',
          labels: ['asset'],
          tenantId: 'tenant-e',
        }),
      ),
    );

    const statistics = await manager.getStatistics();
    expect(statistics.nodeCount).toBe(5);
  });
});
