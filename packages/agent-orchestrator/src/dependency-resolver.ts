import { NodeExecutionMode } from './foundation.js';

export interface DependencyResolverNodeLike {
  readonly id: string;
  readonly dependsOn: readonly string[];
  readonly mode: NodeExecutionMode;
}

export interface DependencyResolution {
  readonly dependencyMap: Readonly<Record<string, readonly string[]>>;
  readonly dependentsMap: Readonly<Record<string, readonly string[]>>;
  readonly topologicalOrder: readonly string[];
  readonly parallelGroups: readonly (readonly string[])[];
}

export class DependencyResolver {
  public resolve(nodes: readonly DependencyResolverNodeLike[]): DependencyResolution {
    const nodeIds = nodes.map((node) => node.id);
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

    for (const node of nodes) {
      for (const dependencyId of node.dependsOn) {
        adjacency.get(dependencyId)?.push(node.id);
        incoming.set(node.id, (incoming.get(node.id) ?? 0) + 1);
        dependencyMap[node.id]?.push(dependencyId);
        dependentsMap[dependencyId]?.push(node.id);
      }
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

    const depthMap = new Map<string, number>();
    for (const nodeId of topologicalOrder) {
      const dependencies = dependencyMap[nodeId] ?? [];
      const depth =
        dependencies.length === 0
          ? 0
          : Math.max(...dependencies.map((dependencyId) => (depthMap.get(dependencyId) ?? 0) + 1));
      depthMap.set(nodeId, depth);
    }

    const depthGroups = new Map<number, string[]>();
    for (const node of nodes) {
      const depth = depthMap.get(node.id) ?? 0;
      const group = depthGroups.get(depth) ?? [];
      group.push(node.id);
      depthGroups.set(depth, group);
    }

    const parallelGroups: string[][] = [];
    const assigned = new Set<string>();
    for (const depth of [...depthGroups.keys()].sort((left, right) => left - right)) {
      const candidates = (depthGroups.get(depth) ?? []).filter((nodeId) => !assigned.has(nodeId));
      if (candidates.length === 0) {
        continue;
      }

      const parallelNodes = candidates.filter((nodeId) => {
        const node = nodes.find((candidate) => candidate.id === nodeId);
        return node?.mode === NodeExecutionMode.Parallel || node?.mode === NodeExecutionMode.FanOut;
      });

      if (parallelNodes.length > 1) {
        parallelGroups.push(parallelNodes);
        for (const nodeId of parallelNodes) {
          assigned.add(nodeId);
        }
      }

      const sequentialNodes = candidates.filter((nodeId) => !assigned.has(nodeId));
      for (const nodeId of sequentialNodes) {
        parallelGroups.push([nodeId]);
        assigned.add(nodeId);
      }
    }

    return {
      dependencyMap: Object.freeze({ ...dependencyMap }),
      dependentsMap: Object.freeze({ ...dependentsMap }),
      topologicalOrder: Object.freeze([...topologicalOrder]),
      parallelGroups: Object.freeze(parallelGroups.map((group) => Object.freeze([...group]))),
    };
  }
}
