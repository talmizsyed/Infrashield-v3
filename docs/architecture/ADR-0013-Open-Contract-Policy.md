# ADR-0013: Open Contract Policy

## Status

Proposed

## Context

Agentic OS is designed to integrate many adapters, providers, and plugins. Clear contract versioning and compatibility policy are essential for long-term evolution.

## Problem Statement

Without disciplined contract management, changes to adapter interfaces or plugin contracts can break the platform and create upgrade failures.

## Decision

Adopt an open contract policy that defines how contracts evolve, how versions are managed, and how compatibility is guaranteed.

Policy rules:

- Contracts are versioned explicitly.
- Backward-compatible changes are allowed within minor version increments.
- Breaking changes require a major version update and documented migration path.
- Core contracts are stable; adapters and plugins declare supported contract versions.
- Compatibility checks should run at startup and during plugin/adpater registration.

## Consequences

- The platform can evolve safely while supporting multiple versions of adapters.
- More discipline is required for API design and contract changes.
- Runtime compatibility validation adds a small startup cost.

## Alternatives Considered

- Ad hoc contract changes: rejected because it leads to fragile integrations.
- Locking contracts forever: rejected because it prevents necessary evolution.

## Implementation Notes

- Add contract metadata to adapter and plugin manifests.
- Implement startup compatibility validation.
- Publish migration guidance when contracts change.

## Future Evolution

- Add compatibility negotiation and graceful fallback.
- Support contract deprecation warnings and phased removal.

## References

- Semantic Versioning
- Adapter Pattern
- Plugin System
