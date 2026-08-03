import type {
  Identifier,
  SerializableValue,
  SerializableValueObject,
} from '@infrashield/contracts';

export enum GoalLifecycle {
  Created = 'created',
  Accepted = 'accepted',
  Planning = 'planning',
  Ready = 'ready',
  Executing = 'executing',
  Waiting = 'waiting',
  Blocked = 'blocked',
  Paused = 'paused',
  Completed = 'completed',
  Cancelled = 'cancelled',
  Failed = 'failed',
  Archived = 'archived',
}

export enum GoalPriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Critical = 'critical',
}

export interface IGoal {
  readonly id: Identifier;
  readonly definition: GoalDefinition;
  readonly context: GoalContext;
  accept(): boolean;
  start(): boolean;
  pause(): boolean;
  resume(): boolean;
  complete(): boolean;
  fail(reason: string): boolean;
  cancel(): boolean;
  createSnapshot(): GoalSnapshot;
}

export interface IGoalManager {
  register(goal: IGoal): void;
  get(goalId: Identifier): IGoal | undefined;
  list(): readonly IGoal[];
  getPending(): readonly IGoal[];
}

export interface IGoalRegistry {
  register(goal: IGoal): void;
  get(goalId: Identifier): IGoal | undefined;
  list(): readonly IGoal[];
}

export interface IPlanner {
  plan(goal: IGoal): Plan;
}

export interface IPlan {
  readonly id: Identifier;
  getDescriptor(): PlanDescriptor;
  getGraph(): TaskGraph;
  createSnapshot(): PlanSnapshot;
}

export interface IPlanBuilder {
  addTask(id: Identifier, name: string, payload?: SerializableValueObject): IPlanBuilder;
  addDependency(childId: Identifier, parentId: Identifier): IPlanBuilder;
  setMetadata(metadata: SerializableValueObject): IPlanBuilder;
  publish(): Plan;
}

export interface IPlanExecutor {
  execute(): PlanExecutionResult;
  replan(reason: string): void;
}

export interface IGoalEvaluator {
  evaluate(input: GoalEvaluationInput): number;
}

export class GoalConstraint {
  public constructor(options: {
    readonly id: Identifier;
    readonly description: string;
    readonly enforced?: boolean;
  }) {
    this.id = options.id;
    this.description = options.description;
    this.enforced = options.enforced ?? true;
  }

  public readonly id: Identifier;
  public readonly description: string;
  public readonly enforced: boolean;
}

export class GoalPolicy {
  public constructor(
    options: {
      readonly executionPolicy?: string;
      readonly tenantIsolation?: boolean;
      readonly authorization?: boolean;
      readonly constraintValidation?: boolean;
    } = {},
  ) {
    this.executionPolicy = options.executionPolicy ?? 'standard';
    this.tenantIsolation = options.tenantIsolation ?? true;
    this.authorization = options.authorization ?? true;
    this.constraintValidation = options.constraintValidation ?? true;
  }

  public readonly executionPolicy: string;
  public readonly tenantIsolation: boolean;
  public readonly authorization: boolean;
  public readonly constraintValidation: boolean;
}

export class GoalDefinition {
  public constructor(options: {
    readonly id: Identifier;
    readonly title: string;
    readonly description?: string;
    readonly priority?: GoalPriority;
    readonly constraints?: readonly GoalConstraint[];
    readonly metadata?: SerializableValueObject;
  }) {
    this.id = options.id;
    this.title = options.title;
    this.description = options.description ?? '';
    this.priority = options.priority ?? GoalPriority.Medium;
    this.constraints = [...(options.constraints ?? [])];
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }

  public readonly id: Identifier;
  public readonly title: string;
  public readonly description: string;
  public readonly priority: GoalPriority;
  public readonly constraints: readonly GoalConstraint[];
  public readonly metadata?: Readonly<SerializableValueObject>;
}

export class GoalContext {
  public constructor(
    options: {
      readonly tenant?: string;
      readonly policy?: GoalPolicy;
      readonly metadata?: SerializableValueObject;
    } = {},
  ) {
    this.tenant = options.tenant;
    this.policy = options.policy ?? new GoalPolicy();
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }

  public readonly tenant?: string;
  public readonly policy: GoalPolicy;
  public readonly metadata?: Readonly<SerializableValueObject>;
}

export class GoalState {
  public constructor(
    options: {
      readonly status?: GoalLifecycle;
      readonly progress?: number;
      readonly currentTask?: string;
      readonly blockedTasks?: readonly string[];
      readonly milestones?: readonly string[];
      readonly updatedAt?: string;
    } = {},
  ) {
    this.status = options.status ?? GoalLifecycle.Created;
    this.progress = options.progress ?? 0;
    this.currentTask = options.currentTask;
    this.blockedTasks = [...(options.blockedTasks ?? [])];
    this.milestones = [...(options.milestones ?? [])];
    this.updatedAt = options.updatedAt ?? new Date().toISOString();
  }

  public readonly status: GoalLifecycle;
  public readonly progress: number;
  public readonly currentTask?: string;
  public readonly blockedTasks: readonly string[];
  public readonly milestones: readonly string[];
  public readonly updatedAt: string;
}

export class GoalDescriptor {
  public constructor(options: {
    readonly id: Identifier;
    readonly title: string;
    readonly description?: string;
    readonly priority?: GoalPriority;
    readonly status?: GoalLifecycle;
  }) {
    this.id = options.id;
    this.title = options.title;
    this.description = options.description;
    this.priority = options.priority ?? GoalPriority.Medium;
    this.status = options.status ?? GoalLifecycle.Created;
  }

  public readonly id: Identifier;
  public readonly title: string;
  public readonly description?: string;
  public readonly priority: GoalPriority;
  public readonly status: GoalLifecycle;
}

export class GoalSnapshot {
  public constructor(options: {
    readonly id: Identifier;
    readonly status: GoalLifecycle;
    readonly progress: number;
    readonly currentTask?: string;
    readonly blockedTasks: readonly string[];
    readonly milestones: readonly string[];
    readonly updatedAt: string;
  }) {
    this.id = options.id;
    this.status = options.status;
    this.progress = options.progress;
    this.currentTask = options.currentTask;
    this.blockedTasks = [...options.blockedTasks];
    this.milestones = [...options.milestones];
    this.updatedAt = options.updatedAt;
    Object.freeze(this);
  }

  public readonly id: Identifier;
  public readonly status: GoalLifecycle;
  public readonly progress: number;
  public readonly currentTask?: string;
  public readonly blockedTasks: readonly string[];
  public readonly milestones: readonly string[];
  public readonly updatedAt: string;
}

export class GoalTracker {
  private progress = 0;
  private currentTask?: string;
  private blockedTasks: string[] = [];
  private milestones: string[] = [];
  private updatedAt = new Date().toISOString();

  public updateProgress(progress: number, currentTask?: string): void {
    this.progress = Math.max(0, Math.min(1, progress));
    this.currentTask = currentTask;
    this.updatedAt = new Date().toISOString();
  }

  public addMilestone(name: string): void {
    if (!this.milestones.includes(name)) {
      this.milestones.push(name);
    }
  }

  public blockTask(taskId: string): void {
    if (!this.blockedTasks.includes(taskId)) {
      this.blockedTasks.push(taskId);
    }
  }

  public getSnapshot(): GoalSnapshot {
    return new GoalSnapshot({
      id: 'tracker',
      status: GoalLifecycle.Executing,
      progress: this.progress,
      currentTask: this.currentTask,
      blockedTasks: this.blockedTasks,
      milestones: this.milestones,
      updatedAt: this.updatedAt,
    });
  }
}

export class Goal extends GoalTracker implements IGoal {
  private state: GoalState;

  public constructor(options: {
    readonly id: Identifier;
    readonly definition: GoalDefinition;
    readonly context: GoalContext;
  }) {
    super();
    this.id = options.id;
    this.definition = options.definition;
    this.context = options.context;
    this.state = new GoalState({ status: GoalLifecycle.Created });
  }

  public readonly id: Identifier;
  public readonly definition: GoalDefinition;
  public readonly context: GoalContext;

  public accept(): boolean {
    this.state = new GoalState({ ...this.state, status: GoalLifecycle.Accepted });
    return true;
  }

  public start(): boolean {
    this.state = new GoalState({ ...this.state, status: GoalLifecycle.Executing });
    return true;
  }

  public pause(): boolean {
    this.state = new GoalState({ ...this.state, status: GoalLifecycle.Paused });
    return true;
  }

  public resume(): boolean {
    this.state = new GoalState({ ...this.state, status: GoalLifecycle.Executing });
    return true;
  }

  public complete(): boolean {
    this.state = new GoalState({ ...this.state, status: GoalLifecycle.Completed, progress: 1 });
    return true;
  }

  public fail(reason: string): boolean {
    this.state = new GoalState({
      ...this.state,
      status: GoalLifecycle.Failed,
      currentTask: reason,
    });
    return true;
  }

  public cancel(): boolean {
    this.state = new GoalState({ ...this.state, status: GoalLifecycle.Cancelled });
    return true;
  }

  public getState(): GoalState {
    return this.state;
  }

  public attachTracker(tracker: GoalTracker): void {
    this.tracker = tracker;
  }

  public updateProgress(progress: number, currentTask?: string): void {
    super.updateProgress(progress, currentTask);
    this.state = new GoalState({ ...this.state, progress, currentTask, status: this.state.status });
    if (this.tracker) {
      this.tracker.updateProgress(progress, currentTask);
    }
  }

  public createSnapshot(): GoalSnapshot {
    const trackerSnapshot = this.tracker?.getSnapshot();
    return new GoalSnapshot({
      id: this.id,
      status: this.state.status,
      progress: trackerSnapshot?.progress ?? this.state.progress,
      currentTask: trackerSnapshot?.currentTask ?? this.state.currentTask,
      blockedTasks: trackerSnapshot?.blockedTasks ?? this.state.blockedTasks,
      milestones: trackerSnapshot?.milestones ?? this.state.milestones,
      updatedAt: trackerSnapshot?.updatedAt ?? this.state.updatedAt,
    });
  }

  private tracker?: GoalTracker;
}

export class GoalRegistry implements IGoalRegistry {
  private readonly goals = new Map<Identifier, IGoal>();

  public register(goal: IGoal): void {
    this.goals.set(goal.id, goal);
  }

  public get(goalId: Identifier): IGoal | undefined {
    return this.goals.get(goalId);
  }

  public list(): readonly IGoal[] {
    return [...this.goals.values()];
  }
}

export class GoalScheduler implements IGoalManager {
  private readonly pending: IGoal[] = [];

  public register(goal: IGoal): void {
    this.pending.push(goal);
  }

  public schedule(goal: IGoal): void {
    this.pending.push(goal);
  }

  public get(goalId: Identifier): IGoal | undefined {
    return this.pending.find((goal) => goal.id === goalId);
  }

  public list(): readonly IGoal[] {
    return [...this.pending];
  }

  public getPending(): readonly IGoal[] {
    return [...this.pending];
  }
}

export class GoalEvaluator implements IGoalEvaluator {
  public evaluate(input: GoalEvaluationInput): number {
    const score = input.success ? 0.6 : 0.2;
    const progressWeight = input.progress * 0.3;
    const blockedWeight = input.blockedTasks.length * 0.05;
    const milestoneWeight = input.milestones.length * 0.05;
    return Number((score + progressWeight - blockedWeight + milestoneWeight).toFixed(2));
  }
}

export interface GoalEvaluationInput {
  readonly success: boolean;
  readonly progress: number;
  readonly blockedTasks: readonly string[];
  readonly milestones: readonly string[];
  readonly completion: number;
}

export class GoalDependency {
  public constructor(options: {
    readonly id: Identifier;
    readonly dependsOn: Identifier;
    readonly metadata?: SerializableValueObject;
  }) {
    this.id = options.id;
    this.dependsOn = options.dependsOn;
    this.metadata = options.metadata;
  }

  public readonly id: Identifier;
  public readonly dependsOn: Identifier;
  public readonly metadata?: SerializableValueObject;
}

export class GoalResult {
  public constructor(options: {
    readonly goalId: Identifier;
    readonly success: boolean;
    readonly message?: string;
    readonly output?: SerializableValue;
  }) {
    this.goalId = options.goalId;
    this.success = options.success;
    this.message = options.message;
    this.output = options.output;
  }

  public readonly goalId: Identifier;
  public readonly success: boolean;
  public readonly message?: string;
  public readonly output?: SerializableValue;
}

export class PlanDescriptor {
  public constructor(options: {
    readonly id: Identifier;
    readonly title: string;
    readonly description?: string;
    readonly metadata?: SerializableValueObject;
  }) {
    this.id = options.id;
    this.title = options.title;
    this.description = options.description;
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }

  public readonly id: Identifier;
  public readonly title: string;
  public readonly description?: string;
  public readonly metadata?: Readonly<SerializableValueObject>;
}

export class TaskNode {
  public constructor(options: {
    readonly id: Identifier;
    readonly name: string;
    readonly payload?: SerializableValueObject;
    readonly dependencies?: readonly Identifier[];
  }) {
    this.id = options.id;
    this.name = options.name;
    this.payload = options.payload;
    this.dependencies = [...(options.dependencies ?? [])];
  }

  public readonly id: Identifier;
  public readonly name: string;
  public readonly payload?: SerializableValueObject;
  public readonly dependencies: readonly Identifier[];
}

export class TaskGraph {
  private readonly nodes = new Map<Identifier, TaskNode>();
  private readonly adjacency = new Map<Identifier, Set<Identifier>>();

  public addNode(node: TaskNode): void {
    this.nodes.set(node.id, node);
    if (!this.adjacency.has(node.id)) {
      this.adjacency.set(node.id, new Set());
    }
  }

  public addEdge(fromId: Identifier, toId: Identifier): void {
    const from = this.nodes.get(fromId);
    const to = this.nodes.get(toId);
    if (!from || !to) {
      throw new Error('Task node not found');
    }
    this.adjacency.get(fromId)?.add(toId);
  }

  public getTasks(): readonly TaskNode[] {
    return [...this.nodes.values()];
  }

  public getDependencies(taskId: Identifier): readonly Identifier[] {
    const node = this.nodes.get(taskId);
    return node?.dependencies ?? [];
  }

  public getChildren(taskId: Identifier): readonly Identifier[] {
    return [...(this.adjacency.get(taskId) ?? [])];
  }
}

export class DependencyGraph {
  private readonly dependencies: GoalDependency[] = [];

  public addDependency(dependency: GoalDependency): void {
    this.dependencies.push(dependency);
  }

  public getDependencies(): readonly GoalDependency[] {
    return [...this.dependencies];
  }
}

export class ExecutionGraph extends TaskGraph {}

export class Plan {
  public constructor(options: {
    readonly id: Identifier;
    readonly descriptor: PlanDescriptor;
    readonly graph?: TaskGraph;
    readonly metadata?: SerializableValueObject;
  }) {
    this.id = options.id;
    this.descriptor = options.descriptor;
    this.graph = options.graph ?? new TaskGraph();
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }

  public readonly id: Identifier;
  public readonly descriptor: PlanDescriptor;
  public readonly graph: TaskGraph;
  public readonly metadata?: Readonly<SerializableValueObject>;

  public getDescriptor(): PlanDescriptor {
    return this.descriptor;
  }

  public getGraph(): TaskGraph {
    return this.graph;
  }

  public createSnapshot(): PlanSnapshot {
    return new PlanSnapshot({
      id: this.id,
      descriptor: this.descriptor,
      graph: this.graph,
      metadata: this.metadata,
    });
  }
}

export class PlanSnapshot {
  public constructor(options: {
    readonly id: Identifier;
    readonly descriptor: PlanDescriptor;
    readonly graph: TaskGraph;
    readonly metadata?: Readonly<SerializableValueObject>;
  }) {
    this.id = options.id;
    this.descriptor = options.descriptor;
    this.graph = options.graph;
    this.metadata = options.metadata;
    Object.freeze(this);
  }

  public readonly id: Identifier;
  public readonly descriptor: PlanDescriptor;
  public readonly graph: TaskGraph;
  public readonly metadata?: Readonly<SerializableValueObject>;
}

export class PlanBuilder implements IPlanBuilder {
  private readonly tasks = new Map<Identifier, TaskNode>();
  private readonly edges = new Map<Identifier, Set<Identifier>>();
  private readonly metadata: SerializableValueObject = {};

  public constructor(private readonly planId: Identifier) {}

  public addTask(id: Identifier, name: string, payload?: SerializableValueObject): IPlanBuilder {
    const node = new TaskNode({ id, name, payload });
    this.tasks.set(id, node);
    if (!this.edges.has(id)) {
      this.edges.set(id, new Set());
    }
    return this;
  }

  public addDependency(childId: Identifier, parentId: Identifier): IPlanBuilder {
    const child = this.tasks.get(childId);
    const parent = this.tasks.get(parentId);
    if (!child || !parent) {
      throw new Error('Task node not found');
    }
    this.edges.get(childId)?.add(parentId);
    return this;
  }

  public setMetadata(metadata: SerializableValueObject): IPlanBuilder {
    Object.assign(this.metadata, metadata);
    return this;
  }

  public publish(): Plan {
    const graph = new TaskGraph();
    for (const task of this.tasks.values()) {
      graph.addNode(task);
    }
    for (const [childId, parents] of this.edges.entries()) {
      for (const parentId of parents.values()) {
        graph.addEdge(parentId, childId);
      }
    }
    return new Plan({
      id: this.planId,
      descriptor: new PlanDescriptor({ id: this.planId, title: 'Generated Plan' }),
      graph,
      metadata: this.metadata,
    });
  }
}

export class PlanValidator {
  public validate(_plan: Plan): { readonly valid: boolean; readonly issues: readonly string[] } {
    return { valid: true, issues: [] };
  }
}

export class PlanOptimizer {
  public optimize(plan: Plan): Plan {
    return plan;
  }
}

export class PlanExecutionState {
  public constructor(
    options: {
      readonly status?: string;
      readonly replanCount?: number;
      readonly currentTask?: Identifier;
      readonly checkpoints?: readonly PlanCheckpoint[];
    } = {},
  ) {
    this.status = options.status ?? 'created';
    this.replanCount = options.replanCount ?? 0;
    this.currentTask = options.currentTask;
    this.checkpoints = [...(options.checkpoints ?? [])];
  }

  public readonly status: string;
  public readonly replanCount: number;
  public readonly currentTask?: Identifier;
  public readonly checkpoints: readonly PlanCheckpoint[];
}

export class PlanExecution {
  private state: PlanExecutionState;

  public constructor(options: { readonly plan: Plan; readonly state?: PlanExecutionState }) {
    this.plan = options.plan;
    this.state = options.state ?? new PlanExecutionState();
  }

  public readonly plan: Plan;

  public execute(): PlanExecutionResult {
    return new PlanExecutionResult({
      status: 'completed',
      planId: this.plan.id,
      message: 'executed',
    });
  }

  public replan(reason: string): void {
    this.state = new PlanExecutionState({
      ...this.state,
      replanCount: this.state.replanCount + 1,
      status: `replanning:${reason}`,
    });
  }

  public addCheckpoint(checkpoint: PlanCheckpoint): void {
    this.state = new PlanExecutionState({
      ...this.state,
      checkpoints: [...this.state.checkpoints, checkpoint],
    });
  }

  public getState(): PlanExecutionState {
    return this.state;
  }

  public getCheckpoints(): readonly PlanCheckpoint[] {
    return this.state.checkpoints;
  }
}

export class PlanExecutionResult {
  public constructor(options: {
    readonly status: string;
    readonly planId: Identifier;
    readonly message?: string;
    readonly checkpoints?: readonly PlanCheckpoint[];
  }) {
    this.status = options.status;
    this.planId = options.planId;
    this.message = options.message;
    this.checkpoints = [...(options.checkpoints ?? [])];
  }

  public readonly status: string;
  public readonly planId: Identifier;
  public readonly message?: string;
  public readonly checkpoints: readonly PlanCheckpoint[];
}

export class PlanCheckpoint {
  public constructor(options: {
    readonly id: Identifier;
    readonly planId: Identifier;
    readonly checkpointType: string;
    readonly metadata?: SerializableValueObject;
  }) {
    this.id = options.id;
    this.planId = options.planId;
    this.checkpointType = options.checkpointType;
    this.metadata = options.metadata;
  }

  public readonly id: Identifier;
  public readonly planId: Identifier;
  public readonly checkpointType: string;
  public readonly metadata?: SerializableValueObject;
}

export class PlanRecovery {
  private readonly checkpoints = new Map<Identifier, PlanCheckpoint>();

  public addCheckpoint(checkpoint: PlanCheckpoint): void {
    this.checkpoints.set(checkpoint.id, checkpoint);
  }

  public getCheckpoint(checkpointId: Identifier): PlanCheckpoint | undefined {
    return this.checkpoints.get(checkpointId);
  }

  public restore(checkpointId: Identifier): PlanCheckpoint | undefined {
    return this.getCheckpoint(checkpointId);
  }
}

export class PlanProgress {
  public constructor(options: {
    readonly completion: number;
    readonly milestones: readonly string[];
    readonly currentTask?: string;
    readonly blockedTasks: readonly string[];
    readonly estimatedCompletion?: string;
    readonly timeline?: readonly string[];
  }) {
    this.completion = options.completion;
    this.milestones = [...options.milestones];
    this.currentTask = options.currentTask;
    this.blockedTasks = [...options.blockedTasks];
    this.estimatedCompletion = options.estimatedCompletion;
    this.timeline = [...(options.timeline ?? [])];
  }

  public readonly completion: number;
  public readonly milestones: readonly string[];
  public readonly currentTask?: string;
  public readonly blockedTasks: readonly string[];
  public readonly estimatedCompletion?: string;
  public readonly timeline: readonly string[];
}

export class ExecutionCheckpoint {
  public constructor(options: {
    readonly id: Identifier;
    readonly label: string;
    readonly metadata?: SerializableValueObject;
  }) {
    this.id = options.id;
    this.label = options.label;
    this.metadata = options.metadata;
  }

  public readonly id: Identifier;
  public readonly label: string;
  public readonly metadata?: SerializableValueObject;
}

export enum PlanningTaskType {
  Atomic = 'atomic',
  Composite = 'composite',
  Parallel = 'parallel',
  Sequential = 'sequential',
  Conditional = 'conditional',
  Approval = 'approval',
  Rollback = 'rollback',
  Recovery = 'recovery',
}

export interface IPlanningEngine {
  plan(goal: PlanningGoal, context: PlanningContext): Promise<PlanningSnapshot>;
  replan(sessionId: string, reason: string): Promise<PlanningSnapshot>;
}

export interface IExecutionPlanner {
  build(graph: PlanningGraph, tasks: readonly PlanningTask[]): PlanningExecutionPlan;
}

export interface ITaskPlanner {
  plan(goal: PlanningGoal, context?: PlanningContext): readonly PlanningTask[];
}

export interface IAgentAssignment {
  assign(task: PlanningTask, agents: readonly Identifier[]): readonly Identifier[];
}

export interface IToolAssignment {
  assign(task: PlanningTask, tools: readonly Identifier[]): readonly Identifier[];
}

export interface IPlanningStrategy {
  plan(goal: PlanningGoal, context: PlanningContext): Promise<PlanningSnapshot>;
}

export class PlanningConstraint {
  public constructor(options: {
    readonly id: Identifier;
    readonly description: string;
    readonly enforced?: boolean;
  }) {
    this.id = options.id;
    this.description = options.description;
    this.enforced = options.enforced ?? true;
  }

  public readonly id: Identifier;
  public readonly description: string;
  public readonly enforced: boolean;
}

export class PlanningPolicy {
  public constructor(
    options: {
      readonly maxParallelism?: number;
      readonly maxRetries?: number;
      readonly approvalRequired?: boolean;
      readonly tenantIsolation?: boolean;
      readonly governance?: boolean;
    } = {},
  ) {
    this.maxParallelism = options.maxParallelism ?? 2;
    this.maxRetries = options.maxRetries ?? 1;
    this.approvalRequired = options.approvalRequired ?? false;
    this.tenantIsolation = options.tenantIsolation ?? true;
    this.governance = options.governance ?? true;
  }

  public readonly maxParallelism: number;
  public readonly maxRetries: number;
  public readonly approvalRequired: boolean;
  public readonly tenantIsolation: boolean;
  public readonly governance: boolean;
}

export class PlanningGoal {
  public constructor(options: {
    readonly id: Identifier;
    readonly title: string;
    readonly description?: string;
    readonly priority?: string;
    readonly subGoals?: readonly PlanningGoal[];
    readonly metadata?: SerializableValueObject;
  }) {
    this.id = options.id;
    this.title = options.title;
    this.description = options.description ?? '';
    this.priority = options.priority ?? 'medium';
    this.subGoals = [...(options.subGoals ?? [])];
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }

  public readonly id: Identifier;
  public readonly title: string;
  public readonly description: string;
  public readonly priority: string;
  public readonly subGoals: readonly PlanningGoal[];
  public readonly metadata?: Readonly<SerializableValueObject>;
}

export class PlanningTask {
  public constructor(options: {
    readonly id: Identifier;
    readonly name: string;
    readonly type: PlanningTaskType;
    readonly description?: string;
    readonly dependsOn?: readonly Identifier[];
    readonly agentIds?: readonly Identifier[];
    readonly toolIds?: readonly Identifier[];
    readonly resources?: readonly string[];
    readonly retries?: number;
    readonly rollback?: boolean;
    readonly metadata?: SerializableValueObject;
  }) {
    this.id = options.id;
    this.name = options.name;
    this.type = options.type;
    this.description = options.description ?? '';
    this.dependsOn = [...(options.dependsOn ?? [])];
    this.agentIds = [...(options.agentIds ?? [])];
    this.toolIds = [...(options.toolIds ?? [])];
    this.resources = [...(options.resources ?? [])];
    this.retries = options.retries ?? 0;
    this.rollback = options.rollback ?? false;
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }

  public readonly id: Identifier;
  public readonly name: string;
  public readonly type: PlanningTaskType;
  public readonly description: string;
  public readonly dependsOn: readonly Identifier[];
  public readonly agentIds: readonly Identifier[];
  public readonly toolIds: readonly Identifier[];
  public readonly resources: readonly string[];
  public readonly retries: number;
  public readonly rollback: boolean;
  public readonly metadata?: Readonly<SerializableValueObject>;
}

export class PlanningContext {
  public constructor(options: {
    readonly goal: PlanningGoal;
    readonly tenant?: string;
    readonly policy?: PlanningPolicy;
    readonly constraints?: readonly PlanningConstraint[];
    readonly metadata?: SerializableValueObject;
  }) {
    this.goal = options.goal;
    this.tenant = options.tenant;
    this.policy = options.policy ?? new PlanningPolicy();
    this.constraints = [...(options.constraints ?? [])];
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }

  public readonly goal: PlanningGoal;
  public readonly tenant?: string;
  public readonly policy: PlanningPolicy;
  public readonly constraints: readonly PlanningConstraint[];
  public readonly metadata?: Readonly<SerializableValueObject>;
}

export class PlanningSession {
  public constructor(options: {
    readonly id: string;
    readonly goalId: Identifier;
    readonly createdAt?: string;
  }) {
    this.id = options.id;
    this.goalId = options.goalId;
    this.createdAt = options.createdAt ?? new Date().toISOString();
  }

  public readonly id: string;
  public readonly goalId: Identifier;
  public readonly createdAt: string;
}

export class PlanningNode {
  public constructor(options: { readonly id: Identifier; readonly task: PlanningTask }) {
    this.id = options.id;
    this.task = options.task;
  }

  public readonly id: Identifier;
  public readonly task: PlanningTask;
}

export class PlanningEdge {
  public constructor(options: {
    readonly id: Identifier;
    readonly from: Identifier;
    readonly to: Identifier;
    readonly type: string;
  }) {
    this.id = options.id;
    this.from = options.from;
    this.to = options.to;
    this.type = options.type;
  }

  public readonly id: Identifier;
  public readonly from: Identifier;
  public readonly to: Identifier;
  public readonly type: string;
}

export class PlanningGraph {
  private readonly nodes: PlanningNode[] = [];
  private readonly edges: PlanningEdge[] = [];

  public addNode(node: PlanningNode): void {
    this.nodes.push(node);
  }

  public addEdge(edge: PlanningEdge): void {
    this.edges.push(edge);
  }

  public getNodes(): readonly PlanningNode[] {
    return [...this.nodes];
  }

  public getEdges(): readonly PlanningEdge[] {
    return [...this.edges];
  }
}

export class PlanningCheckpoint {
  public constructor(options: {
    readonly id: Identifier;
    readonly sessionId: string;
    readonly state: string;
    readonly metadata?: SerializableValueObject;
  }) {
    this.id = options.id;
    this.sessionId = options.sessionId;
    this.state = options.state;
    this.metadata = options.metadata;
  }

  public readonly id: Identifier;
  public readonly sessionId: string;
  public readonly state: string;
  public readonly metadata?: SerializableValueObject;
}

export class PlanningMetrics {
  public constructor(
    options: {
      readonly taskCount?: number;
      readonly dependencyCount?: number;
      readonly criticalPath?: number;
      readonly parallelizationRatio?: number;
      readonly latencyMs?: number;
      readonly replanningCount?: number;
    } = {},
  ) {
    this.taskCount = options.taskCount ?? 0;
    this.dependencyCount = options.dependencyCount ?? 0;
    this.criticalPath = options.criticalPath ?? 0;
    this.parallelizationRatio = options.parallelizationRatio ?? 0;
    this.latencyMs = options.latencyMs ?? 0;
    this.replanningCount = options.replanningCount ?? 0;
  }

  public readonly taskCount: number;
  public readonly dependencyCount: number;
  public readonly criticalPath: number;
  public readonly parallelizationRatio: number;
  public readonly latencyMs: number;
  public readonly replanningCount: number;
}

export class PlanningStatistics {
  public constructor(public readonly metrics: PlanningMetrics) {}
}

export class PlanningAudit {
  private readonly values: string[] = [];

  public record(source: string, message: string): void {
    this.values.push(`${source}:${message}`);
  }

  public get entries(): readonly string[] {
    return [...this.values];
  }
}

export class PlanningSnapshot {
  public constructor(options: {
    readonly sessionId: string;
    readonly tasks: readonly PlanningTask[];
    readonly graph: PlanningGraph;
    readonly metrics: PlanningMetrics;
    readonly audit: PlanningAudit;
    readonly checkpoint?: PlanningCheckpoint;
    readonly createdAt?: string;
  }) {
    this.sessionId = options.sessionId;
    this.tasks = [...options.tasks];
    this.graph = options.graph;
    this.metrics = options.metrics;
    this.audit = options.audit;
    this.checkpoint = options.checkpoint;
    this.createdAt = options.createdAt ?? new Date().toISOString();
    Object.freeze(this);
  }

  public readonly sessionId: string;
  public readonly tasks: readonly PlanningTask[];
  public readonly graph: PlanningGraph;
  public readonly metrics: PlanningMetrics;
  public readonly audit: PlanningAudit;
  public readonly checkpoint?: PlanningCheckpoint;
  public readonly createdAt: string;
}

export class PlanningExecutionPlan {
  public constructor(options: {
    readonly executionMode: string;
    readonly steps: readonly string[];
    readonly tasks: readonly PlanningTask[];
  }) {
    this.executionMode = options.executionMode;
    this.steps = [...options.steps];
    this.tasks = [...options.tasks];
  }

  public readonly executionMode: string;
  public readonly steps: readonly string[];
  public readonly tasks: readonly PlanningTask[];
}

export class TaskPlanner implements ITaskPlanner {
  public plan(goal: PlanningGoal, _context?: PlanningContext): readonly PlanningTask[] {
    const baseTasks = [
      new PlanningTask({
        id: `${goal.id}-analysis`,
        name: 'Analyze scope',
        type: PlanningTaskType.Atomic,
        description: `Analyze ${goal.title}`,
        resources: ['analysis'],
      }),
      new PlanningTask({
        id: `${goal.id}-implementation`,
        name: 'Implement changes',
        type: PlanningTaskType.Composite,
        description: `Implement ${goal.title}`,
        dependsOn: [`${goal.id}-analysis`],
        resources: ['execution'],
      }),
      new PlanningTask({
        id: `${goal.id}-validation`,
        name: 'Validate delivery',
        type: PlanningTaskType.Atomic,
        description: `Validate ${goal.title}`,
        dependsOn: [`${goal.id}-implementation`],
        resources: ['validation'],
      }),
    ];

    if (goal.description.toLowerCase().includes('rollback')) {
      return [
        ...baseTasks,
        new PlanningTask({
          id: `${goal.id}-rollback`,
          name: 'Rollback plan',
          type: PlanningTaskType.Rollback,
          description: 'Prepare rollback instructions',
          dependsOn: [`${goal.id}-validation`],
          rollback: true,
          retries: 1,
        }),
      ];
    }

    return baseTasks;
  }
}

export class DependencyPlanner {
  private graph?: PlanningGraph;

  public attach(graph: PlanningGraph): void {
    this.graph = graph;
  }

  public plan(tasks: readonly PlanningTask[]): readonly PlanningEdge[] {
    if (!this.graph) {
      return [];
    }

    const edges: PlanningEdge[] = [];
    for (let index = 0; index < tasks.length; index += 1) {
      const task = tasks[index];
      if (!task) {
        continue;
      }

      for (const dependencyId of task.dependsOn) {
        edges.push(
          new PlanningEdge({
            id: `${task.id}-${dependencyId}`,
            from: dependencyId,
            to: task.id,
            type: 'dependency',
          }),
        );
      }

      if (task.dependsOn.length === 0 && index > 0) {
        const previousTask = tasks[index - 1];
        if (previousTask) {
          edges.push(
            new PlanningEdge({
              id: `${task.id}-${previousTask.id}`,
              from: previousTask.id,
              to: task.id,
              type: 'sequential',
            }),
          );
        }
      }
    }

    for (const edge of edges) {
      this.graph.addEdge(edge);
    }

    return edges;
  }
}

export class ParallelPlanner {
  public plan(tasks: readonly PlanningTask[]): readonly PlanningTask[][] {
    if (tasks.length <= 1) {
      return [tasks.slice()];
    }

    const firstHalf = tasks.slice(0, Math.ceil(tasks.length / 2));
    const secondHalf = tasks.slice(Math.ceil(tasks.length / 2));
    return [firstHalf, secondHalf];
  }
}

export class SequentialPlanner {
  public plan(tasks: readonly PlanningTask[]): readonly PlanningTask[] {
    return [...tasks];
  }
}

export class ExecutionPlanner implements IExecutionPlanner {
  public build(graph: PlanningGraph, tasks: readonly PlanningTask[]): PlanningExecutionPlan {
    const executionMode = tasks.some((task) => task.type === PlanningTaskType.Parallel)
      ? 'parallel'
      : 'parallel';
    const steps = graph.getEdges().length > 0 ? ['analyze', 'execute', 'validate'] : ['execute'];
    return new PlanningExecutionPlan({ executionMode, steps, tasks });
  }
}

export class AgentAssignment implements IAgentAssignment {
  public assign(task: PlanningTask, agents: readonly Identifier[]): readonly Identifier[] {
    if (agents.length > 0) {
      return [...agents];
    }
    return [task.id];
  }
}

export class ToolAssignment implements IToolAssignment {
  public assign(task: PlanningTask, tools: readonly Identifier[]): readonly Identifier[] {
    if (tools.length > 0) {
      return [...tools];
    }
    return [task.id];
  }
}

export class ResourcePlanner {
  public plan(task: PlanningTask): readonly string[] {
    if (task.resources.length > 0) {
      return [...task.resources];
    }
    return ['shared'];
  }
}

export class PlanningPipeline implements IPlanningStrategy {
  public constructor(
    private readonly taskPlanner: ITaskPlanner = new TaskPlanner(),
    private readonly dependencyPlanner: DependencyPlanner = new DependencyPlanner(),
    private readonly parallelPlanner: ParallelPlanner = new ParallelPlanner(),
    private readonly sequentialPlanner: SequentialPlanner = new SequentialPlanner(),
    private readonly executionPlanner: IExecutionPlanner = new ExecutionPlanner(),
    private readonly agentAssignment: IAgentAssignment = new AgentAssignment(),
    private readonly toolAssignment: IToolAssignment = new ToolAssignment(),
    private readonly resourcePlanner: ResourcePlanner = new ResourcePlanner(),
  ) {}

  public async plan(goal: PlanningGoal, context: PlanningContext): Promise<PlanningSnapshot> {
    const startedAt = Date.now();
    const tasks = this.taskPlanner.plan(goal, context);
    const graph = new PlanningGraph();
    for (const task of tasks) {
      graph.addNode(new PlanningNode({ id: task.id, task }));
    }
    this.dependencyPlanner.attach(graph);
    const dependencyPlan = this.dependencyPlanner.plan(tasks);
    void dependencyPlan;
    const parallelPlan = this.parallelPlanner.plan(tasks);
    const sequentialPlan = this.sequentialPlanner.plan(tasks);
    const executionPlan = this.executionPlanner.build(graph, tasks);
    const assignedAgents = tasks.flatMap((task) =>
      this.agentAssignment.assign(task, task.agentIds),
    );
    const assignedTools = tasks.flatMap((task) => this.toolAssignment.assign(task, task.toolIds));
    const resources = tasks.flatMap((task) => this.resourcePlanner.plan(task));
    const audit = new PlanningAudit();
    audit.record('planning', `planned ${tasks.length} tasks`);
    audit.record('execution', `mode:${executionPlan.executionMode}`);

    const metrics = new PlanningMetrics({
      taskCount: tasks.length,
      dependencyCount: graph.getEdges().length,
      criticalPath: Math.max(1, Math.ceil(tasks.length / 2)),
      parallelizationRatio: parallelPlan.length > 1 ? 0.5 : 0.2,
      latencyMs: Date.now() - startedAt,
    });

    const checkpoint = new PlanningCheckpoint({
      id: `${goal.id}-checkpoint`,
      sessionId: `${goal.id}-session`,
      state: 'ready',
      metadata: {
        executionMode: executionPlan.executionMode,
        assignedAgents,
        assignedTools,
        resources,
        sequentialPlanLength: sequentialPlan.length,
      },
    });

    return new PlanningSnapshot({
      sessionId: checkpoint.sessionId,
      tasks,
      graph,
      metrics,
      audit,
      checkpoint,
    });
  }
}

export class PlanningManager {
  private readonly sessions = new Map<string, PlanningSnapshot>();

  public register(sessionId: string, snapshot: PlanningSnapshot): void {
    this.sessions.set(sessionId, snapshot);
  }

  public get(sessionId: string): PlanningSnapshot | undefined {
    return this.sessions.get(sessionId);
  }

  public list(): readonly PlanningSnapshot[] {
    return [...this.sessions.values()];
  }
}

export class PlanningEngine implements IPlanningEngine {
  public constructor(
    private readonly pipeline: IPlanningStrategy = new PlanningPipeline(),
    private readonly manager: PlanningManager = new PlanningManager(),
  ) {}

  public async plan(goal: PlanningGoal, context: PlanningContext): Promise<PlanningSnapshot> {
    const session = new PlanningSession({ id: `${goal.id}-session`, goalId: goal.id });
    const snapshot = await this.pipeline.plan(goal, context);
    this.manager.register(session.id, snapshot);
    return new PlanningSnapshot({
      sessionId: session.id,
      tasks: snapshot.tasks,
      graph: snapshot.graph,
      metrics: new PlanningMetrics({
        taskCount: snapshot.metrics.taskCount,
        dependencyCount: snapshot.metrics.dependencyCount,
        criticalPath: snapshot.metrics.criticalPath,
        parallelizationRatio: snapshot.metrics.parallelizationRatio,
        latencyMs: snapshot.metrics.latencyMs,
        replanningCount: 0,
      }),
      audit: snapshot.audit,
      checkpoint: snapshot.checkpoint,
    });
  }

  public async replan(sessionId: string, reason: string): Promise<PlanningSnapshot> {
    const existing = this.manager.get(sessionId);
    if (!existing) {
      throw new Error(`Planning session not found: ${sessionId}`);
    }

    const audit = new PlanningAudit();
    audit.record('replanning', reason);
    for (const entry of existing.audit.entries) {
      audit.record('history', entry);
    }

    const metrics = new PlanningMetrics({
      taskCount: existing.metrics.taskCount,
      dependencyCount: existing.metrics.dependencyCount,
      criticalPath: existing.metrics.criticalPath,
      parallelizationRatio: existing.metrics.parallelizationRatio,
      latencyMs: existing.metrics.latencyMs + 1,
      replanningCount: existing.metrics.replanningCount + 1,
    });

    const snapshot = new PlanningSnapshot({
      sessionId,
      tasks: existing.tasks,
      graph: existing.graph,
      metrics,
      audit,
      checkpoint: existing.checkpoint,
    });
    this.manager.register(sessionId, snapshot);
    return snapshot;
  }
}

export class ExecutionTimeline {
  private readonly events: string[] = [];

  public record(event: string, payload: string): void {
    this.events.push(`${event}:${payload}`);
  }

  public getEvents(): readonly string[] {
    return [...this.events];
  }
}
