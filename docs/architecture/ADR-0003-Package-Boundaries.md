# ADR-0003: Package Boundaries

## Status

Proposed

## Context

Agentic OS must be composed of clear modules and packages to avoid coupling between platform concerns and application code. The architecture should permit independent evolution of core services, adapters, and applications.

## Problem Statement

Without strict package boundaries, implementation details can leak across layers, causing dependencies between application code and platform internals. This will make upgrades, testing, and platform adaptation difficult.

## Decision

Define strict package boundaries using a layered architecture:

- Core platform packages: kernel, runtime abstractions, event bus, security, memory, observability.
- Adapter packages: provider adapters, runtime adapters, database adapters, event bus adapters.
- Application packages: application logic, domain-specific agents, UI, and business rules.
- Shared contract packages: interfaces, DTOs, and common schemas.

Package dependency rules:

- Core packages must not depend on application packages.
- Adapter packages depend only on core contracts and external vendor SDKs.
- Applications depend on contracts and platform services but never directly on implementation details.
- Shared contract packages are the only cross-cutting dependency used by multiple layers.

## Consequences

- Enforces separation of concerns and reduces risk of accidental coupling.
- Allows platform and applications to be developed independently.
- Requires strict review of package dependencies and import rules.

## Alternatives Considered

- Using a flat package structure: rejected because it fails to enforce boundaries.
- Allowing some direct dependencies from applications to core implementations: rejected due to future maintenance risk.

## Implementation Notes

- Establish package naming conventions for core, adapters, shared contracts, and applications.
- Use linting or repository rules to enforce dependency boundaries.
- Keep application-specific code isolated from kernel and adapter packages.

## Future Evolution

- Package boundaries may be refined as new platform capabilities emerge, but the core rule (no platform-to-application dependency) remains permanent.

## References

- Hexagonal Architecture
- Dependency Inversion Principle
- Modular Monorepo Patterns
