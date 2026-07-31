import type { IEvent, IEventHandler } from './contracts';
import type { EventDispatchContext } from './middleware';
export type FailureClassification = 'transient' | 'permanent' | 'unexpected' | 'cancelled';
export declare class RetryStrategy {
  readonly type: 'none' | 'fixed' | 'exponential';
  readonly initialDelayMs: number;
  readonly maxDelayMs: number;
  readonly backoffMultiplier: number;
  constructor(
    type?: 'none' | 'fixed' | 'exponential',
    initialDelayMs?: number,
    maxDelayMs?: number,
    backoffMultiplier?: number,
  );
  getDelayMs(attempt: number): number;
}
export declare class RetryPolicy {
  constructor(options?: {
    readonly maxAttempts?: number;
    readonly strategy?: RetryStrategy;
    readonly retryPredicate?: (error: Error, context: RetryContext) => boolean;
  });
  readonly maxAttempts: number;
  readonly strategy: RetryStrategy;
  readonly retryPredicate: ((error: Error, context: RetryContext) => boolean) | undefined;
  static none(): RetryPolicy;
  getDelayMs(attempt: number): number;
  shouldRetry(context: RetryContext): boolean;
}
export declare class RetryContext {
  readonly event: IEvent;
  readonly handler: IEventHandler;
  readonly currentAttempt: number;
  readonly maxAttempts: number;
  readonly strategy: RetryStrategy;
  readonly lastError: Error | undefined;
  readonly shouldRetry: boolean;
  readonly delayMs: number;
  constructor(
    event: IEvent,
    handler: IEventHandler,
    currentAttempt: number,
    maxAttempts: number,
    strategy: RetryStrategy,
    lastError: Error | undefined,
    shouldRetry: boolean,
    delayMs: number,
  );
}
export declare class EventFailure {
  readonly event: IEvent;
  readonly error: Error;
  readonly classification: FailureClassification;
  readonly attempts: number;
  readonly retryHistory: readonly RetryContext[];
  readonly correlationId: string | undefined;
  readonly timestamp: string;
  constructor(
    event: IEvent,
    error: Error,
    classification: FailureClassification,
    attempts: number,
    retryHistory?: readonly RetryContext[],
    correlationId?: string | undefined,
    timestamp?: string,
  );
}
export declare class FailureClassifier {
  classify(error: unknown): FailureClassification;
}
export declare class DeadLetterEntry {
  readonly event: IEvent;
  readonly error: Error;
  readonly retryHistory: readonly RetryContext[];
  readonly correlationId: string | undefined;
  readonly timestamp: string;
  constructor(
    event: IEvent,
    error: Error,
    retryHistory?: readonly RetryContext[],
    correlationId?: string | undefined,
    timestamp?: string,
  );
}
export declare class DeadLetterQueue {
  private readonly entries;
  enqueue(entry: DeadLetterEntry): void;
  size(): number;
  peek(): DeadLetterEntry | undefined;
  drain(): readonly DeadLetterEntry[];
}
export declare class DeadLetterProcessor {
  process(entry: DeadLetterEntry): Promise<void>;
}
export declare class EventExecutionResult<TEvent extends IEvent = IEvent> {
  readonly event: TEvent;
  readonly handler: IEventHandler<TEvent>;
  readonly attempts: number;
  readonly succeeded: boolean;
  readonly outcome: 'succeeded' | 'failed' | 'dead-lettered' | 'cancelled';
  readonly error: Error | undefined;
  readonly retryHistory: readonly RetryContext[];
  readonly failure: EventFailure | undefined;
  constructor(
    event: TEvent,
    handler: IEventHandler<TEvent>,
    attempts: number,
    succeeded: boolean,
    outcome: 'succeeded' | 'failed' | 'dead-lettered' | 'cancelled',
    error?: Error | undefined,
    retryHistory?: readonly RetryContext[],
    failure?: EventFailure | undefined,
  );
}
export declare class RetryExecutor {
  private readonly classifier;
  execute<TEvent extends IEvent>(options: {
    readonly event: TEvent;
    readonly handler: IEventHandler<TEvent>;
    readonly policy?: RetryPolicy;
    readonly dispatchContext?: EventDispatchContext;
    readonly deadLetterQueue?: DeadLetterQueue;
  }): Promise<EventExecutionResult<TEvent>>;
  private wait;
}
//# sourceMappingURL=retry.d.ts.map
