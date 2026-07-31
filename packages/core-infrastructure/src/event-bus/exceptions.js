'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.EventBusError = void 0;
class EventBusError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EventBusError';
  }
}
exports.EventBusError = EventBusError;
//# sourceMappingURL=exceptions.js.map
