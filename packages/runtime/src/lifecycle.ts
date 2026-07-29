import type { IExecutionContext, IExecutionResult, ILifecycleHooks } from '@agentic/sdk';

import { RuntimeStatus, type RuntimeConfiguration } from './common.js';

/**
 * Tracks lifecycle transitions and invokes lifecycle hooks.
 */
export class LifecycleManager {
  private status = RuntimeStatus.Created;

  public constructor(private readonly hooks?: ILifecycleHooks) {}

  public get currentStatus(): RuntimeStatus {
    return this.status;
  }

  public async initialize(_configuration: RuntimeConfiguration): Promise<void> {
    this.status = RuntimeStatus.Initialized;
    await this.hooks?.beforeInitialize?.({
      runtimeId: _configuration.runtimeId,
      configuration: _configuration as never,
    });
    await this.hooks?.afterInitialize?.({
      runtimeId: _configuration.runtimeId,
      configuration: _configuration as never,
    });
  }

  public async start(): Promise<void> {
    this.status = RuntimeStatus.Running;
  }

  public async execute(context: IExecutionContext): Promise<void> {
    this.status = RuntimeStatus.Running;
    await this.hooks?.beforeExecute?.(context);
  }

  public async complete(result: IExecutionResult): Promise<void> {
    this.status = RuntimeStatus.Completed;
    await this.hooks?.beforeComplete?.({
      execution: result as never,
      result,
    });
  }

  public async fail(error: IExecutionResult): Promise<void> {
    this.status = RuntimeStatus.Failed;
    await this.hooks?.onError?.({
      error:
        error.error ??
        ({
          code: 'runtime.failed',
          message: 'Runtime execution failed',
          timestamp: new Date().toISOString(),
        } as never),
      execution: error as never,
    });
  }

  public async cancel(context: IExecutionContext, reason?: string): Promise<void> {
    this.status = RuntimeStatus.Cancelled;
    await this.hooks?.beforeCancel?.({ execution: context, reason });
  }

  public async dispose(runtimeId: string): Promise<void> {
    this.status = RuntimeStatus.Disposed;
    await this.hooks?.onDispose?.({ runtimeId });
  }
}
