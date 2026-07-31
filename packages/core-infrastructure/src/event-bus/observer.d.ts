import type { EventPerformanceSnapshot } from './metrics';
import type { IEventObserver } from './contracts';
export type { IEventObserver } from './contracts';
export declare class EventObserver implements IEventObserver {
  private readonly observer;
  constructor(observer: IEventObserver);
  onEventObserved(snapshot: EventPerformanceSnapshot): Promise<void>;
}
//# sourceMappingURL=observer.d.ts.map
