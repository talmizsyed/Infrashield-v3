import { type IEvent } from './contracts';
import { EventBusError } from './exceptions';
import { createEventId } from './internal/utils';

export interface IEventMiddleware<TEvent extends IEvent = IEvent> {
  execute(
    context: EventMiddlewareContext<TEvent>,
    next: EventDelegate<TEvent>,
  ): Promise<void> | void;
}

export class EventMiddlewareContext<TEvent extends IEvent = IEvent> {
  public constructor(
    public readonly event: TEvent,
    public readonly dispatchContext: EventDispatchContext | undefined,
    public readonly properties: Record<string, unknown> = {},
  ) {}
}

export type EventDelegate<TEvent extends IEvent = IEvent> = (
  context: EventMiddlewareContext<TEvent>,
) => Promise<void> | void;

export class MiddlewareDescriptor<TEvent extends IEvent = IEvent> {
  public constructor(
    public readonly id: string,
    public readonly middleware: IEventMiddleware<TEvent>,
    public readonly createdAt: string = new Date().toISOString(),
  ) {}
}

export class MiddlewareCollection<TEvent extends IEvent = IEvent> {
  private readonly items: MiddlewareDescriptor<TEvent>[] = [];

  public add(middleware: IEventMiddleware<TEvent>): MiddlewareCollection<TEvent> {
    this.validateMiddleware(middleware);
    this.items.push(new MiddlewareDescriptor(createEventId(), middleware));
    return this;
  }

  public toArray(): readonly MiddlewareDescriptor<TEvent>[] {
    return [...this.items];
  }

  public size(): number {
    return this.items.length;
  }

  private validateMiddleware(middleware: unknown): void {
    if (!middleware || (typeof middleware !== 'object' && typeof middleware !== 'function')) {
      throw new EventBusError('Invalid middleware registration.');
    }

    const candidate = middleware as Partial<IEventMiddleware<TEvent>>;
    if (typeof candidate.execute !== 'function') {
      throw new EventBusError('Invalid middleware registration.');
    }
  }
}

export class EventPipeline<TEvent extends IEvent = IEvent> {
  public constructor(private readonly middlewares: readonly MiddlewareDescriptor<TEvent>[]) {}

  public async execute(
    context: EventMiddlewareContext<TEvent>,
    delegate: EventDelegate<TEvent>,
  ): Promise<void> {
    const chain = this.buildChain(delegate, this.middlewares);
    await chain(context);
  }

  public compose(next: EventPipeline<TEvent>): EventPipeline<TEvent> {
    const merged = [...this.middlewares, ...next.middlewares];
    return new EventPipeline<TEvent>(merged);
  }

  private buildChain(
    next: EventDelegate<TEvent>,
    middlewares: readonly MiddlewareDescriptor<TEvent>[],
  ): EventDelegate<TEvent> {
    return middlewares.reduceRight<EventDelegate<TEvent>>(
      (current, descriptor) => async (context) => {
        await descriptor.middleware.execute(context, current);
      },
      next,
    );
  }
}

export class EventPipelineBuilder<TEvent extends IEvent = IEvent> {
  private readonly middlewares: MiddlewareDescriptor<TEvent>[] = [];

  public use(middleware: IEventMiddleware<TEvent>): this {
    this.validateMiddleware(middleware);
    this.middlewares.push(new MiddlewareDescriptor(createEventId(), middleware));
    return this;
  }

  public build(): EventPipeline<TEvent> {
    return new EventPipeline<TEvent>([...this.middlewares]);
  }

  private validateMiddleware(middleware: unknown): void {
    if (!middleware || (typeof middleware !== 'object' && typeof middleware !== 'function')) {
      throw new EventBusError('Invalid middleware registration.');
    }

    const candidate = middleware as Partial<IEventMiddleware<TEvent>>;
    if (typeof candidate.execute !== 'function') {
      throw new EventBusError('Invalid middleware registration.');
    }
  }
}

export class EventDispatchContext {
  public constructor(
    public readonly event: IEvent,
    public readonly signal: AbortSignal | undefined,
    public readonly correlationId: string | undefined = event.correlationId,
    public readonly source: string = event.source,
    public readonly properties: Record<string, unknown> = {},
    public readonly startedAt: string = new Date().toISOString(),
  ) {}

  public ensureNotCancelled(): void {
    if (this.signal?.aborted) {
      throw new EventBusError('Dispatch cancelled.');
    }
  }
}
