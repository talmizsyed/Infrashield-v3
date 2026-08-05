import type { CorrelationId, Identifier, TimestampString } from '@infrashield/contracts';

export interface ExecutionAuditEntry {
  readonly id: string;
  readonly workflowId?: Identifier;
  readonly correlationId?: CorrelationId;
  readonly action: string;
  readonly actorId?: string;
  readonly durationMs?: number;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly timestamp: TimestampString;
}

export class ExecutionAudit {
  private readonly entries: ExecutionAuditEntry[] = [];

  public record(options: {
    readonly workflowId?: Identifier;
    readonly correlationId?: CorrelationId;
    readonly action: string;
    readonly actorId?: string;
    readonly durationMs?: number;
    readonly details?: Readonly<Record<string, unknown>>;
  }): ExecutionAuditEntry {
    const entry: ExecutionAuditEntry = Object.freeze({
      id: `audit-${Date.now()}-${this.entries.length}`,
      workflowId: options.workflowId,
      correlationId: options.correlationId,
      action: options.action,
      actorId: options.actorId,
      durationMs: options.durationMs,
      details: options.details ? Object.freeze({ ...options.details }) : undefined,
      timestamp: new Date().toISOString(),
    });
    this.entries.push(entry);
    return entry;
  }

  public getEntries(): readonly ExecutionAuditEntry[] {
    return Object.freeze([...this.entries]);
  }

  public getWorkflowEntries(workflowId: Identifier): readonly ExecutionAuditEntry[] {
    return Object.freeze(this.entries.filter((entry) => entry.workflowId === workflowId));
  }
}
