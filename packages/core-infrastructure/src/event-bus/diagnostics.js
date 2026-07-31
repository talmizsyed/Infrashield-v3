'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.EventDiagnostics = void 0;
const metrics_1 = require('./metrics');
class EventDiagnostics {
  constructor(metrics = undefined, tracer = undefined, healthCheck = undefined, observers = []) {
    this.metrics = metrics;
    this.tracer = tracer;
    this.healthCheck = healthCheck;
    this.observers = observers;
  }
  recordPublishedEvent() {
    this.metrics?.recordPublishedEvent();
  }
  recordDispatchResult(success) {
    this.metrics?.recordDispatchResult(success);
  }
  recordRetryAttempt() {
    this.metrics?.recordRetryAttempt();
  }
  recordDeadLetter() {
    this.metrics?.recordDeadLetter();
  }
  recordObserverFailure() {
    this.metrics?.recordObserverFailure();
  }
  recordMiddlewareExecution(durationMs) {
    this.metrics?.recordMiddlewareExecution(durationMs);
  }
  recordHandlerExecution(durationMs) {
    this.metrics?.recordHandlerExecution(durationMs);
  }
  recordLatency(durationMs) {
    this.metrics?.recordLatency(durationMs);
  }
  recordConcurrentExecution() {
    this.metrics?.recordConcurrentExecution();
  }
  completeConcurrentExecution() {
    this.metrics?.completeConcurrentExecution();
  }
  recordThroughput() {
    this.metrics?.recordThroughput();
  }
  recordActivity(event, phase, correlationId = event.correlationId) {
    this.tracer?.record(event, correlationId, phase);
  }
  recordHealth(health) {
    this.tracer?.recordHealth(health);
  }
  async observe(snapshot) {
    for (const observer of this.observers) {
      try {
        await observer.onEventObserved(snapshot);
      } catch {
        this.recordObserverFailure();
      }
    }
  }
  snapshot() {
    const metricsSnapshot = this.metrics?.snapshot();
    const health = this.healthCheck?.evaluate(
      metricsSnapshot ??
        new metrics_1.EventPerformanceSnapshot(
          new metrics_1.EventCounters(),
          new metrics_1.EventStatistics(0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
        ),
    );
    this.tracer?.recordHealth(health);
    return new metrics_1.EventPerformanceSnapshot(
      metricsSnapshot?.counters ?? new metrics_1.EventCounters(),
      metricsSnapshot?.statistics ?? new metrics_1.EventStatistics(0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
      health,
      this.tracer?.snapshot().activities ?? [],
      new Date().toISOString(),
    );
  }
}
exports.EventDiagnostics = EventDiagnostics;
//# sourceMappingURL=diagnostics.js.map
