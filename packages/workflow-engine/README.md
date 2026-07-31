# Workflow Engine

The workflow engine package provides the foundational workflow abstractions for Agentic OS. It stays generic and reusable, delegating execution to the runtime rather than implementing workflow work directly.

## Architecture

- Workflow definitions are immutable and validated before execution.
- Workflow executions are isolated and maintain a deterministic lifecycle.
- The engine orchestrates runtime executions without performing workflow work itself.

## Core model

- WorkflowDefinition: immutable workflow contract with identifier, version, metadata, owner, labels, annotations, options, statistics, snapshots, and deterministic hashing.
- WorkflowDefinitionBuilder: fluent builder for constructing validated definitions with semantic versioning, metadata, tags, labels, annotations, and options.
- WorkflowDefinitionMetadata: immutable metadata container with string-safe normalization and lookup helpers.
- WorkflowDefinitionVersion: semantic version value object with major/minor/patch parsing, comparison, and latest-version helpers.
- WorkflowDefinitionSnapshot: immutable snapshot with serialization, diagnostics, and hash generation.
- WorkflowDefinitionStatistics: immutable statistics container for size, metadata count, tag count, annotation count, and timestamps.
- WorkflowExecution: execution lifecycle with created, validated, ready, running, completed, cancelled, failed, and timed out states.
- WorkflowExecutionContext: immutable execution context carrying workflow metadata and optional request context.
- WorkflowExecutionSnapshot: immutable snapshot of execution state and history.
- WorkflowResult: concrete success or failure payload returned by the engine.

## Policy framework

The execution policy framework is intentionally declarative and runtime-agnostic. It lets a workflow declare retry, timeout, compensation, concurrency, failure, cancellation, approval, and rate-limit behavior through immutable policy objects that can be collected and registered without coupling the engine to execution implementation details.

```ts
import {
  WorkflowPolicyCollection,
  WorkflowRetryPolicy,
  WorkflowTimeoutPolicy,
  WorkflowPolicyRegistry,
} from '@infrashield/workflow-engine';

const timeoutPolicy = new WorkflowTimeoutPolicy({
  id: 'timeout-1',
  executionTimeoutMs: 5000,
  dependsOn: [],
});

const retryPolicy = new WorkflowRetryPolicy({
  id: 'retry-1',
  maxAttempts: 3,
  delayMs: 250,
  dependsOn: ['timeout-1'],
});

const registry = new WorkflowPolicyRegistry();
registry.register(timeoutPolicy);
registry.register(retryPolicy);

const collection = new WorkflowPolicyCollection([timeoutPolicy, retryPolicy]);
collection.values.map((policy) => policy.snapshot());
```

## Validation

The workflow validator enforces the required contract:

- missing workflow identifier
- missing workflow name
- missing workflow owner
- missing version
- missing metadata
- missing tags
- invalid semantic versions
- reserved names and invalid metadata values

## Builder API

```ts
import {
  WorkflowAnnotation,
  WorkflowDefinitionBuilder,
  WorkflowDefinitionMetadata,
  WorkflowDefinitionOptions,
} from '@infrashield/workflow-engine';

const definition = new WorkflowDefinitionBuilder()
  .withId('workflow-1')
  .withName('Customer Onboarding')
  .withVersion('2.3.1')
  .withDescription('Handles onboarding')
  .withOwner('ops')
  .withCategory('customer-journey')
  .withTags(['core', 'onboarding'])
  .withLabels(['production', 'critical'])
  .withAnnotations([new WorkflowAnnotation('source', 'internal')])
  .withMetadata(new WorkflowDefinitionMetadata({ tenant: 'acme', author: 'alice' }))
  .withOptions(new WorkflowDefinitionOptions({ timeoutMs: 5000, retryCount: 2 }))
  .build();
```

## Snapshots and statistics

```ts
const snapshot = definition.snapshot();
const statistics = definition.statistics;

snapshot.toJSON();
snapshot.diagnostics();
```

## Workflow state machine

The workflow state machine is the authoritative lifecycle layer for long-running workflow execution. It stays deterministic and architecture-focused: it does not persist state, execute approvals, or coordinate distributed workers. Instead, it provides an immutable journal, immutable checkpoints, pause/resume tokens, suspension contexts, and transition metrics for orchestration layers to consume.

```ts
import { WorkflowStateMachine } from '@infrashield/workflow-engine';

const machine = new WorkflowStateMachine({
  workflowId: 'workflow-1',
  correlationId: 'corr-1',
  metadata: { owner: 'ops' },
});

machine.create();
machine.validate();
machine.start();
machine.pause('waiting on dependency');
machine.resume('dependency available');
machine.wait('waiting for external signal');
machine.complete({ executed: true });

const snapshot = machine.snapshot();
console.log(snapshot.state);
console.log(snapshot.journal.transitions.length);
```

### Supported lifecycle states

- Created
- Validated
- Ready
- Running
- Paused
- Waiting
- WaitingApproval
- WaitingExternalEvent
- Suspended
- Retrying
- Compensating
- Completed
- Cancelled
- Failed
- TimedOut

### Long-running execution support

- Pause and resume tokens for deterministic workflow re-entry
- Suspension contexts for external intervention scenarios
- Immutable checkpoints for progress and recovery metadata
- Event publication through the public event-bus contract layer
- Observability counters for transition count, pause duration, wait duration, retry duration, compensation duration, and checkpoint count
