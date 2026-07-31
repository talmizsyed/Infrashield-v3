import type { IEvent, IEventHandler } from './contracts';
import { EventBusError } from './exceptions';
import type { EventDispatchContext } from './middleware';

export type FailureClassification = 'transient' | 'permanent' | 'unexpected' | 'cancelled';

export class RetryStrategy {
  public constructor(
    public readonly type: 'none' | 'fixed' | 'exponential' = 'none',
    public readonly initialDelayMs = 0,
    public readonly maxDelayMs = 0,
    public readonly backoffMultiplier = 2,
  ) {}

  public getDelayMs(attempt: number): number {
    if (this.type === 'none' || attempt <= 1) {
      return 0;
    }

    if (this.type === 'fixed') {
      return this.initialDelayMs;
    }

    const computed = this.initialDelayMs * Math.pow(this.backoffMultiplier, attempt - 1);
    return this.maxDelayMs > 0 ? Math.min(this.maxDelayMs, computed) : computed;
  }
}

export class RetryPolicy {
  public constructor(
    options: {
      readonly maxAttempts?: number;
      readonly strategy?: RetryStrategy;
      readonly retryPredicate?: (error: Error, context: RetryContext) => boolean;
    } = {},
  ) {
    this.maxAttempts = Math.max(1, options.maxAttempts ?? 1);
    this.strategy = options.strategy ?? new RetryStrategy('none');
    this.retryPredicate = options.retryPredicate;
  }

  public readonly maxAttempts: number;
  public readonly strategy: RetryStrategy;
  public readonly retryPredicate: ((error: Error, context: RetryContext) => boolean) | undefined;

  public static none(): RetryPolicy {
    return new RetryPolicy({ maxAttempts: 1, strategy: new RetryStrategy('none') });
  }

  public getDelayMs(attempt: number): number {
    return this.strategy.getDelayMs(attempt);
  }

  public shouldRetry(context: RetryContext): boolean {
    if (context.currentAttempt >= this.maxAttempts) {
      return false;
    }

    if (this.retryPredicate) {
      return this.retryPredicate(context.lastError ?? new Error('retry'), context);
    }

    return true;
  }
}

export class RetryContext {
  public constructor(
    public readonly event: IEvent,
    public readonly handler: IEventHandler,
    public readonly currentAttempt: number,
    public readonly maxAttempts: number,
    public readonly strategy: RetryStrategy,
    public readonly lastError: Error | undefined,
    public readonly shouldRetry: boolean,
    public readonly delayMs: number,
  ) {}
}

export class EventFailure {
  public constructor(
    public readonly event: IEvent,
    public readonly error: Error,
    public readonly classification: FailureClassification,
    public readonly attempts: number,
    public readonly retryHistory: readonly RetryContext[] = [],
    public readonly correlationId: string | undefined = event.correlationId,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export class FailureClassifier {
  public classify(error: unknown): FailureClassification {
    if (error instanceof Error) {
      const normalized = error.message.toLowerCase();
      if (
        normalized.includes('transient') ||
        normalized.includes('timeout') ||
        normalized.includes('temporar')
      ) {
        return 'transient';
      }

      if (
        normalized.includes('permanent') ||
        normalized.includes('validation') ||
        normalized.includes('invalid') ||
        normalized.includes('forbidden')
      ) {
        return 'permanent';
      }
    }

    return 'unexpected';
  }
}

export class DeadLetterEntry {
  public constructor(
    public readonly event: IEvent,
    public readonly error: Error,
    public readonly retryHistory: readonly RetryContext[] = [],
    public readonly correlationId: string | undefined = event.correlationId,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export class DeadLetterQueue {
  private readonly entries: DeadLetterEntry[] = [];

  public enqueue(entry: DeadLetterEntry): void {
    this.entries.push(entry);
  }

  public size(): number {
    return this.entries.length;
  }

  public peek(): DeadLetterEntry | undefined {
    return this.entries[this.entries.length - 1];
  }

  public drain(): readonly DeadLetterEntry[] {
    const snapshot = [...this.entries];
    this.entries.length = 0;
    return snapshot;
  }
}

export class DeadLetterProcessor {
  public async process(entry: DeadLetterEntry): Promise<void> {
    void entry;
  }
}

export class EventExecutionResult<TEvent extends IEvent = IEvent> {
  public constructor(
    public readonly event: TEvent,
    public readonly handler: IEventHandler<TEvent>,
    public readonly attempts: number,
    public readonly succeeded: boolean,
    public readonly outcome: 'succeeded' | 'failed' | 'dead-lettered' | 'cancelled',
    public readonly error: Error | undefined = undefined,
    public readonly retryHistory: readonly RetryContext[] = [],
    public readonly failure: EventFailure | undefined = undefined,
  ) {}
}

export class RetryExecutor {
  private readonly classifier = new FailureClassifier();

  public async execute<TEvent extends IEvent>(options: {
    readonly event: TEvent;
    readonly handler: IEventHandler<TEvent>;
    readonly policy?: RetryPolicy;
    readonly dispatchContext?: EventDispatchContext;
    readonly deadLetterQueue?: DeadLetterQueue;
  }): Promise<EventExecutionResult<TEvent>> {
    const policy = options.policy ?? RetryPolicy.none();
    const retryHistory: RetryContext[] = [];
    let attempt = 1;

    while (attempt <= policy.maxAttempts) {
      if (options.dispatchContext?.signal?.aborted) {
        return new EventExecutionResult<TEvent>(
          options.event,
          options.handler,
          attempt,
          false,
          'cancelled',
          new EventBusError('Dispatch cancelled.'),
          retryHistory,
          new EventFailure(
            options.event,
            new EventBusError('Dispatch cancelled.'),
            'cancelled',
            attempt,
            retryHistory,
          ),
        );
      }

      try {
        await options.handler.handle(options.event);
        return new EventExecutionResult<TEvent>(
          options.event,
          options.handler,
          attempt,
          true,
          'succeeded',
          undefined,
          retryHistory,
        );
      } catch (error) {
        const wrapped =
          error instanceof Error ? error : new EventBusError('Handler execution failed.');
        const classification = this.classifier.classify(wrapped);
        const retryContext = new RetryContext(
          options.event,
          options.handler,
          attempt,
          policy.maxAttempts,
          policy.strategy,
          wrapped,
          false,
          0,
        );
        retryHistory.push(retryContext);

        const shouldRetry = policy.shouldRetry(retryContext);
        const canRetry =
          shouldRetry && classification !== 'permanent' && attempt < policy.maxAttempts;

        if (!canRetry) {
          const failure = new EventFailure(
            options.event,
            wrapped,
            classification,
            attempt,
            retryHistory,
          );

          if (classification === 'permanent' || attempt >= policy.maxAttempts) {
            options.deadLetterQueue?.enqueue(
              new DeadLetterEntry(options.event, wrapped, retryHistory),
            );
            return new EventExecutionResult<TEvent>(
              options.event,
              options.handler,
              attempt,
              false,
              'dead-lettered',
              wrapped,
              retryHistory,
              failure,
            );
          }

          return new EventExecutionResult<TEvent>(
            options.event,
            options.handler,
            attempt,
            false,
            'failed',
            wrapped,
            retryHistory,
            failure,
          );
        }

        const delayMs = policy.getDelayMs(attempt + 1);
        if (delayMs > 0) {
          await this.wait(delayMs, options.dispatchContext?.signal);
        }

        attempt += 1;
      }
    }

    const failure = new EventFailure(
      options.event,
      new EventBusError('Handler execution failed.'),
      'unexpected',
      attempt,
      retryHistory,
    );
    return new EventExecutionResult<TEvent>(
      options.event,
      options.handler,
      attempt,
      false,
      'failed',
      failure.error,
      retryHistory,
      failure,
    );
  }

  private async wait(delayMs: number, signal: AbortSignal | undefined): Promise<void> {
    if (delayMs <= 0) {
      return;
    }

    if (signal?.aborted) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(resolve, delayMs);
      const abortHandler = (): void => {
        clearTimeout(timeoutId);
        reject(new EventBusError('Dispatch cancelled.'));
      };

      signal?.addEventListener('abort', abortHandler, { once: true });
      void Promise.resolve().then(() => {
        signal?.removeEventListener('abort', abortHandler);
      });
    });
  }
}
