# Workflow Engine

The workflow engine package provides the foundational workflow abstractions for Agentic OS. It stays generic and reusable, delegating execution to the runtime rather than implementing workflow work directly.

## Architecture

- Workflow definitions are immutable and validated before execution.
- Workflow executions are isolated and maintain a deterministic lifecycle.
- The engine orchestrates runtime executions without performing workflow work itself.

## Core model

- WorkflowDefinition: immutable workflow contract with identifier, version, metadata, owner, correlation identifier, tags, and optional description.
- WorkflowBuilder: fluent builder for constructing validated definitions.
- WorkflowExecution: execution lifecycle with created, validated, ready, running, completed, cancelled, failed, and timed out states.
- WorkflowExecutionContext: immutable execution context carrying workflow metadata and optional request context.
- WorkflowExecutionSnapshot: immutable snapshot of execution state and history.
- WorkflowResult: concrete success or failure payload returned by the engine.

## Validation

The workflow validator enforces the required contract:

- missing workflow identifier
- missing workflow name
- missing workflow owner
- missing correlation identifier
- missing version
- missing metadata
- missing tags

## Usage

```ts
import { WorkflowBuilder, WorkflowEngine } from '@infrashield/workflow-engine';

const definition = new WorkflowBuilder()
  .withId('workflow-1')
  .withName('Demo workflow')
  .withOwner('ops')
  .withCorrelationId('corr-1')
  .withVersion('1.0.0')
  .withMetadata({ source: 'docs' })
  .withTags(['demo'])
  .build();

const engine = new WorkflowEngine();
const result = await engine.execute(definition);
```
