import type { Identifier } from '@infrashield/contracts';

import type { ExecutionSession } from './execution-context.js';
import { OrchestrationStatus, ScheduleTrigger } from './foundation.js';
import type { OrchestrationRunRequest } from './foundation.js';
import { ExecutionDispatcher } from './execution-dispatcher.js';
import { QueueWorker } from './queue-worker.js';
import { RetryPolicy } from './retry-policy.js';

export interface ScheduledExecution {
  readonly workflowId: Identifier;
  readonly session: ExecutionSession;
  readonly request: OrchestrationRunRequest;
  readonly trigger: ScheduleTrigger;
  readonly scheduledAt?: string;
  readonly runAt?: string;
  readonly cronExpression?: string;
  readonly eventName?: string;
  readonly webhookId?: string;
  readonly enqueuedAt: string;
  sequence?: number;
  status?: OrchestrationStatus;
  attempts?: number;
  maxAttempts?: number;
  timeoutMs?: number;
  delayMs?: number;
  retryPolicy?: RetryPolicy;
  result?: unknown;
  error?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelledReason?: string;
  lastError?: string;
}

export class ExecutionQueue {
  private readonly items: ScheduledExecution[] = [];
  private sequence = 0;

  public enqueue(item: ScheduledExecution): void {
    if (item.sequence === undefined) {
      item.sequence = this.sequence;
      this.sequence += 1;
    }
    this.items.push(item);
  }

  public dequeue(): ScheduledExecution | undefined {
    while (this.items.length > 0) {
      const item = this.items.shift();
      if (!item || item.status === OrchestrationStatus.Cancelled) {
        continue;
      }
      return item;
    }
    return undefined;
  }

  public peek(): ScheduledExecution | undefined {
    return this.items.find((item) => item.status !== OrchestrationStatus.Cancelled);
  }

  public size(): number {
    return this.items.filter((item) => item.status !== OrchestrationStatus.Cancelled).length;
  }

  public list(): readonly ScheduledExecution[] {
    return Object.freeze(
      this.items.filter((item) => item.status !== OrchestrationStatus.Cancelled),
    );
  }

  public remove(workflowId: Identifier): boolean {
    const index = this.items.findIndex((item) => item.workflowId === workflowId);
    if (index === -1) {
      return false;
    }
    this.items.splice(index, 1);
    return true;
  }

  public cancel(workflowId: Identifier, reason = 'Execution cancelled'): boolean {
    const item = this.items.find((entry) => entry.workflowId === workflowId);
    if (!item) {
      return false;
    }

    item.status = OrchestrationStatus.Cancelled;
    item.cancelledAt = new Date().toISOString();
    item.cancelledReason = reason;
    return this.remove(workflowId);
  }

  public dequeueReady(now = Date.now()): ScheduledExecution | undefined {
    const index = this.items.findIndex((item) => {
      if (item.status === OrchestrationStatus.Cancelled) {
        return false;
      }
      const runAt = item.runAt ?? item.scheduledAt ?? item.enqueuedAt;
      return Date.parse(runAt) <= now;
    });

    if (index === -1) {
      return undefined;
    }

    const [item] = this.items.splice(index, 1);
    return item;
  }
}

export class ExecutionScheduler {
  private readonly queue = new ExecutionQueue();
  private readonly dispatcher: ExecutionDispatcher<Readonly<Record<string, unknown>>>;
  private readonly worker: QueueWorker<Readonly<Record<string, unknown>>>;
  private readonly cronJobs = new Map<string, ScheduledExecution>();
  private readonly eventSubscriptions = new Map<string, ScheduledExecution[]>();
  private readonly webhookHandlers = new Map<string, ScheduledExecution>();

  public constructor(
    options: {
      readonly dispatcher?: ExecutionDispatcher<Readonly<Record<string, unknown>>>;
      readonly retryPolicy?: RetryPolicy;
      readonly timeoutMs?: number;
    } = {},
  ) {
    this.dispatcher =
      options.dispatcher ??
      new ExecutionDispatcher<Readonly<Record<string, unknown>>>({
        retryPolicy: options.retryPolicy,
        timeoutMs: options.timeoutMs,
      });
    this.worker = new QueueWorker(this.queue, this.dispatcher);
  }

  public schedule(options: {
    readonly workflowId: Identifier;
    readonly session: ExecutionSession;
    readonly request: OrchestrationRunRequest;
    readonly delayMs?: number;
    readonly timeoutMs?: number;
    readonly retryPolicy?: RetryPolicy;
    readonly maxAttempts?: number;
    readonly runAt?: string;
  }): ScheduledExecution {
    const schedule = options.request.schedule;
    const trigger = schedule?.trigger ?? ScheduleTrigger.Immediate;
    const now = new Date().toISOString();
    const runAt =
      options.runAt ??
      schedule?.scheduledAt ??
      (options.delayMs !== undefined ? new Date(Date.now() + options.delayMs).toISOString() : now);
    const retryPolicy =
      options.retryPolicy ?? new RetryPolicy({ maxAttempts: options.maxAttempts });

    const scheduled: ScheduledExecution = {
      workflowId: options.workflowId,
      session: options.session,
      request: options.request,
      trigger,
      scheduledAt: schedule?.scheduledAt,
      runAt,
      cronExpression: schedule?.cronExpression,
      eventName: schedule?.eventName,
      webhookId: schedule?.webhookId,
      enqueuedAt: now,
      status: OrchestrationStatus.Queued,
      attempts: 0,
      maxAttempts: retryPolicy.maxAttempts,
      timeoutMs: options.timeoutMs,
      delayMs: options.delayMs,
      retryPolicy,
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
    return this.queue.dequeueReady(now);
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

  public getWorker(): QueueWorker<Readonly<Record<string, unknown>>> {
    return this.worker;
  }

  public getDispatcher(): ExecutionDispatcher<Readonly<Record<string, unknown>>> {
    return this.dispatcher;
  }

  public getQueueDepth(): number {
    return this.queue.size();
  }

  public cancel(workflowId: Identifier, reason = 'Execution cancelled'): boolean {
    return this.queue.cancel(workflowId, reason);
  }

  public async processNext(options?: {
    readonly now?: number;
    readonly signal?: AbortSignal;
  }): Promise<unknown | undefined> {
    const result = await this.worker.processNext(options);
    return result?.result;
  }

  public async processAll(options?: {
    readonly now?: number;
    readonly signal?: AbortSignal;
  }): Promise<readonly unknown[]> {
    const results = await this.worker.drain(options);
    return Object.freeze(
      results.map((result) => result.result).filter((value) => value !== undefined),
    );
  }

  public matchesCron(expression: string): boolean {
    const parts = expression.trim().split(/\s+/);
    return parts.length >= 1 && parts.length <= 6;
  }
}
