# ADR-0011: Decentralized Event Bus

## Status

Proposed

## Context

Agentic OS uses event-driven coordination between agents, services, and adapters. A centralized event bus can become a bottleneck or single point of failure.

## Problem Statement

Centralizing event delivery in one bus limits scalability and makes the platform dependent on a single transport.

## Decision

Use a decentralized event bus architecture with local event routers and optional global event federation.

Key aspects:

- Services emit events to local routers.
- Routers forward events based on subscriptions and policies.
- Global event federation enables cross-node coordination without hardwired central dependency.
- Events remain typed and versioned.

## Consequences

- Platform scales better across clusters and runtime contexts.
- Event routing logic is more complex than a single bus.
- Federation requires consistency rules and security across boundaries.

## Alternatives Considered

- Single central event bus: rejected due to scalability and availability concerns.
- Peer-to-peer event gossip: rejected because it complicates ordering and contract guarantees.

## Implementation Notes

- Standardize event metadata and delivery semantics.
- Support pluggable transports for local and federated delivery.
- Maintain compatibility between local event routers and global federation layers.

## Future Evolution

- Support event streaming backpressure and replay.
- Add multi-tenant isolation for events across organizational domains.

## References

- Event Driven Architecture
- Adapter Pattern
- Decentralized Systems
