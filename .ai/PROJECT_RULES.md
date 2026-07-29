# Project Rules

- Architecture is frozen.
- AI Gateway is the only component that talks to LLM providers.
- Providers are plugin-based.
- Strict TypeScript only.
- No business logic in shared packages.
- No circular dependencies.
- Every package builds independently.
