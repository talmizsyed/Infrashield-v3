import { describe, expect, it } from 'vitest';

import {
  DeterministicSemanticProvider,
  SemanticDocument,
  SemanticMemoryManager,
  SemanticQuery,
  SemanticRankingPolicy,
  SemanticSearchRequest,
} from './index';

describe('semantic memory framework', () => {
  it('chunks documents and preserves metadata', async () => {
    const manager = new SemanticMemoryManager();
    const document = new SemanticDocument({
      id: 'doc-1',
      content:
        'Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi',
      tenant: 'tenant-a',
      source: 'planning',
      labels: ['planning', 'summary'],
      metadata: { category: 'plan' },
    });

    const indexed = await manager.indexDocument(document);
    expect(indexed.chunks.length).toBeGreaterThan(1);
    expect(indexed.chunks[0]?.metadata.labels).toContain('planning');
  });

  it('retrieves semantically similar content and applies ranking', async () => {
    const manager = new SemanticMemoryManager({
      provider: new DeterministicSemanticProvider(),
      rankingPolicy: new SemanticRankingPolicy({ topK: 3, threshold: 0.2 }),
    });

    const document = new SemanticDocument({
      id: 'doc-2',
      content: 'The sky is blue during the day and clouds can reflect sunlight.',
      tenant: 'tenant-a',
      source: 'reflection',
      labels: ['weather'],
      metadata: { category: 'observation' },
    });

    await manager.indexDocument(document);

    const request = new SemanticSearchRequest({
      query: new SemanticQuery({
        text: 'The sky appears blue in daylight',
        tenant: 'tenant-a',
      }),
      topK: 3,
      threshold: 0.1,
    });

    const result = await manager.search(request);
    expect(result.results[0]?.document.id).toBe(document.id);
    expect(result.results[0]?.score.similarity).toBeGreaterThan(0);
  });

  it('filters by tenant and metadata, then caches retrievals', async () => {
    const manager = new SemanticMemoryManager({
      provider: new DeterministicSemanticProvider(),
    });

    const document = new SemanticDocument({
      id: 'doc-3',
      content: 'Quarterly budget review for finance operations.',
      tenant: 'tenant-b',
      source: 'workflow',
      labels: ['finance', 'budget'],
      metadata: { category: 'report', owner: 'ops' },
    });

    await manager.indexDocument(document);

    const request = new SemanticSearchRequest({
      query: new SemanticQuery({
        text: 'budget report',
        tenant: 'tenant-b',
        metadataFilter: { category: 'report' },
      }),
      topK: 5,
      threshold: 0.01,
    });

    const first = await manager.search(request);
    const second = await manager.search(request);

    expect(first.results.some((entry) => entry.document.id === document.id)).toBe(true);
    expect(second.results.some((entry) => entry.document.id === document.id)).toBe(true);
    expect(manager.getMetrics().cacheHits).toBeGreaterThan(0);
  });

  it('creates snapshots and supports concurrent indexing', async () => {
    const manager = new SemanticMemoryManager({ provider: new DeterministicSemanticProvider() });

    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        manager.indexDocument(
          new SemanticDocument({
            id: `doc-${index}`,
            content: `Concurrent semantic document ${index}`,
            tenant: 'tenant-c',
            source: 'runtime',
            labels: ['concurrency'],
          }),
        ),
      ),
    );

    const snapshot = manager.createSnapshot();
    expect(snapshot.documents.length).toBe(8);
    expect(snapshot.documents[0]?.id).toBeDefined();

    const stats = manager.getStatistics();
    expect(stats.documentCount).toBe(8);
  });
});
