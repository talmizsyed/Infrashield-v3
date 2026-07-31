'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.EventTracer =
  exports.EventTraceSnapshot =
  exports.EventActivity =
  exports.EventPerformanceSnapshot =
  exports.EventHealthCheck =
  exports.EventHealth =
  exports.EventStatistics =
  exports.EventMetrics =
  exports.EventCounters =
    void 0;
class EventCounters {
  constructor() {
    this.publishedEvents = 0;
    this.successfulDispatches = 0;
    this.failedDispatches = 0;
    this.retryAttempts = 0;
    this.deadLetteredEvents = 0;
    this.failedObservers = 0;
    this.middlewareExecutions = 0;
    this.handlerExecutions = 0;
    this.concurrentExecutions = 0;
    this.activeExecutions = 0;
  }
}
exports.EventCounters = EventCounters;
class EventMetrics {
  constructor() {
    this.counters = new EventCounters();
    this.latenciesMs = [];
    this.handlerLatenciesMs = [];
    this.middlewareLatenciesMs = [];
    this.throughputSamples = [];
  }
  recordPublishedEvent() {
    this.counters.publishedEvents += 1;
  }
  recordDispatchResult(success) {
    if (success) {
      this.counters.successfulDispatches += 1;
    } else {
      this.counters.failedDispatches += 1;
    }
  }
  recordRetryAttempt() {
    this.counters.retryAttempts += 1;
  }
  recordDeadLetter() {
    this.counters.deadLetteredEvents += 1;
  }
  recordObserverFailure() {
    this.counters.failedObservers += 1;
  }
  recordMiddlewareExecution(durationMs) {
    this.counters.middlewareExecutions += 1;
    this.middlewareLatenciesMs.push(durationMs);
  }
  recordHandlerExecution(durationMs) {
    this.counters.handlerExecutions += 1;
    this.handlerLatenciesMs.push(durationMs);
  }
  recordLatency(durationMs) {
    this.latenciesMs.push(durationMs);
  }
  recordConcurrentExecution() {
    this.counters.concurrentExecutions += 1;
    this.counters.activeExecutions += 1;
  }
  completeConcurrentExecution() {
    if (this.counters.activeExecutions > 0) {
      this.counters.activeExecutions -= 1;
    }
  }
  recordThroughput() {
    this.throughputSamples.push(Date.now());
  }
  snapshot() {
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
  average(values) {
    if (values.length === 0) {
      return 0;
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }
  minimum(values) {
    return values.length === 0 ? 0 : Math.min(...values);
  }
  maximum(values) {
    return values.length === 0 ? 0 : Math.max(...values);
  }
}
exports.EventMetrics = EventMetrics;
class EventStatistics {
  constructor(
    averageLatencyMs,
    minimumLatencyMs,
    maximumLatencyMs,
    averageHandlerLatencyMs,
    minimumHandlerLatencyMs,
    maximumHandlerLatencyMs,
    averageMiddlewareLatencyMs,
    minimumMiddlewareLatencyMs,
    maximumMiddlewareLatencyMs,
    throughputPerSecond,
  ) {
    this.averageLatencyMs = averageLatencyMs;
    this.minimumLatencyMs = minimumLatencyMs;
    this.maximumLatencyMs = maximumLatencyMs;
    this.averageHandlerLatencyMs = averageHandlerLatencyMs;
    this.minimumHandlerLatencyMs = minimumHandlerLatencyMs;
    this.maximumHandlerLatencyMs = maximumHandlerLatencyMs;
    this.averageMiddlewareLatencyMs = averageMiddlewareLatencyMs;
    this.minimumMiddlewareLatencyMs = minimumMiddlewareLatencyMs;
    this.maximumMiddlewareLatencyMs = maximumMiddlewareLatencyMs;
    this.throughputPerSecond = throughputPerSecond;
  }
}
exports.EventStatistics = EventStatistics;
class EventHealth {
  constructor(status, message) {
    this.status = status;
    this.message = message;
  }
}
exports.EventHealth = EventHealth;
class EventHealthCheck {
  constructor(evaluator) {
    this.evaluator = evaluator;
  }
  evaluate(snapshot) {
    return this.evaluator(snapshot);
  }
}
exports.EventHealthCheck = EventHealthCheck;
class EventPerformanceSnapshot {
  constructor(
    counters,
    statistics,
    health,
    activities = [],
    observedAt = new Date().toISOString(),
  ) {
    this.counters = counters;
    this.statistics = statistics;
    this.health = health;
    this.activities = activities;
    this.observedAt = observedAt;
    this.metrics = this;
  }
}
exports.EventPerformanceSnapshot = EventPerformanceSnapshot;
class EventActivity {
  constructor(eventId, correlationId, phase, timestamp) {
    this.eventId = eventId;
    this.correlationId = correlationId;
    this.phase = phase;
    this.timestamp = timestamp;
  }
}
exports.EventActivity = EventActivity;
class EventTraceSnapshot {
  constructor(activities, health) {
    this.activities = activities;
    this.health = health;
  }
}
exports.EventTraceSnapshot = EventTraceSnapshot;
class EventTracer {
  constructor() {
    this.activities = [];
  }
  record(event, correlationId, phase) {
    this.activities.push(
      new EventActivity(event.eventId, correlationId, phase, new Date().toISOString()),
    );
  }
  recordHealth(health) {
    this.health = health;
  }
  getActivities(eventId) {
    return this.activities.filter((activity) => activity.eventId === eventId);
  }
  snapshot() {
    return new EventTraceSnapshot([...this.activities], this.health);
  }
}
exports.EventTracer = EventTracer;
//# sourceMappingURL=metrics.js.map
