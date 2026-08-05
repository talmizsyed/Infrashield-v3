import type { Identifier, TimestampString } from '@infrashield/contracts';

import { ExecutionGraph } from './execution-graph.js';
import { PlanningException } from './foundation.js';
import type { OrchestrationPlanResult } from './foundation.js';

export class ExecutionPlan {
  public readonly workflowId: Identifier;
  public readonly graphId: string;
  public readonly topologicalOrder: readonly string[];
  public readonly entryNodeId: string;
  public readonly exitNodeId: string;
  public readonly parallelGroups: readonly (readonly string[])[];
  public readonly dependencyMap: Readonly<Record<string, readonly string[]>>;
  public readonly dependentsMap: Readonly<Record<string, readonly string[]>>;
  public readonly createdAt: TimestampString;

  public constructor(options: {
    readonly workflowId: Identifier;
    readonly graph: ExecutionGraph;
    readonly topologicalOrder: readonly string[];
    readonly parallelGroups: readonly (readonly string[])[];
    readonly dependencyMap: Readonly<Record<string, readonly string[]>>;
    readonly dependentsMap: Readonly<Record<string, readonly string[]>>;
    readonly createdAt?: TimestampString;
  }) {
    this.workflowId = options.workflowId;
    this.graphId = options.graph.id;
    this.topologicalOrder = Object.freeze([...options.topologicalOrder]);
    this.entryNodeId = options.graph.entryNodeId;
    this.exitNodeId = options.graph.exitNodeId;
    this.parallelGroups = Object.freeze(
      options.parallelGroups.map((group) => Object.freeze([...group])),
    );
    this.dependencyMap = Object.freeze({ ...options.dependencyMap });
    this.dependentsMap = Object.freeze({ ...options.dependentsMap });
    this.createdAt = options.createdAt ?? new Date().toISOString();
  }

  public toResult(): OrchestrationPlanResult {
    return {
      workflowId: this.workflowId,
      graphId: this.graphId,
      topologicalOrder: this.topologicalOrder,
      entryNodeId: this.entryNodeId,
      exitNodeId: this.exitNodeId,
      parallelGroups: this.parallelGroups,
      validated: true,
      createdAt: this.createdAt,
    };
  }
}

export class ExecutionPlanner {
  public plan(options: {
    readonly workflowId: Identifier;
    readonly graph: ExecutionGraph;
  }): ExecutionPlan {
    options.graph.validate();

    const nodeIds = options.graph.nodes.map((node) => node.id);
    const adjacency = new Map<string, string[]>();
    const incoming = new Map<string, number>();
    const dependencyMap: Record<string, string[]> = {};
    const dependentsMap: Record<string, string[]> = {};

    for (const nodeId of nodeIds) {
      adjacency.set(nodeId, []);
      incoming.set(nodeId, 0);
      dependencyMap[nodeId] = [];
      dependentsMap[nodeId] = [];
    }

    for (const edge of options.graph.edges) {
      adjacency.get(edge.sourceId)?.push(edge.targetId);
      incoming.set(edge.targetId, (incoming.get(edge.targetId) ?? 0) + 1);
      dependencyMap[edge.targetId]?.push(edge.sourceId);
      dependentsMap[edge.sourceId]?.push(edge.targetId);
    }

    const queue: string[] = [];
    for (const nodeId of nodeIds) {
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
      for (const childId of adjacency.get(nodeId) ?? []) {
        const nextCount = (incoming.get(childId) ?? 0) - 1;
        incoming.set(childId, nextCount);
        if (nextCount === 0) {
          queue.push(childId);
        }
      }
    }

    if (topologicalOrder.length !== nodeIds.length) {
      throw new PlanningException('Unable to resolve execution graph dependencies');
    }

    const parallelGroups = this.buildParallelGroups(options.graph, topologicalOrder);

    return new ExecutionPlan({
      workflowId: options.workflowId,
      graph: options.graph,
      topologicalOrder,
      parallelGroups,
      dependencyMap,
      dependentsMap,
    });
  }

  private buildParallelGroups(
    graph: ExecutionGraph,
    topologicalOrder: readonly string[],
  ): readonly (readonly string[])[] {
    const groups: string[][] = [];
    const assigned = new Set<string>();
    const depthMap = new Map<string, number>();

    for (const nodeId of topologicalOrder) {
      const dependencies = graph.getDependencies(nodeId);
      const depth =
        dependencies.length === 0
          ? 0
          : Math.max(...dependencies.map((depId) => (depthMap.get(depId) ?? 0) + 1));
      depthMap.set(nodeId, depth);
    }

    const depthGroups = new Map<number, string[]>();
    for (const node of graph.nodes) {
      const depth = depthMap.get(node.id) ?? 0;
      const group = depthGroups.get(depth) ?? [];
      group.push(node.id);
      depthGroups.set(depth, group);
    }

    for (const depth of [...depthGroups.keys()].sort((a, b) => a - b)) {
      const candidates = (depthGroups.get(depth) ?? []).filter((nodeId) => !assigned.has(nodeId));
      if (candidates.length === 0) {
        continue;
      }

      const parallelNodes = candidates.filter((nodeId) => {
        const node = graph.getNode(nodeId);
        return node?.mode === 'parallel' || node?.mode === 'fan-out';
      });

      if (parallelNodes.length > 1) {
        groups.push(parallelNodes);
        for (const nodeId of parallelNodes) {
          assigned.add(nodeId);
        }
      }

      const sequentialNodes = candidates.filter((nodeId) => !assigned.has(nodeId));
      for (const nodeId of sequentialNodes) {
        groups.push([nodeId]);
        assigned.add(nodeId);
      }
    }

    return groups;
  }
}
