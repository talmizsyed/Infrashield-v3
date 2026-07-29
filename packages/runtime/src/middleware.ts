import type { IExecutionContext, IMiddleware } from '@agentic/sdk';

import { RuntimeEventType } from './common.js';
import { createRuntimeEvent } from './events.js';
import type { ExecutionResult } from './common.js';
import type { EventDispatcher } from './events.js';

/**
 * Middleware execution contract.
 */
export interface MiddlewareExecutorOptions {
  readonly middleware: readonly IMiddleware[];
  readonly eventDispatcher: EventDispatcher;
}

/**
 * Executes middleware in request/response order.
 */
export class MiddlewareExecutor {
  public constructor(private readonly options: MiddlewareExecutorOptions) {}

  public async execute(
    context: IExecutionContext,
    terminal: () => Promise<ExecutionResult>,
  ): Promise<ExecutionResult> {
    const chain = this.options.middleware.reduceRight<() => Promise<ExecutionResult>>(
      (next, middleware) => async () => {
        await this.options.eventDispatcher.publish(
          createRuntimeEvent({
            eventType: RuntimeEventType.MiddlewareStarted,
            executionId: context.executionId,
            middlewareId: middleware.middlewareId,
          }),
        );

        const result = await middleware.execute(context, next);

        await this.options.eventDispatcher.publish(
          createRuntimeEvent({
            eventType: RuntimeEventType.MiddlewareCompleted,
            executionId: context.executionId,
            middlewareId: middleware.middlewareId,
          }),
        );

        return result;
      },
      terminal,
    );

    return chain();
  }
}
