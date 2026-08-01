# Retrieval & Context Orchestration

The retrieval module provides a provider-agnostic orchestration engine for combining working memory, session memory, semantic retrieval, knowledge graph data, workflow state, planning context, reflection history, governance constraints, and runtime context into a single execution package.

## Pipeline

1. Resolve sources
2. Assemble candidate chunks
3. Select and rank the best candidates
4. Filter by tenant and security labels
5. Deduplicate and compress
6. Apply budget constraints
7. Package the final context

## Design principles

- Provider agnostic and database independent
- Immutable context packages
- Composable ranking, filtering, compression, and budgeting stages
- Explicit observability and audit hooks
