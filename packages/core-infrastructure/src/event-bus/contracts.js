'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.EventContext = exports.EventEnvelope = exports.EventMetadata = void 0;
class EventMetadata {
  constructor(eventId, correlationId, timestamp, source, category, priority, version, tags) {
    this.eventId = eventId;
    this.correlationId = correlationId;
    this.timestamp = timestamp;
    this.source = source;
    this.category = category;
    this.priority = priority;
    this.version = version;
    this.tags = tags;
  }
  static create(options) {
    return new EventMetadata(
      options.eventId ?? '',
      options.correlationId,
      options.timestamp ?? new Date().toISOString(),
      options.source,
      options.category,
      options.priority,
      options.version ?? 1,
      options.tags ?? [],
    );
  }
}
exports.EventMetadata = EventMetadata;
class EventEnvelope {
  constructor(event, metadata) {
    this.event = event;
    this.metadata = metadata;
  }
}
exports.EventEnvelope = EventEnvelope;
class EventContext {
  constructor(correlationId, source, causationId, properties = {}) {
    this.correlationId = correlationId;
    this.source = source;
    this.causationId = causationId;
    this.properties = properties;
  }
}
exports.EventContext = EventContext;
//# sourceMappingURL=contracts.js.map
