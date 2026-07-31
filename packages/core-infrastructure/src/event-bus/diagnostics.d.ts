import type { IEvent } from './contracts';
import {
  EventHealth,
  EventHealthCheck,
  EventMetrics,
  EventPerformanceSnapshot,
  EventTracer,
} from './metrics';
import type { IEventObserver } from './observer';
export declare class EventDiagnostics {
  private readonly metrics;
  private readonly tracer;
  private readonly healthCheck;
  private readonly observers;
  constructor(
    metrics?: EventMetrics | undefined,
    tracer?: EventTracer | undefined,
    healthCheck?: EventHealthCheck | undefined,
    observers?: readonly IEventObserver[],
  );
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
  recordActivity(event: IEvent, phase: string, correlationId?: string | undefined): void;
  recordHealth(health: EventHealth | undefined): void;
  observe(snapshot: EventPerformanceSnapshot): Promise<void>;
  snapshot(): EventPerformanceSnapshot;
}
//# sourceMappingURL=diagnostics.d.ts.map
