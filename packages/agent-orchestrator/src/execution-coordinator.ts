import type { Identifier } from '@infrashield/contracts';

import type { ExecutionContext, ExecutionSession } from './execution-context.js';
import type { ExecutionNode } from './execution-graph.js';
import { CoordinationException, NodeExecutionMode, OrchestrationStatus } from './foundation.js';
import type {
  AgentExecutorFn,
  OrchestrationNodeResult,
  OrchestrationRunResult,
} from './foundation.js';

export class ExecutionCoordinator {
  public constructor(private readonly executor: AgentExecutorFn) {}

  public async execute(
    context: ExecutionContext,
    session: ExecutionSession,
  ): Promise<OrchestrationRunResult> {
    session.transition(OrchestrationStatus.Running);
    session.appendLog('Execution started');

    const nodeResults: OrchestrationNodeResult[] = [];
    const completed = new Set<string>();
    const dependencyCounts = new Map<string, number>();
    const readyQueue: string[] = [];

    for (const nodeId of context.plan.topologicalOrder) {
      dependencyCounts.set(nodeId, context.plan.dependencyMap[nodeId]?.length ?? 0);
      if ((dependencyCounts.get(nodeId) ?? 0) === 0) {
        readyQueue.push(nodeId);
      }
    }

    while (readyQueue.length > 0 || this.hasRunnableParallelBatch(context, readyQueue, completed)) {
      const batch = this.collectRunnableBatch(context, readyQueue, completed);
      if (batch.length === 0) {
        break;
      }

      const batchResults = await this.executeBatch(context, session, batch, completed);
      nodeResults.push(...batchResults);

      const failed = batchResults.some((result) => result.status === OrchestrationStatus.Failed);
      if (failed) {
        session.transition(OrchestrationStatus.Failed);
        session.appendLog('Execution failed');
        return this.buildResult(context.workflowId, OrchestrationStatus.Failed, nodeResults);
      }

      for (const result of batchResults) {
        completed.add(result.nodeId);
        for (const dependentId of context.plan.dependentsMap[result.nodeId] ?? []) {
          const nextCount = (dependencyCounts.get(dependentId) ?? 0) - 1;
          dependencyCounts.set(dependentId, nextCount);
          if (nextCount === 0 && !completed.has(dependentId) && !readyQueue.includes(dependentId)) {
            readyQueue.push(dependentId);
          }
        }
      }
    }

    const allCompleted = context.plan.topologicalOrder.every((nodeId) => completed.has(nodeId));
    const finalStatus = allCompleted ? OrchestrationStatus.Completed : OrchestrationStatus.Failed;
    session.transition(finalStatus);
    session.appendLog(`Execution ${finalStatus}`);

    return this.buildResult(context.workflowId, finalStatus, nodeResults);
  }

  public async rollback(
    context: ExecutionContext,
    session: ExecutionSession,
    completedNodeIds: readonly string[],
  ): Promise<void> {
    session.transition(OrchestrationStatus.RolledBack);
    session.appendLog('Rollback initiated');

    for (const nodeId of [...completedNodeIds].reverse()) {
      const node = context.graph.getNode(nodeId);
      if (!node) {
        continue;
      }
      try {
        await this.executor(node.agentId, {
          action: 'rollback',
          nodeId,
          workflowId: context.workflowId,
        });
        session.appendLog(`Rolled back node ${nodeId}`);
      } catch (error) {
        session.appendLog(
          `Rollback failed for node ${nodeId}: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
      }
    }
  }

  private collectRunnableBatch(
    context: ExecutionContext,
    readyQueue: string[],
    completed: Set<string>,
  ): ExecutionNode[] {
    const batch: ExecutionNode[] = [];
    const parallelCandidates: ExecutionNode[] = [];

    while (readyQueue.length > 0) {
      const nodeId = readyQueue.shift();
      if (!nodeId || completed.has(nodeId)) {
        continue;
      }
      const node = context.graph.getNode(nodeId);
      if (!node) {
        continue;
      }
      if (!context.evaluateCondition(node.condition)) {
        completed.add(nodeId);
        for (const dependentId of context.plan.dependentsMap[nodeId] ?? []) {
          const deps = context.plan.dependencyMap[dependentId] ?? [];
          if (deps.every((depId) => completed.has(depId))) {
            readyQueue.push(dependentId);
          }
        }
        continue;
      }

      if (node.mode === NodeExecutionMode.Parallel || node.mode === NodeExecutionMode.FanOut) {
        parallelCandidates.push(node);
      } else {
        batch.push(node);
        break;
      }
    }

    if (batch.length === 0 && parallelCandidates.length > 0) {
      return parallelCandidates;
    }

    return batch;
  }

  private hasRunnableParallelBatch(
    context: ExecutionContext,
    readyQueue: string[],
    completed: Set<string>,
  ): boolean {
    return readyQueue.some((nodeId) => {
      const node = context.graph.getNode(nodeId);
      return (
        node !== undefined &&
        !completed.has(nodeId) &&
        (node.mode === NodeExecutionMode.Parallel || node.mode === NodeExecutionMode.FanOut)
      );
    });
  }

  private async executeBatch(
    context: ExecutionContext,
    session: ExecutionSession,
    nodes: readonly ExecutionNode[],
    completed: Set<string>,
  ): Promise<OrchestrationNodeResult[]> {
    if (nodes.length === 1) {
      const result = await this.executeNode(context, session, nodes[0]!);
      session.recordNodeResult(result);
      return [result];
    }

    const results = await Promise.all(
      nodes.map(async (node) => {
        const result = await this.executeNode(context, session, node);
        session.recordNodeResult(result);
        return result;
      }),
    );

    if (nodes.some((node) => node.mode === NodeExecutionMode.FanIn)) {
      const outputs = results
        .map((result) => result.output)
        .filter((output): output is Readonly<Record<string, unknown>> => output !== undefined);
      const fanInNode = nodes.find((node) => node.mode === NodeExecutionMode.FanIn);
      if (fanInNode) {
        context.setNodeOutput(fanInNode.id, { aggregated: outputs });
      }
    }

    for (const nodeId of nodes.map((node) => node.id)) {
      completed.add(nodeId);
    }

    return results;
  }

  private async executeNode(
    context: ExecutionContext,
    session: ExecutionSession,
    node: ExecutionNode,
  ): Promise<OrchestrationNodeResult> {
    const maxAttempts = node.retry?.maxAttempts ?? 1;
    const delayMs = node.retry?.delayMs ?? 0;
    const loopMax = node.mode === NodeExecutionMode.Loop ? (node.loop?.maxIterations ?? 1) : 1;

    let lastError: string | undefined;
    let output: Readonly<Record<string, unknown>> | undefined;
    const startedAt = new Date().toISOString();

    for (let loopIndex = 0; loopIndex < loopMax; loopIndex += 1) {
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          session.appendLog(`Executing node ${node.id} (agent ${node.agentId})`);
          const input = this.buildNodeInput(context, node);
          output = await this.executor(node.agentId, input);
          context.setNodeOutput(node.id, output);
          return {
            nodeId: node.id,
            agentId: node.agentId,
            status: OrchestrationStatus.Completed,
            output,
            attempts: attempt,
            startedAt,
            completedAt: new Date().toISOString(),
          };
        } catch (error) {
          lastError = error instanceof Error ? error.message : 'Execution failed';
          session.recordRetry(node.id, attempt, lastError);
          if (attempt < maxAttempts && delayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
        }
      }
    }

    return {
      nodeId: node.id,
      agentId: node.agentId,
      status: OrchestrationStatus.Failed,
      error: lastError ?? 'Execution failed',
      attempts: maxAttempts * loopMax,
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }

  private buildNodeInput(
    context: ExecutionContext,
    node: ExecutionNode,
  ): Readonly<Record<string, unknown>> {
    const dependencyOutputs: Record<string, Readonly<Record<string, unknown>>> = {};
    for (const dependencyId of node.dependsOn) {
      const output = context.getNodeOutput(dependencyId);
      if (output) {
        dependencyOutputs[dependencyId] = output;
      }
    }

    return Object.freeze({
      workflowId: context.workflowId,
      correlationId: context.correlationId,
      nodeId: node.id,
      dependencies: dependencyOutputs,
      metadata: node.metadata,
    });
  }

  private buildResult(
    workflowId: Identifier,
    status: OrchestrationStatus,
    nodeResults: readonly OrchestrationNodeResult[],
  ): OrchestrationRunResult {
    const startedAt = nodeResults[0]?.startedAt ?? new Date().toISOString();
    return {
      workflowId,
      status,
      nodeResults,
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }
}

export class ExecutionResumeCoordinator {
  public constructor(
    private readonly coordinator: ExecutionCoordinator,
    private readonly executor: AgentExecutorFn,
  ) {}

  public async resumeFromCheckpoint(
    context: ExecutionContext,
    session: ExecutionSession,
    completedNodeIds: readonly string[],
  ): Promise<OrchestrationRunResult> {
    session.transition(OrchestrationStatus.Running);
    session.appendLog(`Resuming from checkpoint with ${completedNodeIds.length} completed nodes`);

    for (const nodeId of completedNodeIds) {
      const node = context.graph.getNode(nodeId);
      if (!node) {
        throw new CoordinationException(`Unknown checkpoint node ${nodeId}`);
      }
      const output = await this.executor(node.agentId, {
        action: 'restore',
        nodeId,
        workflowId: context.workflowId,
      });
      context.setNodeOutput(nodeId, output);
      session.completedNodeIds.push(nodeId);
    }

    return this.coordinator.execute(context, session);
  }
}
