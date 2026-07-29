import type { CorrelationId, Identifier, SerializableValueObject } from '@agentic/sdk';
import type {
  ICancellationToken,
  IConfigurationProvider,
  IExecutionContext,
  IRuntimeServices,
  ILogger,
} from '@agentic/sdk';

/**
 * Execution context creation input.
 */
export interface ExecutionContextInput {
  readonly executionId: Identifier;
  readonly correlationId: CorrelationId;
  readonly traceId: Identifier;
  readonly variables: SerializableValueObject;
  readonly cancellationToken: ICancellationToken;
  readonly logger: ILogger;
  readonly configuration: IConfigurationProvider;
  readonly runtime: IRuntimeServices;
  readonly conversationId?: Identifier;
  readonly metadata?: SerializableValueObject;
}

/**
 * Concrete runtime execution context.
 */
export class ExecutionContext implements IExecutionContext {
  public readonly executionId: Identifier;
  public readonly correlationId: CorrelationId;
  public readonly traceId: Identifier;
  public readonly variables: SerializableValueObject;
  public readonly cancellationToken: ICancellationToken;
  public readonly logger: ILogger;
  public readonly runtime: IRuntimeServices;
  public readonly configuration: IConfigurationProvider;
  public readonly conversationId?: Identifier;
  public readonly metadata?: SerializableValueObject;

  public constructor(input: ExecutionContextInput) {
    this.executionId = input.executionId;
    this.correlationId = input.correlationId;
    this.traceId = input.traceId;
    this.variables = input.variables;
    this.cancellationToken = input.cancellationToken;
    this.logger = input.logger;
    this.configuration = input.configuration;
    this.runtime = input.runtime;
    this.conversationId = input.conversationId;
    this.metadata = input.metadata;
  }
}
