import type { Identifier } from '@infrashield/contracts';

import { ExecutionApproval } from './execution-approval.js';
import { ExecutionAudit } from './execution-audit.js';
import { ExecutionContext, ExecutionSession } from './execution-context.js';
import { ExecutionCoordinator, ExecutionResumeCoordinator } from './execution-coordinator.js';
import { ExecutionGraph } from './execution-graph.js';
import { ExecutionCheckpoint } from './execution-checkpoint.js';
import { ExecutionHistory, type ExecutionHistoryEntry } from './execution-history.js';
import { ExecutionPlanner } from './execution-planner.js';
import { ExecutionScheduler } from './execution-scheduler.js';
import { ExecutionStateStore } from './execution-state-store.js';
import {
  ApprovalMode,
  ApprovalRequiredException,
  createCorrelationId,
  createWorkflowId,
  OrchestrationStatus,
  ScheduleTrigger,
} from './foundation.js';
import type {
  AgentExecutorFn,
  OrchestrationPlanResult,
  OrchestrationRunRequest,
  OrchestrationRunResult,
  OrchestrationSessionSnapshot,
} from './foundation.js';

export interface OrchestratorStatistics {
  readonly totalWorkflows: number;
  readonly runningExecutions: number;
  readonly queuedExecutions: number;
  readonly failedExecutions: number;
  readonly completedExecutions: number;
  readonly awaitingApproval: number;
  readonly averageLatencyMs: number;
  readonly workflowStatus: ReadonlyArray<{ readonly name: string; readonly value: number }>;
}

export class AgentOrchestrator {
  private readonly planner = new ExecutionPlanner();
  private readonly coordinator: ExecutionCoordinator;
  private readonly resumeCoordinator: ExecutionResumeCoordinator;
  private readonly scheduler = new ExecutionScheduler();
  private readonly stateStore = new ExecutionStateStore();
  private readonly history = new ExecutionHistory();
  private readonly approval = new ExecutionApproval();
  private readonly audit = new ExecutionAudit();

  public constructor(private readonly executor: AgentExecutorFn) {
    this.coordinator = new ExecutionCoordinator(executor);
    this.resumeCoordinator = new ExecutionResumeCoordinator(this.coordinator, executor);
  }

  public plan(request: OrchestrationRunRequest): OrchestrationPlanResult {
    const workflowId = createWorkflowId();
    const graph = new ExecutionGraph(request.graph);
    const plan = this.planner.plan({ workflowId, graph });

    const session = new ExecutionSession({
      workflowId,
      graphId: graph.id,
      correlationId: request.correlationId ?? createCorrelationId(),
      scheduleTrigger: request.schedule?.trigger ?? ScheduleTrigger.Immediate,
      metadata: request.metadata,
      approvalRequired: this.requiresApproval(request),
    });
    session.transition(OrchestrationStatus.Planned);

    this.stateStore.saveSession(session);
    this.stateStore.savePlan(workflowId, plan);
    this.history.recordSessionEvent(session, 'planned');
    this.audit.record({ workflowId, action: 'plan', details: { graphId: graph.id } });

    return plan.toResult();
  }

  public async run(request: OrchestrationRunRequest): Promise<OrchestrationRunResult> {
    const workflowId = createWorkflowId();
    const correlationId = request.correlationId ?? createCorrelationId();
    const graph = new ExecutionGraph(request.graph);
    const plan = this.planner.plan({ workflowId, graph });

    const session = new ExecutionSession({
      workflowId,
      graphId: graph.id,
      correlationId,
      scheduleTrigger: request.schedule?.trigger ?? ScheduleTrigger.Immediate,
      metadata: request.metadata,
      approvalRequired: this.requiresApproval(request),
    });

    this.stateStore.saveSession(session);
    this.stateStore.savePlan(workflowId, plan);
    this.stateStore.saveRequest(workflowId, request);
    this.audit.record({ workflowId, action: 'run.requested' });

    if (request.approval) {
      const approvalResult = await this.approval.submit({
        workflowId,
        mode: request.approval.mode,
        requestorId: request.approval.requestorId ?? 'system',
        approvers: request.approval.approvers ?? [],
        title: request.graph.name,
        metadata: request.metadata,
      });
      this.approval.applyToSession(session, approvalResult);
      this.history.recordSessionEvent(session, 'approval.evaluated', {
        approved: approvalResult.approved,
      });

      if (!approvalResult.approved && approvalResult.requiresManualAction) {
        this.scheduler.schedule({ workflowId, session, request });
        throw new ApprovalRequiredException(
          'Workflow requires manual approval before execution',
          workflowId,
        );
      }
    }

    const trigger = request.schedule?.trigger ?? ScheduleTrigger.Immediate;
    if (trigger !== ScheduleTrigger.Immediate) {
      this.scheduler.schedule({ workflowId, session, request });
      session.transition(OrchestrationStatus.Queued);
      this.history.recordSessionEvent(session, 'queued', { trigger });
      return {
        workflowId,
        status: OrchestrationStatus.Queued,
        nodeResults: [],
        startedAt: new Date().toISOString(),
      };
    }

    return this.executeWorkflow(workflowId, graph, plan, request, session);
  }

  public async approve(
    workflowId: Identifier,
    actorId: string,
    reason?: string,
  ): Promise<OrchestrationRunResult> {
    const session = this.getSession(workflowId);
    const plan = this.stateStore.getPlan(workflowId);
    if (!plan) {
      throw new Error(`No plan found for workflow ${workflowId}`);
    }

    const approvalResult = await this.approval.approve(workflowId, actorId, reason);
    this.approval.applyToSession(session, approvalResult);
    this.audit.record({ workflowId, action: 'approve', actorId, details: { reason } });
    this.history.recordSessionEvent(session, 'approved', { actorId });

    if (!approvalResult.approved) {
      return {
        workflowId,
        status: OrchestrationStatus.AwaitingApproval,
        nodeResults: [],
        startedAt: session.createdAt,
      };
    }

    const request = this.stateStore.getRequest(workflowId);
    if (!request) {
      throw new Error(`No run request found for workflow ${workflowId}`);
    }
    const graph = new ExecutionGraph(request.graph);

    return this.executeWorkflow(workflowId, graph, plan, request, session);
  }

  public async retry(workflowId: Identifier): Promise<OrchestrationRunResult> {
    const session = this.getSession(workflowId);
    const plan = this.stateStore.getPlan(workflowId);
    if (!plan) {
      throw new Error(`No plan found for workflow ${workflowId}`);
    }

    session.transition(OrchestrationStatus.Retrying);
    session.failedNodeIds.length = 0;
    this.audit.record({ workflowId, action: 'retry' });
    this.history.recordSessionEvent(session, 'retry');

    const request = this.stateStore.getRequest(workflowId);
    if (!request) {
      throw new Error(`No run request found for workflow ${workflowId}`);
    }

    const graph = new ExecutionGraph(request.graph);
    return this.executeWorkflow(workflowId, graph, plan, request, session);
  }

  public async resume(workflowId: Identifier): Promise<OrchestrationRunResult> {
    const session = this.getSession(workflowId);
    const plan = this.stateStore.getPlan(workflowId);
    const checkpoint = this.stateStore.getLatestCheckpoint(workflowId);
    if (!plan || !checkpoint) {
      throw new Error(`No checkpoint found for workflow ${workflowId}`);
    }

    const request = this.stateStore.getRequest(workflowId);
    if (!request) {
      throw new Error(`No run request found for workflow ${workflowId}`);
    }

    const graph = new ExecutionGraph(request.graph);

    const context = new ExecutionContext({
      workflowId,
      correlationId: session.correlationId,
      graph,
      plan,
      request,
    });

    for (const [nodeId, output] of Object.entries(checkpoint.nodeOutputs)) {
      context.setNodeOutput(nodeId, output);
    }

    this.audit.record({
      workflowId,
      action: 'resume',
      details: { checkpointId: checkpoint.checkpointId },
    });
    this.history.recordSessionEvent(session, 'resume');

    const result = await this.resumeCoordinator.resumeFromCheckpoint(
      context,
      session,
      checkpoint.completedNodeIds,
    );
    this.finalizeExecution(session, context, result);
    return result;
  }

  public list(): readonly OrchestrationSessionSnapshot[] {
    return Object.freeze(
      this.stateStore.listSessions().map((session) => this.stateStore.toSnapshot(session)),
    );
  }

  public get(workflowId: Identifier): OrchestrationSessionSnapshot {
    const session = this.getSession(workflowId);
    return this.stateStore.toSnapshot(session);
  }

  public getHistory(workflowId?: Identifier): readonly ExecutionHistoryEntry[] {
    if (workflowId) {
      return this.history.getWorkflowHistory(workflowId);
    }
    return this.history.getRecent();
  }

  public getStatistics(): OrchestratorStatistics {
    const sessions = this.stateStore.listSessions();
    const running = sessions.filter((s) => s.status === OrchestrationStatus.Running).length;
    const queued =
      sessions.filter((s) => s.status === OrchestrationStatus.Queued).length +
      this.scheduler.getQueueDepth();
    const failed = sessions.filter((s) => s.status === OrchestrationStatus.Failed).length;
    const completed = sessions.filter((s) => s.status === OrchestrationStatus.Completed).length;
    const awaiting = sessions.filter(
      (s) => s.status === OrchestrationStatus.AwaitingApproval,
    ).length;

    const latencies = sessions
      .filter((s) => s.startedAt && s.completedAt)
      .map((s) => Date.parse(s.completedAt!) - Date.parse(s.startedAt!));
    const averageLatencyMs =
      latencies.length > 0
        ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length)
        : 0;

    return {
      totalWorkflows: sessions.length,
      runningExecutions: running,
      queuedExecutions: queued,
      failedExecutions: failed,
      completedExecutions: completed,
      awaitingApproval: awaiting,
      averageLatencyMs,
      workflowStatus: [
        { name: 'Running', value: running },
        { name: 'Queued', value: queued },
        { name: 'Completed', value: completed },
        { name: 'Failed', value: failed },
        { name: 'Awaiting Approval', value: awaiting },
      ],
    };
  }

  public getAudit(): ExecutionAudit {
    return this.audit;
  }

  public getScheduler(): ExecutionScheduler {
    return this.scheduler;
  }

  public getStateStore(): ExecutionStateStore {
    return this.stateStore;
  }

  private async executeWorkflow(
    workflowId: Identifier,
    graph: ExecutionGraph,
    plan: ReturnType<ExecutionPlanner['plan']>,
    request: OrchestrationRunRequest,
    session: ExecutionSession,
  ): Promise<OrchestrationRunResult> {
    const context = new ExecutionContext({
      workflowId,
      correlationId: session.correlationId,
      graph,
      plan,
      request,
    });

    session.transition(OrchestrationStatus.Running);
    this.history.recordSessionEvent(session, 'running');

    const checkpoint = ExecutionCheckpoint.fromSession(context, session);
    this.stateStore.saveCheckpoint(checkpoint);

    const result = await this.coordinator.execute(context, session);

    if (result.status === OrchestrationStatus.Failed) {
      await this.coordinator.rollback(context, session, session.completedNodeIds);
    }

    return this.finalizeExecution(session, context, result);
  }

  private finalizeExecution(
    session: ExecutionSession,
    context: ExecutionContext,
    result: OrchestrationRunResult,
  ): OrchestrationRunResult {
    session.transition(result.status);
    this.stateStore.saveSession(session);
    this.stateStore.saveResult(result);
    this.stateStore.saveOutput(result.workflowId, {
      nodeResults: result.nodeResults,
      status: result.status,
    });
    this.history.recordSessionEvent(session, 'completed', { status: result.status });
    this.audit.record({
      workflowId: result.workflowId,
      action: 'completed',
      details: { status: result.status, nodeCount: result.nodeResults.length },
    });

    const finalCheckpoint = ExecutionCheckpoint.fromSession(context, session);
    this.stateStore.saveCheckpoint(finalCheckpoint);

    return {
      ...result,
      checkpointId: finalCheckpoint.checkpointId,
    };
  }

  private getSession(workflowId: Identifier): ExecutionSession {
    const session = this.stateStore.getSession(workflowId);
    if (!session) {
      throw new Error(`Workflow ${workflowId} not found`);
    }
    return session;
  }

  private requiresApproval(request: OrchestrationRunRequest): boolean {
    return (
      request.approval?.mode === ApprovalMode.Manual ||
      request.approval?.mode === ApprovalMode.MultiStage
    );
  }
}

export function createAgentOrchestrator(executor: AgentExecutorFn): AgentOrchestrator {
  return new AgentOrchestrator(executor);
}

export function createDefaultAgentExecutor(): AgentExecutorFn {
  return async (agentId, input) =>
    Object.freeze({
      agentId,
      status: 'completed',
      output: `Executed ${agentId}`,
      input: input ?? {},
      completedAt: new Date().toISOString(),
    });
}
