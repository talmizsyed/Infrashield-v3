export declare class EventCounters {
  publishedEvents: number;
  successfulDispatches: number;
  failedDispatches: number;
  retryAttempts: number;
  deadLetteredEvents: number;
  failedObservers: number;
  middlewareExecutions: number;
  handlerExecutions: number;
  concurrentExecutions: number;
  activeExecutions: number;
}
export declare class EventMetrics {
  private readonly counters;
  private readonly latenciesMs;
  private readonly handlerLatenciesMs;
  private readonly middlewareLatenciesMs;
  private readonly throughputSamples;
  recordPublishedEvent(): void;
  recordDispatchResult(success: boolean): void;
  recordRetryAttempt(): void;
  recordDeadLetter(): void;
  recordObserverFailure(): void;
  recordMiddlewareExecution(durationMs: number): void;
  recordHandlerExecution(durationMs: number): void;
  recordLatency(durationMs: number): void;
  recordConcurrentExecution(): void;
  completeConcurrentExecution(): void;
  recordThroughput(): void;
  snapshot(): EventPerformanceSnapshot;
  private average;
  private minimum;
  private maximum;
}
export declare class EventStatistics {
  readonly averageLatencyMs: number;
  readonly minimumLatencyMs: number;
  readonly maximumLatencyMs: number;
  readonly averageHandlerLatencyMs: number;
  readonly minimumHandlerLatencyMs: number;
  readonly maximumHandlerLatencyMs: number;
  readonly averageMiddlewareLatencyMs: number;
  readonly minimumMiddlewareLatencyMs: number;
  readonly maximumMiddlewareLatencyMs: number;
  readonly throughputPerSecond: number;
  constructor(
    averageLatencyMs: number,
    minimumLatencyMs: number,
    maximumLatencyMs: number,
    averageHandlerLatencyMs: number,
    minimumHandlerLatencyMs: number,
    maximumHandlerLatencyMs: number,
    averageMiddlewareLatencyMs: number,
    minimumMiddlewareLatencyMs: number,
    maximumMiddlewareLatencyMs: number,
    throughputPerSecond: number,
  );
}
export declare class EventHealth {
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly message: string;
  constructor(status: 'healthy' | 'degraded' | 'unhealthy', message: string);
}
export declare class EventHealthCheck {
  private readonly evaluator;
  constructor(evaluator: (snapshot: EventPerformanceSnapshot) => EventHealth);
  evaluate(snapshot: EventPerformanceSnapshot): EventHealth;
}
export declare class EventPerformanceSnapshot {
  readonly counters: EventCounters;
  readonly statistics: EventStatistics;
  readonly health?: EventHealth | undefined;
  readonly activities: readonly EventActivity[];
  readonly observedAt: string;
  readonly metrics: EventPerformanceSnapshot;
  constructor(
    counters: EventCounters,
    statistics: EventStatistics,
    health?: EventHealth | undefined,
    activities?: readonly EventActivity[],
    observedAt?: string,
  );
}
export declare class EventActivity {
  readonly eventId: string;
  readonly correlationId: string | undefined;
  readonly phase: string;
  readonly timestamp: string;
  constructor(eventId: string, correlationId: string | undefined, phase: string, timestamp: string);
}
export declare class EventTraceSnapshot {
  readonly activities: readonly EventActivity[];
  readonly health?: EventHealth | undefined;
  constructor(activities: readonly EventActivity[], health?: EventHealth | undefined);
}
export declare class EventTracer {
  private readonly activities;
  private health;
  record(event: IEventLike, correlationId: string | undefined, phase: string): void;
  recordHealth(health: EventHealth | undefined): void;
  getActivities(eventId: string): readonly EventActivity[];
  snapshot(): EventTraceSnapshot;
}
interface IEventLike {
  readonly eventId: string;
}
export {};
//# sourceMappingURL=metrics.d.ts.map
