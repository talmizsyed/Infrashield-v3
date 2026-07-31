import { describe, expect, it } from 'vitest';

import {
  WorkflowApprovalPolicy,
  WorkflowCancellationPolicy,
  WorkflowCompensationPolicy,
  WorkflowConcurrencyPolicy,
  WorkflowFailurePolicy,
  WorkflowPolicyCollection,
  WorkflowPolicyRegistry,
  WorkflowRateLimitPolicy,
  WorkflowRetryPolicy,
  WorkflowTimeoutPolicy,
  WorkflowExecutionPolicyValidationException,
} from './workflow-execution-policy.js';

describe('workflow execution policy framework', () => {
  it('creates immutable retry policies with validation', () => {
    const policy = new WorkflowRetryPolicy({
      id: 'retry-1',
      name: 'Retry requests',
      strategy: 'exponential',
      maxAttempts: 3,
      delayMs: 250,
      backoffMultiplier: 2,
      retryConditions: ['timeout', 'network'],
      jitterMs: 50,
      metadata: { scope: 'http' },
    });

    expect(policy.strategy).toBe('exponential');
    expect(policy.maxAttempts).toBe(3);
    expect(policy.retryConditions).toEqual(['timeout', 'network']);
    expect(Object.isFrozen(policy.metadata)).toBe(true);

    expect(
      () =>
        new WorkflowRetryPolicy({
          id: 'retry-invalid',
          maxAttempts: 0,
          delayMs: 100,
        }),
    ).toThrow(WorkflowExecutionPolicyValidationException);
  });

  it('validates timeout and failure policies and preserves immutability', () => {
    const timeout = new WorkflowTimeoutPolicy({
      id: 'timeout-1',
      executionTimeoutMs: 5000,
      queueTimeoutMs: 1000,
      approvalTimeoutMs: 600,
      workflowTimeoutMs: 10000,
    });

    expect(timeout.executionTimeoutMs).toBe(5000);
    expect(timeout.snapshot().executionTimeoutMs).toBe(5000);

    expect(
      () => new WorkflowTimeoutPolicy({ id: 'timeout-invalid', executionTimeoutMs: -1 }),
    ).toThrow(WorkflowExecutionPolicyValidationException);

    const failure = new WorkflowFailurePolicy({ id: 'failure-1', action: 'skip' });
    expect(failure.action).toBe('skip');

    const compensation = new WorkflowCompensationPolicy({
      id: 'compensation-1',
      compensationStepId: 'rollback',
      rollbackMetadata: { tenant: 'acme' },
    });
    expect(compensation.compensationStepId).toBe('rollback');
  });

  it('registers reusable policies once and resolves policy references', () => {
    const retry = new WorkflowRetryPolicy({ id: 'retry-1', maxAttempts: 2, delayMs: 100 });
    const timeout = new WorkflowTimeoutPolicy({ id: 'timeout-1', executionTimeoutMs: 5000 });
    const approval = new WorkflowApprovalPolicy({
      id: 'approval-1',
      required: true,
      timeoutMs: 1200,
    });

    const registry = new WorkflowPolicyRegistry();
    registry.register(retry);
    registry.register(timeout);
    registry.register(approval);

    expect(registry.get('retry-1')).toBe(retry);
    expect(registry.resolve(['retry-1', 'timeout-1']).map((policy) => policy.id)).toEqual([
      'retry-1',
      'timeout-1',
    ]);

    expect(() => registry.register(retry)).toThrow(WorkflowExecutionPolicyValidationException);
  });

  it('stores policy collections immutably and validates policy dependencies', () => {
    const concurrency = new WorkflowConcurrencyPolicy({
      id: 'concurrency-1',
      mode: 'parallel',
      maxConcurrency: 4,
      queueStrategy: 'fifo',
    });
    const rateLimit = new WorkflowRateLimitPolicy({
      id: 'rate-limit-1',
      limit: 100,
      windowMs: 1000,
    });
    const cancellation = new WorkflowCancellationPolicy({
      id: 'cancellation-1',
      mode: 'compensate',
    });

    const collection = new WorkflowPolicyCollection([concurrency, rateLimit, cancellation]);
    expect(collection.values).toHaveLength(3);
    expect(Object.isFrozen(collection.values)).toBe(true);

    expect(
      () => new WorkflowTimeoutPolicy({ id: 'circular-1', dependsOn: ['circular-1'] }),
    ).toThrow(WorkflowExecutionPolicyValidationException);
  });
});
