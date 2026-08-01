import { describe, expect, it } from 'vitest';
import {
  ContextAssembler,
  ContextBuilder,
  ContextBudget,
  ContextChunk,
  ContextCompression,
  ContextDeduplication,
  ContextFiltering,
  ContextOrchestrator,
  ContextPolicy,
  ContextWindow,
} from './index';

describe('context orchestration engine', () => {
  it('assembles and packages a context bundle', async () => {
    const orchestrator = new ContextOrchestrator({
      policy: new ContextPolicy({
        maxTokens: 256,
        maxCharacters: 4096,
      }),
    });

    const packageResult = await orchestrator.orchestrate({
      requestId: 'req-1',
      tenantId: 'tenant-a',
      sources: [
        {
          id: 'memory-1',
          source: 'working',
          content: 'Investigate the payment gateway outage',
          relevance: 0.95,
          recency: 0.9,
          confidence: 0.88,
          importance: 0.9,
          securityLabels: ['restricted'],
          tenantId: 'tenant-a',
        },
        {
          id: 'memory-2',
          source: 'semantic',
          content: 'Investigate the payment gateway outage',
          relevance: 0.9,
          recency: 0.8,
          confidence: 0.85,
          importance: 0.8,
          securityLabels: ['restricted'],
          tenantId: 'tenant-a',
        },
      ],
    });

    expect(packageResult.package.items.length).toBeGreaterThan(0);
    expect(packageResult.package.id).toBeTruthy();
    expect(packageResult.package.size).toBeGreaterThan(0);
  });

  it('compresses and budgets content', async () => {
    new ContextAssembler();
    const compression = new ContextCompression();
    const budget = new ContextBudget({ maxCharacters: 600 });
    const window = new ContextWindow({ maxTokens: 128 });

    const chunks = [
      new ContextChunk({ id: 'c1', content: 'one two three four five', source: 'semantic' }),
      new ContextChunk({ id: 'c2', content: 'six seven eight nine ten', source: 'working' }),
    ];

    const compressed = compression.compress(chunks);
    const withinBudget = budget.enforce(compressed, window);

    expect(withinBudget.length).toBeGreaterThan(0);
    expect(withinBudget[0]?.content.length).toBeLessThanOrEqual(600);
  });

  it('deduplicates and filters context items', async () => {
    const dedup = new ContextDeduplication();
    const filter = new ContextFiltering();
    const builder = new ContextBuilder();

    const items = [
      new ContextChunk({
        id: 'a',
        content: 'same',
        source: 'semantic',
        tenantId: 'tenant-a',
        securityLabels: ['restricted'],
      }),
      new ContextChunk({
        id: 'a',
        content: 'same',
        source: 'semantic',
        tenantId: 'tenant-a',
        securityLabels: ['restricted'],
      }),
      new ContextChunk({
        id: 'b',
        content: 'other',
        source: 'working',
        tenantId: 'tenant-a',
        securityLabels: ['restricted'],
      }),
    ];

    const deduped = dedup.deduplicate(items);
    const filtered = filter.filter(deduped, {
      tenantId: 'tenant-a',
      securityLabels: ['restricted'],
    });
    const packageResult = builder.build(filtered);

    expect(deduped.length).toBe(2);
    expect(filtered.length).toBe(2);
    expect(packageResult.id).toBeTruthy();
  });

  it('creates snapshots and statistics', async () => {
    const orchestrator = new ContextOrchestrator();
    await orchestrator.snapshot('baseline');
    const stats = await orchestrator.getStatistics();

    expect(stats.packages).toBeGreaterThanOrEqual(0);
    expect(stats.size).toBeGreaterThanOrEqual(0);
  });
});
