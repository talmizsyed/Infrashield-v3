import type { Identifier } from '@agentic/sdk';

import { RuntimeEventType, type RuntimeEvent } from './common.js';

export { RuntimeEventType } from './common.js';

/**
 * Runtime event listener contract.
 */
export type RuntimeEventListener = (event: RuntimeEvent) => Promise<void> | void;

/**
 * Dispatches runtime events to subscribers.
 */
export class EventDispatcher {
  private readonly listeners = new Map<RuntimeEventType, Set<RuntimeEventListener>>();
  private readonly events: RuntimeEvent[] = [];

  public get history(): readonly RuntimeEvent[] {
    return this.events;
  }

  public subscribe(eventType: RuntimeEventType, listener: RuntimeEventListener): () => void {
    const bucket = this.listeners.get(eventType) ?? new Set<RuntimeEventListener>();
    bucket.add(listener);
    this.listeners.set(eventType, bucket);

    return () => {
      const listeners = this.listeners.get(eventType);
      listeners?.delete(listener);
      if (listeners && listeners.size === 0) {
        this.listeners.delete(eventType);
      }
    };
  }

  public async publish(event: RuntimeEvent): Promise<void> {
    this.events.push(event);
    const listeners = this.listeners.get(event.eventType);
    if (!listeners) {
      return;
    }

    for (const listener of listeners) {
      await listener(event);
    }
  }

  public clearHistory(): void {
    this.events.length = 0;
  }
}

/**
 * Creates a runtime execution event.
 */
export function createRuntimeEvent(input: {
  readonly eventType: RuntimeEventType;
  readonly executionId?: Identifier;
  readonly middlewareId?: Identifier;
  readonly payload?: RuntimeEvent['payload'];
}): RuntimeEvent {
  return {
    eventType: input.eventType,
    executionId: input.executionId,
    middlewareId: input.middlewareId,
    payload: input.payload,
    timestamp: new Date().toISOString(),
  };
}
