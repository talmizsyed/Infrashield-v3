import type {
  Identifier,
  SerializableValueObject,
  TimestampString,
  VersionString,
} from '@infrashield/contracts';

import {
  ToolCategory,
  ToolDefinition,
  ToolExecutor,
  ToolMetadata,
  ToolRegistry,
  ToolRegistryException,
  ToolResult,
  ToolValidationError,
  ToolValidator,
} from './tool-registry.js';
import type { ToolAuditContext, ToolGovernanceContext } from './tool-governance.js';
import { ToolExecutionPolicy, ToolScope } from './tool-governance.js';

export class ToolCapability {
  public readonly name: string;
  public readonly description?: string;

  public constructor(options: { readonly name: string; readonly description?: string }) {
    if (!options.name.trim()) {
      throw new ToolRegistryException('Tool capability name is required.');
    }

    this.name = options.name;
    this.description = options.description;
  }
}

export interface ToolExecutionContext<
  TConfiguration extends SerializableValueObject = SerializableValueObject,
> extends ToolGovernanceContext {
  readonly configuration?: Readonly<Partial<TConfiguration>>;
  readonly requestTimestamp?: TimestampString;
  readonly authorization?: import('./tool-governance.js').ToolAuthorization;
  readonly executionPolicy?: ToolExecutionPolicy;
  readonly audit?: ToolAuditContext;
}

export class ToolRequest<
  TInput extends SerializableValueObject = SerializableValueObject,
  TConfiguration extends SerializableValueObject = SerializableValueObject,
> {
  public readonly toolId: Identifier;
  public readonly input: Readonly<TInput>;
  public readonly context: ToolExecutionContext<TConfiguration>;

  public constructor(options: {
    readonly toolId: Identifier;
    readonly input: Readonly<TInput>;
    readonly context?: ToolExecutionContext<TConfiguration>;
  }) {
    this.toolId = options.toolId;
    this.input = options.input;
    this.context = options.context ?? {};
  }
}

export class ToolResponse<TOutput extends SerializableValueObject = SerializableValueObject> {
  public readonly result: ToolResult<TOutput>;

  public constructor(result: ToolResult<TOutput>) {
    this.result = result;
  }

  public get status(): ToolResult<TOutput>['status'] {
    return this.result.status;
  }

  public get output(): Readonly<TOutput> | undefined {
    return this.result.output;
  }

  public get error(): string | undefined {
    return this.result.error;
  }
}

export class ToolConfiguration<
  TConfiguration extends SerializableValueObject = SerializableValueObject,
> {
  private readonly defaultValues: Readonly<Partial<TConfiguration>>;
  private readonly requiredFields: readonly (keyof TConfiguration & string)[];
  private readonly validator?: (configuration: Readonly<TConfiguration>) => void | Promise<void>;

  public constructor(
    options: {
      readonly defaultValues?: Readonly<Partial<TConfiguration>>;
      readonly requiredFields?: readonly (keyof TConfiguration & string)[];
      readonly validate?: (configuration: Readonly<TConfiguration>) => void | Promise<void>;
    } = {},
  ) {
    this.defaultValues = Object.freeze({
      ...(options.defaultValues ?? {}),
    }) as Readonly<Partial<TConfiguration>>;
    this.requiredFields = Object.freeze([...(options.requiredFields ?? [])]);
    this.validator = options.validate;
  }

  public async resolve(
    configuration?: Readonly<Partial<TConfiguration>>,
  ): Promise<Readonly<TConfiguration>> {
    const resolved = Object.freeze({
      ...this.defaultValues,
      ...(configuration ?? {}),
    }) as Readonly<TConfiguration>;

    for (const field of this.requiredFields) {
      if (resolved[field] === undefined || resolved[field] === null) {
        throw new ToolValidationError(`Missing required configuration field: ${field}`);
      }
    }

    await this.validator?.(resolved);
    return resolved;
  }
}

export class ToolLifecycle<
  TInput extends SerializableValueObject = SerializableValueObject,
  TOutput extends SerializableValueObject = SerializableValueObject,
  TConfiguration extends SerializableValueObject = SerializableValueObject,
> {
  public readonly onRegister?: (
    tool: BaseTool<TInput, TOutput, TConfiguration>,
  ) => void | Promise<void>;
  public readonly onUnregister?: (
    tool: BaseTool<TInput, TOutput, TConfiguration>,
  ) => void | Promise<void>;
  public readonly beforeExecute?: (
    request: ToolRequest<TInput, TConfiguration>,
  ) => void | Promise<void>;
  public readonly afterExecute?: (
    request: ToolRequest<TInput, TConfiguration>,
    output: Readonly<TOutput>,
  ) => void | Promise<void>;
  public readonly onError?: (
    request: ToolRequest<TInput, TConfiguration>,
    error: Error,
  ) => void | Promise<void>;

  public constructor(
    options: {
      readonly onRegister?: (
        tool: BaseTool<TInput, TOutput, TConfiguration>,
      ) => void | Promise<void>;
      readonly onUnregister?: (
        tool: BaseTool<TInput, TOutput, TConfiguration>,
      ) => void | Promise<void>;
      readonly beforeExecute?: (
        request: ToolRequest<TInput, TConfiguration>,
      ) => void | Promise<void>;
      readonly afterExecute?: (
        request: ToolRequest<TInput, TConfiguration>,
        output: Readonly<TOutput>,
      ) => void | Promise<void>;
      readonly onError?: (
        request: ToolRequest<TInput, TConfiguration>,
        error: Error,
      ) => void | Promise<void>;
    } = {},
  ) {
    this.onRegister = options.onRegister;
    this.onUnregister = options.onUnregister;
    this.beforeExecute = options.beforeExecute;
    this.afterExecute = options.afterExecute;
    this.onError = options.onError;
  }
}

export abstract class BaseTool<
  TInput extends SerializableValueObject = SerializableValueObject,
  TOutput extends SerializableValueObject = SerializableValueObject,
  TConfiguration extends SerializableValueObject = SerializableValueObject,
> {
  public readonly id: Identifier;
  public readonly name: string;
  public readonly metadata: ToolMetadata;
  public readonly validator: ToolValidator<TInput, TOutput>;
  public readonly configuration: ToolConfiguration<TConfiguration>;
  public readonly lifecycle: ToolLifecycle<TInput, TOutput, TConfiguration>;
  public readonly capabilities: readonly ToolCapability[];

  protected constructor(options: {
    readonly id: Identifier;
    readonly name: string;
    readonly metadata: ToolMetadata;
    readonly validator?: ToolValidator<TInput, TOutput>;
    readonly configuration?: ToolConfiguration<TConfiguration>;
    readonly lifecycle?: ToolLifecycle<TInput, TOutput, TConfiguration>;
    readonly capabilities?: readonly ToolCapability[];
  }) {
    this.id = options.id;
    this.name = options.name;
    this.metadata = options.metadata;
    this.validator = options.validator ?? new ToolValidator<TInput, TOutput>();
    this.configuration = options.configuration ?? new ToolConfiguration<TConfiguration>();
    this.lifecycle = options.lifecycle ?? new ToolLifecycle<TInput, TOutput, TConfiguration>();
    this.capabilities = Object.freeze([...(options.capabilities ?? [])]);
  }

  public abstract execute(request: ToolRequest<TInput, TConfiguration>): Promise<TOutput> | TOutput;

  public toDefinition(): ToolDefinition<TInput, TOutput> {
    return new ToolDefinition<TInput, TOutput>({
      id: this.id,
      name: this.name,
      metadata: this.metadata,
      validator: this.validator,
      executor: new ToolExecutor<TInput, TOutput>(async (input, context) => {
        const executionContext = context as ToolExecutionContext<TConfiguration>;
        const audit = executionContext.executionPolicy
          ? await executionContext.executionPolicy.enforce(
              { id: this.id, name: this.name, metadata: this.metadata },
              executionContext,
            )
          : executionContext.authorization
            ? await executionContext.authorization.authorize(
                { id: this.id, name: this.name, metadata: this.metadata },
                executionContext,
                executionContext.scopes ?? [ToolScope.Execute],
              )
            : (executionContext.audit ?? {
                actorId: executionContext.actorId,
                roles: Object.freeze((executionContext.roles ?? []).map((role) => role.name)),
                requestedScopes: Object.freeze([
                  ...(executionContext.scopes ?? [ToolScope.Execute]),
                ]),
                decision: 'allow' as const,
                reason: 'No authorization configured.',
                evaluatedAt: new Date().toISOString(),
                metadata: executionContext.metadata,
              });

        const request = new ToolRequest<TInput, TConfiguration>({
          toolId: this.id,
          input,
          context: {
            ...executionContext,
            audit,
          },
        });

        try {
          await this.configuration.resolve(request.context.configuration);
          await this.lifecycle.beforeExecute?.(request);
          const output = await this.execute(request);
          await this.lifecycle.afterExecute?.(request, output);
          return output;
        } catch (error) {
          const executionError =
            error instanceof Error ? error : new ToolRegistryException('Tool execution failed.');
          await this.lifecycle.onError?.(request, executionError);
          throw executionError;
        }
      }),
    });
  }
}

interface BaseToolOptions<
  TInput extends SerializableValueObject,
  TOutput extends SerializableValueObject,
  TConfiguration extends SerializableValueObject,
> {
  readonly id: Identifier;
  readonly name: string;
  readonly metadata: ToolMetadata;
  readonly validator?: ToolValidator<TInput, TOutput>;
  readonly configuration?: ToolConfiguration<TConfiguration>;
  readonly lifecycle?: ToolLifecycle<TInput, TOutput, TConfiguration>;
  readonly capabilities?: readonly ToolCapability[];
}

class BuiltTool<
  TInput extends SerializableValueObject,
  TOutput extends SerializableValueObject,
  TConfiguration extends SerializableValueObject,
> extends BaseTool<TInput, TOutput, TConfiguration> {
  public constructor(
    options: BaseToolOptions<TInput, TOutput, TConfiguration>,
    private readonly handler: (
      request: ToolRequest<TInput, TConfiguration>,
    ) => Promise<TOutput> | TOutput,
  ) {
    super(options);
  }

  public execute(request: ToolRequest<TInput, TConfiguration>): Promise<TOutput> | TOutput {
    return this.handler(request);
  }
}

interface RegisteredSdkToolHandle {
  readonly unregister: () => Promise<void>;
}

export class ToolBuilder<
  TInput extends SerializableValueObject = SerializableValueObject,
  TOutput extends SerializableValueObject = SerializableValueObject,
  TConfiguration extends SerializableValueObject = SerializableValueObject,
> {
  private description = '';
  private version: VersionString = '1.0.0';
  private categories: ToolCategory[] = [];
  private tags: string[] = [];
  private timeoutMs?: number;
  private validator = new ToolValidator<TInput, TOutput>();
  private configuration = new ToolConfiguration<TConfiguration>();
  private lifecycle = new ToolLifecycle<TInput, TOutput, TConfiguration>();
  private capabilities: ToolCapability[] = [];
  private handler?: (request: ToolRequest<TInput, TConfiguration>) => Promise<TOutput> | TOutput;

  public constructor(
    private readonly id: Identifier,
    private readonly name: string,
  ) {}

  public withDescription(description: string): this {
    this.description = description;
    return this;
  }

  public withVersion(version: VersionString): this {
    this.version = version;
    return this;
  }

  public withCategories(categories: readonly ToolCategory[]): this {
    this.categories = [...categories];
    return this;
  }

  public withTags(tags: readonly string[]): this {
    this.tags = [...tags];
    return this;
  }

  public withTimeout(timeoutMs: number): this {
    this.timeoutMs = timeoutMs;
    return this;
  }

  public withValidator(validator: ToolValidator<TInput, TOutput>): this {
    this.validator = validator;
    return this;
  }

  public withConfiguration(configuration: ToolConfiguration<TConfiguration>): this {
    this.configuration = configuration;
    return this;
  }

  public withLifecycle(lifecycle: ToolLifecycle<TInput, TOutput, TConfiguration>): this {
    this.lifecycle = lifecycle;
    return this;
  }

  public withCapabilities(capabilities: readonly ToolCapability[]): this {
    this.capabilities = [...capabilities];
    return this;
  }

  public withHandler(
    handler: (request: ToolRequest<TInput, TConfiguration>) => Promise<TOutput> | TOutput,
  ): this {
    this.handler = handler;
    return this;
  }

  public build(): BaseTool<TInput, TOutput, TConfiguration> {
    if (!this.handler) {
      throw new ToolRegistryException('Tool handler is required.');
    }

    return new BuiltTool<TInput, TOutput, TConfiguration>(
      {
        id: this.id,
        name: this.name,
        metadata: new ToolMetadata({
          description: this.description,
          version: this.version,
          categories: this.categories,
          tags: this.tags,
          timeoutMs: this.timeoutMs,
        }),
        validator: this.validator,
        configuration: this.configuration,
        lifecycle: this.lifecycle,
        capabilities: this.capabilities,
      },
      this.handler,
    );
  }
}

export class ToolFactory {
  private readonly tools = new Map<Identifier, RegisteredSdkToolHandle>();

  public constructor(private readonly registry: ToolRegistry = new ToolRegistry()) {}

  public create<
    TInput extends SerializableValueObject,
    TOutput extends SerializableValueObject,
    TConfiguration extends SerializableValueObject,
  >(tool: BaseTool<TInput, TOutput, TConfiguration>): ToolDefinition<TInput, TOutput> {
    return tool.toDefinition();
  }

  public async register<
    TInput extends SerializableValueObject,
    TOutput extends SerializableValueObject,
    TConfiguration extends SerializableValueObject,
  >(tool: BaseTool<TInput, TOutput, TConfiguration>): Promise<ToolDefinition<TInput, TOutput>> {
    const definition = tool.toDefinition();
    this.registry.register(definition);
    this.tools.set(tool.id, {
      unregister: async () => {
        await tool.lifecycle.onUnregister?.(tool);
      },
    });
    await tool.lifecycle.onRegister?.(tool);
    return definition;
  }

  public async unregister(toolId: Identifier): Promise<boolean> {
    const tool = this.tools.get(toolId);
    const removed = this.registry.unregister(toolId);
    if (tool) {
      await tool.unregister();
      this.tools.delete(toolId);
    }
    return removed;
  }

  public getRegistry(): ToolRegistry {
    return this.registry;
  }
}
