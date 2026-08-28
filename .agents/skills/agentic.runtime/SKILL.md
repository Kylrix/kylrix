---
name: agentic.runtime
description: In-app agent runtime (settings agents, chat/session routes, tool registry, client executor, Vercel AI SDK). Use when editing agent drawers, tools, or session UX.
---

# Agentic runtime

## Where it lives

- UI: `/settings/agents`, `/agents/chat/[id]`, `/agents/session/[id]`
- Core: `lib/agentic/*` (`tools-registry`, `client-executor`, `runtime`, `session-local-store`, `prompt-framework`, `llm-provider`, `ai-sdk/*`, …)
- Vercel AI SDK Subsystem: `lib/agentic/ai-sdk/*` (`models.ts`, `tools.ts`, `runner.ts`)
- Safety: read `security.agentic-execution-safety`

## Product rules

1. No standalone `/agents` marketing/hub page — entry is settings + chat/session.
2. Tools stay ownership-scoped; never escalate past the signed-in user's permissions.
3. Prefer existing secure-ops / server actions over new HTTP APIs.
4. Layman UI copy only (no jargon in user-visible agent strings).

## Vercel AI SDK Architecture

Kylrix supports Vercel AI SDK (`ai`, `@ai-sdk/google`, `@ai-sdk/openai`) alongside `@google/generative-ai` for advanced multi-turn agentic conversations:

1. **Model Resolution (`lib/agentic/ai-sdk/models.ts`)**: Dynamically resolves Google Gemini (`gemini-2.0-flash`), OpenAI (`gpt-4o-mini`), or local Ollama instances based on environment variables (`GOOGLE_API_KEY`, `OPENAI_BASE_URL`, `OLLAMA_BASE_URL`).
2. **Native Tool Definitions (`lib/agentic/ai-sdk/tools.ts`)**: Type-safe Zod-validated tool definitions (`create_note`, `update_note`, `get_note`, `create_goal`, `update_goal`, `create_project`, `ui.navigate`, `search_ecosystem`, `suggest_next_steps`, etc.).
3. **Multi-Turn Runner (`lib/agentic/ai-sdk/runner.ts`)**: Handles multi-step autonomous tool calls (`maxSteps: 5`) where the model reasons, calls tools, processes results, and formulates final responses in a single turn without halting prematurely.

## When extending tools

Register in `lib/agentic/tools-registry.ts` and `lib/agentic/ai-sdk/tools.ts`, keep ids stable, and gate mutations through existing permission / sudo paths.
