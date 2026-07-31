import {
  ExecutionPriority,
  type IRuntimeExecution as RuntimeExecutionLike,
} from './runtime-foundation.js';

export type RuntimeSchedulerBackpressurePolicy =
  'reject' | 'block' | 'drop-oldest' | 'drop-newest' | 'caller-executes';

export enum RuntimeQueueHealthStatus {
  Healthy = 'healthy',
  Degraded = 'degraded',
  Critical = 'critical',
}

export interface IRuntimeScheduler {
  readonly queue: IRuntimeQueue;
  start(): Promise<void>;
  shutdown(options?: { drain?: boolean }): Promise<void>;
  enqueue(execution: RuntimeExecutionLike): Promise<void>;
  drain(): Promise<void>;
  getStatistics(): RuntimeQueueStatistics;
  getHealth(): RuntimeQueueHealth;
}

export interface IRuntimeQueue {
  readonly capacity: number;
  readonly length: number;
  enqueue(item: RuntimeQueueItem): Promise<void>;
  dequeue(): Promise<RuntimeQueueItem | undefined>;
  peek(): Promise<RuntimeQueueItem | undefined>;
  snapshot(): RuntimeQueueSnapshot;
  clear(): Promise<void>;
}

export interface IRuntimeWorker {
  readonly id: string;
  readonly isBusy: boolean;
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
}

export interface IRuntimeWorkerPool {
  readonly workers: readonly IRuntimeWorker[];
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
}

export interface IRuntimeQueueObserver {
  onQueueChange(snapshot: RuntimeQueueSnapshot): void | Promise<void>;
}

export interface IRuntimeSchedulerObserver {
  onSchedulerChange(snapshot: RuntimeQueueStatistics): void | Promise<void>;
}

export interface RuntimeQueueItem {
  readonly execution: RuntimeExecutionLike;
  readonly enqueuedAt: number;
  readonly sequence: number;
  readonly lease?: RuntimeExecutionLease;
}

export interface RuntimeExecutionReservation {
  readonly executionId: string;
  readonly reservedAt: number;
  readonly lease: RuntimeExecutionLease;
}

export interface RuntimeExecutionLease {
  readonly expiresAt: number;
  readonly token: string;
}

export interface RuntimeQueueSnapshot {
  readonly length: number;
  readonly capacity: number;
  readonly items: readonly RuntimeQueueItem[];
  readonly reserved: readonly RuntimeExecutionReservation[];
}

export interface RuntimeQueueStatistics {
  enqueued: number;
  dequeued: number;
  completed: number;
  failed: number;
  cancelled: number;
  dropped: number;
  leaseExpirations: number;
  averageWaitMs: number;
  maximumWaitMs: number;
  dispatchLatencyMs: number;
  queueDepth: number;
  workerUtilization: number;
}

export interface RuntimeQueueHealth {
  readonly status: RuntimeQueueHealthStatus;
  readonly queueDepth: number;
  readonly workerCount: number;
  readonly busyWorkers: number;
  readonly failures: number;
}

export interface RuntimeSchedulerOptions {
  readonly workers?: number;
  readonly queueCapacity?: number;
  readonly backpressurePolicy?: RuntimeSchedulerBackpressurePolicy;
  readonly leaseDurationMs?: number;
  readonly handler?: (execution: RuntimeExecutionLike) => Promise<void> | void;
  readonly eventBus?: { publish(event: { type: string; payload?: unknown }): Promise<void> | void };
  readonly observers?: readonly IRuntimeQueueObserver[];
}

export class QueueFullException extends Error {
  public constructor(message = 'Queue is full') {
    super(message);
    this.name = 'QueueFullException';
  }
}

export class WorkerFailureException extends Error {
  public constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'WorkerFailureException';
  }
}

export class SchedulerShutdownException extends Error {
  public constructor(message = 'Scheduler is shutting down') {
    super(message);
    this.name = 'SchedulerShutdownException';
  }
}

export class InvalidSchedulerStateException extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'InvalidSchedulerStateException';
  }
}

export class QueueReservationException extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'QueueReservationException';
  }
}

export class RuntimeSchedulerBuilder {
  private options: RuntimeSchedulerOptions = {};

  public withWorkers(count: number): this {
    this.options = { ...this.options, workers: count };
    return this;
  }

  public withQueueCapacity(capacity: number): this {
    this.options = { ...this.options, queueCapacity: capacity };
    return this;
  }

  public withBackpressurePolicy(policy: RuntimeSchedulerBackpressurePolicy): this {
    this.options = { ...this.options, backpressurePolicy: policy };
    return this;
  }

  public withLeaseDurationMs(durationMs: number): this {
    this.options = { ...this.options, leaseDurationMs: durationMs };
    return this;
  }

  public withHandler(handler: (execution: RuntimeExecutionLike) => Promise<void> | void): this {
    this.options = { ...this.options, handler };
    return this;
  }

  public build(): RuntimeScheduler {
    return new RuntimeScheduler(this.options);
  }
}

export class RuntimeQueue implements IRuntimeQueue {
  private readonly items: RuntimeQueueItem[] = [];
  private readonly reserved = new Map<string, RuntimeExecutionReservation>();
  private sequence = 0;

  public constructor(
    public readonly capacity: number,
    private readonly leaseDurationMs = 1000,
  ) {}

  public get length(): number {
    return this.items.length;
  }

  public async enqueue(item: RuntimeQueueItem): Promise<void> {
    if (this.items.length >= this.capacity) {
      throw new QueueFullException();
    }

    this.items.push({ ...item, sequence: ++this.sequence });
  }

  public async dequeue(): Promise<RuntimeQueueItem | undefined> {
    if (this.items.length === 0) {
      return undefined;
    }

    const sorted = [...this.items].sort((a, b) => this.compare(a, b));
    const item = sorted[0];
    if (!item) {
      return undefined;
    }

    const index = this.items.findIndex((candidate) => candidate.sequence === item.sequence);
    if (index < 0) {
      return undefined;
    }

    this.items.splice(index, 1);

    const reservation: RuntimeExecutionReservation = {
      executionId: item.execution.id,
      reservedAt: Date.now(),
      lease: {
        expiresAt: Date.now() + this.leaseDurationMs,
        token: `${item.execution.id}:${Date.now()}`,
      },
    };
    this.reserved.set(item.execution.id, reservation);

    return { ...item, lease: reservation.lease };
  }

  public async peek(): Promise<RuntimeQueueItem | undefined> {
    if (this.items.length === 0) {
      return undefined;
    }

    const sorted = [...this.items].sort((a, b) => this.compare(a, b));
    return sorted[0];
  }

  public snapshot(): RuntimeQueueSnapshot {
    return {
      length: this.items.length,
      capacity: this.capacity,
      items: [...this.items].sort((a, b) => this.compare(a, b)),
      reserved: Array.from(this.reserved.values()),
    };
  }

  public async clear(): Promise<void> {
    this.items.splice(0, this.items.length);
    this.reserved.clear();
  }

  private compare(a: RuntimeQueueItem, b: RuntimeQueueItem): number {
    const priorityRank = (priority: RuntimeExecutionLike['priority']): number => {
      switch (priority) {
        case ExecutionPriority.Critical:
          return 0;
        case ExecutionPriority.High:
          return 1;
        case ExecutionPriority.Normal:
          return 2;
        case ExecutionPriority.Low:
          return 3;
        default:
          return 4;
      }
    };

    const priorityDifference =
      priorityRank(a.execution.priority) - priorityRank(b.execution.priority);
    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return a.sequence - b.sequence;
  }
}

export class RuntimeWorker implements IRuntimeWorker {
  public readonly id: string;
  private running = false;
  private stopped = false;
  private readonly handler: (execution: RuntimeExecutionLike) => Promise<void> | void;

  public constructor(
    id: string,
    handler: (execution: RuntimeExecutionLike) => Promise<void> | void,
  ) {
    this.id = id;
    this.handler = handler;
  }

  public get isBusy(): boolean {
    return this.running;
  }

  public async start(): Promise<void> {
    this.running = false;
    this.stopped = false;
  }

  public async stop(): Promise<void> {
    this.running = false;
    this.stopped = true;
  }

  public async restart(): Promise<void> {
    this.running = false;
    this.stopped = false;
  }

  public async run(execution: RuntimeExecutionLike): Promise<void> {
    if (this.stopped) {
      throw new SchedulerShutdownException();
    }

    this.running = true;
    try {
      await this.handler(execution);
    } finally {
      this.running = false;
    }
  }
}

export class RuntimeWorkerPool implements IRuntimeWorkerPool {
  private readonly workerList: RuntimeWorker[] = [];

  public constructor(
    workerCount: number,
    handler: (execution: RuntimeExecutionLike) => Promise<void> | void,
  ) {
    for (let index = 0; index < workerCount; index += 1) {
      this.workerList.push(new RuntimeWorker(`worker-${index + 1}`, handler));
    }
  }

  public get workers(): readonly IRuntimeWorker[] {
    return this.workerList;
  }

  public async start(): Promise<void> {
    for (const worker of this.workerList) {
      await worker.start();
    }
  }

  public async stop(): Promise<void> {
    for (const worker of this.workerList) {
      await worker.stop();
    }
  }

  public async restart(): Promise<void> {
    for (const worker of this.workerList) {
      await worker.restart();
    }
  }
}

export class RuntimeDispatchLoop {
  private running = false;
  private stopped = false;
  private readonly queue: RuntimeQueue;
  private readonly workers: RuntimeWorker[];
  private readonly handler: (execution: RuntimeExecutionLike) => Promise<void> | void;
  private readonly onItem?: (item: RuntimeQueueItem) => void;

  public constructor(options: {
    readonly queue: RuntimeQueue;
    readonly workers: RuntimeWorker[];
    readonly handler: (execution: RuntimeExecutionLike) => Promise<void> | void;
    readonly onItem?: (item: RuntimeQueueItem) => void;
  }) {
    this.queue = options.queue;
    this.workers = options.workers;
    this.handler = options.handler;
    this.onItem = options.onItem;
  }

  public async start(): Promise<void> {
    this.running = true;
    this.stopped = false;
    while (this.running && !this.stopped) {
      const item = await this.queue.dequeue();
      if (!item) {
        await new Promise((resolve) => setTimeout(resolve, 5));
        continue;
      }

      const worker = this.workers.find((candidate) => !candidate.isBusy) ?? this.workers[0];
      if (!worker) {
        await new Promise((resolve) => setTimeout(resolve, 5));
        continue;
      }

      if (this.onItem) {
        this.onItem(item);
      }

      void worker.run(item.execution).catch(() => undefined);
    }
  }

  public async stop(): Promise<void> {
    this.running = false;
    this.stopped = true;
  }
}

export class RuntimeScheduler implements IRuntimeScheduler {
  public readonly queue: IRuntimeQueue;
  private readonly workers: RuntimeWorker[];
  private readonly handler: (execution: RuntimeExecutionLike) => Promise<void> | void;
  private readonly backpressurePolicy: RuntimeSchedulerBackpressurePolicy;
  private readonly queueCapacity: number;
  private readonly eventBus?: {
    publish(event: { type: string; payload?: unknown }): Promise<void> | void;
  };
  private readonly observers: readonly IRuntimeQueueObserver[];
  private readonly dispatchLoop: RuntimeDispatchLoop;
  private readonly statistics: RuntimeQueueStatistics = {
    enqueued: 0,
    dequeued: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    dropped: 0,
    leaseExpirations: 0,
    averageWaitMs: 0,
    maximumWaitMs: 0,
    dispatchLatencyMs: 0,
    queueDepth: 0,
    workerUtilization: 0,
  };
  private running = false;
  private shuttingDown = false;
  private sequence = 0;

  public constructor(options: RuntimeSchedulerOptions = {}) {
    this.queueCapacity = options.queueCapacity ?? 100;
    this.backpressurePolicy = options.backpressurePolicy ?? 'reject';
    this.handler = options.handler ?? (async () => undefined);
    this.eventBus = options.eventBus;
    this.observers = options.observers ?? [];
    this.queue = new RuntimeQueue(this.queueCapacity, options.leaseDurationMs ?? 1000);
    this.workers = Array.from(
      { length: options.workers ?? 1 },
      (_, index) => new RuntimeWorker(`worker-${index + 1}`, this.handler),
    );
    this.dispatchLoop = new RuntimeDispatchLoop({
      queue: this.queue as RuntimeQueue,
      workers: this.workers,
      handler: this.handler,
      onItem: (item) => {
        this.statistics.dequeued += 1;
        const latency = Date.now() - item.enqueuedAt;
        this.statistics.dispatchLatencyMs = latency;
        this.statistics.averageWaitMs = latency;
        this.statistics.maximumWaitMs = Math.max(this.statistics.maximumWaitMs, latency);
        this.statistics.queueDepth = this.queue.length;
        void this.notifyObservers();
      },
    });
  }

  public async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    this.shuttingDown = false;
    for (const worker of this.workers) {
      await worker.start();
    }
    void this.dispatchLoop.start();
    await this.emit('SchedulerStarted');
  }

  public async shutdown(options: { drain?: boolean } = {}): Promise<void> {
    if (this.shuttingDown) {
      return;
    }

    this.shuttingDown = true;
    this.running = false;
    await this.dispatchLoop.stop();

    if (options.drain) {
      while ((await this.queue.peek()) !== undefined) {
        const item = await this.queue.dequeue();
        if (!item) {
          break;
        }

        await this.handler(item.execution);
        this.statistics.completed += 1;
        this.statistics.queueDepth = this.queue.length;
      }
    }

    for (const worker of this.workers) {
      await worker.stop();
    }

    await this.emit('SchedulerStopped');
  }

  public async enqueue(execution: RuntimeExecutionLike): Promise<void> {
    if (!this.running) {
      throw new InvalidSchedulerStateException('Scheduler is not running');
    }

    if (this.shuttingDown) {
      throw new SchedulerShutdownException();
    }

    if (this.queueCapacity > 0 && this.queue.length >= this.queueCapacity) {
      if (this.backpressurePolicy === 'reject') {
        this.statistics.dropped += 1;
        throw new QueueFullException();
      }

      if (this.backpressurePolicy === 'caller-executes') {
        await this.handler(execution);
        this.statistics.completed += 1;
        return;
      }
    }

    const item: RuntimeQueueItem = {
      execution,
      enqueuedAt: Date.now(),
      sequence: ++this.sequence,
    };

    await this.queue.enqueue(item);
    this.statistics.enqueued += 1;
    this.statistics.queueDepth = this.queue.length;
    await this.emit('ExecutionQueued', item);
    await this.notifyObservers();
  }

  public async drain(): Promise<void> {
    while ((await this.queue.peek()) !== undefined) {
      const item = await this.queue.dequeue();
      if (!item) {
        break;
      }

      await this.handler(item.execution);
      this.statistics.completed += 1;
      this.statistics.queueDepth = this.queue.length;
    }
  }

  public getStatistics(): RuntimeQueueStatistics {
    this.expireLeases();
    return { ...this.statistics, queueDepth: this.queue.length };
  }

  public getHealth(): RuntimeQueueHealth {
    const busyWorkers = this.workers.filter((worker) => worker.isBusy).length;
    return {
      status:
        this.statistics.failed > 0
          ? RuntimeQueueHealthStatus.Degraded
          : RuntimeQueueHealthStatus.Healthy,
      queueDepth: this.queue.length,
      workerCount: this.workers.length,
      busyWorkers,
      failures: this.statistics.failed,
    };
  }

  private expireLeases(): void {
    const now = Date.now();
    const snapshot = this.queue.snapshot();
    const expired = snapshot.reserved.filter((reservation) => reservation.lease.expiresAt <= now);
    if (expired.length > 0) {
      this.statistics.leaseExpirations += expired.length;
    }
  }

  private async emit(type: string, item?: RuntimeQueueItem): Promise<void> {
    await this.eventBus?.publish({ type, payload: item?.execution ?? undefined });
  }

  private async notifyObservers(): Promise<void> {
    const snapshot = this.queue.snapshot();
    for (const observer of this.observers) {
      await observer.onQueueChange(snapshot);
    }
  }
}
