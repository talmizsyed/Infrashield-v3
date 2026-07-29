# ADR-0004: Adapter-First Architecture

## Status

Proposed

## Context

Agentic OS must be extensible across AI providers, runtime environments, storage systems, and event infrastructure. Relying on built-in integrations would conflict with the platform's vendor-agnostic goals.

## Problem Statement

If platform behavior is hard-coded for specific providers or runtimes, the system cannot support new technologies without invasive changes. A provider- or runtime-specific architecture would also reduce the platform's portability.

## Decision

Adopt an adapter-first architecture in which every external integration is accessed through a defined adapter contract. Adapters are first-class extension points implemented outside the core kernel.

Key principles:

- Platform core defines abstract interfaces for provider, runtime, storage, event, and security adapters.
- Adapters implement these interfaces and are loaded dynamically or registered at startup.
- The platform must never depend on adapter implementation details.
- Adapters may be developed and released independently of the core platform.

## Consequences

- New providers and runtimes can be added without changing core platform logic.
- The platform remains decoupled from vendor-specific APIs.
- Adapter compatibility must be managed via clear versioning and contract stability.

## Alternatives Considered

- Building direct integrations inside the core: rejected because it contradicts vendor agnosticism.
- Allowing hybrid direct/adapter integrations: rejected because it weakens the extension model.

## Implementation Notes

- Define stable adapter interfaces for AI providers, event buses, storage, and runtime hosts.
- Provide an adapter registry and discovery mechanism.
- Document adapter lifecycle and registration process.

## Future Evolution

- Adapter metadata may evolve to include capabilities, health checks, and version negotiation.
- Support for adapter federations and multi-adapter policies may be added.

## References

- Adapter Pattern
- Dependency Inversion Principle
