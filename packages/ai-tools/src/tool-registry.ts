import type {
  CorrelationId,
  Identifier,
  SerializableValueObject,
  TimestampString,
  VersionString,
} from '@infrashield/contracts';

export enum ToolCategory {
  Infrastructure = 'Infrastructure',
  AI = 'AI',
  Security = 'Security',
  Workflow = 'Workflow',
  KnowledgeGraph = 'KnowledgeGraph',
  Provider = 'Provider',
  Utility = 'Utility',
}

export type ToolResultStatus = 'completed' | 'failed' | 'timed-out';

export class ToolRegistryException extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ToolRegistryException';
  }
}

export class ToolValidationError extends ToolRegistryException {
  public constructor(message: string) {
    super(message);
    this.name = 'ToolValidationError';
  }
}

export class ToolTimeoutError extends ToolRegistryException {
  public constructor(message: string) {
    super(message);
    this.name = 'ToolTimeoutError';
  }
}

export interface ToolContext {
  readonly requestId?: Identifier;
  readonly correlationId?: CorrelationId;
  readonly actorId?: string;
  readonly metadata?: Readonly<SerializableValueObject>;
  readonly timeoutMs?: number;
}

export class ToolMetadata {
  public readonly description: string;
  public readonly version: VersionString;
  public readonly categories: readonly ToolCategory[];
  public readonly tags: readonly string[];
  public readonly timeoutMs?: number;

  public constructor(options: {
    readonly description: string;
    readonly version: VersionString;
    readonly categories: readonly ToolCategory[];
    readonly tags?: readonly string[];
    readonly timeoutMs?: number;
  }) {
    if (!options.description.trim()) {
      throw new ToolRegistryException('Tool description is required.');
    }
    if (!options.version.trim()) {
      throw new ToolRegistryException('Tool version is required.');
    }
    if (options.categories.length === 0) {
      throw new ToolRegistryException('At least one tool category is required.');
    }
    if (options.timeoutMs !== undefined && options.timeoutMs <= 0) {
      throw new ToolRegistryException('Tool timeout must be greater than zero.');
    }

    this.description = options.description;
    this.version = options.version;
    this.categories = Object.freeze([...options.categories]);
    this.tags = Object.freeze([...(options.tags ?? [])]);
    this.timeoutMs = options.timeoutMs;
  }
}

export class ToolValidator<
  TInput extends SerializableValueObject = SerializableValueObject,
  TOutput extends SerializableValueObject = SerializableValueObject,
> {
  private readonly requiredInputFields: readonly (keyof TInput & string)[];
  private readonly requiredOutputFields: readonly (keyof TOutput & string)[];
  private readonly inputValidator?: (input: TInput, context: ToolContext) => void | Promise<void>;
  private readonly outputValidator?: (
    output: TOutput,
    context: ToolContext,
  ) => void | Promise<void>;

  public constructor(
    options: {
      readonly requiredInputFields?: readonly (keyof TInput & string)[];
      readonly requiredOutputFields?: readonly (keyof TOutput & string)[];
      readonly validateInput?: (input: TInput, context: ToolContext) => void | Promise<void>;
      readonly validateOutput?: (output: TOutput, context: ToolContext) => void | Promise<void>;
    } = {},
  ) {
    this.requiredInputFields = Object.freeze([...(options.requiredInputFields ?? [])]);
    this.requiredOutputFields = Object.freeze([...(options.requiredOutputFields ?? [])]);
    this.inputValidator = options.validateInput;
    this.outputValidator = options.validateOutput;
  }

  public async validateInput(input: TInput, context: ToolContext = {}): Promise<void> {
    this.validateRequiredFields(input, this.requiredInputFields, 'input');
    await this.inputValidator?.(input, context);
  }

  public async validateOutput(output: TOutput, context: ToolContext = {}): Promise<void> {
    this.validateRequiredFields(output, this.requiredOutputFields, 'output');
    await this.outputValidator?.(output, context);
  }

  private validateRequiredFields(
    value: SerializableValueObject,
    requiredFields: readonly string[],
    label: 'input' | 'output',
  ): void {
    for (const field of requiredFields) {
      if (!(field in value) || value[field] === undefined || value[field] === null) {
        throw new ToolValidationError(`Missing required ${label} field: ${field}`);
      }
    }
  }
}

export interface ToolResult<TOutput extends SerializableValueObject = SerializableValueObject> {
  readonly toolId: Identifier;
  readonly version: VersionString;
  readonly status: ToolResultStatus;
  readonly output?: Readonly<TOutput>;
  readonly error?: string;
  readonly durationMs: number;
  readonly startedAt: TimestampString;
  readonly completedAt: TimestampString;
  readonly metadata?: Readonly<SerializableValueObject>;
}

export class ToolExecutor<
  TInput extends SerializableValueObject = SerializableValueObject,
  TOutput extends SerializableValueObject = SerializableValueObject,
> {
  public constructor(
    private readonly handler: (
      input: Readonly<TInput>,
      context: ToolContext,
    ) => Promise<TOutput> | TOutput,
  ) {}

  public async execute(input: Readonly<TInput>, context: ToolContext = {}): Promise<TOutput> {
    return this.handler(input, context);
  }
}

export class ToolDefinition<
  TInput extends SerializableValueObject = SerializableValueObject,
  TOutput extends SerializableValueObject = SerializableValueObject,
> {
  public readonly id: Identifier;
  public readonly name: string;
  public readonly metadata: ToolMetadata;
  public readonly validator: ToolValidator<TInput, TOutput>;
  public readonly executor: ToolExecutor<TInput, TOutput>;

  public constructor(options: {
    readonly id: Identifier;
    readonly name: string;
    readonly metadata: ToolMetadata;
    readonly executor: ToolExecutor<TInput, TOutput>;
    readonly validator?: ToolValidator<TInput, TOutput>;
  }) {
    if (!options.id.trim()) {
      throw new ToolRegistryException('Tool id is required.');
    }
    if (!options.name.trim()) {
      throw new ToolRegistryException('Tool name is required.');
    }

    this.id = options.id;
    this.name = options.name;
    this.metadata = options.metadata;
    this.executor = options.executor;
    this.validator = options.validator ?? new ToolValidator<TInput, TOutput>();
  }
}

export interface ToolDiscoveryQuery {
  readonly category?: ToolCategory;
  readonly version?: VersionString;
  readonly tag?: string;
  readonly name?: string;
}

type RegisteredToolDefinition = ToolDefinition<SerializableValueObject, SerializableValueObject>;

export class ToolRegistry {
  private readonly tools = new Map<Identifier, RegisteredToolDefinition>();

  public register<TInput extends SerializableValueObject, TOutput extends SerializableValueObject>(
    tool: ToolDefinition<TInput, TOutput>,
  ): void {
    if (this.tools.has(tool.id)) {
      throw new ToolRegistryException(`Tool ${tool.id} is already registered.`);
    }

    this.tools.set(tool.id, tool as unknown as RegisteredToolDefinition);
  }

  public unregister(toolId: Identifier): boolean {
    return this.tools.delete(toolId);
  }

  public get<TInput extends SerializableValueObject, TOutput extends SerializableValueObject>(
    toolId: Identifier,
  ): ToolDefinition<TInput, TOutput> | undefined {
    return this.tools.get(toolId) as ToolDefinition<TInput, TOutput> | undefined;
  }

  public list(): readonly ToolDefinition[] {
    return Object.freeze([...this.tools.values()]);
  }

  public discover(query: ToolDiscoveryQuery = {}): readonly ToolDefinition[] {
    const normalizedName = query.name?.toLowerCase();

    return Object.freeze(
      this.list().filter((tool) => {
        const categoryMatches =
          query.category === undefined || tool.metadata.categories.includes(query.category);
        const versionMatches =
          query.version === undefined || tool.metadata.version === query.version;
        const tagMatches = query.tag === undefined || tool.metadata.tags.includes(query.tag);
        const nameMatches =
          normalizedName === undefined || tool.name.toLowerCase().includes(normalizedName);

        return categoryMatches && versionMatches && tagMatches && nameMatches;
      }),
    );
  }

  public async execute<
    TInput extends SerializableValueObject = SerializableValueObject,
    TOutput extends SerializableValueObject = SerializableValueObject,
  >(
    toolId: Identifier,
    input: Readonly<TInput>,
    context: ToolContext = {},
  ): Promise<ToolResult<TOutput>> {
    const tool = this.get<TInput, TOutput>(toolId);
    if (!tool) {
      throw new ToolRegistryException(`Tool ${toolId} is not registered.`);
    }

    const startedAt = new Date().toISOString();
    const startedAtMs = Date.now();

    try {
      await tool.validator.validateInput(input, context);
      const output = await this.runWithTimeout(tool, input, context);
      await tool.validator.validateOutput(output, context);

      return this.buildResult(tool, {
        status: 'completed',
        output,
        startedAt,
        durationMs: Date.now() - startedAtMs,
        metadata: context.metadata,
      });
    } catch (error) {
      const timedOut = error instanceof ToolTimeoutError;
      return this.buildResult(tool, {
        status: timedOut ? 'timed-out' : 'failed',
        error: error instanceof Error ? error.message : 'Tool execution failed.',
        startedAt,
        durationMs: Date.now() - startedAtMs,
        metadata: context.metadata,
      });
    }
  }

  private async runWithTimeout<
    TInput extends SerializableValueObject,
    TOutput extends SerializableValueObject,
  >(
    tool: ToolDefinition<TInput, TOutput>,
    input: Readonly<TInput>,
    context: ToolContext,
  ): Promise<TOutput> {
    const timeoutMs = context.timeoutMs ?? tool.metadata.timeoutMs;
    if (timeoutMs === undefined) {
      return tool.executor.execute(input, context);
    }

    return new Promise<TOutput>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new ToolTimeoutError(`Tool ${tool.id} timed out after ${timeoutMs}ms.`));
      }, timeoutMs);

      Promise.resolve(tool.executor.execute(input, context))
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error: unknown) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private buildResult<
    TInput extends SerializableValueObject,
    TOutput extends SerializableValueObject,
  >(
    tool: ToolDefinition<TInput, TOutput>,
    options: {
      readonly status: ToolResultStatus;
      readonly output?: TOutput;
      readonly error?: string;
      readonly startedAt: TimestampString;
      readonly durationMs: number;
      readonly metadata?: Readonly<SerializableValueObject>;
    },
  ): ToolResult<TOutput> {
    return Object.freeze({
      toolId: tool.id,
      version: tool.metadata.version,
      status: options.status,
      output: options.output ? Object.freeze({ ...options.output }) : undefined,
      error: options.error,
      durationMs: options.durationMs,
      startedAt: options.startedAt,
      completedAt: new Date().toISOString(),
      metadata: options.metadata ? Object.freeze({ ...options.metadata }) : undefined,
    });
  }
}
