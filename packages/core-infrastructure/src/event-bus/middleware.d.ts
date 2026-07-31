import { type IEvent } from './contracts';
export interface IEventMiddleware<TEvent extends IEvent = IEvent> {
  execute(
    context: EventMiddlewareContext<TEvent>,
    next: EventDelegate<TEvent>,
  ): Promise<void> | void;
}
export declare class EventMiddlewareContext<TEvent extends IEvent = IEvent> {
  readonly event: TEvent;
  readonly dispatchContext: EventDispatchContext | undefined;
  readonly properties: Record<string, unknown>;
  constructor(
    event: TEvent,
    dispatchContext: EventDispatchContext | undefined,
    properties?: Record<string, unknown>,
  );
}
export type EventDelegate<TEvent extends IEvent = IEvent> = (
  context: EventMiddlewareContext<TEvent>,
) => Promise<void> | void;
export declare class MiddlewareDescriptor<TEvent extends IEvent = IEvent> {
  readonly id: string;
  readonly middleware: IEventMiddleware<TEvent>;
  readonly createdAt: string;
  constructor(id: string, middleware: IEventMiddleware<TEvent>, createdAt?: string);
}
export declare class MiddlewareCollection<TEvent extends IEvent = IEvent> {
  private readonly items;
  add(middleware: IEventMiddleware<TEvent>): MiddlewareCollection<TEvent>;
  toArray(): readonly MiddlewareDescriptor<TEvent>[];
  size(): number;
  private validateMiddleware;
}
export declare class EventPipeline<TEvent extends IEvent = IEvent> {
  private readonly middlewares;
  constructor(middlewares: readonly MiddlewareDescriptor<TEvent>[]);
  execute(context: EventMiddlewareContext<TEvent>, delegate: EventDelegate<TEvent>): Promise<void>;
  compose(next: EventPipeline<TEvent>): EventPipeline<TEvent>;
  private buildChain;
}
export declare class EventPipelineBuilder<TEvent extends IEvent = IEvent> {
  private readonly middlewares;
  use(middleware: IEventMiddleware<TEvent>): this;
  build(): EventPipeline<TEvent>;
  private validateMiddleware;
}
export declare class EventDispatchContext {
  readonly event: IEvent;
  readonly signal: AbortSignal | undefined;
  readonly correlationId: string | undefined;
  readonly source: string;
  readonly properties: Record<string, unknown>;
  readonly startedAt: string;
  constructor(
    event: IEvent,
    signal: AbortSignal | undefined,
    correlationId?: string | undefined,
    source?: string,
    properties?: Record<string, unknown>,
    startedAt?: string,
  );
  ensureNotCancelled(): void;
}
//# sourceMappingURL=middleware.d.ts.map
