import type {
  Identifier,
  Result,
  SerializableValue,
  SerializableValueObject,
  TimestampString,
} from '@infrashield/contracts';

export interface IAgentDirectory {
  register(entry: AgentDirectoryEntry): void;
  get(agentId: Identifier): AgentDirectoryEntry | undefined;
  list(): readonly AgentDirectoryEntry[];
  search(options?: AgentDiscoveryOptions): readonly AgentDirectoryEntry[];
}

export interface IAgentDiscovery {
  discover(options?: AgentDiscoveryOptions): readonly AgentDirectoryEntry[];
}

export interface IAgentCoordinator {
  delegate(request: AgentDelegationRequest): Promise<Result<AgentDelegationResponse>>;
  cancel(taskId: Identifier): Promise<Result<void>>;
}

export interface IAgentDelegation {
  delegate(request: AgentDelegationRequest): Promise<Result<AgentDelegationResponse>>;
}

export interface IAgentMessaging {
  send(message: AgentMessage): Promise<Result<void>>;
  publish(broadcast: AgentBroadcast): Promise<Result<void>>;
}

export interface IAgentConversation {
  append(message: AgentConversation): void;
  list(): readonly AgentConversation[];
}

export interface IAgentNegotiation {
  propose(input: AgentNegotiationInput): Promise<Result<AgentNegotiationOutcome>>;
}

export interface IAgentConsensus {
  evaluate(votes: readonly AgentVoting[]): Promise<Result<AgentConsensusOutcome>>;
}

export interface AgentDirectoryEntry {
  readonly id: Identifier;
  readonly name: string;
  readonly role?: string;
  readonly version?: string;
  readonly tenant?: string;
  readonly capabilities?: readonly string[];
  readonly tags?: readonly string[];
  readonly available?: boolean;
  readonly health?: string;
  readonly trust?: number;
}

export interface AgentDiscoveryOptions {
  readonly capability?: string;
  readonly role?: string;
  readonly tags?: readonly string[];
  readonly tenant?: string;
  readonly available?: boolean;
  readonly health?: string;
  readonly version?: string;
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

export class AgentDiscoveryException extends AgentException {}
export class AgentDelegationException extends AgentException {}
export class AgentMessagingException extends AgentException {}
export class AgentNegotiationException extends AgentException {}
export class AgentConsensusException extends AgentException {}

export class AgentCapabilityDescriptor {
  public constructor(options: {
    readonly id: Identifier;
    readonly name: string;
    readonly category?: string;
    readonly tags?: readonly string[];
    readonly version?: string;
  }) {
    this.id = options.id;
    this.name = options.name;
    this.category = options.category;
    this.tags = [...(options.tags ?? [])];
    this.version = options.version ?? '1.0.0';
  }

  public readonly id: Identifier;
  public readonly name: string;
  public readonly category?: string;
  public readonly tags: readonly string[];
  public readonly version: string;
}

export class AgentCapabilityCatalog {
  private readonly capabilities = new Map<Identifier, AgentCapabilityDescriptor>();

  public register(descriptor: AgentCapabilityDescriptor): void {
    this.capabilities.set(descriptor.id, descriptor);
  }

  public get(id: Identifier): AgentCapabilityDescriptor | undefined {
    return this.capabilities.get(id);
  }

  public list(): readonly AgentCapabilityDescriptor[] {
    return [...this.capabilities.values()];
  }
}

export class AgentDirectory implements IAgentDirectory {
  private readonly entries = new Map<Identifier, AgentDirectoryEntry>();

  public register(entry: AgentDirectoryEntry): void {
    this.entries.set(entry.id, entry);
  }

  public get(agentId: Identifier): AgentDirectoryEntry | undefined {
    return this.entries.get(agentId);
  }

  public list(): readonly AgentDirectoryEntry[] {
    return [...this.entries.values()];
  }

  public search(options: AgentDiscoveryOptions = {}): readonly AgentDirectoryEntry[] {
    return this.list().filter((entry) => {
      const capabilityMatches =
        !options.capability || entry.capabilities?.includes(options.capability);
      const roleMatches = !options.role || entry.role === options.role;
      const tagsMatches = !options.tags || options.tags.every((tag) => entry.tags?.includes(tag));
      const tenantMatches = !options.tenant || entry.tenant === options.tenant;
      const availabilityMatches =
        options.available === undefined || entry.available === options.available;
      const healthMatches = !options.health || entry.health === options.health;
      const versionMatches = !options.version || entry.version === options.version;
      return (
        capabilityMatches &&
        roleMatches &&
        tagsMatches &&
        tenantMatches &&
        availabilityMatches &&
        healthMatches &&
        versionMatches
      );
    });
  }
}

export class AgentDiscoveryService implements IAgentDiscovery {
  public constructor(private readonly directory: IAgentDirectory) {}

  public discover(options: AgentDiscoveryOptions = {}): readonly AgentDirectoryEntry[] {
    return this.directory.search(options);
  }
}

export class AgentRegistry {
  private readonly entries = new Map<Identifier, AgentDirectoryEntry>();

  public register(entry: AgentDirectoryEntry): void {
    this.entries.set(entry.id, entry);
  }

  public get(agentId: Identifier): AgentDirectoryEntry | undefined {
    return this.entries.get(agentId);
  }

  public list(): readonly AgentDirectoryEntry[] {
    return [...this.entries.values()];
  }
}

export class AgentTask {
  public constructor(options: {
    readonly id: Identifier;
    readonly type: string;
    readonly payload?: SerializableValueObject;
    readonly metadata?: SerializableValueObject;
  }) {
    this.id = options.id;
    this.type = options.type;
    this.payload = options.payload;
    this.metadata = options.metadata;
  }

  public readonly id: Identifier;
  public readonly type: string;
  public readonly payload?: SerializableValueObject;
  public readonly metadata?: SerializableValueObject;
}

export class AgentTaskAssignment {
  public constructor(options: {
    readonly taskId: Identifier;
    readonly agentId: Identifier;
    readonly priority?: number;
  }) {
    this.taskId = options.taskId;
    this.agentId = options.agentId;
    this.priority = options.priority ?? 0;
  }

  public readonly taskId: Identifier;
  public readonly agentId: Identifier;
  public readonly priority: number;
}

export class AgentTaskQueue {
  private readonly items: AgentTask[] = [];

  public enqueue(task: AgentTask): void {
    this.items.push(task);
  }

  public dequeue(): AgentTask | undefined {
    return this.items.shift();
  }

  public peek(): AgentTask | undefined {
    return this.items[0];
  }

  public size(): number {
    return this.items.length;
  }
}

export class AgentTaskResult {
  public constructor(options: {
    readonly taskId: Identifier;
    readonly status: string;
    readonly output?: SerializableValue;
    readonly error?: string;
  }) {
    this.taskId = options.taskId;
    this.status = options.status;
    this.output = options.output;
    this.error = options.error;
  }

  public readonly taskId: Identifier;
  public readonly status: string;
  public readonly output?: SerializableValue;
  public readonly error?: string;
}

export class AgentDelegationRequest {
  public constructor(options: {
    readonly task: AgentTask;
    readonly assignment: AgentTaskAssignment;
    readonly deadlineMs?: number;
    readonly retryCount?: number;
    readonly metadata?: SerializableValueObject;
  }) {
    this.task = options.task;
    this.assignment = options.assignment;
    this.deadlineMs = options.deadlineMs ?? 1000;
    this.retryCount = options.retryCount ?? 0;
    this.metadata = options.metadata;
  }

  public readonly task: AgentTask;
  public readonly assignment: AgentTaskAssignment;
  public readonly deadlineMs: number;
  public readonly retryCount: number;
  public readonly metadata?: SerializableValueObject;
}

export class AgentDelegationResponse {
  public constructor(options: {
    readonly status: string;
    readonly taskId: Identifier;
    readonly agentId: Identifier;
    readonly message?: string;
    readonly result?: AgentTaskResult;
  }) {
    this.status = options.status;
    this.taskId = options.taskId;
    this.agentId = options.agentId;
    this.message = options.message;
    this.result = options.result;
  }

  public readonly status: string;
  public readonly taskId: Identifier;
  public readonly agentId: Identifier;
  public readonly message?: string;
  public readonly result?: AgentTaskResult;
}

export class AgentCoordinator implements IAgentCoordinator, IAgentDelegation {
  public async delegate(request: AgentDelegationRequest): Promise<Result<AgentDelegationResponse>> {
    return {
      succeeded: true,
      data: new AgentDelegationResponse({
        status: 'accepted',
        taskId: request.task.id,
        agentId: request.assignment.agentId,
        message: 'Delegation accepted',
      }),
    };
  }

  public async cancel(_taskId: Identifier): Promise<Result<void>> {
    return { succeeded: true, data: undefined };
  }
}

export class AgentConversation {
  public constructor(options: {
    readonly role: string;
    readonly content: string;
    readonly timestamp?: TimestampString;
  }) {
    this.role = options.role;
    this.content = options.content;
    this.timestamp = options.timestamp ?? new Date().toISOString();
  }

  public readonly role: string;
  public readonly content: string;
  public readonly timestamp: TimestampString;
}

export class AgentConversationHistory implements IAgentConversation {
  private readonly entries: AgentConversation[] = [];

  public append(message: AgentConversation): void {
    this.entries.push(message);
  }

  public list(): readonly AgentConversation[] {
    return [...this.entries];
  }
}

export class AgentMessage {
  public constructor(options: {
    readonly id: Identifier;
    readonly from: Identifier;
    readonly to: Identifier;
    readonly type: string;
    readonly payload?: SerializableValueObject;
    readonly timestamp?: TimestampString;
    readonly priority?: number;
  }) {
    this.id = options.id;
    this.from = options.from;
    this.to = options.to;
    this.type = options.type;
    this.payload = options.payload;
    this.timestamp = options.timestamp ?? new Date().toISOString();
    this.priority = options.priority ?? 0;
  }

  public readonly id: Identifier;
  public readonly from: Identifier;
  public readonly to: Identifier;
  public readonly type: string;
  public readonly payload?: SerializableValueObject;
  public readonly timestamp: TimestampString;
  public readonly priority: number;
}

export class AgentMailbox implements IAgentMessaging {
  private readonly messages = new Map<Identifier, AgentMessage>();

  public async send(message: AgentMessage): Promise<Result<void>> {
    this.messages.set(message.id, message);
    return { succeeded: true, data: undefined };
  }

  public async publish(broadcast: AgentBroadcast): Promise<Result<void>> {
    this.messages.set(broadcast.id, broadcast as unknown as AgentMessage);
    return { succeeded: true, data: undefined };
  }

  public get(id: Identifier): AgentMessage | undefined {
    return this.messages.get(id);
  }
}

export class AgentBroadcast {
  public constructor(options: {
    readonly id?: Identifier;
    readonly channelId: Identifier;
    readonly payload?: SerializableValueObject;
    readonly timestamp?: TimestampString;
  }) {
    this.id = options.id ?? `broadcast-${Date.now()}`;
    this.channelId = options.channelId;
    this.payload = options.payload;
    this.timestamp = options.timestamp ?? new Date().toISOString();
  }

  public readonly id: Identifier;
  public readonly channelId: Identifier;
  public readonly payload?: SerializableValueObject;
  public readonly timestamp: TimestampString;
}

export class AgentSubscription {
  public constructor(options: {
    readonly channelId: Identifier;
    readonly subscriberId: Identifier;
  }) {
    this.channelId = options.channelId;
    this.subscriberId = options.subscriberId;
  }

  public readonly channelId: Identifier;
  public readonly subscriberId: Identifier;
}

export class AgentChannel {
  public constructor(
    public readonly id: Identifier,
    public readonly subscriptions: AgentSubscription[] = [],
  ) {}

  public subscribe(subscription: AgentSubscription): void {
    this.subscriptions.push(subscription);
  }
}

export class AgentSharedContext {
  public constructor(options: {
    readonly id: Identifier;
    readonly tenant?: string;
    readonly metadata?: SerializableValueObject;
  }) {
    this.id = options.id;
    this.tenant = options.tenant;
    this.metadata = options.metadata;
    this.references = [];
  }

  public readonly id: Identifier;
  public readonly tenant?: string;
  public readonly metadata?: SerializableValueObject;
  public readonly references: AgentSharedMemoryReference[];

  public attachReference(reference: AgentSharedMemoryReference): void {
    this.references.push(reference);
  }
}

export class AgentSharedMemoryReference {
  public constructor(options: {
    readonly id: Identifier;
    readonly uri: string;
    readonly tenant?: string;
  }) {
    this.id = options.id;
    this.uri = options.uri;
    this.tenant = options.tenant;
  }

  public readonly id: Identifier;
  public readonly uri: string;
  public readonly tenant?: string;
}

export class AgentNegotiationInput {
  public constructor(options: {
    readonly capability: string;
    readonly resource: string;
    readonly priority: number;
    readonly conflict?: string;
  }) {
    this.capability = options.capability;
    this.resource = options.resource;
    this.priority = options.priority;
    this.conflict = options.conflict;
  }

  public readonly capability: string;
  public readonly resource: string;
  public readonly priority: number;
  public readonly conflict?: string;
}

export class AgentNegotiationOutcome {
  public constructor(options: {
    readonly accepted: boolean;
    readonly reason: string;
    readonly proposalId?: Identifier;
  }) {
    this.accepted = options.accepted;
    this.reason = options.reason;
    this.proposalId = options.proposalId;
  }

  public readonly accepted: boolean;
  public readonly reason: string;
  public readonly proposalId?: Identifier;
}

export class AgentNegotiation implements IAgentNegotiation {
  public async propose(input: AgentNegotiationInput): Promise<Result<AgentNegotiationOutcome>> {
    return {
      succeeded: true,
      data: new AgentNegotiationOutcome({
        accepted: true,
        reason: 'Negotiation accepted',
        proposalId: input.capability,
      }),
    };
  }
}

export class AgentVoting {
  public constructor(options: {
    readonly voterId: Identifier;
    readonly value: number;
    readonly weight?: number;
  }) {
    this.voterId = options.voterId;
    this.value = options.value;
    this.weight = options.weight ?? 1;
  }

  public readonly voterId: Identifier;
  public readonly value: number;
  public readonly weight: number;
}

export class AgentConsensusOutcome {
  public constructor(options: {
    readonly decision: string;
    readonly score?: number;
    readonly reason?: string;
  }) {
    this.decision = options.decision;
    this.score = options.score;
    this.reason = options.reason;
  }

  public readonly decision: string;
  public readonly score?: number;
  public readonly reason?: string;
}

export class AgentConsensus implements IAgentConsensus {
  public async evaluate(votes: readonly AgentVoting[]): Promise<Result<AgentConsensusOutcome>> {
    const totalWeight = votes.reduce((sum, vote) => sum + vote.weight, 0);
    const weighted = votes.reduce((sum, vote) => sum + vote.value * vote.weight, 0);
    const decision = weighted >= totalWeight / 2 ? 'accept' : 'reject';
    return {
      succeeded: true,
      data: new AgentConsensusOutcome({
        decision,
        score: weighted / Math.max(totalWeight, 1),
        reason: 'Weighted consensus',
      }),
    };
  }
}

export class AgentPresence {
  public constructor(options: {
    readonly agentId: Identifier;
    readonly status: string;
    readonly timestamp?: TimestampString;
  }) {
    this.agentId = options.agentId;
    this.status = options.status;
    this.timestamp = options.timestamp ?? new Date().toISOString();
  }

  public readonly agentId: Identifier;
  public readonly status: string;
  public readonly timestamp: TimestampString;
}

export class AgentHeartbeat {
  public constructor(options: {
    readonly agentId: Identifier;
    readonly timestamp: TimestampString;
  }) {
    this.agentId = options.agentId;
    this.timestamp = options.timestamp;
  }

  public readonly agentId: Identifier;
  public readonly timestamp: TimestampString;
}

export class AgentHealthMonitor {
  private readonly state = new Map<
    Identifier,
    { status: string; lastHeartbeat?: TimestampString }
  >();

  public observe(presence: AgentPresence, heartbeat: AgentHeartbeat): void {
    this.state.set(presence.agentId, {
      status: presence.status,
      lastHeartbeat: heartbeat.timestamp,
    });
  }

  public snapshot(): Record<Identifier, { status: string; lastHeartbeat?: TimestampString }> {
    return Object.fromEntries(this.state.entries());
  }
}

export class AgentCollaborationSession {
  public constructor(options: {
    readonly id: Identifier;
    readonly tenant?: string;
    readonly metadata?: SerializableValueObject;
  }) {
    this.id = options.id;
    this.tenant = options.tenant;
    this.metadata = options.metadata;
  }

  public readonly id: Identifier;
  public readonly tenant?: string;
  public readonly metadata?: SerializableValueObject;
}

export class AgentMediator {
  public constructor(private readonly orchestrator: AgentOrchestrator) {}

  public async start(_session: AgentCollaborationSession): Promise<Result<void>> {
    return this.orchestrator.start(_session);
  }

  public async complete(_sessionId: Identifier): Promise<Result<void>> {
    return this.orchestrator.complete(_sessionId);
  }
}

export class AgentOrchestrator implements IAgentCoordinator {
  public async delegate(request: AgentDelegationRequest): Promise<Result<AgentDelegationResponse>> {
    return {
      succeeded: true,
      data: new AgentDelegationResponse({
        status: 'accepted',
        taskId: request.task.id,
        agentId: request.assignment.agentId,
        message: 'Orchestrated delegation',
      }),
    };
  }

  public async start(_session: AgentCollaborationSession): Promise<Result<void>> {
    return { succeeded: true, data: undefined };
  }

  public async complete(_sessionId: Identifier): Promise<Result<void>> {
    return { succeeded: true, data: undefined };
  }

  public async cancel(_taskId: Identifier): Promise<Result<void>> {
    return { succeeded: true, data: undefined };
  }
}
