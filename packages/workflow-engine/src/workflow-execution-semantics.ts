import { EventMetadata, type IEvent, type IEventBus } from '@infrashield/core-infrastructure';

import { WorkflowExecutionException } from './workflow-foundation.js';
import type { IWorkflowGraph } from './workflow-step-model.js';

export interface IWorkflowBranch {
  readonly id: string;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly condition?: IWorkflowCondition;
  readonly metadata: Readonly<Record<string, unknown>>;
  validate(): void;
}

export interface IWorkflowCondition {
  readonly id: string;
  readonly kind: 'if' | 'else' | 'elseif' | 'switch' | 'default';
  readonly expression?: string;
  readonly targetNodeId?: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  validate(): void;
}

export interface IWorkflowParallelGroup {
  readonly id: string;
  readonly branchIds: readonly string[];
  readonly maxConcurrency?: number;
  readonly completionStrategy: 'join' | 'merge' | 'any';
  readonly metadata: Readonly<Record<string, unknown>>;
  validate(): void;
}

export interface IWorkflowMergeGroup {
  readonly id: string;
  readonly sourceBranchIds: readonly string[];
  readonly targetNodeId: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  validate(): void;
}

export interface IWorkflowLoopDefinition {
  readonly id: string;
  readonly kind: 'for' | 'foreach' | 'while' | 'dowhile';
  readonly targetNodeId: string;
  readonly maxIterations?: number;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly state?: Readonly<Record<string, unknown>>;
  readonly exitPolicy?: 'continue' | 'break' | 'stop';
  validate(): void;
}

export interface IWorkflowTraversalEngine {
  traverse(options: {
    readonly graph: IWorkflowGraph;
    readonly semantics: WorkflowExecutionSemantics;
    readonly currentNodeId: string;
    readonly completedNodeIds: readonly string[];
    readonly executionHistory: readonly string[];
    readonly context?: Readonly<Record<string, unknown>>;
  }): WorkflowTraversalSnapshot;
}

export class WorkflowBranchException extends WorkflowExecutionException {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkflowBranchException';
  }
}

export class WorkflowParallelException extends WorkflowExecutionException {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkflowParallelException';
  }
}

export class WorkflowLoopException extends WorkflowExecutionException {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkflowLoopException';
  }
}

export class WorkflowTraversalException extends WorkflowExecutionException {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkflowTraversalException';
  }
}

export class WorkflowMergeException extends WorkflowExecutionException {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkflowMergeException';
  }
}

export class WorkflowCondition {
  public readonly id: string;
  public readonly kind: 'if' | 'else' | 'elseif' | 'switch' | 'default';
  public readonly expression?: string;
  public readonly targetNodeId?: string;
  public readonly metadata: Readonly<Record<string, unknown>>;

  public constructor(options: {
    readonly id: string;
    readonly kind: 'if' | 'else' | 'elseif' | 'switch' | 'default';
    readonly expression?: string;
    readonly targetNodeId?: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }) {
    this.id = options.id.trim();
    this.kind = options.kind;
    this.expression = options.expression?.trim();
    this.targetNodeId = options.targetNodeId?.trim();
    this.metadata = Object.freeze({ ...(options.metadata ?? {}) });
    this.validate();
  }

  public validate(): void {
    if (!this.id) {
      throw new WorkflowBranchException('Condition identifier is required');
    }
    if (this.kind === 'default' && this.expression) {
      throw new WorkflowBranchException('Default conditions cannot define an expression');
    }
  }
}

export class WorkflowConditionEvaluator {
  public evaluate(
    condition: IWorkflowCondition,
    context: Readonly<{ values?: ReadonlyMap<string, unknown> }> = {},
  ): boolean {
    if (!condition.expression) {
      return condition.kind !== 'default';
    }
    const variableValue = context.values?.get(condition.expression);
    return variableValue === true;
  }
}

export class WorkflowBranch {
  public readonly id: string;
  public readonly sourceNodeId: string;
  public readonly targetNodeId: string;
  public readonly condition?: WorkflowCondition;
  public readonly metadata: Readonly<Record<string, unknown>>;

  public constructor(options: {
    readonly id: string;
    readonly sourceNodeId: string;
    readonly targetNodeId: string;
    readonly condition?: WorkflowCondition;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }) {
    this.id = options.id.trim();
    this.sourceNodeId = options.sourceNodeId.trim();
    this.targetNodeId = options.targetNodeId.trim();
    this.condition = options.condition;
    this.metadata = Object.freeze({ ...(options.metadata ?? {}) });
    this.validate();
  }

  public validate(): void {
    if (!this.id || !this.sourceNodeId || !this.targetNodeId) {
      throw new WorkflowBranchException('Branch identifiers must be non-empty');
    }
    if (this.targetNodeId === this.sourceNodeId) {
      throw new WorkflowBranchException('Branch cannot target itself');
    }
    if (this.targetNodeId.includes(' ')) {
      throw new WorkflowBranchException('Branch target must be a valid node identifier');
    }
  }
}

export class WorkflowBranchEvaluator {
  public evaluate(
    branch: IWorkflowBranch,
    context: Readonly<{ values?: ReadonlyMap<string, unknown> }> = {},
  ): boolean {
    if (!branch.condition) {
      return true;
    }
    return new WorkflowConditionEvaluator().evaluate(branch.condition, context);
  }
}

export class WorkflowParallelGroup implements IWorkflowParallelGroup {
  public readonly id: string;
  public readonly branchIds: readonly string[];
  public readonly maxConcurrency?: number;
  public readonly completionStrategy: 'join' | 'merge' | 'any';
  public readonly metadata: Readonly<Record<string, unknown>>;

  public constructor(options: {
    readonly id: string;
    readonly branchIds: readonly string[];
    readonly maxConcurrency?: number;
    readonly completionStrategy?: 'join' | 'merge' | 'any';
    readonly metadata?: Readonly<Record<string, unknown>>;
  }) {
    this.id = options.id.trim();
    this.branchIds = Object.freeze([...(options.branchIds ?? [])]);
    this.maxConcurrency = options.maxConcurrency;
    this.completionStrategy = options.completionStrategy ?? 'join';
    this.metadata = Object.freeze({ ...(options.metadata ?? {}) });
    this.validate();
  }

  public validate(): void {
    if (!this.id) {
      throw new WorkflowParallelException('Parallel group identifier is required');
    }
    if (this.branchIds.length < 2) {
      throw new WorkflowParallelException('Parallel group requires at least two branches');
    }
    if (this.maxConcurrency !== undefined && this.maxConcurrency < 1) {
      throw new WorkflowParallelException('Parallel group maxConcurrency must be at least 1');
    }
  }
}

export class WorkflowMergeGroup implements IWorkflowMergeGroup {
  public readonly id: string;
  public readonly sourceBranchIds: readonly string[];
  public readonly targetNodeId: string;
  public readonly metadata: Readonly<Record<string, unknown>>;

  public constructor(options: {
    readonly id: string;
    readonly sourceBranchIds: readonly string[];
    readonly targetNodeId: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }) {
    this.id = options.id.trim();
    this.sourceBranchIds = Object.freeze([...(options.sourceBranchIds ?? [])]);
    this.targetNodeId = options.targetNodeId.trim();
    this.metadata = Object.freeze({ ...(options.metadata ?? {}) });
    this.validate();
  }

  public validate(): void {
    if (!this.id || !this.targetNodeId) {
      throw new WorkflowMergeException('Merge group requires an identifier and target node');
    }
    if (this.sourceBranchIds.length < 2) {
      throw new WorkflowMergeException('Merge group requires at least two sources');
    }
    if (this.sourceBranchIds.some((id) => !id.trim())) {
      throw new WorkflowMergeException('Merge group contains an empty source branch id');
    }
  }
}

export class WorkflowLoopDefinition implements IWorkflowLoopDefinition {
  public readonly id: string;
  public readonly kind: 'for' | 'foreach' | 'while' | 'dowhile';
  public readonly targetNodeId: string;
  public readonly maxIterations?: number;
  public readonly metadata: Readonly<Record<string, unknown>>;
  public readonly state?: Readonly<Record<string, unknown>>;
  public readonly exitPolicy?: 'continue' | 'break' | 'stop';

  public constructor(options: {
    readonly id: string;
    readonly kind: 'for' | 'foreach' | 'while' | 'dowhile';
    readonly targetNodeId: string;
    readonly maxIterations?: number;
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly state?: Readonly<Record<string, unknown>>;
    readonly exitPolicy?: 'continue' | 'break' | 'stop';
  }) {
    this.id = options.id.trim();
    this.kind = options.kind;
    this.targetNodeId = options.targetNodeId.trim();
    this.maxIterations = options.maxIterations;
    this.metadata = Object.freeze({ ...(options.metadata ?? {}) });
    this.state = options.state ? Object.freeze({ ...options.state }) : undefined;
    this.exitPolicy = options.exitPolicy;
    this.validate();
  }

  public validate(): void {
    if (!this.id || !this.targetNodeId) {
      throw new WorkflowLoopException('Loop definition requires an identifier and target node');
    }
    if (this.maxIterations !== undefined && this.maxIterations < 1) {
      throw new WorkflowLoopException('Loop maxIterations must be at least 1');
    }
  }
}

export class WorkflowExecutionSemantics {
  public readonly branches: readonly WorkflowBranch[];
  public readonly conditions: readonly WorkflowCondition[];
  public readonly parallelGroups: readonly WorkflowParallelGroup[];
  public readonly mergeGroups: readonly WorkflowMergeGroup[];
  public readonly loops: readonly WorkflowLoopDefinition[];
  public readonly metadata: Readonly<Record<string, unknown>>;

  public constructor(
    options: {
      readonly branches?: readonly WorkflowBranch[];
      readonly conditions?: readonly WorkflowCondition[];
      readonly parallelGroups?: readonly WorkflowParallelGroup[];
      readonly mergeGroups?: readonly WorkflowMergeGroup[];
      readonly loops?: readonly WorkflowLoopDefinition[];
      readonly metadata?: Readonly<Record<string, unknown>>;
    } = {},
  ) {
    this.branches = Object.freeze([...(options.branches ?? [])]);
    this.conditions = Object.freeze([...(options.conditions ?? [])]);
    this.parallelGroups = Object.freeze([...(options.parallelGroups ?? [])]);
    this.mergeGroups = Object.freeze([...(options.mergeGroups ?? [])]);
    this.loops = Object.freeze([...(options.loops ?? [])]);
    this.metadata = Object.freeze({ ...(options.metadata ?? {}) });
  }

  public validateAgainstGraph(graph: IWorkflowGraph): void {
    const nodeIds = new Set(graph.steps.map((step) => step.id.toString()));

    for (const branch of this.branches) {
      if (!nodeIds.has(branch.sourceNodeId) || !nodeIds.has(branch.targetNodeId)) {
        throw new WorkflowTraversalException(
          `Branch '${branch.id}' references an unknown graph node`,
        );
      }
    }

    for (const merge of this.mergeGroups) {
      if (!nodeIds.has(merge.targetNodeId)) {
        throw new WorkflowTraversalException(`Merge '${merge.id}' targets an unknown graph node`);
      }
      for (const sourceBranchId of merge.sourceBranchIds) {
        if (!nodeIds.has(sourceBranchId)) {
          throw new WorkflowTraversalException(
            `Merge '${merge.id}' references an unknown source branch '${sourceBranchId}'`,
          );
        }
      }
    }

    for (const group of this.parallelGroups) {
      for (const branchId of group.branchIds) {
        if (!nodeIds.has(branchId)) {
          throw new WorkflowTraversalException(
            `Parallel group '${group.id}' references an unknown branch '${branchId}'`,
          );
        }
      }
    }

    for (const loopDefinition of this.loops) {
      if (!nodeIds.has(loopDefinition.targetNodeId)) {
        throw new WorkflowTraversalException(
          `Loop '${loopDefinition.id}' targets an unknown graph node`,
        );
      }
    }
  }

  public snapshot(): WorkflowTraversalSnapshot {
    return new WorkflowTraversalSnapshot({
      nextNodeIds: [],
      blockedNodeIds: [],
      satisfiedDependencies: [],
      branchResolutions: [],
      mergeResolutions: [],
      traversalHistory: [],
      parallelBranches: [],
      completedBranches: [],
      loopCount: this.loops.length,
      traversalDepth: 0,
      branchDurationMs: 0,
      mergeDurationMs: 0,
      executionPath: [],
      metadata: this.metadata,
    });
  }
}

export class WorkflowTraversalEngine implements IWorkflowTraversalEngine {
  private readonly eventBus?: IEventBus;

  public constructor(eventBus?: IEventBus) {
    this.eventBus = eventBus;
  }

  public traverse(options: {
    readonly graph: IWorkflowGraph;
    readonly semantics: WorkflowExecutionSemantics;
    readonly currentNodeId: string;
    readonly completedNodeIds: readonly string[];
    readonly executionHistory: readonly string[];
    readonly context?: Readonly<Record<string, unknown>>;
  }): WorkflowTraversalSnapshot {
    const currentNodeId = options.currentNodeId.trim();
    if (!currentNodeId) {
      throw new WorkflowTraversalException('Traversal requires a current node identifier');
    }
    if (!options.graph.steps.some((step) => step.id.toString() === currentNodeId)) {
      throw new WorkflowTraversalException('Traversal current node does not exist in the graph');
    }

    options.semantics.validateAgainstGraph(options.graph);

    const nextNodeIds = this.resolveNextNodes(options);
    const blockedNodeIds = this.resolveBlockedNodes(options, nextNodeIds);
    const satisfiedDependencies = this.resolveSatisfiedDependencies(options, nextNodeIds);
    const branchResolutions = this.resolveBranchResolutions(options);
    const mergeResolutions = this.resolveMergeResolutions(options);
    const parallelBranches = options.semantics.parallelGroups.flatMap((group) => group.branchIds);
    const completedBranches = options.completedNodeIds.filter((id) =>
      parallelBranches.includes(id),
    );
    const executionPath = [...options.executionHistory, currentNodeId];

    const snapshot = new WorkflowTraversalSnapshot({
      nextNodeIds,
      blockedNodeIds,
      satisfiedDependencies,
      branchResolutions,
      mergeResolutions,
      traversalHistory: executionPath,
      parallelBranches,
      completedBranches,
      loopCount: options.semantics.loops.length,
      traversalDepth: executionPath.length,
      branchDurationMs: 0,
      mergeDurationMs: 0,
      executionPath,
      metadata: {
        currentNodeId,
        completedNodeIds: [...options.completedNodeIds],
        historyLength: executionPath.length,
      },
    });

    this.publishEvent('TraversalAdvanced', snapshot);
    return snapshot;
  }

  private resolveNextNodes(options: {
    readonly graph: IWorkflowGraph;
    readonly semantics: WorkflowExecutionSemantics;
    readonly currentNodeId: string;
    readonly completedNodeIds: readonly string[];
    readonly executionHistory: readonly string[];
    readonly context?: Readonly<Record<string, unknown>>;
  }): string[] {
    const branchTargets = options.semantics.branches
      .filter((branch) => branch.sourceNodeId === options.currentNodeId)
      .filter((branch) => this.evaluateBranch(branch, options.context))
      .map((branch) => branch.targetNodeId)
      .filter((target) => !options.completedNodeIds.includes(target));

    if (branchTargets.length > 0) {
      return [...new Set(branchTargets)].sort();
    }

    const graphTargets = options.graph.edges
      .filter((edge) => edge.sourceId === options.currentNodeId)
      .map((edge) => edge.targetId)
      .filter((target) => !options.completedNodeIds.includes(target));

    return [...new Set(graphTargets)].sort();
  }

  private resolveBlockedNodes(
    options: {
      readonly graph: IWorkflowGraph;
      readonly semantics: WorkflowExecutionSemantics;
      readonly currentNodeId: string;
      readonly completedNodeIds: readonly string[];
      readonly executionHistory: readonly string[];
      readonly context?: Readonly<Record<string, unknown>>;
    },
    nextNodeIds: readonly string[],
  ): string[] {
    return nextNodeIds.filter(
      (nodeId) => !options.graph.steps.some((step) => step.id.toString() === nodeId),
    );
  }

  private resolveSatisfiedDependencies(
    options: {
      readonly graph: IWorkflowGraph;
      readonly semantics: WorkflowExecutionSemantics;
      readonly currentNodeId: string;
      readonly completedNodeIds: readonly string[];
      readonly executionHistory: readonly string[];
      readonly context?: Readonly<Record<string, unknown>>;
    },
    nextNodeIds: readonly string[],
  ): string[] {
    return nextNodeIds.filter((nodeId) => options.completedNodeIds.includes(nodeId));
  }

  private resolveBranchResolutions(options: {
    readonly graph: IWorkflowGraph;
    readonly semantics: WorkflowExecutionSemantics;
    readonly currentNodeId: string;
    readonly completedNodeIds: readonly string[];
    readonly executionHistory: readonly string[];
    readonly context?: Readonly<Record<string, unknown>>;
  }): readonly string[] {
    return options.semantics.branches
      .filter((branch) => branch.sourceNodeId === options.currentNodeId)
      .filter((branch) => this.evaluateBranch(branch, options.context))
      .map((branch) => `${branch.sourceNodeId}:${branch.targetNodeId}`);
  }

  private resolveMergeResolutions(options: {
    readonly graph: IWorkflowGraph;
    readonly semantics: WorkflowExecutionSemantics;
    readonly currentNodeId: string;
    readonly completedNodeIds: readonly string[];
    readonly executionHistory: readonly string[];
    readonly context?: Readonly<Record<string, unknown>>;
  }): readonly string[] {
    return options.semantics.mergeGroups
      .filter((merge) =>
        merge.sourceBranchIds.every((branchId) => options.completedNodeIds.includes(branchId)),
      )
      .filter((merge) => merge.targetNodeId !== options.currentNodeId)
      .map((merge) => merge.targetNodeId);
  }

  private evaluateBranch(
    branch: WorkflowBranch,
    context?: Readonly<Record<string, unknown>>,
  ): boolean {
    const values = context?.values instanceof Map ? context.values : undefined;
    if (!branch.condition) {
      return true;
    }
    return new WorkflowBranchEvaluator().evaluate(branch, { values });
  }

  private publishEvent(eventType: string, snapshot: WorkflowTraversalSnapshot): void {
    if (!this.eventBus) {
      return;
    }
    const metadata = EventMetadata.create({
      eventId: `workflow.${eventType.toLowerCase()}.${Date.now()}`,
      correlationId: undefined,
      source: 'workflow-engine',
      category: 'application',
      priority: 'normal',
      version: 1,
      tags: ['workflow-engine', eventType.toLowerCase()],
    });
    const event: IEvent = {
      eventId: metadata.eventId,
      correlationId: undefined,
      timestamp: metadata.timestamp,
      source: metadata.source,
      category: metadata.category,
      priority: metadata.priority,
      version: metadata.version,
      tags: metadata.tags,
      eventType,
      payload: snapshot.toJSON(),
      metadata,
      toEnvelope: () => ({ event, metadata }),
    };
    void this.eventBus.publish(event);
  }
}

export class WorkflowTraversalSnapshot {
  public readonly nextNodeIds: readonly string[];
  public readonly blockedNodeIds: readonly string[];
  public readonly satisfiedDependencies: readonly string[];
  public readonly branchResolutions: readonly string[];
  public readonly mergeResolutions: readonly string[];
  public readonly traversalHistory: readonly string[];
  public readonly parallelBranches: readonly string[];
  public readonly completedBranches: readonly string[];
  public readonly loopCount: number;
  public readonly traversalDepth: number;
  public readonly branchDurationMs: number;
  public readonly mergeDurationMs: number;
  public readonly executionPath: readonly string[];
  public readonly metadata: Readonly<Record<string, unknown>>;

  public constructor(options: {
    readonly nextNodeIds: readonly string[];
    readonly blockedNodeIds: readonly string[];
    readonly satisfiedDependencies: readonly string[];
    readonly branchResolutions: readonly string[];
    readonly mergeResolutions: readonly string[];
    readonly traversalHistory: readonly string[];
    readonly parallelBranches: readonly string[];
    readonly completedBranches: readonly string[];
    readonly loopCount: number;
    readonly traversalDepth: number;
    readonly branchDurationMs: number;
    readonly mergeDurationMs: number;
    readonly executionPath: readonly string[];
    readonly metadata?: Readonly<Record<string, unknown>>;
  }) {
    this.nextNodeIds = Object.freeze([...options.nextNodeIds]);
    this.blockedNodeIds = Object.freeze([...options.blockedNodeIds]);
    this.satisfiedDependencies = Object.freeze([...options.satisfiedDependencies]);
    this.branchResolutions = Object.freeze([...options.branchResolutions]);
    this.mergeResolutions = Object.freeze([...options.mergeResolutions]);
    this.traversalHistory = Object.freeze([...options.traversalHistory]);
    this.parallelBranches = Object.freeze([...options.parallelBranches]);
    this.completedBranches = Object.freeze([...options.completedBranches]);
    this.loopCount = options.loopCount;
    this.traversalDepth = options.traversalDepth;
    this.branchDurationMs = options.branchDurationMs;
    this.mergeDurationMs = options.mergeDurationMs;
    this.executionPath = Object.freeze([...options.executionPath]);
    this.metadata = Object.freeze({ ...(options.metadata ?? {}) });
  }

  public toJSON(): Record<string, unknown> {
    return {
      nextNodeIds: [...this.nextNodeIds],
      blockedNodeIds: [...this.blockedNodeIds],
      satisfiedDependencies: [...this.satisfiedDependencies],
      branchResolutions: [...this.branchResolutions],
      mergeResolutions: [...this.mergeResolutions],
      traversalHistory: [...this.traversalHistory],
      parallelBranches: [...this.parallelBranches],
      completedBranches: [...this.completedBranches],
      loopCount: this.loopCount,
      traversalDepth: this.traversalDepth,
      branchDurationMs: this.branchDurationMs,
      mergeDurationMs: this.mergeDurationMs,
      executionPath: [...this.executionPath],
      metadata: { ...this.metadata },
    };
  }
}
