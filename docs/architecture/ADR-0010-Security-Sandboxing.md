# ADR-0010: Security Sandboxing

## Status

Proposed

## Context

Agentic OS executes third-party or dynamically generated logic. Without strong sandboxing, the platform risks privilege escalation, data exfiltration, and unsafe actions.

## Problem Statement

Executing agents or plugins with broad privileges creates security risks, especially when agents can access platform services or external systems.

## Decision

Adopt security sandboxing as a core platform requirement.

Sandboxing strategy:

- Limit agent and plugin capabilities to explicit contracts.
- Run untrusted workloads within isolated execution contexts.
- Enforce data access policies for memory, storage, and network.
- Apply least privilege for runtime services and provider access.

## Consequences

- Platform security is improved but runtime complexity grows.
- Some plugin or provider features may need explicit approval.
- Security controls must be audited and versioned.

## Alternatives Considered

- Trusting all code to run with full privileges: rejected because it is unsafe.
- Soft policy enforcement only: rejected because it cannot reliably contain untrusted workloads.

## Implementation Notes

- Define sandbox boundary contracts and audit logs.
- Use context-specific isolation mechanisms when available.
- Integrate security enforcement into plugin/adapters and execution contexts.

## Future Evolution

- Add runtime policy engines, capability tokens, and attestation.
- Support fine-grained sandboxing for data plane vs control plane separation.

## References

- Least Privilege
- Security by Design
- Execution Context
