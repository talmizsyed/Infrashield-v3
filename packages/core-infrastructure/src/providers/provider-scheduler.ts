import { toTimestampString } from '../primitives';
import type { ProviderJob, ProviderScheduleOptions } from './provider-types';

export class ProviderDiscoveryJob implements ProviderJob {
  public readonly id: string;
  public readonly providerId: string;
  public readonly createdAt = toTimestampString(new Date().toISOString());
  public readonly kind: string;
  public readonly priority: number;

  public constructor(options: {
    readonly providerId: string;
    readonly kind: string;
    readonly priority?: number;
  }) {
    this.id = `discovery-${options.providerId}`;
    this.providerId = options.providerId;
    this.kind = options.kind;
    this.priority = options.priority ?? 0;
  }

  public async execute(): Promise<void> {}
}

export class ProviderInventoryJob implements ProviderJob {
  public readonly id: string;
  public readonly providerId: string;
  public readonly createdAt = toTimestampString(new Date().toISOString());
  public readonly kind: string;
  public readonly priority: number;

  public constructor(options: {
    readonly providerId: string;
    readonly kind: string;
    readonly priority?: number;
  }) {
    this.id = `inventory-${options.providerId}`;
    this.providerId = options.providerId;
    this.kind = options.kind;
    this.priority = options.priority ?? 0;
  }

  public async execute(): Promise<void> {}
}

export class ProviderHealthJob implements ProviderJob {
  public readonly id: string;
  public readonly providerId: string;
  public readonly createdAt = toTimestampString(new Date().toISOString());
  public readonly kind: string;
  public readonly priority: number;

  public constructor(options: {
    readonly providerId: string;
    readonly kind: string;
    readonly priority?: number;
  }) {
    this.id = `health-${options.providerId}`;
    this.providerId = options.providerId;
    this.kind = options.kind;
    this.priority = options.priority ?? 0;
  }

  public async execute(): Promise<void> {}
}

export class ProviderScheduler {
  private readonly queue: Array<{ readonly job: ProviderJob }> = [];

  public schedule(job: ProviderJob, options: ProviderScheduleOptions = {}): void {
    const priority = options.priority ?? job.priority;
    const next = { job: { ...job, priority } as ProviderJob };
    this.queue.push(next);
    this.queue.sort((left, right) => right.job.priority - left.job.priority);
  }

  public next(): { readonly job: ProviderJob } | undefined {
    return this.queue.shift();
  }

  public complete(jobId: string): void {
    const index = this.queue.findIndex((entry) => entry.job.id === jobId);
    if (index >= 0) {
      this.queue.splice(index, 1);
    }
  }
}
