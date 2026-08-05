import { NodeExecutionMode } from './foundation.js';
import type { OrchestrationGraphDefinition, OrchestrationNodeDefinition } from './foundation.js';
import { DependencyResolver } from './dependency-resolver.js';
import { GraphValidator } from './graph-validator.js';

export class ExecutionEdge {
  public readonly sourceId: string;
  public readonly targetId: string;

  public constructor(options: { readonly sourceId: string; readonly targetId: string }) {
    this.sourceId = options.sourceId;
    this.targetId = options.targetId;
  }
}

export class ExecutionNode {
  public readonly id: string;
  public readonly agentId: string;
  public readonly mode: NodeExecutionMode;
  public readonly dependsOn: readonly string[];
  public readonly condition?: string;
  public readonly loop?: { readonly maxIterations: number };
  public readonly retry?: { readonly maxAttempts: number; readonly delayMs?: number };
  public readonly metadata: Readonly<Record<string, unknown>>;

  public constructor(definition: OrchestrationNodeDefinition) {
    this.id = definition.id;
    this.agentId = definition.agentId;
    this.mode = definition.mode ?? NodeExecutionMode.Sequential;
    this.dependsOn = Object.freeze([...(definition.dependsOn ?? [])]);
    this.condition = definition.condition;
    this.loop = definition.loop ? Object.freeze({ ...definition.loop }) : undefined;
    this.retry = definition.retry ? Object.freeze({ ...definition.retry }) : undefined;
    this.metadata = Object.freeze({ ...(definition.metadata ?? {}) });
  }
}

export class ExecutionGraph {
  private readonly validator = new GraphValidator();
  private readonly resolver = new DependencyResolver();
  private readonly resolution: ReturnType<DependencyResolver['resolve']>;

  public readonly id: string;
  public readonly name: string;
  public readonly nodes: readonly ExecutionNode[];
  public readonly edges: readonly ExecutionEdge[];
  public readonly entryNodeId: string;
  public readonly exitNodeId: string;
  public readonly metadata: Readonly<Record<string, unknown>>;

  public constructor(definition: OrchestrationGraphDefinition) {
    this.validator.validateDefinition(definition);
    this.id = definition.id;
    this.name = definition.name;
    this.nodes = Object.freeze(definition.nodes.map((node) => new ExecutionNode(node)));
    this.edges = Object.freeze(this.buildEdges(definition.nodes));
    this.entryNodeId = definition.entryNodeId ?? definition.nodes[0]?.id ?? '';
    this.exitNodeId =
      definition.exitNodeId ?? definition.nodes[definition.nodes.length - 1]?.id ?? '';
    this.metadata = Object.freeze({ ...(definition.metadata ?? {}) });
    this.resolution = this.resolver.resolve(this.nodes);
    this.validate();
  }

  public validate(): void {
    this.validator.validateGraph(this);
  }

  public getNode(nodeId: string): ExecutionNode | undefined {
    return this.nodes.find((node) => node.id === nodeId);
  }

  public getDependents(nodeId: string): readonly string[] {
    return this.resolution.dependentsMap[nodeId] ?? [];
  }

  public getDependencies(nodeId: string): readonly string[] {
    return this.resolution.dependencyMap[nodeId] ?? [];
  }

  public getTopologicalOrder(): readonly string[] {
    return this.resolution.topologicalOrder;
  }

  public getParallelGroups(): readonly (readonly string[])[] {
    return this.resolution.parallelGroups;
  }

  private buildEdges(nodes: readonly OrchestrationNodeDefinition[]): ExecutionEdge[] {
    const edges: ExecutionEdge[] = [];
    for (const node of nodes) {
      for (const dependencyId of node.dependsOn ?? []) {
        edges.push(new ExecutionEdge({ sourceId: dependencyId, targetId: node.id }));
      }
    }
    return edges;
  }
}

export class ExecutionGraphSnapshot {
  public readonly id: string;
  public readonly name: string;
  public readonly nodeIds: readonly string[];
  public readonly edgeCount: number;
  public readonly entryNodeId: string;
  public readonly exitNodeId: string;
  public readonly createdAt: string;

  public constructor(graph: ExecutionGraph) {
    this.id = graph.id;
    this.name = graph.name;
    this.nodeIds = Object.freeze(graph.nodes.map((node) => node.id));
    this.edgeCount = graph.edges.length;
    this.entryNodeId = graph.entryNodeId;
    this.exitNodeId = graph.exitNodeId;
    this.createdAt = new Date().toISOString();
  }
}
