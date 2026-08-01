import { describe, expect, it } from 'vitest';
import {
  ApprovalDecision,
  ApprovalPolicy,
  ApprovalRequest,
  ComplianceStatus,
  GovernanceCondition,
  GovernanceContext,
  GovernanceDecision,
  GovernanceEngine,
  GovernancePolicy,
  GovernanceRegistry,
  GovernanceRule,
  GovernanceScope,
} from './index';

describe('governance framework', () => {
  it('evaluates policies with tenant-aware scopes and denies unsafe actions', () => {
    const policy = new GovernancePolicy({
      id: 'policy-1',
      name: 'tenant-safe-policy',
      tenantScope: 'tenant-a',
      scopes: [
        new GovernanceScope({
          id: 'scope-1',
          name: 'tool-execution',
          tenant: 'tenant-a',
          action: 'execute',
        }),
      ],
      rules: [
        new GovernanceRule({
          id: 'rule-1',
          name: 'deny high risk',
          decision: GovernanceDecision.Deny,
          conditions: [
            new GovernanceCondition({
              id: 'cond-risk',
              description: 'risk threshold',
              attribute: 'risk',
              operator: 'gte',
              value: 0.8,
            }),
          ],
          scopes: [
            new GovernanceScope({
              id: 'scope-1',
              name: 'tool-execution',
              tenant: 'tenant-a',
              action: 'execute',
            }),
          ],
        }),
      ],
    });

    const context = new GovernanceContext({
      id: 'ctx-1',
      actor: 'agent-1',
      action: 'execute',
      resource: 'tool:delete',
      tenant: 'tenant-a',
      metadata: { risk: 0.9 },
      policy,
    });

    const result = new GovernanceEngine({ policy }).evaluate(context);

    expect(result.decision).toBe(GovernanceDecision.Deny);
    expect(result.violations).toHaveLength(1);
    expect(result.approved).toBe(false);
    expect(result.audit).toBeDefined();
  });

  it('supports approval workflows and delegated approvals', () => {
    const engine = new GovernanceEngine();
    const request = new ApprovalRequest({
      id: 'approval-1',
      actor: 'operator',
      action: 'deploy',
      resource: 'workflow:prod',
      reason: 'human validation required',
      policy: new ApprovalPolicy({ mode: 'delegated' }),
    });

    const approved = engine.decide(request, ApprovalDecision.Approved);
    expect(approved.approved).toBe(true);
    expect(approved.decision).toBe(ApprovalDecision.Approved);

    const delegated = engine.decide(request, ApprovalDecision.Delegated);
    expect(delegated.approved).toBe(true);
    expect(delegated.decision).toBe(ApprovalDecision.Delegated);
  });

  it('evaluates trust and compliance and triggers guardrails when needed', () => {
    const engine = new GovernanceEngine();
    const context = new GovernanceContext({
      id: 'ctx-2',
      actor: 'agent-2',
      action: 'execute',
      resource: 'memory:read',
      riskScore: 0.95,
      requiredCompliance: ComplianceStatus.Warning,
      metadata: { risk: 0.95 },
    });

    const result = engine.evaluate(context);

    expect(result.risk.score).toBeGreaterThan(0.8);
    expect(result.execution?.triggered).toBe(true);
    expect(result.decision).toBe(GovernanceDecision.Escalate);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('records audit entries and snapshots them', () => {
    const engine = new GovernanceEngine();
    const context = new GovernanceContext({
      id: 'ctx-3',
      actor: 'agent-3',
      action: 'review',
      resource: 'workflow:read',
    });

    const result = engine.evaluate(context);
    const snapshot = engine.audit.snapshot();

    expect(result.audit).toBeDefined();
    expect(snapshot.policyId).toBeDefined();
    expect(snapshot.createdAt).toBeTruthy();
    expect(engine.audit.list()).toHaveLength(1);
  });

  it('supports registry entries and immutable policy snapshots', () => {
    const registry = new GovernanceRegistry();
    const policy = new GovernancePolicy({ id: 'policy-2', name: 'immutable-policy' });
    registry.register(policy);
    expect(registry.get('policy-2')).toBe(policy);
    expect(policy.immutable).toBe(true);
  });
});
