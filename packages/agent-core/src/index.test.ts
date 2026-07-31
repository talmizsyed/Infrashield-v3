import { describe, expect, it } from 'vitest';
import {
  AgentCapabilities,
  AgentConfiguration,
  AgentContext,
  AgentContextBuilder,
  AgentContextBuilderException,
  AgentContextException,
  AgentException,
  AgentConversationContext,
  AgentEnvironmentContext,
  AgentExecution,
  AgentExecutionContext,
  AgentExecutionResult,
  AgentHost,
  AgentIdentity,
  AgentKernel,
  AgentKnowledgeContext,
  AgentLifecycle,
  AgentMemoryContext,
  AgentRegistry,
  AgentRuntimeContext,
  AgentSession,
  AgentStateContext,
  AgentStatus,
  AgentTaskContext,
  AgentWorkingMemory,
  ConversationMemoryException,
  KnowledgeMemoryException,
  AgentMemoryException,
} from './index';

describe('agent-core', () => {
  it('creates a kernel and transitions through lifecycle states', async () => {
    const identity = new AgentIdentity('agent-1', 'Planner');
    const capabilities = new AgentCapabilities({ reasoning: true, planning: true });
    const configuration = new AgentConfiguration({
      identity,
      capabilities,
      enabled: true,
    });
    const kernel = new AgentKernel(configuration);

    expect(kernel.getStatus()).toBe(AgentStatus.Created);

    const initialization = await kernel.initialize();
    expect(initialization.succeeded).toBe(true);
    expect(kernel.getStatus()).toBe(AgentStatus.Initialized);

    const started = await kernel.start();
    expect(started.succeeded).toBe(true);
    expect(kernel.getStatus()).toBe(AgentStatus.Running);

    const paused = await kernel.pause();
    expect(paused.succeeded).toBe(true);
    expect(kernel.getStatus()).toBe(AgentStatus.Paused);

    const resumed = await kernel.resume();
    expect(resumed.succeeded).toBe(true);
    expect(kernel.getStatus()).toBe(AgentStatus.Running);
  });

  it('builds an execution context and returns an execution result', async () => {
    const kernel = new AgentKernel(
      new AgentConfiguration({
        identity: new AgentIdentity('agent-2', 'Worker'),
        capabilities: new AgentCapabilities({ toolUsage: true }),
      }),
    );

    await kernel.initialize();
    const context = kernel.createContext('task-1', 'summarize input');
    expect(context).toBeInstanceOf(AgentContext);
    expect(context.getSession().getId()).toBeDefined();

    const execution = await kernel.execute('task-1', 'summarize input');
    expect(execution.succeeded).toBe(true);
    expect(execution.data).toBeInstanceOf(AgentExecutionResult);
    expect(execution.data?.status).toBe(AgentStatus.Completed);
  });

  it('maintains sessions and registry entries', async () => {
    const host = new AgentHost();
    const kernel = new AgentKernel(
      new AgentConfiguration({
        identity: new AgentIdentity('agent-3', 'Coordinator'),
        capabilities: new AgentCapabilities({ collaboration: true }),
      }),
    );

    const session = kernel.createSession();
    expect(session).toBeInstanceOf(AgentSession);

    host.register(kernel);
    const registered = host.get(kernel.getId());
    expect(registered).toBeDefined();

    const registry = new AgentRegistry();
    registry.register(kernel);
    expect(registry.get(kernel.getId())).toBeDefined();
  });

  it('creates lifecycle and execution objects with immutable state', () => {
    const lifecycle = new AgentLifecycle();
    const execution = new AgentExecution({
      id: 'exec-1',
      task: 'inspect',
      context: new AgentContext(
        new AgentConfiguration({ identity: new AgentIdentity('agent-4', 'Inspector') }),
      ),
    });

    expect(lifecycle.getStatus()).toBe(AgentStatus.Created);
    expect(execution.getTask()).toBe('inspect');
    expect(execution.getContext().getSession().getId()).toBeDefined();
  });

  it('throws a clear exception for invalid configuration', () => {
    expect(
      () =>
        new AgentConfiguration({
          identity: new AgentIdentity('', 'Missing id'),
          capabilities: new AgentCapabilities(),
        }),
    ).toThrow(AgentException);
  });

  it('builds a rich execution context with memory, conversation, and knowledge layers', () => {
    const builder = new AgentContextBuilder('plan-research');
    const workingMemory = new AgentWorkingMemory();
    workingMemory.setFact('objective', 'analyze the incident');
    workingMemory.setVariable('confidence', 0.91);
    workingMemory.setCurrentTask('investigate');

    const conversationContext = new AgentConversationContext();
    conversationContext.appendMessage('system', 'You are a helpful assistant.');
    conversationContext.appendMessage('user', 'Investigate the incident.');

    const knowledgeContext = new AgentKnowledgeContext();
    knowledgeContext.attachReference('doc://knowledge/1');
    knowledgeContext.attachRetrievedDocument('doc://knowledge/1');

    const runtimeContext = new AgentRuntimeContext('workflow-1', 'gpt-4o', 'openai');
    const environmentContext = new AgentEnvironmentContext('prod', 'us-east-1');
    const taskContext = new AgentTaskContext('investigate', 'Review the alert');
    const stateContext = new AgentStateContext();
    const memoryContext = new AgentMemoryContext();

    const context = builder
      .withWorkingMemory(workingMemory)
      .withConversationContext(conversationContext)
      .withKnowledgeContext(knowledgeContext)
      .withRuntimeContext(runtimeContext)
      .withEnvironmentContext(environmentContext)
      .withTaskContext(taskContext)
      .withStateContext(stateContext)
      .withMemoryContext(memoryContext)
      .build();

    expect(context).toBeInstanceOf(AgentExecutionContext);
    expect(context.runtime.workflowId).toBe('workflow-1');
    expect(context.memory.workingMemory.getFacts().get('objective')).toBe('analyze the incident');
    expect(context.conversation.messages).toHaveLength(2);
    expect(context.knowledge.knowledgeReferences).toHaveLength(1);
    expect(context.observability.knowledgeReferences).toBe(1);
  });

  it('creates immutable snapshots and isolates later mutations', () => {
    const workingMemory = new AgentWorkingMemory();
    workingMemory.setFact('stage', 'draft');

    const snapshot = workingMemory.createSnapshot();
    workingMemory.setFact('stage', 'ready');

    expect(snapshot.facts.get('stage')).toBe('draft');
    expect(workingMemory.createSnapshot().facts.get('stage')).toBe('ready');
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it('throws typed exceptions for invalid memory and builder operations', () => {
    const memory = new AgentWorkingMemory();
    expect(() => memory.setFact('', 'value')).toThrow(AgentMemoryException);

    const builder = new AgentContextBuilder('');
    expect(() => builder.build()).toThrow(AgentContextBuilderException);

    const conversation = new AgentConversationContext();
    expect(() => conversation.appendMessage('', 'content')).toThrow(ConversationMemoryException);

    const knowledge = new AgentKnowledgeContext();
    expect(() => knowledge.attachReference('')).toThrow(KnowledgeMemoryException);

    expect(() => {
      throw new AgentContextException('context failed');
    }).toThrow(AgentContextException);
  });
});
