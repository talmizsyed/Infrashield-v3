import { describe, expect, it } from 'vitest';
import {
  ApprovalDecisionType,
  ApprovalEngine,
  ApprovalRiskLevel,
  ApprovalStatus,
  ApprovalWorkflow,
} from './index';

describe('approval platform', () => {
  it('supports approval lifecycle decisions', async () => {
    const engine = new ApprovalEngine();
    const request = { requestId: 'req-1', correlationId: 'corr-1', tenantId: 'tenant-a' };

    const response = await engine.submit(request);
    expect(response.requestId).toBe('req-1');
  });

  it('supports risk levels and workflow shape', () => {
    const workflow: ApprovalWorkflow = {
      id: 'wf-1',
      name: 'standard',
      mode: 'manual',
      stages: 2,
      requiredApprovals: 1,
    };

    expect(workflow.requiredApprovals).toBe(1);
    expect(ApprovalRiskLevel.Critical).toBe('critical');
    expect(ApprovalDecisionType.Approve).toBe('approve');
  });

  it('tracks statuses for approval lifecycle events', () => {
    expect(ApprovalStatus.Pending).toBe('pending');
    expect(ApprovalStatus.Approved).toBe('approved');
    expect(ApprovalStatus.Rejected).toBe('rejected');
    expect(ApprovalStatus.Expired).toBe('expired');
  });
});
