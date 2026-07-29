import type { IExecutionContext } from '@agentic/sdk';

import type { ExecutionResult } from './common.js';
import type { MiddlewareExecutor } from './middleware.js';

/**
 * Execution pipeline that composes middleware and a terminal executor.
 */
export class ExecutionPipeline {
  public constructor(
    public readonly pipelineId: string,
    private readonly middlewareExecutor: MiddlewareExecutor,
  ) {}

  public run(
    context: IExecutionContext,
    terminal: () => Promise<ExecutionResult>,
  ): Promise<ExecutionResult> {
    return this.middlewareExecutor.execute(context, terminal);
  }
}
