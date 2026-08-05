import type { Identifier, TimestampString } from '@infrashield/contracts';

import type { ExecutionSession } from './execution-context.js';
import type { OrchestrationStatus } from './foundation.js';

export interface ExecutionHistoryEntry {
  readonly workflowId: Identifier;
  readonly event: string;
  readonly status?: OrchestrationStatus;
  readonly nodeId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly timestamp: TimestampString;
}

export class ExecutionHistory {
  private readonly entries = new Map<Identifier, ExecutionHistoryEntry[]>();

  public record(entry: ExecutionHistoryEntry): void {
    const workflowEntries = this.entries.get(entry.workflowId) ?? [];
    workflowEntries.push(Object.freeze({ ...entry }));
    this.entries.set(entry.workflowId, workflowEntries);
  }

  public recordSessionEvent(
    session: ExecutionSession,
    event: string,
    metadata?: Readonly<Record<string, unknown>>,
  ): void {
    this.record({
      workflowId: session.workflowId,
      event,
      status: session.status,
      metadata,
      timestamp: new Date().toISOString(),
    });
  }

  public getWorkflowHistory(workflowId: Identifier): readonly ExecutionHistoryEntry[] {
    return Object.freeze([...(this.entries.get(workflowId) ?? [])]);
  }

  public listAll(): readonly ExecutionHistoryEntry[] {
    return Object.freeze([...this.entries.values()].flatMap((entries) => [...entries]));
  }

  public getRecent(limit = 50): readonly ExecutionHistoryEntry[] {
    return Object.freeze(
      [...this.listAll()]
        .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
        .slice(0, limit),
    );
  }
}
