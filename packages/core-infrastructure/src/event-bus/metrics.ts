export class EventCounters {
  public publishedEvents = 0;
  public successfulDispatches = 0;
  public failedDispatches = 0;
  public retryAttempts = 0;
  public deadLetteredEvents = 0;
  public failedObservers = 0;
  public middlewareExecutions = 0;
  public handlerExecutions = 0;
  public concurrentExecutions = 0;
  public activeExecutions = 0;
}

export class EventMetrics {
  private readonly counters = new EventCounters();
  private readonly latenciesMs: number[] = [];
  private readonly handlerLatenciesMs: number[] = [];
  private readonly middlewareLatenciesMs: number[] = [];
  private readonly throughputSamples: number[] = [];

  public recordPublishedEvent(): void {
    this.counters.publishedEvents += 1;
  }

  public recordDispatchResult(success: boolean): void {
    if (success) {
      this.counters.successfulDispatches += 1;
    } else {
      this.counters.failedDispatches += 1;
    }
  }

  public recordRetryAttempt(): void {
    this.counters.retryAttempts += 1;
  }

  public recordDeadLetter(): void {
    this.counters.deadLetteredEvents += 1;
  }

  public recordObserverFailure(): void {
    this.counters.failedObservers += 1;
  }

  public recordMiddlewareExecution(durationMs: number): void {
    this.counters.middlewareExecutions += 1;
    this.middlewareLatenciesMs.push(durationMs);
  }

  public recordHandlerExecution(durationMs: number): void {
    this.counters.handlerExecutions += 1;
    this.handlerLatenciesMs.push(durationMs);
  }

  public recordLatency(durationMs: number): void {
    this.latenciesMs.push(durationMs);
  }

  public recordConcurrentExecution(): void {
    this.counters.concurrentExecutions += 1;
    this.counters.activeExecutions += 1;
  }

  public completeConcurrentExecution(): void {
    if (this.counters.activeExecutions > 0) {
      this.counters.activeExecutions -= 1;
    }
  }

  public recordThroughput(): void {
    this.throughputSamples.push(Date.now());
  }

  public snapshot(): EventPerformanceSnapshot {
    return new EventPerformanceSnapshot(
      { ...this.counters },
      new EventStatistics(
        this.average(this.latenciesMs),
        this.minimum(this.latenciesMs),
        this.maximum(this.latenciesMs),
        this.average(this.handlerLatenciesMs),
        this.minimum(this.handlerLatenciesMs),
        this.maximum(this.handlerLatenciesMs),
        this.average(this.middlewareLatenciesMs),
        this.minimum(this.middlewareLatenciesMs),
        this.maximum(this.middlewareLatenciesMs),
        this.throughputSamples.length,
      ),
    );
  }

  private average(values: readonly number[]): number {
    if (values.length === 0) {
      return 0;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private minimum(values: readonly number[]): number {
    return values.length === 0 ? 0 : Math.min(...values);
  }

  private maximum(values: readonly number[]): number {
    return values.length === 0 ? 0 : Math.max(...values);
  }
}

export class EventStatistics {
  public constructor(
    public readonly averageLatencyMs: number,
    public readonly minimumLatencyMs: number,
    public readonly maximumLatencyMs: number,
    public readonly averageHandlerLatencyMs: number,
    public readonly minimumHandlerLatencyMs: number,
    public readonly maximumHandlerLatencyMs: number,
    public readonly averageMiddlewareLatencyMs: number,
    public readonly minimumMiddlewareLatencyMs: number,
    public readonly maximumMiddlewareLatencyMs: number,
    public readonly throughputPerSecond: number,
  ) {}
}

export class EventHealth {
  public constructor(
    public readonly status: 'healthy' | 'degraded' | 'unhealthy',
    public readonly message: string,
  ) {}
}

export class EventHealthCheck {
  public constructor(
    private readonly evaluator: (snapshot: EventPerformanceSnapshot) => EventHealth,
  ) {}

  public evaluate(snapshot: EventPerformanceSnapshot): EventHealth {
    return this.evaluator(snapshot);
  }
}

export class EventPerformanceSnapshot {
  public readonly metrics: EventPerformanceSnapshot;

  public constructor(
    public readonly counters: EventCounters,
    public readonly statistics: EventStatistics,
    public readonly health?: EventHealth,
    public readonly activities: readonly EventActivity[] = [],
    public readonly observedAt: string = new Date().toISOString(),
  ) {
    this.metrics = this;
  }
}

export class EventActivity {
  public constructor(
    public readonly eventId: string,
    public readonly correlationId: string | undefined,
    public readonly phase: string,
    public readonly timestamp: string,
  ) {}
}

export class EventTraceSnapshot {
  public constructor(
    public readonly activities: readonly EventActivity[],
    public readonly health?: EventHealth,
  ) {}
}

export class EventTracer {
  private readonly activities: EventActivity[] = [];
  private health: EventHealth | undefined;

  public record(event: IEventLike, correlationId: string | undefined, phase: string): void {
    this.activities.push(
      new EventActivity(event.eventId, correlationId, phase, new Date().toISOString()),
    );
  }

  public recordHealth(health: EventHealth | undefined): void {
    this.health = health;
  }

  public getActivities(eventId: string): readonly EventActivity[] {
    return this.activities.filter((activity) => activity.eventId === eventId);
  }

  public snapshot(): EventTraceSnapshot {
    return new EventTraceSnapshot([...this.activities], this.health);
  }
}

interface IEventLike {
  readonly eventId: string;
}
