import type { Context } from '@infrashield/context';
import type {
  Identifier,
  Result,
  SerializableValue,
  SerializableValueObject,
  TimestampString,
} from '@infrashield/contracts';

export enum AgentStatus {
  Created = 'created',
  Initialized = 'initialized',
  Starting = 'starting',
  Running = 'running',
  Waiting = 'waiting',
  Thinking = 'thinking',
  Executing = 'executing',
  Delegating = 'delegating',
  Collaborating = 'collaborating',
  Completed = 'completed',
  Paused = 'paused',
  Stopped = 'stopped',
  Failed = 'failed',
  Disposed = 'disposed',
}

export interface IAgent {
  readonly id: Identifier;
  readonly identity: AgentIdentity;
  readonly capabilities: AgentCapabilities;
  readonly configuration: AgentConfiguration;
  readonly status: AgentStatus;
  initialize(): Promise<Result<void>>;
  start(): Promise<Result<void>>;
  pause(): Promise<Result<void>>;
  resume(): Promise<Result<void>>;
  stop(): Promise<Result<void>>;
  dispose(): Promise<Result<void>>;
  execute(task: string, input?: string): Promise<Result<AgentExecutionResult>>;
}

export interface IAgentKernel extends IAgent {
  createContext(task: string, input?: string): AgentContext;
  createSession(): AgentSession;
  getStatus(): AgentStatus;
}

export interface IAgentHost {
  register(agent: IAgent): void;
  get(agentId: Identifier): IAgent | undefined;
  list(): readonly IAgent[];
}

export interface IAgentContext {
  readonly id: Identifier;
  readonly task: string;
  readonly input?: string;
  readonly session: AgentSession;
  readonly createdAt: TimestampString;
  getSession(): AgentSession;
}

export interface IAgentRegistry {
  register(agent: IAgent): void;
  get(agentId: Identifier): IAgent | undefined;
  list(): readonly IAgent[];
}

export interface IAgentLifecycle {
  getStatus(): AgentStatus;
  transition(next: AgentStatus): Result<void>;
}

export class AgentException extends Error {
  public constructor(
    message: string,
    public readonly details?: SerializableValueObject,
  ) {
    super(message);
    this.name = 'AgentException';
  }
}

export class AgentLifecycleException extends AgentException {}
export class AgentExecutionException extends AgentException {}
export class AgentContextException extends AgentException {}
export class AgentConfigurationException extends AgentException {}

export class AgentIdentity {
  public constructor(
    public readonly id: Identifier,
    public readonly name: string,
    public readonly version: string = '1.0.0',
  ) {
    if (!id.trim()) {
      throw new AgentConfigurationException('Agent identifier is required');
    }
    if (!name.trim()) {
      throw new AgentConfigurationException('Agent name is required');
    }
  }
}

export interface AgentMetadata {
  readonly identity: AgentIdentity;
  readonly description?: string;
  readonly version?: string;
  readonly capabilities?: readonly string[];
  readonly metadata?: SerializableValueObject;
}

export class AgentProfile implements AgentMetadata {
  public constructor(
    public readonly identity: AgentIdentity,
    public readonly description?: string,
    public readonly version: string = '1.0.0',
    public readonly capabilities: readonly string[] = [],
    public readonly metadata?: SerializableValueObject,
  ) {}
}

export class AgentCapabilities {
  public constructor(
    options: {
      readonly reasoning?: boolean;
      readonly planning?: boolean;
      readonly toolUsage?: boolean;
      readonly workflowExecution?: boolean;
      readonly memoryAccess?: boolean;
      readonly knowledgeLookup?: boolean;
      readonly taskDelegation?: boolean;
      readonly reflection?: boolean;
      readonly goalTracking?: boolean;
      readonly stateManagement?: boolean;
      readonly observability?: boolean;
      readonly futureCapabilities?: readonly string[];
    } = {},
  ) {
    this.reasoning = options.reasoning ?? false;
    this.planning = options.planning ?? false;
    this.toolUsage = options.toolUsage ?? false;
    this.workflowExecution = options.workflowExecution ?? false;
    this.memoryAccess = options.memoryAccess ?? false;
    this.knowledgeLookup = options.knowledgeLookup ?? false;
    this.taskDelegation = options.taskDelegation ?? false;
    this.reflection = options.reflection ?? false;
    this.goalTracking = options.goalTracking ?? false;
    this.stateManagement = options.stateManagement ?? false;
    this.observability = options.observability ?? false;
    this.futureCapabilities = Object.freeze([...(options.futureCapabilities ?? [])]);
  }

  public readonly reasoning: boolean;
  public readonly planning: boolean;
  public readonly toolUsage: boolean;
  public readonly workflowExecution: boolean;
  public readonly memoryAccess: boolean;
  public readonly knowledgeLookup: boolean;
  public readonly taskDelegation: boolean;
  public readonly reflection: boolean;
  public readonly goalTracking: boolean;
  public readonly stateManagement: boolean;
  public readonly observability: boolean;
  public readonly futureCapabilities: readonly string[];
}

export class AgentConfiguration {
  public constructor(options: {
    readonly identity: AgentIdentity;
    readonly capabilities?: AgentCapabilities;
    readonly profile?: AgentProfile;
    readonly enabled?: boolean;
    readonly metadata?: SerializableValueObject;
  }) {
    if (!options.identity?.id.trim()) {
      throw new AgentConfigurationException('Agent identity is required');
    }
    this.identity = options.identity;
    this.capabilities = options.capabilities ?? new AgentCapabilities();
    this.profile = options.profile;
    this.enabled = options.enabled ?? true;
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
    Object.freeze(this);
  }

  public readonly identity: AgentIdentity;
  public readonly capabilities: AgentCapabilities;
  public readonly profile?: AgentProfile;
  public readonly enabled: boolean;
  public readonly metadata?: Readonly<SerializableValueObject>;
}

export class AgentState {
  public constructor(
    public readonly agentId: Identifier,
    public readonly status: AgentStatus,
    public readonly details?: SerializableValueObject,
  ) {}
}

export class AgentSession {
  private static nextId = 0;

  public constructor(public readonly id: Identifier = `session-${++AgentSession.nextId}`) {}

  public getId(): Identifier {
    return this.id;
  }
}

export class AgentContext implements IAgentContext {
  public constructor(configuration: AgentConfiguration, task: string = 'default', input?: string) {
    this.id = `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.task = task;
    this.input = input;
    this.session = new AgentSession();
    this.createdAt = new Date().toISOString();
    this.configuration = configuration;
  }

  public readonly id: Identifier;
  public readonly task: string;
  public readonly input?: string;
  public readonly session: AgentSession;
  public readonly createdAt: TimestampString;
  public readonly configuration: AgentConfiguration;

  public getSession(): AgentSession {
    return this.session;
  }
}

export interface IAgentExecutionContext {
  readonly id: Identifier;
  readonly task: string;
  readonly input?: string;
  readonly session: AgentSession;
  readonly createdAt: TimestampString;
  readonly configuration?: AgentConfiguration;
  readonly memory: AgentMemoryContext;
  readonly conversation: AgentConversationContext;
  readonly knowledge: AgentKnowledgeContext;
  readonly runtime: AgentRuntimeContext;
  readonly environment: AgentEnvironmentContext;
  readonly taskContext: AgentTaskContext;
  readonly state: AgentStateContext;
  readonly observability: AgentContextObservability;
  snapshot(): AgentContextSnapshot;
}

export interface IAgentMemory {
  readonly id: Identifier;
  readonly createdAt: TimestampString;
  snapshot(): AgentContextSnapshot;
}

export interface IAgentWorkingMemory extends IAgentMemory {
  getFacts(): ReadonlyMap<string, SerializableValue>;
  setFact(key: string, value: SerializableValue): void;
  getVariable(name: string): SerializableValue | undefined;
  setVariable(name: string, value: SerializableValue): void;
  getScratchpad(): readonly string[];
  appendScratchpad(entry: string): void;
  getGoals(): readonly string[];
  setGoal(goal: string): void;
  getCurrentTask(): string | undefined;
  setCurrentTask(task: string): void;
  getExecutionMetadata(): Readonly<SerializableValueObject>;
  setExecutionMetadata(key: string, value: SerializableValue): void;
}

export interface IAgentConversationMemory extends IAgentMemory {
  readonly messages: readonly AgentConversationMessage[];
  appendMessage(role: string, content: string): void;
  getMessages(): readonly AgentConversationMessage[];
  getSummaries(): readonly string[];
  appendSummary(summary: string): void;
}

export interface IAgentKnowledgeMemory extends IAgentMemory {
  readonly knowledgeReferences: readonly string[];
  readonly retrievedDocuments: readonly string[];
  readonly evidence: readonly string[];
  attachReference(reference: string): void;
  attachRetrievedDocument(document: string): void;
  attachEvidence(evidence: string): void;
  setConfidence(confidence: number): void;
}

export interface IAgentContextBuilder {
  withWorkingMemory(memory: IAgentWorkingMemory): IAgentContextBuilder;
  withConversationContext(context: IAgentConversationMemory): IAgentContextBuilder;
  withKnowledgeContext(context: IAgentKnowledgeMemory): IAgentContextBuilder;
  withRuntimeContext(context: AgentRuntimeContext): IAgentContextBuilder;
  withEnvironmentContext(context: AgentEnvironmentContext): IAgentContextBuilder;
  withTaskContext(context: AgentTaskContext): IAgentContextBuilder;
  withStateContext(context: AgentStateContext): IAgentContextBuilder;
  withMemoryContext(context: AgentMemoryContext): IAgentContextBuilder;
  withConfiguration(configuration: AgentConfiguration): IAgentContextBuilder;
  build(): AgentExecutionContext;
}

export class AgentMemoryException extends AgentException {}
export class AgentContextBuilderException extends AgentException {}
export class ConversationMemoryException extends AgentException {}
export class KnowledgeMemoryException extends AgentException {}

export class AgentConversationMessage {
  public constructor(
    public readonly role: string,
    public readonly content: string,
    public readonly createdAt: TimestampString = new Date().toISOString(),
  ) {}
}

export class AgentWorkingMemory implements IAgentWorkingMemory {
  public readonly id: Identifier;
  public readonly createdAt: TimestampString;
  private readonly facts = new Map<string, SerializableValue>();
  private readonly variables = new Map<string, SerializableValue>();
  private readonly scratchpad: string[] = [];
  private readonly goals: string[] = [];
  private currentTask?: string;
  private readonly executionMetadata: Record<string, SerializableValue> = {};

  public constructor(id: Identifier = `memory-${Date.now()}`) {
    this.id = id;
    this.createdAt = new Date().toISOString();
  }

  public getFacts(): ReadonlyMap<string, SerializableValue> {
    return new Map(this.facts);
  }

  public setFact(key: string, value: SerializableValue): void {
    if (!key.trim()) {
      throw new AgentMemoryException('Fact key is required');
    }
    this.facts.set(key, value);
  }

  public getVariable(name: string): SerializableValue | undefined {
    return this.variables.get(name);
  }

  public setVariable(name: string, value: SerializableValue): void {
    if (!name.trim()) {
      throw new AgentMemoryException('Variable name is required');
    }
    this.variables.set(name, value);
  }

  public getScratchpad(): readonly string[] {
    return [...this.scratchpad];
  }

  public appendScratchpad(entry: string): void {
    if (!entry.trim()) {
      throw new AgentMemoryException('Scratchpad entry is required');
    }
    this.scratchpad.push(entry);
  }

  public getGoals(): readonly string[] {
    return [...this.goals];
  }

  public setGoal(goal: string): void {
    if (!goal.trim()) {
      throw new AgentMemoryException('Goal is required');
    }
    this.goals.push(goal);
  }

  public getCurrentTask(): string | undefined {
    return this.currentTask;
  }

  public setCurrentTask(task: string): void {
    if (!task.trim()) {
      throw new AgentMemoryException('Task is required');
    }
    this.currentTask = task;
  }

  public getExecutionMetadata(): Readonly<SerializableValueObject> {
    return { ...this.executionMetadata };
  }

  public setExecutionMetadata(key: string, value: SerializableValue): void {
    if (!key.trim()) {
      throw new AgentMemoryException('Execution metadata key is required');
    }
    this.executionMetadata[key] = value;
  }

  public snapshot(): AgentContextSnapshot {
    return this.createSnapshot();
  }

  public createSnapshot(): AgentContextSnapshot {
    return new AgentContextSnapshot({
      facts: new Map(this.facts),
      variables: new Map(this.variables),
      scratchpad: [...this.scratchpad],
      goals: [...this.goals],
      currentTask: this.currentTask,
      executionMetadata: { ...this.executionMetadata },
    });
  }
}

export class AgentConversationContext implements IAgentConversationMemory {
  public readonly id: Identifier;
  public readonly createdAt: TimestampString;
  public readonly messages: AgentConversationMessage[] = [];
  private readonly summaries: string[] = [];

  public constructor(id: Identifier = `conversation-${Date.now()}`) {
    this.id = id;
    this.createdAt = new Date().toISOString();
  }

  public appendMessage(role: string, content: string): void {
    if (!role.trim() || !content.trim()) {
      throw new ConversationMemoryException('Message role and content are required');
    }
    this.messages.push(new AgentConversationMessage(role, content));
  }

  public getMessages(): readonly AgentConversationMessage[] {
    return [...this.messages];
  }

  public getSummaries(): readonly string[] {
    return [...this.summaries];
  }

  public appendSummary(summary: string): void {
    if (!summary.trim()) {
      throw new ConversationMemoryException('Conversation summary is required');
    }
    this.summaries.push(summary);
  }

  public snapshot(): AgentContextSnapshot {
    return new AgentContextSnapshot({
      messages: [...this.messages],
      summaries: [...this.summaries],
    });
  }
}

export class AgentKnowledgeContext implements IAgentKnowledgeMemory {
  public readonly id: Identifier;
  public readonly createdAt: TimestampString;
  public readonly knowledgeReferences: string[] = [];
  public readonly retrievedDocuments: string[] = [];
  public readonly evidence: string[] = [];
  private confidence = 0;

  public constructor(id: Identifier = `knowledge-${Date.now()}`) {
    this.id = id;
    this.createdAt = new Date().toISOString();
  }

  public attachReference(reference: string): void {
    if (!reference.trim()) {
      throw new KnowledgeMemoryException('Knowledge reference is required');
    }
    this.knowledgeReferences.push(reference);
  }

  public attachRetrievedDocument(document: string): void {
    if (!document.trim()) {
      throw new KnowledgeMemoryException('Retrieved document reference is required');
    }
    this.retrievedDocuments.push(document);
  }

  public attachEvidence(evidence: string): void {
    if (!evidence.trim()) {
      throw new KnowledgeMemoryException('Evidence is required');
    }
    this.evidence.push(evidence);
  }

  public setConfidence(confidence: number): void {
    if (confidence < 0 || confidence > 1) {
      throw new KnowledgeMemoryException('Confidence must be between 0 and 1');
    }
    this.confidence = confidence;
  }

  public snapshot(): AgentContextSnapshot {
    return new AgentContextSnapshot({
      knowledgeReferences: [...this.knowledgeReferences],
      retrievedDocuments: [...this.retrievedDocuments],
      evidence: [...this.evidence],
      confidence: this.confidence,
    });
  }
}

export class AgentRuntimeContext {
  public constructor(
    public readonly workflowId: string,
    public readonly model: string,
    public readonly provider: string,
    public readonly executionId: Identifier = `exec-${Date.now()}`,
    public readonly correlationId: Identifier = `corr-${Date.now()}`,
    public readonly tenant?: string,
    public readonly environment?: string,
    public readonly securityContext?: SerializableValueObject,
  ) {}
}

export class AgentEnvironmentContext {
  public constructor(
    public readonly environment: string = 'development',
    public readonly region: string = 'local',
  ) {}
}

export class AgentTaskContext {
  public constructor(
    public readonly task: string,
    public readonly description?: string,
  ) {
    if (!task.trim()) {
      throw new AgentContextException('Task is required');
    }
  }
}

export class AgentStateContext {
  private readonly values = new Map<string, SerializableValue>();

  public setValue(key: string, value: SerializableValue): void {
    if (!key.trim()) {
      throw new AgentContextException('State key is required');
    }
    this.values.set(key, value);
  }

  public getValue(key: string): SerializableValue | undefined {
    return this.values.get(key);
  }

  public snapshot(): AgentContextSnapshot {
    return new AgentContextSnapshot({ state: new Map(this.values) });
  }
}

export class AgentMemoryContext {
  public constructor(
    public workingMemory: AgentWorkingMemory = new AgentWorkingMemory(),
    public conversationContext: AgentConversationContext = new AgentConversationContext(),
    public knowledgeContext: AgentKnowledgeContext = new AgentKnowledgeContext(),
  ) {}

  public snapshot(): AgentContextSnapshot {
    return new AgentContextSnapshot({
      facts: this.workingMemory.getFacts(),
      messages: this.conversationContext.getMessages(),
      knowledgeReferences: this.knowledgeContext.knowledgeReferences,
    });
  }
}

export class AgentContextObservability {
  public constructor(
    public readonly contextSize: number = 0,
    public readonly memoryUsage: number = 0,
    public readonly conversationLength: number = 0,
    public readonly knowledgeReferences: number = 0,
    public readonly snapshotCount: number = 0,
    public readonly contextCreationLatency: number = 0,
  ) {}
}

export class AgentContextSnapshot {
  public constructor(
    options: {
      readonly facts?: ReadonlyMap<string, SerializableValue>;
      readonly variables?: ReadonlyMap<string, SerializableValue>;
      readonly scratchpad?: readonly string[];
      readonly goals?: readonly string[];
      readonly currentTask?: string;
      readonly executionMetadata?: Readonly<SerializableValueObject>;
      readonly messages?: readonly AgentConversationMessage[];
      readonly summaries?: readonly string[];
      readonly knowledgeReferences?: readonly string[];
      readonly retrievedDocuments?: readonly string[];
      readonly evidence?: readonly string[];
      readonly confidence?: number;
      readonly state?: ReadonlyMap<string, SerializableValue>;
      readonly createdAt?: TimestampString;
    } = {},
  ) {
    this.facts = new Map(options.facts ?? []);
    this.variables = new Map(options.variables ?? []);
    this.scratchpad = [...(options.scratchpad ?? [])];
    this.goals = [...(options.goals ?? [])];
    this.currentTask = options.currentTask;
    this.executionMetadata = options.executionMetadata ? { ...options.executionMetadata } : {};
    this.messages = [...(options.messages ?? [])];
    this.summaries = [...(options.summaries ?? [])];
    this.knowledgeReferences = [...(options.knowledgeReferences ?? [])];
    this.retrievedDocuments = [...(options.retrievedDocuments ?? [])];
    this.evidence = [...(options.evidence ?? [])];
    this.confidence = options.confidence ?? 0;
    this.state = new Map(options.state ?? []);
    this.createdAt = options.createdAt ?? new Date().toISOString();
    Object.freeze(this);
  }

  public readonly facts: ReadonlyMap<string, SerializableValue>;
  public readonly variables: ReadonlyMap<string, SerializableValue>;
  public readonly scratchpad: readonly string[];
  public readonly goals: readonly string[];
  public readonly currentTask?: string;
  public readonly executionMetadata: Readonly<SerializableValueObject>;
  public readonly messages: readonly AgentConversationMessage[];
  public readonly summaries: readonly string[];
  public readonly knowledgeReferences: readonly string[];
  public readonly retrievedDocuments: readonly string[];
  public readonly evidence: readonly string[];
  public readonly confidence: number;
  public readonly state: ReadonlyMap<string, SerializableValue>;
  public readonly createdAt: TimestampString;
}

export class AgentExecutionContext implements IAgentExecutionContext {
  public constructor(options: {
    readonly id: Identifier;
    readonly task: string;
    readonly input?: string;
    readonly session: AgentSession;
    readonly createdAt?: TimestampString;
    readonly configuration?: AgentConfiguration;
    readonly memory?: AgentMemoryContext;
    readonly conversation?: AgentConversationContext;
    readonly knowledge?: AgentKnowledgeContext;
    readonly runtime?: AgentRuntimeContext;
    readonly environment?: AgentEnvironmentContext;
    readonly taskContext?: AgentTaskContext;
    readonly state?: AgentStateContext;
    readonly observability?: AgentContextObservability;
  }) {
    this.id = options.id;
    this.task = options.task;
    this.input = options.input;
    this.session = options.session;
    this.createdAt = options.createdAt ?? new Date().toISOString();
    this.configuration = options.configuration;
    this.memory = options.memory ?? new AgentMemoryContext();
    this.conversation = options.conversation ?? new AgentConversationContext();
    this.knowledge = options.knowledge ?? new AgentKnowledgeContext();
    this.runtime =
      options.runtime ?? new AgentRuntimeContext('default', 'default-model', 'default-provider');
    this.environment = options.environment ?? new AgentEnvironmentContext();
    this.taskContext = options.taskContext ?? new AgentTaskContext(this.task);
    this.state = options.state ?? new AgentStateContext();
    this.observability = options.observability ?? new AgentContextObservability();
  }

  public readonly id: Identifier;
  public readonly task: string;
  public readonly input?: string;
  public readonly session: AgentSession;
  public readonly createdAt: TimestampString;
  public readonly configuration?: AgentConfiguration;
  public readonly memory: AgentMemoryContext;
  public readonly conversation: AgentConversationContext;
  public readonly knowledge: AgentKnowledgeContext;
  public readonly runtime: AgentRuntimeContext;
  public readonly environment: AgentEnvironmentContext;
  public readonly taskContext: AgentTaskContext;
  public readonly state: AgentStateContext;
  public readonly observability: AgentContextObservability;

  public snapshot(): AgentContextSnapshot {
    return new AgentContextSnapshot({
      facts: this.memory.workingMemory.getFacts(),
      variables: this.memory.workingMemory.getFacts(),
      scratchpad: this.memory.workingMemory.getScratchpad(),
      goals: this.memory.workingMemory.getGoals(),
      currentTask: this.memory.workingMemory.getCurrentTask(),
      executionMetadata: this.memory.workingMemory.getExecutionMetadata(),
      messages: this.conversation.getMessages(),
      summaries: this.conversation.getSummaries(),
      knowledgeReferences: this.knowledge.knowledgeReferences,
      retrievedDocuments: this.knowledge.retrievedDocuments,
      evidence: this.knowledge.evidence,
      confidence: 0,
      state: new Map<string, SerializableValue>(),
      createdAt: this.createdAt,
    });
  }
}

export class AgentContextBuilder implements IAgentContextBuilder {
  private workingMemory?: IAgentWorkingMemory;
  private conversationContext?: IAgentConversationMemory;
  private knowledgeContext?: IAgentKnowledgeMemory;
  private runtimeContext?: AgentRuntimeContext;
  private environmentContext?: AgentEnvironmentContext;
  private taskContext?: AgentTaskContext;
  private stateContext?: AgentStateContext;
  private memoryContext?: AgentMemoryContext;
  private configuration?: AgentConfiguration;

  public constructor(private readonly task: string) {}

  public withWorkingMemory(memory: IAgentWorkingMemory): IAgentContextBuilder {
    this.workingMemory = memory;
    return this;
  }

  public withConversationContext(context: IAgentConversationMemory): IAgentContextBuilder {
    this.conversationContext = context;
    return this;
  }

  public withKnowledgeContext(context: IAgentKnowledgeMemory): IAgentContextBuilder {
    this.knowledgeContext = context;
    return this;
  }

  public withRuntimeContext(context: AgentRuntimeContext): IAgentContextBuilder {
    this.runtimeContext = context;
    return this;
  }

  public withEnvironmentContext(context: AgentEnvironmentContext): IAgentContextBuilder {
    this.environmentContext = context;
    return this;
  }

  public withTaskContext(context: AgentTaskContext): IAgentContextBuilder {
    this.taskContext = context;
    return this;
  }

  public withStateContext(context: AgentStateContext): IAgentContextBuilder {
    this.stateContext = context;
    return this;
  }

  public withMemoryContext(context: AgentMemoryContext): IAgentContextBuilder {
    this.memoryContext = context;
    return this;
  }

  public withConfiguration(configuration: AgentConfiguration): IAgentContextBuilder {
    this.configuration = configuration;
    return this;
  }

  public build(): AgentExecutionContext {
    if (!this.task.trim()) {
      throw new AgentContextBuilderException('Context task is required');
    }

    const memoryContext = this.memoryContext ?? new AgentMemoryContext();
    if (this.workingMemory) {
      memoryContext.workingMemory = this.workingMemory as AgentWorkingMemory;
      memoryContext.workingMemory.setFact('__builder__', this.task);
    }

    const conversation =
      this.conversationContext instanceof AgentConversationContext
        ? this.conversationContext
        : new AgentConversationContext();
    const knowledge =
      this.knowledgeContext instanceof AgentKnowledgeContext
        ? this.knowledgeContext
        : new AgentKnowledgeContext();
    const runtime =
      this.runtimeContext ??
      new AgentRuntimeContext(this.task, 'default-model', 'default-provider');
    const environment = this.environmentContext ?? new AgentEnvironmentContext();
    const taskContext = this.taskContext ?? new AgentTaskContext(this.task);
    const state = this.stateContext ?? new AgentStateContext();

    return new AgentExecutionContext({
      id: `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      task: this.task,
      session: new AgentSession(),
      configuration: this.configuration,
      memory: memoryContext,
      conversation,
      knowledge,
      runtime,
      environment,
      taskContext,
      state,
      observability: new AgentContextObservability(
        0,
        0,
        conversation.getMessages().length,
        knowledge.knowledgeReferences.length,
        1,
        0,
      ),
    });
  }
}

export class AgentExecution {
  public constructor(options: {
    readonly id: Identifier;
    readonly task: string;
    readonly context: AgentContext;
    readonly startedAt?: TimestampString;
    readonly completedAt?: TimestampString;
    readonly metadata?: SerializableValueObject;
  }) {
    this.id = options.id;
    this.task = options.task;
    this.context = options.context;
    this.startedAt = options.startedAt ?? new Date().toISOString();
    this.completedAt = options.completedAt;
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }

  public readonly id: Identifier;
  public readonly task: string;
  public readonly context: AgentContext;
  public readonly startedAt: TimestampString;
  public readonly completedAt?: TimestampString;
  public readonly metadata?: Readonly<SerializableValueObject>;

  public getTask(): string {
    return this.task;
  }

  public getContext(): AgentContext {
    return this.context;
  }
}

export class AgentExecutionResult {
  public constructor(
    public readonly status: AgentStatus,
    public readonly output?: SerializableValueObject,
    public readonly error?: string,
  ) {}
}

export class AgentLifecycle implements IAgentLifecycle {
  private status: AgentStatus = AgentStatus.Created;

  public getStatus(): AgentStatus {
    return this.status;
  }

  public transition(next: AgentStatus): Result<void> {
    this.status = next;
    return { succeeded: true, data: undefined };
  }
}

export class AgentKernel implements IAgentKernel {
  public status: AgentStatus = AgentStatus.Created;
  private readonly sessions: AgentSession[] = [];
  private readonly lifecycle = new AgentLifecycle();

  public constructor(public readonly configuration: AgentConfiguration) {}

  public readonly id: Identifier = this.configuration.identity.id;

  public getId(): Identifier {
    return this.configuration.identity.id;
  }

  public getStatus(): AgentStatus {
    return this.status;
  }

  public async initialize(): Promise<Result<void>> {
    this.status = AgentStatus.Initialized;
    this.lifecycle.transition(AgentStatus.Initialized);
    return { succeeded: true, data: undefined };
  }

  public async start(): Promise<Result<void>> {
    if (this.status === AgentStatus.Disposed) {
      throw new AgentLifecycleException('Agent is disposed');
    }
    this.status = AgentStatus.Running;
    this.lifecycle.transition(AgentStatus.Running);
    return { succeeded: true, data: undefined };
  }

  public async pause(): Promise<Result<void>> {
    this.status = AgentStatus.Paused;
    this.lifecycle.transition(AgentStatus.Paused);
    return { succeeded: true, data: undefined };
  }

  public async resume(): Promise<Result<void>> {
    this.status = AgentStatus.Running;
    this.lifecycle.transition(AgentStatus.Running);
    return { succeeded: true, data: undefined };
  }

  public async stop(): Promise<Result<void>> {
    this.status = AgentStatus.Stopped;
    this.lifecycle.transition(AgentStatus.Stopped);
    return { succeeded: true, data: undefined };
  }

  public async dispose(): Promise<Result<void>> {
    this.status = AgentStatus.Disposed;
    this.lifecycle.transition(AgentStatus.Disposed);
    return { succeeded: true, data: undefined };
  }

  public async execute(task: string, input?: string): Promise<Result<AgentExecutionResult>> {
    this.createContext(task, input);
    this.status = AgentStatus.Executing;
    this.lifecycle.transition(AgentStatus.Executing);
    const result = new AgentExecutionResult(AgentStatus.Completed, { task, status: 'completed' });
    this.status = AgentStatus.Completed;
    this.lifecycle.transition(AgentStatus.Completed);
    return { succeeded: true, data: result };
  }

  public createContext(task: string, input?: string): AgentContext {
    const context = new AgentContext(this.configuration, task, input);
    this.sessions.push(context.getSession());
    return context;
  }

  public createSession(): AgentSession {
    const session = new AgentSession();
    this.sessions.push(session);
    return session;
  }

  public getState(): AgentState {
    return new AgentState(this.getId(), this.status);
  }

  public getLifecycle(): AgentLifecycle {
    return this.lifecycle;
  }

  public readonly identity: AgentIdentity = this.configuration.identity;
  public readonly capabilities: AgentCapabilities = this.configuration.capabilities;
  public readonly statusValue: AgentStatus = this.status;
  public readonly metadata: AgentProfile | undefined = this.configuration.profile;

  public getContext(): Context {
    return {
      request: {
        requestId: this.getId(),
        correlationId: this.getId(),
      },
      execution: {
        executionId: this.getId(),
        timestamp: new Date().toISOString(),
      },
    };
  }
}

export class AgentHost implements IAgentHost {
  private readonly agents = new Map<Identifier, IAgent>();

  public register(agent: IAgent): void {
    this.agents.set(agent.id, agent);
  }

  public get(agentId: Identifier): IAgent | undefined {
    return this.agents.get(agentId);
  }

  public list(): readonly IAgent[] {
    return [...this.agents.values()];
  }
}

export class AgentRegistry implements IAgentRegistry {
  private readonly agents = new Map<Identifier, IAgent>();

  public register(agent: IAgent): void {
    this.agents.set(agent.id, agent);
  }

  public get(agentId: Identifier): IAgent | undefined {
    return this.agents.get(agentId);
  }

  public list(): readonly IAgent[] {
    return [...this.agents.values()];
  }
}

export class AgentDescriptor {
  public constructor(
    public readonly identity: AgentIdentity,
    public readonly capabilities: AgentCapabilities,
    public readonly configuration: AgentConfiguration,
  ) {}
}

export class AgentSnapshot {
  public constructor(
    public readonly id: Identifier,
    public readonly status: AgentStatus,
    public readonly metadata?: SerializableValueObject,
  ) {}
}

export { AgentConfiguration as AgentConfig };
export * from './tool-framework';
export * from './collaboration';
export * from './planning';
export * from './reflection';
export * from './governance';
