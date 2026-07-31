'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.EventDispatcher =
  exports.HandlerResolver =
  exports.DispatchResult =
  exports.DispatchStatistics =
  exports.EventExecutionContext =
    void 0;
const exceptions_1 = require('./exceptions');
const metrics_1 = require('./metrics');
const middleware_1 = require('./middleware');
const retry_1 = require('./retry');
class EventExecutionContext {
  constructor(
    event,
    dispatchContext,
    handler,
    index,
    startedAt = new Date().toISOString(),
    completedAt = undefined,
    status = 'pending',
    error = undefined,
  ) {
    this.event = event;
    this.dispatchContext = dispatchContext;
    this.handler = handler;
    this.index = index;
    this.startedAt = startedAt;
    this.completedAt = completedAt;
    this.status = status;
    this.error = error;
  }
}
exports.EventExecutionContext = EventExecutionContext;
class DispatchStatistics {
  constructor(startedAt = new Date().toISOString()) {
    this.executedHandlers = 0;
    this.resolvedHandlers = 0;
    this.failedHandlers = 0;
    this.missingHandlers = 0;
    this.cancelled = false;
    this.retryAttempts = 0;
    this.deadLetteredEvents = 0;
    this.durationMs = 0;
    this.startedAt = startedAt;
  }
}
exports.DispatchStatistics = DispatchStatistics;
class DispatchResult {
  constructor(
    event,
    dispatchContext,
    statistics,
    errors = [],
    executionContexts = [],
    completedAt = new Date().toISOString(),
  ) {
    this.event = event;
    this.dispatchContext = dispatchContext;
    this.statistics = statistics;
    this.errors = errors;
    this.executionContexts = executionContexts;
    this.completedAt = completedAt;
  }
  get succeeded() {
    return (
      this.errors.length === 0 &&
      this.statistics.missingHandlers === 0 &&
      !this.statistics.cancelled
    );
  }
}
exports.DispatchResult = DispatchResult;
class HandlerResolver {
  constructor(provider, tokenFactory) {
    this.provider = provider;
    this.tokenFactory = tokenFactory;
  }
  resolve(event) {
    if (!event || typeof event !== 'object') {
      throw new exceptions_1.EventBusError('Event must be a non-null object.');
    }
    const token = this.tokenFactory(event);
    const candidates = this.provider.ResolveAll(token);
    return candidates.map((candidate) => this.validateHandler(candidate));
  }
  validateHandler(handler) {
    if (!handler || (typeof handler !== 'object' && typeof handler !== 'function')) {
      throw new exceptions_1.EventBusError('Invalid handler registration.');
    }
    const candidate = handler;
    if (typeof candidate.handle !== 'function') {
      throw new exceptions_1.EventBusError('Invalid handler registration.');
    }
    return handler;
  }
}
exports.HandlerResolver = HandlerResolver;
class EventDispatcher {
  constructor(
    provider,
    handlerResolver,
    pipeline = new middleware_1.EventPipeline([]),
    retryExecutor = undefined,
    metrics = undefined,
    observers = [],
    tracer = undefined,
    healthCheck = undefined,
  ) {
    this.provider = provider;
    this.handlerResolver = handlerResolver;
    this.pipeline = pipeline;
    this.retryExecutor = retryExecutor;
    this.metrics = metrics;
    this.observers = observers;
    this.tracer = tracer;
    this.healthCheck = healthCheck;
  }
  async dispatch(event, options = {}) {
    this.validateEvent(event);
    const startedAt = new Date().toISOString();
    const statistics = new DispatchStatistics(startedAt);
    this.metrics?.recordConcurrentExecution();
    try {
      this.tracer?.record(event, event.correlationId, 'dispatch-started');
      const dispatchContext = new middleware_1.EventDispatchContext(
        event,
        options.signal,
        event.correlationId,
        event.source,
        options.context?.properties ?? {},
        startedAt,
      );
      if (dispatchContext.signal?.aborted) {
        this.metrics?.recordDispatchResult(false);
        this.metrics?.recordLatency(0);
        this.tracer?.record(event, event.correlationId, 'dispatch-cancelled');
        statistics.cancelled = true;
        statistics.completedAt = new Date().toISOString();
        statistics.durationMs = 0;
        return new DispatchResult(
          event,
          dispatchContext,
          statistics,
          [],
          [],
          statistics.completedAt,
        );
      }
      const executionContexts = [];
      const errors = [];
      const middlewareContext = new middleware_1.EventMiddlewareContext(event, dispatchContext);
      try {
        await this.pipeline.execute(middlewareContext, async () => {
          const handlers = this.handlerResolver.resolve(event);
          statistics.resolvedHandlers = handlers.length;
          if (handlers.length === 0) {
            statistics.missingHandlers = 1;
            statistics.completedAt = new Date().toISOString();
            statistics.durationMs = 0;
            return;
          }
          for (const [index, handler] of handlers.entries()) {
            dispatchContext.ensureNotCancelled();
            const executionContext = new EventExecutionContext(
              event,
              dispatchContext,
              handler,
              index,
            );
            try {
              const handlerStartedAt = Date.now();
              const executionResult = this.retryExecutor
                ? await this.retryExecutor.execute({
                    event,
                    handler,
                    policy: options.retryPolicy,
                    dispatchContext,
                    deadLetterQueue: options.deadLetterQueue,
                  })
                : await this.executeOnce(event, handler);
              const handlerDurationMs = Date.now() - handlerStartedAt;
              this.metrics?.recordHandlerExecution(handlerDurationMs);
              this.tracer?.record(event, event.correlationId, 'handler-executed');
              if (executionResult.attempts > 1) {
                statistics.retryAttempts += executionResult.attempts - 1;
                this.metrics?.recordRetryAttempt();
              }
              if (executionResult.succeeded) {
                statistics.executedHandlers += 1;
                executionContexts.push(
                  new EventExecutionContext(
                    event,
                    dispatchContext,
                    handler,
                    index,
                    executionContext.startedAt,
                    new Date().toISOString(),
                    'succeeded',
                  ),
                );
              } else {
                statistics.failedHandlers += 1;
                if (executionResult.outcome === 'dead-lettered') {
                  statistics.deadLetteredEvents += 1;
                  this.metrics?.recordDeadLetter();
                }
                errors.push(
                  executionResult.error ??
                    new exceptions_1.EventBusError('Handler execution failed.'),
                );
                executionContexts.push(
                  new EventExecutionContext(
                    event,
                    dispatchContext,
                    handler,
                    index,
                    executionContext.startedAt,
                    new Date().toISOString(),
                    'failed',
                    executionResult.error,
                  ),
                );
              }
            } catch (error) {
              statistics.failedHandlers += 1;
              const wrapped =
                error instanceof Error
                  ? error
                  : new exceptions_1.EventBusError('Handler execution failed.');
              errors.push(wrapped);
              executionContexts.push(
                new EventExecutionContext(
                  event,
                  dispatchContext,
                  handler,
                  index,
                  executionContext.startedAt,
                  new Date().toISOString(),
                  'failed',
                  wrapped,
                ),
              );
            }
          }
        });
      } catch (error) {
        const wrapped =
          error instanceof Error
            ? error
            : new exceptions_1.EventBusError('Handler resolution failed.');
        errors.push(wrapped);
        statistics.failedHandlers += 1;
      }
      statistics.completedAt = new Date().toISOString();
      statistics.durationMs = Date.now() - new Date(startedAt).getTime();
      this.metrics?.recordLatency(statistics.durationMs);
      this.metrics?.recordDispatchResult(errors.length === 0 && statistics.missingHandlers === 0);
      this.tracer?.record(event, event.correlationId, 'dispatch-completed');
      if (this.tracer && this.healthCheck) {
        const metricsSnapshot = this.metrics?.snapshot();
        const baseSnapshot =
          metricsSnapshot ??
          new metrics_1.EventPerformanceSnapshot(
            new metrics_1.EventCounters(),
            new metrics_1.EventStatistics(0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
          );
        this.tracer.recordHealth(this.healthCheck.evaluate(baseSnapshot));
      }
      const snapshots = await Promise.allSettled(
        this.observers.map(async (observer) => {
          const snapshot = this.createSnapshot(event, statistics, errors, executionContexts);
          await observer.onEventObserved(snapshot);
        }),
      );
      snapshots.forEach((snapshot) => {
        if (snapshot.status === 'rejected') {
          this.metrics?.recordObserverFailure();
        }
      });
      return new DispatchResult(
        event,
        dispatchContext,
        statistics,
        errors,
        executionContexts,
        statistics.completedAt,
      );
    } finally {
      this.metrics?.completeConcurrentExecution();
    }
  }
  createSnapshot(_event, _statistics, _errors, _executionContexts) {
    const metricsSnapshot = this.metrics?.snapshot();
    const activities = this.tracer?.snapshot().activities ?? [];
    const baseSnapshot =
      metricsSnapshot ??
      new metrics_1.EventPerformanceSnapshot(
        new metrics_1.EventCounters(),
        new metrics_1.EventStatistics(0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
      );
    const health =
      this.healthCheck?.evaluate(baseSnapshot) ?? new metrics_1.EventHealth('healthy', 'ok');
    this.tracer?.recordHealth(health);
    return new metrics_1.EventPerformanceSnapshot(
      metricsSnapshot?.counters ?? new metrics_1.EventCounters(),
      metricsSnapshot?.statistics ?? new metrics_1.EventStatistics(0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
      health,
      activities,
      new Date().toISOString(),
    );
  }
  async executeOnce(event, handler) {
    try {
      await handler.handle(event);
      return new retry_1.EventExecutionResult(event, handler, 1, true, 'succeeded');
    } catch (error) {
      const wrapped =
        error instanceof Error
          ? error
          : new exceptions_1.EventBusError('Handler execution failed.');
      return new retry_1.EventExecutionResult(event, handler, 1, false, 'failed', wrapped);
    }
  }
  validateEvent(event) {
    if (!event || typeof event !== 'object') {
      throw new exceptions_1.EventBusError('Event must be a non-null object.');
    }
    if (!event.metadata || typeof event.metadata !== 'object') {
      throw new exceptions_1.EventBusError('Event metadata is missing.');
    }
    if (
      !event.eventType ||
      typeof event.eventType !== 'string' ||
      event.eventType.trim().length === 0
    ) {
      throw new exceptions_1.EventBusError('Invalid event type.');
    }
  }
}
exports.EventDispatcher = EventDispatcher;
//# sourceMappingURL=dispatch.js.map
