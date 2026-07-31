'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.EventDispatchContext =
  exports.EventPipelineBuilder =
  exports.EventPipeline =
  exports.MiddlewareCollection =
  exports.MiddlewareDescriptor =
  exports.EventMiddlewareContext =
    void 0;
const exceptions_1 = require('./exceptions');
const utils_1 = require('./internal/utils');
class EventMiddlewareContext {
  constructor(event, dispatchContext, properties = {}) {
    this.event = event;
    this.dispatchContext = dispatchContext;
    this.properties = properties;
  }
}
exports.EventMiddlewareContext = EventMiddlewareContext;
class MiddlewareDescriptor {
  constructor(id, middleware, createdAt = new Date().toISOString()) {
    this.id = id;
    this.middleware = middleware;
    this.createdAt = createdAt;
  }
}
exports.MiddlewareDescriptor = MiddlewareDescriptor;
class MiddlewareCollection {
  constructor() {
    this.items = [];
  }
  add(middleware) {
    this.validateMiddleware(middleware);
    this.items.push(new MiddlewareDescriptor((0, utils_1.createEventId)(), middleware));
    return this;
  }
  toArray() {
    return [...this.items];
  }
  size() {
    return this.items.length;
  }
  validateMiddleware(middleware) {
    if (!middleware || (typeof middleware !== 'object' && typeof middleware !== 'function')) {
      throw new exceptions_1.EventBusError('Invalid middleware registration.');
    }
    const candidate = middleware;
    if (typeof candidate.execute !== 'function') {
      throw new exceptions_1.EventBusError('Invalid middleware registration.');
    }
  }
}
exports.MiddlewareCollection = MiddlewareCollection;
class EventPipeline {
  constructor(middlewares) {
    this.middlewares = middlewares;
  }
  async execute(context, delegate) {
    const chain = this.buildChain(delegate, this.middlewares);
    await chain(context);
  }
  compose(next) {
    const merged = [...this.middlewares, ...next.middlewares];
    return new EventPipeline(merged);
  }
  buildChain(next, middlewares) {
    return middlewares.reduceRight(
      (current, descriptor) => async (context) => {
        await descriptor.middleware.execute(context, current);
      },
      next,
    );
  }
}
exports.EventPipeline = EventPipeline;
class EventPipelineBuilder {
  constructor() {
    this.middlewares = [];
  }
  use(middleware) {
    this.validateMiddleware(middleware);
    this.middlewares.push(new MiddlewareDescriptor((0, utils_1.createEventId)(), middleware));
    return this;
  }
  build() {
    return new EventPipeline([...this.middlewares]);
  }
  validateMiddleware(middleware) {
    if (!middleware || (typeof middleware !== 'object' && typeof middleware !== 'function')) {
      throw new exceptions_1.EventBusError('Invalid middleware registration.');
    }
    const candidate = middleware;
    if (typeof candidate.execute !== 'function') {
      throw new exceptions_1.EventBusError('Invalid middleware registration.');
    }
  }
}
exports.EventPipelineBuilder = EventPipelineBuilder;
class EventDispatchContext {
  constructor(
    event,
    signal,
    correlationId = event.correlationId,
    source = event.source,
    properties = {},
    startedAt = new Date().toISOString(),
  ) {
    this.event = event;
    this.signal = signal;
    this.correlationId = correlationId;
    this.source = source;
    this.properties = properties;
    this.startedAt = startedAt;
  }
  ensureNotCancelled() {
    if (this.signal?.aborted) {
      throw new exceptions_1.EventBusError('Dispatch cancelled.');
    }
  }
}
exports.EventDispatchContext = EventDispatchContext;
//# sourceMappingURL=middleware.js.map
