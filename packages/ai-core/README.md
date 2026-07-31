# AI Core

The AI core package provides the provider-agnostic gateway foundation for Agentic OS.
It stays runtime-agnostic and does not integrate any vendor SDKs directly.

## Architecture

- Applications delegate AI work through the gateway rather than calling providers directly.
- Providers implement a shared contract for initialization, validation, execution, streaming, health checks, capability discovery, model discovery, token estimation, and cost estimation.
- The gateway centralizes provider registration, model registration, execution routing, health reporting, observability, and event publication through the public event-bus contracts.

## Core types

- AIGateway: the central orchestration entry point.
- AIProvider: the base provider abstraction.
- AIProviderRegistry: provider registration and lookup.
- AIModelRegistry: model registration and lookup.
- AIExecutionRequest / AIExecutionResponse: request and response contracts.
- AIProviderCapabilities / AIModelCapabilities: capability discovery contract.
- AIProviderHealth / AIProviderStatistics: health and observability data.

## Execution flow

1. Applications submit an AI execution request to the gateway.
2. The gateway resolves the provider and validates the request.
3. The provider executes the request using its own implementation details.
4. The gateway records usage statistics and publishes health events.
