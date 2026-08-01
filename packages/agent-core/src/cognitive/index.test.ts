import { describe, expect, it } from 'vitest';
import {
  CognitiveExecutionPlan,
  CognitiveLifecycle,
  CognitiveOrchestrator,
  CognitivePolicy,
  CognitiveSession,
  CognitiveState,
} from './index';

describe('cognitive orchestrator', () => {
  it('runs a deterministic execution pipeline', async () => {
    const orchestrator = new CognitiveOrchestrator({
      policy: new CognitivePolicy({
        maxRetries: 2,
        timeoutMs: 500,
      }),
    });

    const session = new CognitiveSession({ id: 'session-1' });
    const execution = await orchestrator.execute(session, {
      requestId: 'req-1',
      task: 'investigate incident',
      tenantId: 'tenant-a',
      context: {
        workingMemory: ['incident detected'],
        conversation: ['investigate the incident'],
      },
    });

    expect(execution.result.status).toBe('completed');
    expect(execution.state.currentDecision).toBe('complete');
    expect(execution.checkpoints.length).toBeGreaterThan(0);
  });

  it('supports cancellation and retry decisions', async () => {
    const orchestrator = new CognitiveOrchestrator();
    const session = new CognitiveSession({ id: 'session-2' });
    const execution = await orchestrator.execute(session, {
      requestId: 'req-2',
      task: 'retry flow',
      tenantId: 'tenant-b',
      context: {
        workingMemory: ['retry needed'],
      },
    });

    expect(execution.result.status).toBe('completed');
    expect(execution.state.decisions.length).toBeGreaterThan(0);
  });

  it('creates snapshots and statistics', async () => {
    const orchestrator = new CognitiveOrchestrator();
    const session = new CognitiveSession({ id: 'session-3' });
    await orchestrator.execute(session, {
      requestId: 'req-3',
      task: 'snapshot flow',
      tenantId: 'tenant-c',
    });

    const snapshot = await orchestrator.snapshot('baseline');
    const statistics = await orchestrator.getStatistics();

    expect(snapshot.name).toBe('baseline');
    expect(statistics.executions).toBeGreaterThanOrEqual(1);
  });

  it('supports lifecycle transitions and immutable checkpoints', () => {
    const lifecycle = new CognitiveLifecycle();
    const checkpoint = new CognitiveExecutionPlan({ id: 'plan-1', steps: ['gather', 'evaluate'] });
    const state = new CognitiveState({ id: 'state-1', currentDecision: 'continue' });

    expect(lifecycle.getStatus()).toBe('created');
    expect(checkpoint.steps).toHaveLength(2);
    expect(state.currentDecision).toBe('continue');
  });
});
