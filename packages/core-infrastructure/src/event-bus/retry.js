'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.RetryExecutor =
  exports.EventExecutionResult =
  exports.DeadLetterProcessor =
  exports.DeadLetterQueue =
  exports.DeadLetterEntry =
  exports.FailureClassifier =
  exports.EventFailure =
  exports.RetryContext =
  exports.RetryPolicy =
  exports.RetryStrategy =
    void 0;
const exceptions_1 = require('./exceptions');
class RetryStrategy {
  constructor(type = 'none', initialDelayMs = 0, maxDelayMs = 0, backoffMultiplier = 2) {
    this.type = type;
    this.initialDelayMs = initialDelayMs;
    this.maxDelayMs = maxDelayMs;
    this.backoffMultiplier = backoffMultiplier;
  }
  getDelayMs(attempt) {
    if (this.type === 'none' || attempt <= 1) {
      return 0;
    }
    if (this.type === 'fixed') {
      return this.initialDelayMs;
    }
    const computed = this.initialDelayMs * Math.pow(this.backoffMultiplier, attempt - 1);
    return this.maxDelayMs > 0 ? Math.min(this.maxDelayMs, computed) : computed;
  }
}
exports.RetryStrategy = RetryStrategy;
class RetryPolicy {
  constructor(options = {}) {
    this.maxAttempts = Math.max(1, options.maxAttempts ?? 1);
    this.strategy = options.strategy ?? new RetryStrategy('none');
    this.retryPredicate = options.retryPredicate;
  }
  static none() {
    return new RetryPolicy({ maxAttempts: 1, strategy: new RetryStrategy('none') });
  }
  getDelayMs(attempt) {
    return this.strategy.getDelayMs(attempt);
  }
  shouldRetry(context) {
    if (context.currentAttempt >= this.maxAttempts) {
      return false;
    }
    if (this.retryPredicate) {
      return this.retryPredicate(context.lastError ?? new Error('retry'), context);
    }
    return true;
  }
}
exports.RetryPolicy = RetryPolicy;
class RetryContext {
  constructor(
    event,
    handler,
    currentAttempt,
    maxAttempts,
    strategy,
    lastError,
    shouldRetry,
    delayMs,
  ) {
    this.event = event;
    this.handler = handler;
    this.currentAttempt = currentAttempt;
    this.maxAttempts = maxAttempts;
    this.strategy = strategy;
    this.lastError = lastError;
    this.shouldRetry = shouldRetry;
    this.delayMs = delayMs;
  }
}
exports.RetryContext = RetryContext;
class EventFailure {
  constructor(
    event,
    error,
    classification,
    attempts,
    retryHistory = [],
    correlationId = event.correlationId,
    timestamp = new Date().toISOString(),
  ) {
    this.event = event;
    this.error = error;
    this.classification = classification;
    this.attempts = attempts;
    this.retryHistory = retryHistory;
    this.correlationId = correlationId;
    this.timestamp = timestamp;
  }
}
exports.EventFailure = EventFailure;
class FailureClassifier {
  classify(error) {
    if (error instanceof Error) {
      const normalized = error.message.toLowerCase();
      if (
        normalized.includes('transient') ||
        normalized.includes('timeout') ||
        normalized.includes('temporar')
      ) {
        return 'transient';
      }
      if (
        normalized.includes('permanent') ||
        normalized.includes('validation') ||
        normalized.includes('invalid') ||
        normalized.includes('forbidden')
      ) {
        return 'permanent';
      }
    }
    return 'unexpected';
  }
}
exports.FailureClassifier = FailureClassifier;
class DeadLetterEntry {
  constructor(
    event,
    error,
    retryHistory = [],
    correlationId = event.correlationId,
    timestamp = new Date().toISOString(),
  ) {
    this.event = event;
    this.error = error;
    this.retryHistory = retryHistory;
    this.correlationId = correlationId;
    this.timestamp = timestamp;
  }
}
exports.DeadLetterEntry = DeadLetterEntry;
class DeadLetterQueue {
  constructor() {
    this.entries = [];
  }
  enqueue(entry) {
    this.entries.push(entry);
  }
  size() {
    return this.entries.length;
  }
  peek() {
    return this.entries[this.entries.length - 1];
  }
  drain() {
    const snapshot = [...this.entries];
    this.entries.length = 0;
    return snapshot;
  }
}
exports.DeadLetterQueue = DeadLetterQueue;
class DeadLetterProcessor {
  async process(entry) {
    void entry;
  }
}
exports.DeadLetterProcessor = DeadLetterProcessor;
class EventExecutionResult {
  constructor(
    event,
    handler,
    attempts,
    succeeded,
    outcome,
    error = undefined,
    retryHistory = [],
    failure = undefined,
  ) {
    this.event = event;
    this.handler = handler;
    this.attempts = attempts;
    this.succeeded = succeeded;
    this.outcome = outcome;
    this.error = error;
    this.retryHistory = retryHistory;
    this.failure = failure;
  }
}
exports.EventExecutionResult = EventExecutionResult;
class RetryExecutor {
  constructor() {
    this.classifier = new FailureClassifier();
  }
  async execute(options) {
    const policy = options.policy ?? RetryPolicy.none();
    const retryHistory = [];
    let attempt = 1;
    while (attempt <= policy.maxAttempts) {
      if (options.dispatchContext?.signal?.aborted) {
        return new EventExecutionResult(
          options.event,
          options.handler,
          attempt,
          false,
          'cancelled',
          new exceptions_1.EventBusError('Dispatch cancelled.'),
          retryHistory,
          new EventFailure(
            options.event,
            new exceptions_1.EventBusError('Dispatch cancelled.'),
            'cancelled',
            attempt,
            retryHistory,
          ),
        );
      }
      try {
        await options.handler.handle(options.event);
        return new EventExecutionResult(
          options.event,
          options.handler,
          attempt,
          true,
          'succeeded',
          undefined,
          retryHistory,
        );
      } catch (error) {
        const wrapped =
          error instanceof Error
            ? error
            : new exceptions_1.EventBusError('Handler execution failed.');
        const classification = this.classifier.classify(wrapped);
        const retryContext = new RetryContext(
          options.event,
          options.handler,
          attempt,
          policy.maxAttempts,
          policy.strategy,
          wrapped,
          false,
          0,
        );
        retryHistory.push(retryContext);
        const shouldRetry = policy.shouldRetry(retryContext);
        const canRetry =
          shouldRetry && classification !== 'permanent' && attempt < policy.maxAttempts;
        if (!canRetry) {
          const failure = new EventFailure(
            options.event,
            wrapped,
            classification,
            attempt,
            retryHistory,
          );
          if (classification === 'permanent' || attempt >= policy.maxAttempts) {
            options.deadLetterQueue?.enqueue(
              new DeadLetterEntry(options.event, wrapped, retryHistory),
            );
            return new EventExecutionResult(
              options.event,
              options.handler,
              attempt,
              false,
              'dead-lettered',
              wrapped,
              retryHistory,
              failure,
            );
          }
          return new EventExecutionResult(
            options.event,
            options.handler,
            attempt,
            false,
            'failed',
            wrapped,
            retryHistory,
            failure,
          );
        }
        const delayMs = policy.getDelayMs(attempt + 1);
        if (delayMs > 0) {
          await this.wait(delayMs, options.dispatchContext?.signal);
        }
        attempt += 1;
      }
    }
    const failure = new EventFailure(
      options.event,
      new exceptions_1.EventBusError('Handler execution failed.'),
      'unexpected',
      attempt,
      retryHistory,
    );
    return new EventExecutionResult(
      options.event,
      options.handler,
      attempt,
      false,
      'failed',
      failure.error,
      retryHistory,
      failure,
    );
  }
  async wait(delayMs, signal) {
    if (delayMs <= 0) {
      return;
    }
    if (signal?.aborted) {
      return;
    }
    await new Promise((resolve, reject) => {
      const timeoutId = setTimeout(resolve, delayMs);
      const abortHandler = () => {
        clearTimeout(timeoutId);
        reject(new exceptions_1.EventBusError('Dispatch cancelled.'));
      };
      signal?.addEventListener('abort', abortHandler, { once: true });
      void Promise.resolve().then(() => {
        signal?.removeEventListener('abort', abortHandler);
      });
    });
  }
}
exports.RetryExecutor = RetryExecutor;
//# sourceMappingURL=retry.js.map
