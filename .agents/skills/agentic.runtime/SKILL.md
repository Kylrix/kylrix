---
name: agentic.runtime
description: In-app agent runtime (settings agents, chat/session routes, tool registry, client executor). Use when editing agent drawers, tools, or session UX.
---

# Agentic runtime

## Where it lives

- UI: `/settings/agents`, `/agents/chat/[id]`, `/agents/session/[id]`
- Core: `lib/agentic/*` (`tools-registry`, `client-executor`, `runtime`, `session-local-store`, `prompt-framework`, …)
- Safety: read `security.agentic-execution-safety`

## Product rules

1. No standalone `/agents` marketing/hub page — entry is settings + chat/session.
2. Tools stay ownership-scoped; never escalate past the signed-in user's permissions.
3. Prefer existing secure-ops / server actions over new HTTP APIs.
4. Layman UI copy only (no jargon in user-visible agent strings).

## When extending tools

Register in `lib/agentic/tools-registry.ts`, keep ids stable, and gate mutations through existing permission / sudo paths.
