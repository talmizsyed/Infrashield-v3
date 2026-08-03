import type { Identifier, SerializableValueObject } from '@infrashield/contracts';
import {
  ApprovalDecisionType,
  ApprovalEngine,
  ApprovalPolicy,
  ApprovalRequest,
  ApprovalRiskAssessment,
  ApprovalRiskLevel,
  ApprovalStatus,
  ApprovalWorkflow,
} from '@infrashield/governance';
import { PlanningContext, PlanningEngine, PlanningGoal } from '@infrashield/agent-core';
import {
  Context,
  TraceContext,
  KnowledgeMetadata,
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeGraphManager,
} from '@infrashield/context';
import {
  MemoryCategory,
  MemoryManager,
  MemoryType,
  MemoryEntry,
  MemoryMetadata,
} from '@infrashield/ai-memory';
import {
  AIGateway,
  AIExecutionRequest,
  AIProvider,
  AIProviderCapabilities,
  AIProviderDescriptor,
  AIExecutionResponse,
} from '@infrashield/ai-core';
import {
  WorkflowBuilder,
  WorkflowExecutionCoordinator,
  WorkflowExecutionEngine,
  WorkflowGraph,
  WorkflowStepBuilder,
} from '@infrashield/workflow-engine';
import {
  ToolDefinition,
  ToolExecutionRequest,
  ToolHost,
  ToolManifest,
  ToolType,
  ToolVersion,
} from '@infrashield/agent-core';
import { RuntimeEngine, RuntimeExecutionOptions } from './runtime-engine.js';
import { Runtime } from './runtime-foundation.js';
import { ServiceRegistry } from './registry.js';
import { ExecutionResult as RuntimeExecutionResultBase } from './common.js';
import { LifecycleManager } from './lifecycle.js';
import { ExecutionPipeline } from './pipeline.js';
import { MiddlewareExecutor } from './middleware.js';
import { RetryManager } from './retry.js';
import { ExecutionStatus } from '@agentic/sdk';

export interface UnifiedAgentRuntimeRequest {
  readonly requestId: Identifier;
  readonly input: string;
  readonly metadata?: SerializableValueObject;
}

export interface UnifiedAgentRuntimeResult {
  readonly executionId: Identifier;
  readonly correlationId: Identifier;
  readonly timeline: readonly string[];
  readonly executedTools: readonly string[];
  readonly providerResponses: readonly AIExecutionResponse[];
  readonly memoryUpdates: readonly MemoryEntry[];
  readonly knowledgeGraphUpdates: ReadonlyArray<{ node?: KnowledgeNode; edge?: KnowledgeEdge }>;
  readonly observabilityEvents: readonly string[];
  readonly finalOutput: SerializableValueObject;
}

export class UnifiedAgentRuntime {
  private readonly planningEngine = new PlanningEngine();
  private workflowEngine!: WorkflowExecutionEngine;
  private readonly approvalEngine = new ApprovalEngine();
  private readonly memoryManager = new MemoryManager();
  private readonly aiGateway = new AIGateway();
  private readonly toolHost = new ToolHost();
  private readonly knowledgeGraph = new KnowledgeGraphManager();
  private readonly registry = new ServiceRegistry({ runtimeId: 'unified-runtime' });
  private readonly runtimeEngine: RuntimeEngine;

  public constructor() {
    const middlewareExecutor = new MiddlewareExecutor({
      middleware: [],
      eventDispatcher: this.registry.eventDispatcher,
    });
    const pipeline = new ExecutionPipeline('unified-pipeline', middlewareExecutor);
    const lifecycleManager = new LifecycleManager(this.registry.hooks);
    const terminalExecutor = {
      async execute(
        agent: { id: string; name: string },
        context: { executionId: string },
      ): Promise<RuntimeExecutionResultBase> {
        return new RuntimeExecutionResultBase({
          executionId: context.executionId,
          status: ExecutionStatus.Completed,
          succeeded: true,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          output: { agentId: agent.id, agentName: agent.name },
        });
      },
    };

    this.runtimeEngine = new RuntimeEngine({
      configuration: { runtimeId: 'unified-runtime', environment: 'demo' },
      services: this.registry,
      executor: terminalExecutor as never,
      pipeline,
      lifecycleManager,
      retryManager: new RetryManager(),
    });

    const workflowRuntime = new Runtime({ id: 'workflow-runtime', name: 'workflow-runtime' });
    this.workflowEngine = new WorkflowExecutionEngine({
      coordinator: new WorkflowExecutionCoordinator({ runtime: workflowRuntime as never }),
    });

    this.initializeInfrastructure();
  }

  public async execute(request: UnifiedAgentRuntimeRequest): Promise<UnifiedAgentRuntimeResult> {
    await this.initializeInfrastructure();

    const executionId = `exec-${Date.now()}`;
    const correlationId = request.requestId;
    const timeline: string[] = [];
    const observabilityEvents: string[] = [];
    const executedTools: string[] = [];
    const providerResponses: AIExecutionResponse[] = [];
    const memoryUpdates: MemoryEntry[] = [];
    const knowledgeGraphUpdates: Array<{ node?: KnowledgeNode; edge?: KnowledgeEdge }> = [];

    const emit = (event: string, payload?: SerializableValueObject): void => {
      timeline.push(event);
      observabilityEvents.push(`${event}:${JSON.stringify(payload ?? {})}`);
    };

    emit('REQUEST_RECEIVED', { requestId: request.requestId, input: request.input });

    this.createContext(request);
    emit('CONTEXT_READY', { requestId: request.requestId, correlationId });

    const memoryEntry = await this.memoryManager.store({
      id: `mem-${executionId}`,
      key: `request:${request.requestId}`,
      category: MemoryCategory.Working,
      type: MemoryType.Execution,
      value: { input: request.input, metadata: request.metadata ?? {} },
      scope: 'execution',
      metadata: new MemoryMetadata({ scope: 'execution', tags: ['request'] }),
      providerId: 'inmemory',
    });
    memoryUpdates.push(memoryEntry);
    emit('MEMORY_READY', { memoryId: memoryEntry.id });

    const goal = new PlanningGoal({
      id: `goal-${executionId}`,
      title: 'Resolve request',
      description: request.input,
      priority: 'high',
      metadata: { requestId: request.requestId },
    });
    const planningContext = new PlanningContext({
      goal,
      tenant: (request.metadata?.tenantId as string | undefined) ?? 'default',
      metadata: { requestId: request.requestId },
    });
    const planningSnapshot = await this.planningEngine.plan(goal, planningContext);
    emit('PLAN_CREATED', {
      sessionId: planningSnapshot.sessionId,
      taskCount: planningSnapshot.tasks.length,
    });

    const workflowDefinition = new WorkflowBuilder()
      .withId(`workflow-${executionId}`)
      .withName('Unified request workflow')
      .withOwner('platform')
      .withCorrelationId(correlationId)
      .withVersion('1.0.0')
      .withMetadata({ requestId: request.requestId })
      .withTags(['unified-runtime'])
      .build();
    const entryStep = new WorkflowStepBuilder()
      .withId('step-1')
      .withName('Route and execute')
      .withVersion('1.0.0')
      .build();
    const exitStep = new WorkflowStepBuilder()
      .withId('step-2')
      .withName('Finalize response')
      .withVersion('1.0.0')
      .build();
    const graph = new WorkflowGraph({
      id: `graph-${executionId}`,
      name: 'Unified workflow graph',
      version: '1.0.0',
      steps: [entryStep, exitStep],
      entryNodeId: entryStep.id.toString(),
      exitNodeId: exitStep.id.toString(),
      edges: [],
    });
    const workflowResult = await this.workflowEngine.execute({
      definition: workflowDefinition,
      graph,
    });
    emit('WORKFLOW_CREATED', {
      workflowId: workflowDefinition.id.value,
      state: workflowResult.status,
    });

    const approvalRequest = new ApprovalRequest({
      id: `approval-${executionId}`,
      title: 'Execute request',
      operation: 'execute',
      requestorId: 'platform',
      approvers: ['operator'],
      policy: new ApprovalPolicy({ autoApproveOnLowRisk: true, allowDelegation: true }),
      workflow: new ApprovalWorkflow({
        id: 'approval-workflow',
        name: 'default',
        mode: 'automatic' as never,
      }),
      riskAssessment: new ApprovalRiskAssessment({
        level: ApprovalRiskLevel.Low,
        score: 5,
        threshold: 50,
      }),
    });
    const approvalResponse = await this.approvalEngine.submit(approvalRequest);
    if (approvalResponse.status !== ApprovalStatus.Approved) {
      emit('REQUEST_FAILED', { reason: 'approval-required' });
      return this.buildResult({
        executionId,
        correlationId,
        timeline,
        executedTools,
        providerResponses,
        memoryUpdates,
        knowledgeGraphUpdates,
        observabilityEvents,
        finalOutput: { status: 'rejected' },
      });
    }
    emit('APPROVAL_GRANTED', {
      requestId: request.requestId,
      decision: approvalResponse.decision?.decision ?? ApprovalDecisionType.Approve,
    });

    await this.runtimeEngine.initialize();
    await this.runtimeEngine.start();
    await this.runtimeEngine.execute(
      {
        id: 'agent-1',
        name: 'UnifiedAgent',
        version: '1.0.0',
        capabilities: [],
        plugins: [],
        tools: [],
      } as never,
      this.runtimeEngine.createExecutionContext({
        executionId,
        correlationId,
        traceId: `trace-${executionId}`,
        variables: { requestId: request.requestId, input: request.input },
        metadata: { requestId: request.requestId },
      }),
      { retryPolicy: undefined } as RuntimeExecutionOptions,
    );
    emit('EXECUTION_STARTED', { executionId });

    const toolDefinition = new ToolDefinition({
      id: 'tool-route-request',
      name: 'route-request',
      version: new ToolVersion('1.0.0'),
      type: ToolType.CustomTool,
      manifest: new ToolManifest({
        id: 'tool-route-request',
        name: 'route-request',
        type: ToolType.CustomTool,
      }),
      description: 'Routes a request to the provider',
    });
    this.toolHost.register(toolDefinition);
    const toolResult = await this.toolHost.execute(
      new ToolExecutionRequest({ toolId: toolDefinition.id, input: request.input }),
    );
    executedTools.push(toolDefinition.id);
    emit('TOOL_EXECUTED', { toolId: toolDefinition.id, status: toolResult.status });

    const providerRequest = new AIExecutionRequest({
      id: `provider-${executionId}`,
      providerId: 'demo-provider',
      input: request.input,
      operation: 'chat',
      metadata: { requestId: request.requestId },
    });
    const providerResponse = await this.invokeProvider(providerRequest);
    providerResponses.push(providerResponse);
    emit('PROVIDER_EXECUTED', { providerId: providerResponse.providerId });

    const node = await this.knowledgeGraph.createEntity({
      id: `node-${executionId}`,
      name: `Request ${request.requestId}`,
      type: 'workflow',
      tenantId: (request.metadata?.tenantId as string | undefined) ?? 'default',
      metadata: new KnowledgeMetadata({ scope: 'knowledge' }),
    } as never);
    const edge = await this.knowledgeGraph.createRelationship({
      id: `edge-${executionId}`,
      type: 'references',
      fromId: node.id,
      toId: `goal-${executionId}`,
      tenantId: (request.metadata?.tenantId as string | undefined) ?? 'default',
    } as never);
    knowledgeGraphUpdates.push({ node, edge });
    emit('KNOWLEDGE_UPDATED', { nodeId: node.id, edgeId: edge.id });

    emit('REQUEST_COMPLETED', { requestId: request.requestId, executionId });

    return this.buildResult({
      executionId,
      correlationId,
      timeline,
      executedTools,
      providerResponses,
      memoryUpdates,
      knowledgeGraphUpdates,
      observabilityEvents,
      finalOutput: { status: 'completed', output: providerResponse.output ?? {} },
    });
  }

  private createContext(request: UnifiedAgentRuntimeRequest): Context {
    return {
      request: {
        requestId: request.requestId,
        correlationId: request.requestId,
        trace: new Proxy({}, { get: () => undefined }) as TraceContext,
        metadata: request.metadata,
      },
      execution: {
        executionId: `exec-${Date.now()}`,
        timestamp: new Date().toISOString(),
        context: {
          requestId: request.requestId,
          correlationId: request.requestId,
        } as never,
      },
    } as Context;
  }

  private buildResult(result: UnifiedAgentRuntimeResult): UnifiedAgentRuntimeResult {
    return result;
  }

  private async initializeInfrastructure(): Promise<void> {
    await this.aiGateway.initialize();
    const provider = this.createDemoProvider();
    if (!this.aiGateway.providerRegistry.get(provider.descriptor.id)) {
      await this.aiGateway.registerProvider(provider);
    }
  }

  private createDemoProvider(): AIProvider {
    return new (class extends AIProvider {
      public constructor() {
        super(
          new AIProviderDescriptor({
            id: 'demo-provider',
            name: 'Demo Provider',
            version: '1.0.0',
            capabilities: [new AIProviderCapabilities({ kind: 'chat', supported: true })],
          }),
        );
      }

      public async initialize(): Promise<void> {
        await super.initialize();
      }

      public async validate(): Promise<void> {
        await super.validate();
      }

      public async execute(request: AIExecutionRequest): Promise<AIExecutionResponse> {
        return new AIExecutionResponse({
          id: request.id,
          providerId: request.providerId,
          status: 'success',
          output: { text: `handled:${request.input}` },
        });
      }

      public async stream(request: AIExecutionRequest): Promise<AIExecutionResponse> {
        return this.execute(request);
      }

      public async shutdown(): Promise<void> {
        await super.shutdown();
      }

      public async discoverCapabilities(): Promise<readonly AIProviderCapabilities[]> {
        return this.descriptor.capabilities;
      }

      public async discoverModels(): Promise<readonly never[]> {
        return [];
      }

      public async estimateTokens(_request: AIExecutionRequest): Promise<number> {
        return 0;
      }

      public async estimateCost(_request: AIExecutionRequest): Promise<number> {
        return 0;
      }
    })();
  }

  private async invokeProvider(_request: AIExecutionRequest): Promise<AIExecutionResponse> {
    return this.aiGateway.execute(_request);
  }
}
