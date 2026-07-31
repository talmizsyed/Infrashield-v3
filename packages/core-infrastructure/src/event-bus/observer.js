'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.EventObserver = void 0;
class EventObserver {
  constructor(observer) {
    this.observer = observer;
  }
  async onEventObserved(snapshot) {
    await this.observer.onEventObserved(snapshot);
  }
}
exports.EventObserver = EventObserver;
//# sourceMappingURL=observer.js.map
