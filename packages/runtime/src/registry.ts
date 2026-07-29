import type {
  IConfigurationProvider,
  ILogger,
  ITracer,
  IMiddleware,
  ILifecycleHooks,
} from '@agentic/sdk';

import { CancellationManager } from './cancellation.js';
import { EventDispatcher } from './events.js';
import { createNoopLogger, createNoopTracer } from './logging.js';
import { RetryManager } from './retry.js';

/**
 * Runtime service registry.
 */
export interface ServiceRegistryOptions {
  readonly runtimeId: string;
  readonly configuration?: IConfigurationProvider;
  readonly logger?: ILogger;
  readonly tracer?: ITracer;
  readonly middleware?: readonly IMiddleware[];
  readonly hooks?: ILifecycleHooks;
}

/**
 * Collects runtime services without exposing a service locator.
 */
export class ServiceRegistry {
  public readonly runtimeId: string;
  public readonly configuration?: IConfigurationProvider;
  public readonly logger: ILogger;
  public readonly tracer: ITracer;
  public readonly eventDispatcher: EventDispatcher;
  public readonly cancellationManager: CancellationManager;
  public readonly retryManager: RetryManager;
  public readonly middleware: readonly IMiddleware[];
  public readonly hooks?: ILifecycleHooks;

  public constructor(options: ServiceRegistryOptions) {
    this.runtimeId = options.runtimeId;
    this.configuration = options.configuration;
    this.logger = options.logger ?? createNoopLogger();
    this.tracer = options.tracer ?? createNoopTracer();
    this.eventDispatcher = new EventDispatcher();
    this.cancellationManager = new CancellationManager();
    this.retryManager = new RetryManager();
    this.middleware = options.middleware ?? [];
    this.hooks = options.hooks;
  }
}
