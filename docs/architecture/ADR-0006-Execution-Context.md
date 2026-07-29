# ADR-0006: Execution Context

## Status

Proposed

## Context

Agentic OS must support running agents in multiple execution contexts, such as local processes, containerized environments, serverless functions, and edge devices. Execution contexts must be abstracted so agents can move across environments without requiring application changes.

## Problem Statement

If execution context is baked into agent or platform logic, the platform becomes tied to a specific runtime or deployment model. This undermines the system's ability to run on diverse hardware, OS, and cloud environments.

## Decision

Define execution context as an interface-driven abstraction. Each context is implemented by an adapter, and the platform routes agents to the appropriate context based on policies.

Execution context capabilities will include:

- environment provisioning and isolation
- resource limits and quotas
- lifecycle hooks for startup and shutdown
- connectivity to platform services, security, and observability

## Consequences

- The platform can support heterogeneous runtime environments.
- Agent code remains portable and runtime-agnostic.
- Supporting many contexts requires robust adapter contracts and discovery.

## Alternatives Considered

- Limiting execution to a single runtime model: rejected because it reduces platform applicability.
- Hard-coding context behavior in the kernel: rejected because it violates the adapter-first principle.

## Implementation Notes

- Create context registration and selection mechanisms.
- Define consistent execution APIs that adapters must satisfy.
- Ensure platform services for memory, events, and security are available in each context.

## Future Evolution

- Add support for specialized contexts like secure enclaves, edge microcontrollers, and hybrid cloud nodes.
- Introduce runtime policy engines for context selection.

## References

- Runtime Abstraction
- Adapter Pattern
- Dependency Inversion Principle
