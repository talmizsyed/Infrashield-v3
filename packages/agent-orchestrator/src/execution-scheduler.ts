import type { Identifier } from '@infrashield/contracts';

import type { ExecutionSession } from './execution-context.js';
import { ScheduleTrigger } from './foundation.js';
import type { OrchestrationRunRequest } from './foundation.js';

export interface ScheduledExecution {
  readonly workflowId: Identifier;
  readonly session: ExecutionSession;
  readonly request: OrchestrationRunRequest;
  readonly trigger: ScheduleTrigger;
  readonly scheduledAt?: string;
  readonly cronExpression?: string;
  readonly eventName?: string;
  readonly webhookId?: string;
  readonly enqueuedAt: string;
}

export class ExecutionQueue {
  private readonly items: ScheduledExecution[] = [];

  public enqueue(item: ScheduledExecution): void {
    this.items.push(item);
  }

  public dequeue(): ScheduledExecution | undefined {
    return this.items.shift();
  }

  public peek(): ScheduledExecution | undefined {
    return this.items[0];
  }

  public size(): number {
    return this.items.length;
  }

  public list(): readonly ScheduledExecution[] {
    return Object.freeze([...this.items]);
  }

  public remove(workflowId: Identifier): boolean {
    const index = this.items.findIndex((item) => item.workflowId === workflowId);
    if (index === -1) {
      return false;
    }
    this.items.splice(index, 1);
    return true;
  }
}

export class ExecutionScheduler {
  private readonly queue = new ExecutionQueue();
  private readonly cronJobs = new Map<string, ScheduledExecution>();
  private readonly eventSubscriptions = new Map<string, ScheduledExecution[]>();
  private readonly webhookHandlers = new Map<string, ScheduledExecution>();

  public schedule(options: {
    readonly workflowId: Identifier;
    readonly session: ExecutionSession;
    readonly request: OrchestrationRunRequest;
  }): ScheduledExecution {
    const schedule = options.request.schedule;
    const trigger = schedule?.trigger ?? ScheduleTrigger.Immediate;

    const scheduled: ScheduledExecution = {
      workflowId: options.workflowId,
      session: options.session,
      request: options.request,
      trigger,
      scheduledAt: schedule?.scheduledAt,
      cronExpression: schedule?.cronExpression,
      eventName: schedule?.eventName,
      webhookId: schedule?.webhookId,
      enqueuedAt: new Date().toISOString(),
    };

    switch (trigger) {
      case ScheduleTrigger.Immediate:
      case ScheduleTrigger.Manual:
        this.queue.enqueue(scheduled);
        break;
      case ScheduleTrigger.Scheduled:
        this.queue.enqueue(scheduled);
        break;
      case ScheduleTrigger.Cron:
        if (schedule?.cronExpression) {
          this.cronJobs.set(options.workflowId, scheduled);
        }
        this.queue.enqueue(scheduled);
        break;
      case ScheduleTrigger.EventDriven:
        if (schedule?.eventName) {
          const existing = this.eventSubscriptions.get(schedule.eventName) ?? [];
          existing.push(scheduled);
          this.eventSubscriptions.set(schedule.eventName, existing);
        }
        break;
      case ScheduleTrigger.Webhook:
        if (schedule?.webhookId) {
          this.webhookHandlers.set(schedule.webhookId, scheduled);
        }
        break;
      default:
        this.queue.enqueue(scheduled);
    }

    return scheduled;
  }

  public dequeueReady(now = Date.now()): ScheduledExecution | undefined {
    const next = this.queue.peek();
    if (!next) {
      return undefined;
    }

    if (next.trigger === ScheduleTrigger.Scheduled && next.scheduledAt) {
      if (Date.parse(next.scheduledAt) > now) {
        return undefined;
      }
    }

    return this.queue.dequeue();
  }

  public triggerEvent(eventName: string): readonly ScheduledExecution[] {
    const items = this.eventSubscriptions.get(eventName) ?? [];
    this.eventSubscriptions.delete(eventName);
    for (const item of items) {
      this.queue.enqueue(item);
    }
    return Object.freeze([...items]);
  }

  public triggerWebhook(webhookId: string): ScheduledExecution | undefined {
    const item = this.webhookHandlers.get(webhookId);
    if (item) {
      this.webhookHandlers.delete(webhookId);
      this.queue.enqueue(item);
    }
    return item;
  }

  public getQueue(): ExecutionQueue {
    return this.queue;
  }

  public getQueueDepth(): number {
    return this.queue.size();
  }

  public matchesCron(expression: string): boolean {
    const parts = expression.trim().split(/\s+/);
    return parts.length >= 1 && parts.length <= 6;
  }
}
