import { describe, expect, it } from 'vitest';
import { createAgentRuntimeWithSamples } from './index';

describe('agent runtime', () => {
  it('registers the supported agent types and completes an execution lifecycle', () => {
    const runtime = createAgentRuntimeWithSamples();
    const result = runtime.run('operations', 'review operational posture');

    expect(runtime.registry.list()).toHaveLength(8);
    expect(result.state).toBe('completed');
    expect(result.checkpoint?.completedTaskIds).toEqual(['assess', 'execute']);
  });

  it('plans and cancels a session', () => {
    const runtime = createAgentRuntimeWithSamples();
    const session = runtime.initialize('security', 'review policy drift', 'background');

    expect(runtime.validate(session.id).state).toBe('validated');
    expect(runtime.plan(session.id).tasks).toHaveLength(2);
    expect(runtime.cancel(session.id).state).toBe('cancelled');
  });
});
