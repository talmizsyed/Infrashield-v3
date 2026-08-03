import { describe, expect, it } from 'vitest';

import { UnifiedAgentRuntime } from './unified-agent-runtime.js';

describe('unified agent runtime', () => {
  it('executes the full request lifecycle and returns a unified result', async () => {
    const runtime = new UnifiedAgentRuntime();
    const result = await runtime.execute({
      requestId: 'req-unified-1',
      input: 'Investigate the suspicious deployment',
      metadata: { tenantId: 'tenant-a' },
    });

    expect(result.executionId).toBeTruthy();
    expect(result.correlationId).toBe('req-unified-1');
    expect(result.timeline).toContain('REQUEST_RECEIVED');
    expect(result.timeline).toContain('PLAN_CREATED');
    expect(result.timeline).toContain('WORKFLOW_CREATED');
    expect(result.timeline).toContain('REQUEST_COMPLETED');
    expect(result.providerResponses.length).toBeGreaterThan(0);
    expect(result.memoryUpdates.length).toBeGreaterThan(0);
    expect(result.knowledgeGraphUpdates.length).toBeGreaterThan(0);
    expect(result.observabilityEvents.length).toBeGreaterThan(0);
    expect(result.finalOutput).toBeDefined();
  });
});
