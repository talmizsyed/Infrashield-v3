import type { CorrelationId, Identifier, TimestampString } from '@infrashield/contracts';

import { OrchestrationStatus } from './foundation.js';

const terminalStatuses = new Set<OrchestrationStatus>([
  OrchestrationStatus.Completed,
  OrchestrationStatus.Failed,
  OrchestrationStatus.Cancelled,
  OrchestrationStatus.RolledBack,
]);

export interface ExecutionEvent {
  readonly workflowId: Identifier;
  readonly correlationId: CorrelationId;
  readonly event: string;
  readonly status?: OrchestrationStatus;
  readonly nodeId?: string;
  readonly agentId?: string;
  readonly checkpointId?: Identifier;
  readonly actorId?: string;
  readonly durationMs?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly timestamp: TimestampString;
}

export class ExecutionTimeline {
  private readonly events: ExecutionEvent[];

  public constructor(events: readonly ExecutionEvent[] = []) {
    this.events = [...events].map((event) => this.freezeEvent(event));
  }

  public record(event: ExecutionEvent): ExecutionEvent {
    const frozen = this.freezeEvent(event);
    this.events.push(frozen);
    return frozen;
  }

  public getEvents(): readonly ExecutionEvent[] {
    return Object.freeze([...this.events]);
  }

  public getLifecycleEvents(): readonly ExecutionEvent[] {
    return Object.freeze(this.events.filter((event) => event.nodeId === undefined));
  }

  public getNodeEvents(nodeId: string): readonly ExecutionEvent[] {
    return Object.freeze(this.events.filter((event) => event.nodeId === nodeId));
  }

  public getAgentEvents(agentId: string): readonly ExecutionEvent[] {
    return Object.freeze(this.events.filter((event) => event.agentId === agentId));
  }

  public getStartedAt(): TimestampString | undefined {
    return this.events.find((event) => event.event === 'running' || event.event === 'started')
      ?.timestamp;
  }

  public getCompletedAt(): TimestampString | undefined {
    for (let index = this.events.length - 1; index >= 0; index -= 1) {
      const event = this.events[index];
      if (
        event &&
        (event.event === 'completed' ||
          (event.status !== undefined && terminalStatuses.has(event.status)))
      ) {
        return event.timestamp;
      }
    }

    return undefined;
  }

  public getDurationMs(): number | undefined {
    const startedAt = this.getStartedAt();
    const completedAt = this.getCompletedAt();
    if (!startedAt || !completedAt) {
      return undefined;
    }

    return Date.parse(completedAt) - Date.parse(startedAt);
  }

  private freezeEvent(event: ExecutionEvent): ExecutionEvent {
    return Object.freeze({
      ...event,
      metadata: event.metadata ? Object.freeze({ ...event.metadata }) : undefined,
    });
  }
}
