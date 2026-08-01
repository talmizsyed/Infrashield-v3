import type {
  Identifier,
  Result,
  SerializableValue,
  SerializableValueObject,
  TimestampString,
} from '@infrashield/contracts';

export enum ToolExecutionStatus {
  Registered = 'registered',
  Discovered = 'discovered',
  Validated = 'validated',
  Authorized = 'authorized',
  Preparing = 'preparing',
  Executing = 'executing',
  Retrying = 'retrying',
  Completed = 'completed',
  Cancelled = 'cancelled',
  Failed = 'failed',
  Disposed = 'disposed',
}

export enum ToolType {
  AITool = 'ai-tool',
  WorkflowTool = 'workflow-tool',
  RESTTool = 'rest-tool',
  GraphQLTool = 'graphql-tool',
  SSHTool = 'ssh-tool',
  PowerShellTool = 'powershell-tool',
  BashTool = 'bash-tool',
  SQLTool = 'sql-tool',
  KubernetesTool = 'kubernetes-tool',
  TerraformTool = 'terraform-tool',
  AnsibleTool = 'ansible-tool',
  PythonTool = 'python-tool',
  MCPTool = 'mcp-tool',
  PluginTool = 'plugin-tool',
  CustomTool = 'custom-tool',
}

export interface ITool {
  readonly id: Identifier;
  readonly name: string;
  readonly description: string;
  readonly version: ToolVersion;
  readonly type: ToolType;
  readonly manifest: ToolManifest;
  execute(request: ToolExecutionRequest): Promise<ToolExecutionResult>;
}

export interface IToolRegistry {
  register(tool: ToolDefinition): void;
  get(toolId: Identifier): ToolDefinition | undefined;
  list(): readonly ToolDefinition[];
  discover(options?: {
    capability?: string;
    category?: string;
    tag?: string;
  }): readonly ToolDefinition[];
  lookupByVersion(version: string): readonly ToolDefinition[];
  lookupByCategory(category: string): readonly ToolDefinition[];
}

export interface IToolExecutor {
  execute(request: ToolExecutionRequest): Promise<ToolExecutionResult>;
}

export interface IToolProvider {
  readonly id: Identifier;
  readonly name: string;
  createTool(definition: ToolDefinition): ITool;
}

export interface IToolPipeline {
  run(tools: readonly IToolExecutor[], request: ToolExecutionRequest): Promise<ToolExecutionResult>;
}

export interface IToolCatalog {
  register(tool: ToolDefinition): void;
  list(): readonly ToolDefinition[];
}

export interface IToolAuthorization {
  authorize(request: ToolExecutionRequest): Promise<Result<void>>;
}

export interface IToolValidator {
  validate(input: SerializableValue): Result<void>;
}

export interface IToolPolicy {
  readonly name: string;
  readonly maxRetries: number;
  readonly timeoutMs: number;
}

export class ToolException extends Error {
  public constructor(
    message: string,
    public readonly details?: SerializableValueObject,
  ) {
    super(message);
    this.name = 'ToolException';
  }
}

export class ToolAuthorizationException extends ToolException {}
export class ToolValidationException extends ToolException {}
export class ToolExecutionException extends ToolException {}
export class ToolPolicyException extends ToolException {}

export class ToolVersion {
  public constructor(public readonly value: string) {
    if (!value.trim()) {
      throw new ToolException('Tool version is required');
    }
  }
}

export class ToolCapability {
  public constructor(
    public readonly name: string,
    public readonly category?: string,
  ) {
    if (!name.trim()) {
      throw new ToolException('Tool capability name is required');
    }
  }
}

export class ToolMetadata {
  public constructor(
    options: {
      readonly tags?: readonly string[];
      readonly dependencies?: readonly ToolDependency[];
      readonly health?: ToolHealth;
    } = {},
  ) {
    this.tags = [...(options.tags ?? [])];
    this.dependencies = [...(options.dependencies ?? [])];
    this.health = options.health;
  }

  public readonly tags: readonly string[];
  public readonly dependencies: readonly ToolDependency[];
  public readonly health?: ToolHealth;
}

export class ToolManifest {
  public constructor(options: {
    readonly id: Identifier;
    readonly name: string;
    readonly type: ToolType;
    readonly metadata?: SerializableValueObject;
  }) {
    if (!options.id.trim()) {
      throw new ToolException('Tool manifest id is required');
    }
    if (!options.name.trim()) {
      throw new ToolException('Tool manifest name is required');
    }
    this.id = options.id;
    this.name = options.name;
    this.type = options.type;
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }

  public readonly id: Identifier;
  public readonly name: string;
  public readonly type: ToolType;
  public readonly metadata?: Readonly<SerializableValueObject>;
}

export class ToolDependency {
  public constructor(
    public readonly id: Identifier,
    public readonly version?: string,
  ) {}
}

export class ToolHealth {
  public constructor(
    options: {
      readonly status: string;
      readonly uptimeMs?: number;
      readonly metrics?: ToolMetrics;
    } = { status: 'unknown' },
  ) {
    this.status = options.status;
    this.uptimeMs = options.uptimeMs ?? 0;
    this.metrics = options.metrics;
  }

  public readonly status: string;
  public readonly uptimeMs: number;
  public readonly metrics?: ToolMetrics;
}

export class ToolMetrics {
  public constructor(
    options: {
      readonly successes?: number;
      readonly failures?: number;
      readonly retries?: number;
      readonly latencyMs?: number;
    } = {},
  ) {
    this.successes = options.successes ?? 0;
    this.failures = options.failures ?? 0;
    this.retries = options.retries ?? 0;
    this.latencyMs = options.latencyMs ?? 0;
  }

  public successes: number;
  public failures: number;
  public retries: number;
  public latencyMs: number;

  public recordSuccess(): void {
    this.successes += 1;
  }

  public recordFailure(): void {
    this.failures += 1;
  }

  public recordRetry(): void {
    this.retries += 1;
  }

  public recordLatency(latencyMs: number): void {
    this.latencyMs = latencyMs;
  }
}

export class ToolStatistics {
  public constructor(public readonly metrics: ToolMetrics = new ToolMetrics()) {}
}

export class ToolAudit {
  public constructor(public readonly entries: readonly string[] = []) {}
}

export class ToolScope {
  public static readonly Execute = 'execute';
  public static readonly Read = 'read';
  public static readonly Write = 'write';
  public static readonly Admin = 'admin';
}

export class ToolSecurity {
  public constructor(
    options: {
      readonly tenant?: string;
      readonly scopes?: readonly string[];
      readonly secrets?: SerializableValueObject;
    } = {},
  ) {
    this.tenant = options.tenant;
    this.scopes = [...(options.scopes ?? [])];
    this.secrets = options.secrets ? Object.freeze({ ...options.secrets }) : undefined;
  }

  public readonly tenant?: string;
  public readonly scopes: readonly string[];
  public readonly secrets?: Readonly<SerializableValueObject>;
}

export class ToolDescriptor {
  public constructor(options: {
    readonly id: Identifier;
    readonly name: string;
    readonly version: ToolVersion;
    readonly type: ToolType;
    readonly manifest: ToolManifest;
    readonly capabilities?: readonly ToolCapability[];
    readonly categories?: readonly string[];
    readonly tags?: readonly string[];
    readonly metadata?: ToolMetadata;
  }) {
    if (!options.id.trim()) {
      throw new ToolException('Tool descriptor id is required');
    }
    this.id = options.id;
    this.name = options.name;
    this.version = options.version;
    this.type = options.type;
    this.manifest = options.manifest;
    this.capabilities = [...(options.capabilities ?? [])];
    this.categories = [...(options.categories ?? [])];
    this.tags = [...(options.tags ?? [])];
    this.metadata = options.metadata;
  }

  public readonly id: Identifier;
  public readonly name: string;
  public readonly version: ToolVersion;
  public readonly type: ToolType;
  public readonly manifest: ToolManifest;
  public readonly capabilities: readonly ToolCapability[];
  public readonly categories: readonly ToolCategory[];
  public readonly tags: readonly string[];
  public readonly metadata?: ToolMetadata;
}

export type ToolCategory = string;

export class ToolDefinition extends ToolDescriptor implements ITool {
  public constructor(options: ToolDefinitionOptions) {
    super(options);
    this.description = options.description ?? 'No description provided';
    this.metadata = options.metadata;
    this.manifest = options.manifest;
    this.type = options.type;
  }

  public readonly description: string;
  public readonly metadata?: ToolMetadata;
  public readonly manifest: ToolManifest;
  public readonly type: ToolType;

  public async execute(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    return new ToolExecutionResult({
      toolId: this.id,
      status: ToolExecutionStatus.Completed,
      output: request.input,
    });
  }
}

interface ToolDefinitionOptions extends Omit<
  ToolDescriptor,
  'capabilities' | 'categories' | 'tags' | 'metadata'
> {
  readonly description?: string;
  readonly capabilities?: readonly ToolCapability[];
  readonly categories?: readonly string[];
  readonly tags?: readonly string[];
  readonly manifest: ToolManifest;
  readonly metadata?: ToolMetadata;
}

export class ToolExecutionContext {
  public constructor(
    options: {
      readonly session?: ToolSession;
      readonly authorization?: ToolAuthorization;
      readonly security?: ToolSecurity;
      readonly policy?: ToolPolicy;
      readonly validator?: IToolValidator;
      readonly metadata?: SerializableValueObject;
    } = {},
  ) {
    this.session = options.session ?? new ToolSession('default-session');
    this.authorization = options.authorization;
    this.security = options.security;
    this.policy =
      options.policy ?? new ToolPolicy({ name: 'default-policy', maxRetries: 0, timeoutMs: 1000 });
    this.validator = options.validator;
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }

  public readonly session: ToolSession;
  public readonly authorization?: ToolAuthorization;
  public readonly security?: ToolSecurity;
  public readonly policy?: ToolPolicy;
  public readonly validator?: IToolValidator;
  public readonly metadata?: Readonly<SerializableValueObject>;
}

export class ToolSession {
  public constructor(public readonly id: Identifier) {}
}

export class ToolExecutionRequest {
  public constructor(
    options: {
      readonly toolId?: Identifier;
      readonly input?: SerializableValue;
      readonly context?: ToolExecutionContext;
    } = {},
  ) {
    this.toolId = options.toolId ?? '';
    this.input = options.input;
    this.context = options.context;
  }

  public readonly toolId: Identifier;
  public readonly input?: SerializableValue;
  public readonly context?: ToolExecutionContext;
}

export class ToolExecutionResult {
  public constructor(
    options: {
      readonly toolId?: Identifier;
      readonly status?: ToolExecutionStatus;
      readonly output?: SerializableValue;
      readonly error?: string;
      readonly startedAt?: TimestampString;
      readonly completedAt?: TimestampString;
      readonly metadata?: SerializableValueObject;
    } = {},
  ) {
    this.toolId = options.toolId ?? '';
    this.status = options.status ?? ToolExecutionStatus.Failed;
    this.output = options.output;
    this.error = options.error;
    this.startedAt = options.startedAt ?? new Date().toISOString();
    this.completedAt = options.completedAt;
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }

  public readonly toolId: Identifier;
  public readonly status: ToolExecutionStatus;
  public readonly output?: SerializableValue;
  public readonly error?: string;
  public readonly startedAt: TimestampString;
  public readonly completedAt?: TimestampString;
  public readonly metadata?: Readonly<SerializableValueObject>;
}

export class ToolInvocation {
  public constructor(
    public readonly definition: ToolDefinition,
    public readonly execution: ToolExecution,
  ) {}
}

export class ToolExecution implements IToolExecutor {
  private status: ToolExecutionStatus = ToolExecutionStatus.Registered;
  private readonly history: ToolExecutionResult[] = [];

  public constructor(
    private readonly definition: ToolDefinition,
    private readonly handler: (input: SerializableValue | undefined) => Promise<SerializableValue>,
  ) {}

  public async execute(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    this.status = ToolExecutionStatus.Preparing;
    const context = request.context;
    if (context?.authorization) {
      const authorized = await context.authorization.authorize(request);
      if (!authorized.succeeded) {
        throw new ToolAuthorizationException('Authorization failed');
      }
    }
    this.status = ToolExecutionStatus.Executing;
    const output = await this.handler(request.input);
    this.status = ToolExecutionStatus.Completed;
    const result = new ToolExecutionResult({
      toolId: this.definition.id,
      status: ToolExecutionStatus.Completed,
      output,
    });
    this.history.push(result);
    return result;
  }

  public createSnapshot(): ToolSnapshot {
    return new ToolSnapshot({
      toolId: this.definition.id,
      status: this.status,
      history: [...this.history],
    });
  }
}

export class ToolPipeline implements IToolPipeline {
  public async run(
    tools: readonly IToolExecutor[],
    request: ToolExecutionRequest,
  ): Promise<ToolExecutionResult> {
    let lastResult: ToolExecutionResult | undefined;
    for (const tool of tools) {
      lastResult = await tool.execute(request);
      if (lastResult.status === ToolExecutionStatus.Failed) {
        break;
      }
    }
    return (
      lastResult ??
      new ToolExecutionResult({
        toolId: request.toolId,
        status: ToolExecutionStatus.Failed,
        error: 'No tools executed',
      })
    );
  }
}

export class ToolCatalog implements IToolCatalog {
  private readonly tools = new Map<Identifier, ToolDefinition>();

  public register(tool: ToolDefinition): void {
    this.tools.set(tool.id, tool);
  }

  public list(): readonly ToolDefinition[] {
    return [...this.tools.values()];
  }
}

export class ToolRegistry implements IToolRegistry {
  private readonly tools = new Map<Identifier, ToolDefinition>();

  public register(tool: ToolDefinition): void {
    this.tools.set(tool.id, tool);
  }

  public get(toolId: Identifier): ToolDefinition | undefined {
    return this.tools.get(toolId);
  }

  public list(): readonly ToolDefinition[] {
    return [...this.tools.values()];
  }

  public discover(
    options: { capability?: string; category?: string; tag?: string } = {},
  ): readonly ToolDefinition[] {
    return this.list().filter((tool) => {
      const capabilityMatches =
        !options.capability ||
        tool.capabilities.some((capability) => capability.name === options.capability);
      const categoryMatches =
        !options.category || tool.categories.some((category) => category === options.category);
      const tagMatches = !options.tag || tool.tags.some((tag) => tag === options.tag);
      return capabilityMatches && categoryMatches && tagMatches;
    });
  }

  public lookupByVersion(version: string): readonly ToolDefinition[] {
    return this.list().filter((tool) => tool.version.value === version);
  }

  public lookupByCategory(category: string): readonly ToolDefinition[] {
    return this.list().filter((tool) => tool.categories.includes(category));
  }
}

export class ToolAuthorization implements IToolAuthorization {
  public constructor(
    allowedTenantsOrOptions: readonly string[] | { readonly allow?: readonly string[] } = [],
  ) {
    this.allowedTenants = Array.isArray(allowedTenantsOrOptions)
      ? allowedTenantsOrOptions
      : ((allowedTenantsOrOptions as { readonly allow?: readonly string[] }).allow ?? []);
  }

  private readonly allowedTenants: readonly string[];

  public async authorize(request: ToolExecutionRequest): Promise<Result<void>> {
    if (!request.context?.security?.tenant) {
      throw new ToolAuthorizationException('Tenant is required');
    }
    if (!this.allowedTenants.includes(request.context.security.tenant)) {
      throw new ToolAuthorizationException('Tenant is not allowed');
    }
    return { succeeded: true, data: undefined };
  }
}

export class ToolValidation implements IToolValidator {
  public validate(input: SerializableValue): Result<void> {
    if (input === undefined || input === null || (typeof input === 'string' && !input.trim())) {
      throw new ToolValidationException('Input cannot be empty');
    }
    return { succeeded: true, data: undefined };
  }
}

export class ToolPolicy implements IToolPolicy {
  public constructor(options: {
    readonly name: string;
    readonly maxRetries: number;
    readonly timeoutMs: number;
  }) {
    if (!options.name.trim()) {
      throw new ToolException('Tool policy name is required');
    }
    this.name = options.name;
    this.maxRetries = options.maxRetries;
    this.timeoutMs = options.timeoutMs;
  }

  public readonly name: string;
  public readonly maxRetries: number;
  public readonly timeoutMs: number;
}

export class ToolSnapshot {
  public constructor(
    options: {
      readonly toolId?: Identifier;
      readonly status?: ToolExecutionStatus;
      readonly history?: readonly ToolExecutionResult[];
      readonly metadata?: SerializableValueObject;
    } = {},
  ) {
    this.toolId = options.toolId ?? '';
    this.status = options.status ?? ToolExecutionStatus.Registered;
    this.history = [...(options.history ?? [])];
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }

  public readonly toolId: Identifier;
  public readonly status: ToolExecutionStatus;
  public readonly history: readonly ToolExecutionResult[];
  public readonly metadata?: Readonly<SerializableValueObject>;
}

export { ToolDefinition as Tool };
