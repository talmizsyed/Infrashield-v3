import type { EventPerformanceSnapshot } from './metrics';
import type { IEventObserver } from './contracts';

export type { IEventObserver } from './contracts';

export class EventObserver implements IEventObserver {
  public constructor(private readonly observer: IEventObserver) {}

  public async onEventObserved(snapshot: EventPerformanceSnapshot): Promise<void> {
    await this.observer.onEventObserved(snapshot);
  }
}
