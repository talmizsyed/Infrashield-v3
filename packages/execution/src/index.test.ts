import { describe, expect, it } from 'vitest';
import type { ExecutionContext, ExecutionResult, ExecutionStep } from './index.js';
import { ExecutionStatus } from './index.js';

const dummyContext: ExecutionContext = {
  executionId: 'exec-1',
  correlationId: 'corr-1',
  status: ExecutionStatus.Created,
  requestContext: {
    request: {
      requestId: 'req-1',
      correlationId: 'corr-1',
    },
    execution: {
      executionId: 'exec-1',
      timestamp: new Date().toISOString(),
    },
  },
  options: {},
  timestamp: new Date().toISOString(),
};

const dummyStep: ExecutionStep = {
  stepId: 'step-1',
  name: 'dummy',
  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    return {
      executionId: context.executionId,
      status: ExecutionStatus.Completed,
      succeeded: true,
      startedAt: context.timestamp,
      completedAt: new Date().toISOString(),
    };
  },
};

describe('Execution package contracts', () => {
  it('supports serializable execution context and step contracts', async () => {
    const result = await dummyStep.execute(dummyContext);

    expect(result).toEqual({
      executionId: 'exec-1',
      status: ExecutionStatus.Completed,
      succeeded: true,
      startedAt: dummyContext.timestamp,
      completedAt: result.completedAt,
    });
  });

  it('exposes execution status lifecycle values', () => {
    expect(ExecutionStatus.Queued).toBe('queued');
    expect(ExecutionStatus.TimedOut).toBe('timedOut');
  });
});
