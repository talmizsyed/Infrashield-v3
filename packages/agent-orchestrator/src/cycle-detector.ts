export interface CycleDetectorNodeLike {
  readonly id: string;
  readonly dependsOn?: readonly string[];
}

export class CycleDetector {
  public detect(nodes: readonly CycleDetectorNodeLike[]): readonly string[] | undefined {
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const path: string[] = [];
    const nodeMap = new Map(nodes.map((node) => [node.id, node] as const));

    const visit = (nodeId: string): readonly string[] | undefined => {
      if (visiting.has(nodeId)) {
        const cycleStartIndex = path.indexOf(nodeId);
        return cycleStartIndex >= 0 ? [...path.slice(cycleStartIndex), nodeId] : [nodeId, nodeId];
      }

      if (visited.has(nodeId)) {
        return undefined;
      }

      const node = nodeMap.get(nodeId);
      if (!node) {
        return undefined;
      }

      visiting.add(nodeId);
      path.push(nodeId);

      for (const dependencyId of node.dependsOn ?? []) {
        const cycle = visit(dependencyId);
        if (cycle) {
          return cycle;
        }
      }

      path.pop();
      visiting.delete(nodeId);
      visited.add(nodeId);
      return undefined;
    };

    for (const node of nodes) {
      const cycle = visit(node.id);
      if (cycle) {
        return cycle;
      }
    }

    return undefined;
  }

  public hasCycle(nodes: readonly CycleDetectorNodeLike[]): boolean {
    return this.detect(nodes) !== undefined;
  }
}
