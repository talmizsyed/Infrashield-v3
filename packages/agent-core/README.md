# Agent Core

The agent-core package provides the reusable enterprise abstractions for agent execution context, memory, lifecycle orchestration, and planning.

## Architecture

- AgentKernel owns lifecycle, execution, and session orchestration for an agent instance.
- AgentContextBuilder creates a rich execution context from working memory, conversation memory, knowledge memory, runtime state, task metadata, and environment context.
- AgentExecutionContext is an immutable runtime container for the active execution state.
- AgentWorkingMemory, AgentConversationContext, and AgentKnowledgeContext model provider-agnostic memory layers that future packages can implement with in-memory, Redis, Neo4j, vector, or cloud backends.

## Memory abstraction

The abstractions support:

- Working memory: facts, variables, scratchpad, goals, current task, execution metadata.
- Conversation memory: messages, turns, summaries, system instructions, user instructions.
- Knowledge memory: knowledge references, retrieved documents, evidence, confidence.
- Execution and environment context: workflow, runtime, session, model, provider, execution id, correlation id, tenant, environment, and security context.

## Planning framework

The planning module introduces provider-agnostic abstractions for goals, plans, task graphs, dependency graphs, checkpoints, recovery, and progress tracking. It is designed for long-running autonomous work without embedding any infrastructure-specific logic.

## Reflection framework

The reflection module introduces deterministic abstractions for evaluating execution outcomes, scoring confidence, recording evidence, generating recommendations, and producing immutable reports. It is intentionally artifact-driven so future memory and knowledge services can consume the outputs without depending on providers or infrastructure services.

### Goal model

- Goals encapsulate a target objective, lifecycle state, policy, and execution context.
- Goal snapshots capture progress, blocked tasks, and milestones for observability.
- Goal registries and schedulers expose reusable coordination primitives.

### Planning model

- Plans are immutable once published, while builders remain mutable during planning.
- Task graphs and dependency graphs support hierarchical decomposition and ordering.
- Checkpoints, recovery, and replay primitives support resilience for long-running execution.

## Snapshots

Snapshots provide immutable read-only views of the current state so callers can capture a point-in-time representation without mutating the live context.

## Builder pattern

```ts
const context = new AgentContextBuilder('investigate')
  .withWorkingMemory(new AgentWorkingMemory())
  .withConversationContext(new AgentConversationContext())
  .withKnowledgeContext(new AgentKnowledgeContext())
  .withRuntimeContext(new AgentRuntimeContext('workflow-1', 'gpt-4o', 'openai'))
  .withEnvironmentContext(new AgentEnvironmentContext('prod', 'us-east-1'))
  .withTaskContext(new AgentTaskContext('investigate', 'Review the alert'))
  .withStateContext(new AgentStateContext())
  .build();
```

Persistence, vector search, and provider SDK integrations are intentionally out of scope for this package. Future packages can implement these capabilities without changing the abstraction.
