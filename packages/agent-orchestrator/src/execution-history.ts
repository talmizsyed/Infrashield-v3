import type { Identifier } from '@infrashield/contracts';

import type { ExecutionSession } from './execution-context.js';
import type { OrchestrationNodeResult, OrchestrationRunResult } from './foundation.js';
import { ExecutionTimeline, type ExecutionEvent } from './execution-event.js';

export type ExecutionHistoryEntry = ExecutionEvent;

export class ExecutionHistory {
  private readonly timelines = new Map<Identifier, ExecutionTimeline>();

  private getTimelineInternal(workflowId: Identifier): ExecutionTimeline {
    const timeline = this.timelines.get(workflowId);
    if (timeline) {
      return timeline;
    }

    const created = new ExecutionTimeline();
    this.timelines.set(workflowId, created);
    return created;
  }

  public record(entry: ExecutionHistoryEntry): void {
    this.getTimelineInternal(entry.workflowId).record(entry);
  }

  public recordSessionEvent(
    session: ExecutionSession,
    event: string,
    metadata?: Readonly<Record<string, unknown>>,
  ): void {
    this.record({
      workflowId: session.workflowId,
      correlationId: session.correlationId,
      event,
      status: session.status,
      metadata,
      timestamp: new Date().toISOString(),
    });
  }

  public recordNodeEvent(
    session: ExecutionSession,
    nodeResult: OrchestrationNodeResult,
    metadata?: Readonly<Record<string, unknown>>,
  ): void {
    this.record({
      workflowId: session.workflowId,
      correlationId: session.correlationId,
      event: `node.${nodeResult.status}`,
      status: nodeResult.status,
      nodeId: nodeResult.nodeId,
      agentId: nodeResult.agentId,
      durationMs:
        nodeResult.startedAt && nodeResult.completedAt
          ? Date.parse(nodeResult.completedAt) - Date.parse(nodeResult.startedAt)
          : undefined,
      metadata: {
        attempts: nodeResult.attempts,
        ...metadata,
      },
      timestamp: nodeResult.completedAt ?? new Date().toISOString(),
    });
  }

  public recordRunResult(session: ExecutionSession, result: OrchestrationRunResult): void {
    for (const nodeResult of result.nodeResults) {
      this.recordNodeEvent(session, nodeResult);
    }

    this.recordSessionEvent(session, 'execution.duration', {
      durationMs:
        session.startedAt && session.completedAt
          ? Date.parse(session.completedAt) - Date.parse(session.startedAt)
          : undefined,
      resultStatus: result.status,
    });
  }

  public getTimeline(workflowId: Identifier): ExecutionTimeline {
    return new ExecutionTimeline(this.getWorkflowHistory(workflowId));
  }

  public getWorkflowHistory(workflowId: Identifier): readonly ExecutionHistoryEntry[] {
    return this.getTimelineInternal(workflowId).getEvents();
  }

  public listAll(): readonly ExecutionHistoryEntry[] {
    return Object.freeze(
      [...this.timelines.values()].flatMap((timeline) => [...timeline.getEvents()]),
    );
  }

  public getRecent(limit = 50): readonly ExecutionHistoryEntry[] {
    return Object.freeze(
      [...this.listAll()]
        .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
        .slice(0, limit),
    );
  }
}
