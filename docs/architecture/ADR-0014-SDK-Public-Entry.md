# ADR-0014: SDK Public Entry Point

## Status

Proposed

## Context

Agentic OS needs a single developer-facing entry point that hides package topology and keeps application code from depending on runtime internals.

## Decision

Introduce `@agentic/sdk` as the only public SDK surface for application teams.

The SDK will:

- expose contracts, interfaces, and manifest specifications only
- remain provider-agnostic and application-agnostic
- avoid business logic, runtime adapters, and service implementations
- preserve dependency inversion by depending only on kernel contracts

## Consequences

- Application code imports a single package and does not need to know the internal package map.
- Platform contracts can evolve behind a stable facade.
- The SDK becomes the canonical place for documentation-driven public APIs.

## Validation Rules

- No circular dependencies.
- The SDK must not depend on application packages.
- Applications must not reference runtime internals.
- Providers implement exported interfaces.
- Runtime packages depend only on contracts.

## Future Evolution

- The SDK may re-export additional kernel contracts as the platform matures.
- Runtime implementations will consume the SDK contracts without changing application import paths.
