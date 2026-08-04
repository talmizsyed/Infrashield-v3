import { createHash } from 'node:crypto';

import {
  EventEnvelope,
  EventMetadata,
  type IEvent,
  type IEventBus,
} from '@infrashield/core-infrastructure';
import type { IRuntime, TimestampString } from '@infrashield/contracts';

import { WorkflowExecutionException } from './workflow-foundation.js';
import type { IWorkflowDefinition } from './workflow-foundation.js';
import { WorkflowEdge, type IWorkflowGraph } from './workflow-step-model.js';

export {
  WorkflowEdge,
  WorkflowGraph,
  WorkflowStepBuilder,
  WorkflowStepIdentifier,
  WorkflowStepVersion,
} from './workflow-step-model.js';

export enum WorkflowExecutionState {
  Pending = 'pending',
  Ready = 'ready',
  Running = 'running',
  Completed = 'completed',
  Skipped = 'skipped',
  Failed = 'failed',
  Cancelled = 'cancelled',
  TimedOut = 'timedOut',
  Compensating = 'compensating',
  Compensated = 'compensated',
}

export interface IWorkflowExecutionPlan {
  readonly workflowId: string;
  readonly definitionHash: string;
  readonly graphHash: string;
  readonly topologicalOrder: readonly string[];
  readonly entryNodeId: string;
  readonly exitNodeId: string;
  readonly readyNodeIds: readonly string[];
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: TimestampString;
  snapshot(): WorkflowExecutionSnapshot;
}

export interface IWorkflowExecutionContext {
  readonly workflowId: string;
  readonly correlationId: string;
  readonly definition: IWorkflowDefinition;
  readonly graph: IWorkflowGraph;
  readonly plan: IWorkflowExecutionPlan;
  readonly cursor: WorkflowExecutionCursor;
  readonly state: WorkflowExecutionState;
  readonly history: readonly WorkflowExecutionState[];
  readonly startedAt?: TimestampString;
  readonly completedAt?: TimestampString;
  snapshot(): WorkflowExecutionSnapshot;
}

export interface IWorkflowExecutionCoordinator {
  execute(
    plan: IWorkflowExecutionPlan,
    context: IWorkflowExecutionContext,
  ): Promise<WorkflowExecutionResult>;
}

export interface IWorkflowExecutionPlanner {
  plan(options: {
    readonly definition: IWorkflowDefinition;
    readonly graph: IWorkflowGraph;
  }): WorkflowExecutionPlan;
}

export interface IWorkflowExecutionEngine {
  execute(options: {
    readonly definition: IWorkflowDefinition;
    readonly graph: IWorkflowGraph;
  }): Promise<WorkflowExecutionResult>;
}

export class WorkflowPlanningException extends WorkflowExecutionException {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkflowPlanningException';
  }
}

export class WorkflowGraphValidationException extends WorkflowPlanningException {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkflowGraphValidationException';
  }
}

export class WorkflowExecutionEngineException extends WorkflowExecutionException {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkflowExecutionEngineException';
  }
}

export class WorkflowCoordinatorException extends WorkflowExecutionEngineException {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkflowCoordinatorException';
  }
}

export class WorkflowTraversalException extends WorkflowExecutionEngineException {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkflowTraversalException';
  }
}

export class WorkflowExecutionPlan implements IWorkflowExecutionPlan {
  public readonly workflowId: string;
  public readonly definitionHash: string;
  public readonly graphHash: string;
  public readonly topologicalOrder: readonly string[];
  public readonly entryNodeId: string;
  public readonly exitNodeId: string;
  public readonly readyNodeIds: readonly string[];
  public readonly metadata: Readonly<Record<string, unknown>>;
  public readonly createdAt: TimestampString;

  public constructor(options: {
    readonly workflowId: string;
    readonly definitionHash: string;
    readonly graphHash: string;
    readonly topologicalOrder: readonly string[];
    readonly entryNodeId: string;
    readonly exitNodeId: string;
    readonly readyNodeIds: readonly string[];
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly createdAt?: TimestampString;
  }) {
    this.workflowId = options.workflowId;
    this.definitionHash = options.definitionHash;
    this.graphHash = options.graphHash;
    this.topologicalOrder = Object.freeze([...options.topologicalOrder]);
    this.entryNodeId = options.entryNodeId;
    this.exitNodeId = options.exitNodeId;
    this.readyNodeIds = Object.freeze([...options.readyNodeIds]);
    this.metadata = Object.freeze({ ...(options.metadata ?? {}) });
    this.createdAt = options.createdAt ?? new Date().toISOString();
  }

  public snapshot(): WorkflowExecutionSnapshot {
    return new WorkflowExecutionSnapshot({
      workflowId: this.workflowId,
      state: WorkflowExecutionState.Pending,
      cursor: new WorkflowExecutionCursor({ completedNodeIds: [] }),
      metadata: this.metadata,
    });
  }
}

export class WorkflowExecutionCursor {
  public readonly currentNodeId?: string;
  public readonly completedNodeIds: readonly string[];
  public readonly readyNodeIds: readonly string[];
  public readonly blockedNodeIds: readonly string[];
  public readonly failedNodeIds: readonly string[];
  public readonly remainingNodeIds: readonly string[];
  public readonly traversalMetadata: Readonly<Record<string, unknown>>;
  public readonly executionHistory: readonly string[];

  public constructor(options: {
    readonly currentNodeId?: string;
    readonly completedNodeIds?: readonly string[];
    readonly readyNodeIds?: readonly string[];
    readonly blockedNodeIds?: readonly string[];
    readonly failedNodeIds?: readonly string[];
    readonly remainingNodeIds?: readonly string[];
    readonly traversalMetadata?: Readonly<Record<string, unknown>>;
    readonly executionHistory?: readonly string[];
  }) {
    this.currentNodeId = options.currentNodeId;
    this.completedNodeIds = Object.freeze([...(options.completedNodeIds ?? [])]);
    this.readyNodeIds = Object.freeze([...(options.readyNodeIds ?? [])]);
    this.blockedNodeIds = Object.freeze([...(options.blockedNodeIds ?? [])]);
    this.failedNodeIds = Object.freeze([...(options.failedNodeIds ?? [])]);
    this.remainingNodeIds = Object.freeze([...(options.remainingNodeIds ?? [])]);
    this.traversalMetadata = Object.freeze({ ...(options.traversalMetadata ?? {}) });
    this.executionHistory = Object.freeze([...(options.executionHistory ?? [])]);
  }
}

export class WorkflowExecutionGraph {
  public readonly nodes: readonly string[];
  public readonly edges: readonly WorkflowEdge[];
  public readonly entryNodeId: string;
  public readonly exitNodeId: string;

  public constructor(options: {
    readonly nodes: readonly string[];
    readonly edges: readonly WorkflowEdge[];
    readonly entryNodeId: string;
    readonly exitNodeId: string;
  }) {
    this.nodes = Object.freeze([...options.nodes]);
    this.edges = Object.freeze([...options.edges]);
    this.entryNodeId = options.entryNodeId;
    this.exitNodeId = options.exitNodeId;
  }
}

export class WorkflowExecutionResult {
  public readonly status: WorkflowExecutionState;
  public readonly snapshot: WorkflowExecutionSnapshot;

  public constructor(options: {
    readonly status: WorkflowExecutionState;
    readonly snapshot: WorkflowExecutionSnapshot;
  }) {
    this.status = options.status;
    this.snapshot = options.snapshot;
  }
}

export class WorkflowExecutionSnapshot {
  public readonly workflowId: string;
  public readonly state: WorkflowExecutionState;
  public readonly cursor: WorkflowExecutionCursor;
  public readonly metadata: Readonly<Record<string, unknown>>;
  public readonly createdAt: TimestampString;
  public readonly completedAt?: TimestampString;

  public constructor(options: {
    readonly workflowId: string;
    readonly state: WorkflowExecutionState;
    readonly cursor: WorkflowExecutionCursor;
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly createdAt?: TimestampString;
    readonly completedAt?: TimestampString;
  }) {
    this.workflowId = options.workflowId;
    this.state = options.state;
    this.cursor = options.cursor;
    this.metadata = Object.freeze({ ...(options.metadata ?? {}) });
    this.createdAt = options.createdAt ?? new Date().toISOString();
    this.completedAt = options.completedAt;
  }
}

export class WorkflowExecutionPlanner implements IWorkflowExecutionPlanner {
  public plan(options: {
    readonly definition: IWorkflowDefinition;
    readonly graph: IWorkflowGraph;
  }): WorkflowExecutionPlan {
    const stepIds = options.graph.steps.map((step) => step.id.toString());
    const adjacency = new Map<string, string[]>();
    const incoming = new Map<string, number>();

    for (const step of options.graph.steps) {
      adjacency.set(step.id.toString(), []);
      incoming.set(step.id.toString(), 0);
    }

    for (const edge of options.graph.edges) {
      const sourceId = edge.sourceId;
      const targetId = edge.targetId;
      if (!stepIds.includes(sourceId) || !stepIds.includes(targetId)) {
        throw new WorkflowGraphValidationException(
          'Workflow graph contains an invalid edge reference',
        );
      }
      if (sourceId === targetId) {
        throw new WorkflowGraphValidationException(
          'Workflow graph contains a self-referential edge',
        );
      }
      adjacency.get(sourceId)?.push(targetId);
      incoming.set(targetId, (incoming.get(targetId) ?? 0) + 1);
    }

    const queue: string[] = [];
    for (const nodeId of stepIds) {
      if ((incoming.get(nodeId) ?? 0) === 0) {
        queue.push(nodeId);
      }
    }

    const topologicalOrder: string[] = [];
    while (queue.length > 0) {
      queue.sort();
      const nodeId = queue.shift();
      if (!nodeId) {
        continue;
      }
      topologicalOrder.push(nodeId);
      for (const dependency of adjacency.get(nodeId) ?? []) {
        const nextCount = (incoming.get(dependency) ?? 0) - 1;
        incoming.set(dependency, nextCount);
        if (nextCount === 0) {
          queue.push(dependency);
        }
      }
    }

    if (topologicalOrder.length !== stepIds.length) {
      throw new WorkflowGraphValidationException('Workflow graph contains a cycle');
    }

    const entryNodeId = options.graph.entryNodeId ?? topologicalOrder[0] ?? '';
    const exitNodeId =
      options.graph.exitNodeId ?? topologicalOrder[topologicalOrder.length - 1] ?? '';
    const readyNodeIds = entryNodeId ? [entryNodeId] : [];

    return new WorkflowExecutionPlan({
      workflowId: options.definition.id.value,
      definitionHash: createHash('sha256').update(options.definition.id.value).digest('hex'),
      graphHash: createHash('sha256').update(options.graph.id).digest('hex'),
      topologicalOrder,
      entryNodeId,
      exitNodeId,
      readyNodeIds,
      metadata: {
        workflowId: options.definition.id.value,
        stepCount: stepIds.length,
        edgeCount: options.graph.edges.length,
        plannedAt: new Date().toISOString(),
      },
    });
  }
}

export class WorkflowExecutionCoordinator implements IWorkflowExecutionCoordinator {
  private readonly runtime?: IRuntime;
  private readonly eventBus?: IEventBus;

  public constructor(options?: { readonly runtime?: IRuntime; readonly eventBus?: IEventBus }) {
    this.runtime = options?.runtime;
    this.eventBus = options?.eventBus;
  }

  public async execute(
    plan: IWorkflowExecutionPlan,
    context: IWorkflowExecutionContext,
  ): Promise<WorkflowExecutionResult> {
    const completedNodeIds: string[] = [];
    const failedNodeIds: string[] = [];
    const readyNodeIds = [...plan.readyNodeIds];
    const blockedNodeIds: string[] = [];
    const executionHistory: string[] = [];
    const remainingNodeIds = [...plan.topologicalOrder];
    const traversalMetadata = {
      startedAt: new Date().toISOString(),
      stepCount: plan.topologicalOrder.length,
    };
    const dependencyCounts = new Map<string, number>();
    const dependents = new Map<string, string[]>();

    for (const nodeId of plan.topologicalOrder) {
      dependencyCounts.set(nodeId, 0);
      dependents.set(nodeId, []);
    }

    for (const edge of context.graph.edges) {
      const sourceId = edge.sourceId;
      const targetId = edge.targetId;
      if (!dependencyCounts.has(sourceId) || !dependencyCounts.has(targetId)) {
        continue;
      }
      const nextCount = (dependencyCounts.get(targetId) ?? 0) + 1;
      dependencyCounts.set(targetId, nextCount);
      const existing = dependents.get(sourceId) ?? [];
      dependents.set(sourceId, [...existing, targetId]);
    }

    for (const nodeId of plan.topologicalOrder) {
      if ((dependencyCounts.get(nodeId) ?? 0) === 0 && !readyNodeIds.includes(nodeId)) {
        readyNodeIds.push(nodeId);
      }
    }

    if (this.eventBus) {
      const metadata = EventMetadata.create({
        eventId: `workflow.started.${Date.now()}`,
        correlationId: context.correlationId,
        timestamp: new Date().toISOString(),
        source: 'workflow-engine',
        category: 'application',
        priority: 'normal',
        version: 1,
        tags: ['workflow-engine'],
      });
      const event: IEvent = {
        eventId: metadata.eventId,
        correlationId: metadata.correlationId,
        timestamp: metadata.timestamp,
        source: metadata.source,
        category: metadata.category,
        priority: metadata.priority,
        version: metadata.version,
        tags: metadata.tags,
        eventType: 'workflow.started',
        payload: { workflowId: context.workflowId },
        metadata,
        toEnvelope: () => new EventEnvelope(event, metadata),
      };
      await this.eventBus.publish(event);
    }

    for (const nodeId of plan.topologicalOrder) {
      if (!readyNodeIds.includes(nodeId)) {
        blockedNodeIds.push(nodeId);
        continue;
      }

      const runtimeExecution = this.runtime?.createExecution({
        id: `${context.workflowId}.${nodeId}`,
        owner: { id: context.workflowId, type: 'workflow-step' },
        correlationId: context.correlationId,
        metadata: { workflowId: context.workflowId, nodeId },
      });

      if (!runtimeExecution) {
        throw new WorkflowCoordinatorException('Runtime execution could not be created');
      }

      executionHistory.push(nodeId);
      await runtimeExecution.queue();
      await runtimeExecution.start();
      await runtimeExecution.complete({
        status: 'completed',
        output: { nodeId, workflowId: context.workflowId },
        metadata: { nodeId },
      });

      completedNodeIds.push(nodeId);
      readyNodeIds.splice(readyNodeIds.indexOf(nodeId), 1);
      remainingNodeIds.splice(remainingNodeIds.indexOf(nodeId), 1);

      for (const childId of dependents.get(nodeId) ?? []) {
        const nextCount = (dependencyCounts.get(childId) ?? 0) - 1;
        dependencyCounts.set(childId, nextCount);
        if (
          nextCount === 0 &&
          !completedNodeIds.includes(childId) &&
          !readyNodeIds.includes(childId)
        ) {
          readyNodeIds.push(childId);
        }
      }

      if (this.eventBus) {
        const metadata = EventMetadata.create({
          eventId: `workflow.step.completed.${nodeId}`,
          correlationId: context.correlationId,
          timestamp: new Date().toISOString(),
          source: 'workflow-engine',
          category: 'application',
          priority: 'normal',
          version: 1,
          tags: ['workflow-engine'],
        });
        const event: IEvent = {
          eventId: metadata.eventId,
          correlationId: metadata.correlationId,
          timestamp: metadata.timestamp,
          source: metadata.source,
          category: metadata.category,
          priority: metadata.priority,
          version: metadata.version,
          tags: metadata.tags,
          eventType: 'workflow.step.completed',
          payload: { workflowId: context.workflowId, nodeId },
          metadata,
          toEnvelope: () => new EventEnvelope(event, metadata),
        };
        await this.eventBus.publish(event);
      }
    }

    if (this.eventBus) {
      const metadata = EventMetadata.create({
        eventId: `workflow.completed.${Date.now()}`,
        correlationId: context.correlationId,
        timestamp: new Date().toISOString(),
        source: 'workflow-engine',
        category: 'application',
        priority: 'normal',
        version: 1,
        tags: ['workflow-engine'],
      });
      const event: IEvent = {
        eventId: metadata.eventId,
        correlationId: metadata.correlationId,
        timestamp: metadata.timestamp,
        source: metadata.source,
        category: metadata.category,
        priority: metadata.priority,
        version: metadata.version,
        tags: metadata.tags,
        eventType: 'workflow.completed',
        payload: { workflowId: context.workflowId },
        metadata,
        toEnvelope: () => new EventEnvelope(event, metadata),
      };
      await this.eventBus.publish(event);
    }

    const cursor = new WorkflowExecutionCursor({
      currentNodeId: undefined,
      completedNodeIds,
      readyNodeIds,
      blockedNodeIds,
      failedNodeIds,
      remainingNodeIds,
      traversalMetadata,
      executionHistory,
    });
    const snapshot = new WorkflowExecutionSnapshot({
      workflowId: context.workflowId,
      state: WorkflowExecutionState.Completed,
      cursor,
      metadata: { completedNodeCount: completedNodeIds.length },
      completedAt: new Date().toISOString(),
    });
    return new WorkflowExecutionResult({ status: WorkflowExecutionState.Completed, snapshot });
  }
}

export class WorkflowExecutionEngine implements IWorkflowExecutionEngine {
  private readonly planner: WorkflowExecutionPlanner;
  private readonly coordinator: WorkflowExecutionCoordinator;

  public constructor(options?: {
    readonly planner?: WorkflowExecutionPlanner;
    readonly coordinator?: WorkflowExecutionCoordinator;
  }) {
    this.planner = options?.planner ?? new WorkflowExecutionPlanner();
    this.coordinator = options?.coordinator ?? new WorkflowExecutionCoordinator();
  }

  public async execute(options: {
    readonly definition: IWorkflowDefinition;
    readonly graph: IWorkflowGraph;
  }): Promise<WorkflowExecutionResult> {
    const plan = this.planner.plan(options);
    const context: IWorkflowExecutionContext = {
      workflowId: options.definition.id.value,
      correlationId: options.definition.correlationId,
      definition: options.definition,
      graph: options.graph,
      plan,
      cursor: new WorkflowExecutionCursor({ completedNodeIds: [] }),
      state: WorkflowExecutionState.Pending,
      history: [],
      snapshot: () =>
        new WorkflowExecutionSnapshot({
          workflowId: options.definition.id.value,
          state: WorkflowExecutionState.Pending,
          cursor: new WorkflowExecutionCursor({ completedNodeIds: [] }),
          metadata: { workflowId: options.definition.id.value },
        }),
    };
    return this.coordinator.execute(plan, context);
  }
}
