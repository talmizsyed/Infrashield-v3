# Cognitive Orchestrator

The cognitive orchestrator is a provider-agnostic coordination layer for the Agentic OS platform. It coordinates execution through a deterministic pipeline that composes context assembly, memory access, knowledge retrieval, planning, tool selection, workflow coordination, governance, and reflections without implementing business logic or AI reasoning.

## Architecture

- The orchestrator accepts a session and an execution request.
- A pipeline produces an execution result.
- A coordinator and optional strategy decide how to progress or recover.
- Snapshots, metrics, and audit trails provide observability.
