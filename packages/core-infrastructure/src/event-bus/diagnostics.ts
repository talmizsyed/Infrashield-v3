import type { IEvent } from './contracts';
import {
  EventCounters,
  EventHealth,
  EventHealthCheck,
  EventMetrics,
  EventPerformanceSnapshot,
  EventStatistics,
  EventTracer,
} from './metrics';
import type { IEventObserver } from './observer';

export class EventDiagnostics {
  public constructor(
    private readonly metrics: EventMetrics | undefined = undefined,
    private readonly tracer: EventTracer | undefined = undefined,
    private readonly healthCheck: EventHealthCheck | undefined = undefined,
    private readonly observers: readonly IEventObserver[] = [],
  ) {}

  public recordPublishedEvent(): void {
    this.metrics?.recordPublishedEvent();
  }

  public recordDispatchResult(success: boolean): void {
    this.metrics?.recordDispatchResult(success);
  }

  public recordRetryAttempt(): void {
    this.metrics?.recordRetryAttempt();
  }

  public recordDeadLetter(): void {
    this.metrics?.recordDeadLetter();
  }

  public recordObserverFailure(): void {
    this.metrics?.recordObserverFailure();
  }

  public recordMiddlewareExecution(durationMs: number): void {
    this.metrics?.recordMiddlewareExecution(durationMs);
  }

  public recordHandlerExecution(durationMs: number): void {
    this.metrics?.recordHandlerExecution(durationMs);
  }

  public recordLatency(durationMs: number): void {
    this.metrics?.recordLatency(durationMs);
  }

  public recordConcurrentExecution(): void {
    this.metrics?.recordConcurrentExecution();
  }

  public completeConcurrentExecution(): void {
    this.metrics?.completeConcurrentExecution();
  }

  public recordThroughput(): void {
    this.metrics?.recordThroughput();
  }

  public recordActivity(
    event: IEvent,
    phase: string,
    correlationId: string | undefined = event.correlationId,
  ): void {
    this.tracer?.record(event, correlationId, phase);
  }

  public recordHealth(health: EventHealth | undefined): void {
    this.tracer?.recordHealth(health);
  }

  public async observe(snapshot: EventPerformanceSnapshot): Promise<void> {
    for (const observer of this.observers) {
      try {
        await observer.onEventObserved(snapshot);
      } catch {
        this.recordObserverFailure();
      }
    }
  }

  public snapshot(): EventPerformanceSnapshot {
    const metricsSnapshot = this.metrics?.snapshot();
    const health = this.healthCheck?.evaluate(
      metricsSnapshot ??
        new EventPerformanceSnapshot(
          new EventCounters(),
          new EventStatistics(0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
        ),
    );

    this.tracer?.recordHealth(health);

    return new EventPerformanceSnapshot(
      metricsSnapshot?.counters ?? new EventCounters(),
      metricsSnapshot?.statistics ?? new EventStatistics(0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
      health,
      this.tracer?.snapshot().activities ?? [],
      new Date().toISOString(),
    );
  }
}
