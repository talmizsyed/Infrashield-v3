import {
  ApprovalDecisionType,
  ApprovalEngine,
  ApprovalPolicy,
  ApprovalRequest,
  ApprovalRiskAssessment,
  ApprovalRiskLevel,
  ApprovalStatus,
  ApprovalWorkflow,
  ApprovalMode as GovernanceApprovalMode,
} from '@infrashield/governance';
import type { Identifier } from '@infrashield/contracts';

import type { ExecutionSession } from './execution-context.js';
import { ApprovalMode, OrchestrationStatus } from './foundation.js';

export interface ExecutionApprovalRequest {
  readonly workflowId: Identifier;
  readonly mode: ApprovalMode;
  readonly requestorId: string;
  readonly approvers: readonly string[];
  readonly title?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ExecutionApprovalResult {
  readonly workflowId: Identifier;
  readonly approved: boolean;
  readonly status: ApprovalStatus;
  readonly decision?: ApprovalDecisionType;
  readonly requiresManualAction: boolean;
}

export class ExecutionApproval {
  private readonly engine: ApprovalEngine;
  private readonly pending = new Map<Identifier, ExecutionApprovalRequest>();

  public constructor(engine: ApprovalEngine = new ApprovalEngine()) {
    this.engine = engine;
  }

  public async submit(request: ExecutionApprovalRequest): Promise<ExecutionApprovalResult> {
    this.pending.set(request.workflowId, request);

    const governanceMode = this.toGovernanceMode(request.mode);
    const policy = new ApprovalPolicy({
      autoApproveOnLowRisk: request.mode === ApprovalMode.Auto,
    });
    const workflow = new ApprovalWorkflow({
      id: `workflow-approval-${request.workflowId}`,
      name: request.title ?? 'Workflow approval',
      mode: governanceMode,
      stages: request.mode === ApprovalMode.MultiStage ? 2 : 1,
      requiredApprovals: request.mode === ApprovalMode.MultiStage ? 2 : 1,
    });

    const riskLevel =
      request.mode === ApprovalMode.Auto ? ApprovalRiskLevel.Low : ApprovalRiskLevel.Medium;

    const approvalRequest = new ApprovalRequest({
      id: `approval-${request.workflowId}`,
      title: request.title ?? `Workflow ${request.workflowId}`,
      operation: 'workflow.execute',
      requestorId: request.requestorId,
      approvers: request.approvers,
      policy,
      workflow,
      riskAssessment: new ApprovalRiskAssessment({
        level: riskLevel,
        score: request.mode === ApprovalMode.Auto ? 10 : 40,
        threshold: 50,
      }),
      metadata: request.metadata,
    });

    const response = await this.engine.submit(approvalRequest);
    const approved = response.status === ApprovalStatus.Approved;

    return {
      workflowId: request.workflowId,
      approved,
      status: response.status,
      decision: response.decision?.decision,
      requiresManualAction:
        request.mode === ApprovalMode.Manual ||
        request.mode === ApprovalMode.MultiStage ||
        response.status === ApprovalStatus.RequestedInformation,
    };
  }

  public async approve(
    workflowId: Identifier,
    actorId: string,
    reason?: string,
  ): Promise<ExecutionApprovalResult> {
    void reason;

    const pending = this.pending.get(workflowId);

    this.pending.delete(workflowId);

    if (pending && !pending.approvers.includes(actorId) && pending.approvers.length > 0) {
      return {
        workflowId,
        approved: false,
        status: ApprovalStatus.RequestedInformation,
        decision: ApprovalDecisionType.RequestInformation,
        requiresManualAction: true,
      };
    }

    return {
      workflowId,
      approved: true,
      status: ApprovalStatus.Approved,
      decision: ApprovalDecisionType.Approve,
      requiresManualAction: false,
    };
  }

  public applyToSession(session: ExecutionSession, approvalResult: ExecutionApprovalResult): void {
    session.approvalRequired = approvalResult.requiresManualAction;
    session.approved = approvalResult.approved;
    if (!approvalResult.approved && approvalResult.requiresManualAction) {
      session.transition(OrchestrationStatus.AwaitingApproval);
    }
  }

  public getPending(): readonly ExecutionApprovalRequest[] {
    return Object.freeze([...this.pending.values()]);
  }

  private toGovernanceMode(mode: ApprovalMode): GovernanceApprovalMode {
    switch (mode) {
      case ApprovalMode.Auto:
        return GovernanceApprovalMode.Automatic;
      case ApprovalMode.MultiStage:
        return GovernanceApprovalMode.MultiStage;
      case ApprovalMode.Policy:
        return GovernanceApprovalMode.Sequential;
      case ApprovalMode.Manual:
      default:
        return GovernanceApprovalMode.Manual;
    }
  }
}
