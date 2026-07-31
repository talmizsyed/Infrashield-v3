'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.EventBase =
  exports.EventPublisher =
  exports.SubscriptionRegistry =
  exports.SubscriptionBuilder =
  exports.EventSubscription =
  exports.HandlerDescriptor =
    void 0;
const exceptions_1 = require('./exceptions');
const utils_1 = require('./internal/utils');
const contracts_1 = require('./contracts');
class HandlerDescriptor {
  constructor(id, eventType, handler, createdAt = new Date().toISOString()) {
    this.id = id;
    this.eventType = eventType;
    this.handler = handler;
    this.createdAt = createdAt;
  }
}
exports.HandlerDescriptor = HandlerDescriptor;
class EventSubscription {
  constructor(descriptor, eventType) {
    this.descriptor = descriptor;
    this.eventType = eventType;
  }
}
exports.EventSubscription = EventSubscription;
class SubscriptionBuilder {
  eventType(eventType) {
    this.eventTypeName = eventType;
    return this;
  }
  handler(handler) {
    this.registeredHandler = handler;
    return this;
  }
  build() {
    if (!this.eventTypeName || this.eventTypeName.trim().length === 0) {
      throw new exceptions_1.EventBusError('Subscription requires an event type.');
    }
    if (!this.registeredHandler) {
      throw new exceptions_1.EventBusError('Subscription requires a handler.');
    }
    const descriptor = new HandlerDescriptor(
      (0, utils_1.createEventId)(),
      this.eventTypeName,
      this.registeredHandler,
    );
    return new EventSubscription(descriptor, this.eventTypeName);
  }
}
exports.SubscriptionBuilder = SubscriptionBuilder;
class SubscriptionRegistry {
  constructor() {
    this.subscriptions = new Map();
    this.eventTypes = new Set();
  }
  register(handler, eventType) {
    const eventTypeName = this.resolveEventTypeName(eventType);
    this.validateHandler(handler);
    const existing = this.getSubscriptions(eventTypeName);
    if (existing.some((subscription) => subscription.descriptor.handler === handler)) {
      throw new exceptions_1.EventBusError(`Duplicate subscription for ${eventTypeName}.`);
    }
    const descriptor = new HandlerDescriptor((0, utils_1.createEventId)(), eventTypeName, handler);
    const subscription = new EventSubscription(descriptor, eventTypeName);
    const next = [...existing, subscription];
    this.subscriptions.set(eventTypeName, next);
    this.eventTypes.add(eventTypeName);
  }
  registerSubscription(subscription) {
    this.validateSubscription(subscription);
    const eventTypeName = subscription.descriptor.eventType;
    const existing = this.getSubscriptions(eventTypeName);
    if (
      existing.some((candidate) => candidate.descriptor.handler === subscription.descriptor.handler)
    ) {
      throw new exceptions_1.EventBusError(`Duplicate subscription for ${eventTypeName}.`);
    }
    const next = [...existing, subscription];
    this.subscriptions.set(eventTypeName, next);
    this.eventTypes.add(eventTypeName);
  }
  unregister(handler, eventType) {
    const eventTypeName = this.resolveEventTypeName(eventType);
    const existing = this.getSubscriptions(eventTypeName);
    const next = existing.filter((subscription) => subscription.descriptor.handler !== handler);
    if (next.length === existing.length) {
      return false;
    }
    if (next.length === 0) {
      this.subscriptions.delete(eventTypeName);
    } else {
      this.subscriptions.set(eventTypeName, next);
    }
    if (this.subscriptions.size === 0) {
      this.eventTypes.clear();
    } else {
      const remaining = [...this.subscriptions.values()].flat();
      this.eventTypes.clear();
      for (const subscription of remaining) {
        this.eventTypes.add(subscription.eventType);
      }
    }
    return true;
  }
  lookup(event) {
    this.validateEvent(event);
    const eventTypeName = this.resolveEventTypeName(event.eventType);
    return this.getSubscriptions(eventTypeName);
  }
  getSubscriptions(eventType) {
    return [...(this.subscriptions.get(eventType) ?? [])];
  }
  getEventTypes() {
    return [...this.eventTypes];
  }
  subscribe(handler) {
    this.validateHandler(handler);
    throw new exceptions_1.EventBusError('Subscription registration requires an event type.');
  }
  validateHandler(handler) {
    if (!handler || (typeof handler !== 'object' && typeof handler !== 'function')) {
      throw new exceptions_1.EventBusError('Invalid handler registration.');
    }
    const candidate = handler;
    if (typeof candidate.handle !== 'function') {
      throw new exceptions_1.EventBusError('Invalid handler registration.');
    }
  }
  validateSubscription(subscription) {
    if (!subscription || typeof subscription !== 'object') {
      throw new exceptions_1.EventBusError('Invalid subscription registration.');
    }
    const descriptor = subscription.descriptor;
    if (!descriptor || typeof descriptor !== 'object') {
      throw new exceptions_1.EventBusError('Invalid subscription registration.');
    }
    if (!descriptor.eventType || descriptor.eventType.trim().length === 0) {
      throw new exceptions_1.EventBusError('Subscription requires an event type.');
    }
    this.validateHandler(descriptor.handler);
  }
  validateEvent(event) {
    if (!event || typeof event !== 'object') {
      throw new exceptions_1.EventBusError('Event must be a non-null object.');
    }
    if (!event.metadata || typeof event.metadata !== 'object') {
      throw new exceptions_1.EventBusError('Event metadata is missing.');
    }
    const eventType = event.eventType ?? event.constructor?.name;
    if (typeof eventType !== 'string' || eventType.trim().length === 0) {
      throw new exceptions_1.EventBusError('Invalid event type.');
    }
  }
  resolveEventTypeName(eventType) {
    if (typeof eventType === 'string') {
      if (eventType.trim().length === 0) {
        throw new exceptions_1.EventBusError('Invalid event type.');
      }
      return eventType;
    }
    if (typeof eventType === 'function') {
      return eventType.name;
    }
    throw new exceptions_1.EventBusError('Invalid event type.');
  }
}
exports.SubscriptionRegistry = SubscriptionRegistry;
class EventPublisher {
  constructor(registry) {
    this.registry = registry;
    this.preparedEvents = [];
  }
  async publish(event) {
    this.validateEvent(event);
    this.registry.lookup(event);
    this.preparedEvents.push(event.toEnvelope());
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
exports.EventPublisher = EventPublisher;
class EventBase {
  constructor(payload, options) {
    this.eventId = options.eventId ?? (0, utils_1.createEventId)();
    this.correlationId = options.correlationId;
    this.timestamp = options.timestamp ?? new Date().toISOString();
    this.source = options.source;
    this.category = options.category;
    this.priority = options.priority;
    this.version = options.version ?? 1;
    this.tags = Object.freeze([...(options.tags ?? [])]);
    this.eventType = this.constructor.name;
    this.payload = Object.freeze({ ...payload });
    this.metadata = contracts_1.EventMetadata.create({
      eventId: this.eventId,
      correlationId: this.correlationId,
      timestamp: this.timestamp,
      source: this.source,
      category: this.category,
      priority: this.priority,
      version: this.version,
      tags: this.tags,
    });
  }
  toEnvelope() {
    return new contracts_1.EventEnvelope(this, this.metadata);
  }
}
exports.EventBase = EventBase;
//# sourceMappingURL=core.js.map
