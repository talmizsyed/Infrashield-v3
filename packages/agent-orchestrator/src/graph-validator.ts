import { GraphValidationException } from './foundation.js';
import type { OrchestrationGraphDefinition } from './foundation.js';
import { CycleDetector } from './cycle-detector.js';

export interface GraphValidatorNodeLike {
  readonly id: string;
  readonly agentId: string;
  readonly dependsOn?: readonly string[];
}

export interface GraphValidatorLike {
  readonly id: string;
  readonly name: string;
  readonly nodes: readonly GraphValidatorNodeLike[];
  readonly entryNodeId: string;
  readonly exitNodeId: string;
}

export class GraphValidator {
  public constructor(private readonly cycleDetector = new CycleDetector()) {}

  public validateDefinition(definition: OrchestrationGraphDefinition): void {
    if (!definition.id.trim()) {
      throw new GraphValidationException('Graph id is required');
    }
    if (!definition.name.trim()) {
      throw new GraphValidationException('Graph name is required');
    }
    if (definition.nodes.length === 0) {
      throw new GraphValidationException('Graph must contain at least one node');
    }

    const nodeIds = new Set<string>();
    for (const node of definition.nodes) {
      if (!node.id.trim()) {
        throw new GraphValidationException('Node id is required');
      }
      if (!node.agentId.trim()) {
        throw new GraphValidationException(`Node ${node.id} requires an agentId`);
      }
      if (nodeIds.has(node.id)) {
        throw new GraphValidationException(`Duplicate node id: ${node.id}`);
      }
      nodeIds.add(node.id);
    }

    for (const node of definition.nodes) {
      for (const dependencyId of node.dependsOn ?? []) {
        if (!nodeIds.has(dependencyId)) {
          throw new GraphValidationException(
            `Node ${node.id} depends on unknown node ${dependencyId}`,
          );
        }
        if (dependencyId === node.id) {
          throw new GraphValidationException(`Node ${node.id} cannot depend on itself`);
        }
      }
    }

    if (definition.entryNodeId && !nodeIds.has(definition.entryNodeId)) {
      throw new GraphValidationException(`Entry node ${definition.entryNodeId} does not exist`);
    }
    if (definition.exitNodeId && !nodeIds.has(definition.exitNodeId)) {
      throw new GraphValidationException(`Exit node ${definition.exitNodeId} does not exist`);
    }

    if (this.cycleDetector.hasCycle(definition.nodes)) {
      throw new GraphValidationException('Execution graph contains a cycle');
    }
  }

  public validateGraph(graph: GraphValidatorLike): void {
    const nodeIds = new Set(graph.nodes.map((node) => node.id));

    if (graph.entryNodeId && !nodeIds.has(graph.entryNodeId)) {
      throw new GraphValidationException(`Entry node ${graph.entryNodeId} does not exist`);
    }
    if (graph.exitNodeId && !nodeIds.has(graph.exitNodeId)) {
      throw new GraphValidationException(`Exit node ${graph.exitNodeId} does not exist`);
    }

    if (this.cycleDetector.hasCycle(graph.nodes)) {
      throw new GraphValidationException('Execution graph contains a cycle');
    }
  }
}
