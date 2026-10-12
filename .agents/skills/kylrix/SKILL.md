---
name: kylrix
description: >-
  North-star product vision for Kylrix: anti-fragility, vendor independence, and
  decade-scale survivability on bare metal. Use when making architecture,
  dependency, backend, AI provider, framework, or long-term stack decisions —
  before adding vendors, deep imports, or hardcoded assumptions.
---

# Kylrix — North Star (Anti-Fragility)

Kylrix is built to **outlive its toolchain**. Every meaningful decision should increase optionality: the ability to swap CRUD, inference, auth, storage, realtime, or the web framework without rewriting the product from scratch.

## Ultimate end state

The stack should converge on **two dependencies only**:

1. **A place to run code** (today: a VPS; tomorrow: any host that runs your binary or container).
2. **Bare metal / compute** under that host (CPU, RAM, disk, network).

Everything else — BaaS, managed AI, proprietary SDKs, a specific React framework — is a **temporary adapter**, not identity.

## What “anti-fragile” means here

| Principle | Practice |
|-----------|----------|
| **Ports, not providers** | Domain code talks to interfaces (`DatabasePort`, inference port, storage port). Vendors live in adapters only. |
| **Single repo, lean velocity** | One canonical tree (`kylrix/`). Shared contracts (`sdk/contracts`, `lib/data`, `lib/core/di`). No parallel implementations of the same behavior. |
| **Rewrite-friendly layers** | Any layer should be replaceable in a 5–10 year horizon without touching UI product rules or user data semantics. |
| **Local-first by default** | User-visible state paints from local engine first; remote is sync, not gate. Survives offline and provider outages. |
| **Exportable truth** | User data must remain recoverable without a vendor dashboard (export paths, open formats, sovereign hosting story). |
| **Fail soft, not fail closed on vendor** | Provider outage degrades sync/inference — it must not brick unlock, read, or local edit. |

## Layer map (swappable boundaries)

```
┌─────────────────────────────────────────────────────────┐
│  Product semantics (notes, goals, vault, agents, API)   │  ← keep stable decades
├─────────────────────────────────────────────────────────┤
│  Contracts (sdk/contracts, /api/v1 shapes, MCP tools)   │  ← version carefully
├─────────────────────────────────────────────────────────┤
│  Application services (lib/services, lib/api, actions)    │  ← orchestration only
├─────────────────────────────────────────────────────────┤
│  Ports (lib/core/ports/*, lib/data)                       │  ← backend-agnostic
├─────────────────────────────────────────────────────────┤
│  Adapters (lib/core/adapters/*, provider SDKs)            │  ← replaceable
├─────────────────────────────────────────────────────────┤
│  Host (Next.js today · static server tomorrow)           │  ← framework is not destiny
└─────────────────────────────────────────────────────────┘
```

**Today’s default adapters (not permanent):** Appwrite (data/auth/storage), Next.js (HTTP/UI SSR), Gemini/other models (inference). Treat them as **one implementation**, not the architecture.

Canonical data access for new code: **`@/lib/data`** (`getDatabase()`, `systemTables()`, `q.*`) — not `createSystemTablesDB()` or raw `node-appwrite` in domain logic.

## Decision checklist (run before merging)

Ask every PR / design:

1. **Vendor leak?** Does UI or domain import a provider SDK, env-specific URL, or vendor type?
2. **Duplicate SoT?** Is the same row shape or cache key defined in two places?
3. **Bypass port?** Does new CRUD skip `Registry` / `lib/data` / secure-ops?
4. **Inference lock-in?** Is a model name, API shape, or tool schema hardcoded without a provider interface?
5. **Framework lock-in?** Is behavior impossible without Next.js server components / middleware / a single deployment model?
6. **Survivability?** If this vendor vanished tomorrow, what still works locally on the VPS?

If any answer is “yes” (bad), add an adapter boundary or document a time-boxed exception in the PR.

## AI / agents (no single-model destiny)

- **Inference is a port.** Agent loops call a provider through an internal interface; model IDs and API keys are configuration, not call-site literals scattered across UI.
- **Tools are contracts.** MCP tools and `/api/v1` share `sdk/contracts` — not parallel Zod worlds.
- **Dogfood the product API.** Agents use `/api/v1` + PATs; they do not become a second admin backdoor to the database.
- Prefer **bring-your-own endpoint** posture long-term (local model, alternate API, air-gapped inference) even when defaulting to a hosted model today.

## Backend / CRUD (no single-BaaS destiny)

- **Hexagonal registry:** `lib/core/di/registry.ts` + `lib/data/`.
- **Query language:** `lib/data/queries.ts` (`q.equal`, …) — never `Query.*` from Appwrite in product services.
- **Migrations path:** `KYLRIX_DATA_BACKEND` env (future) selects adapter; schema remains declarative and exportable.
- **Never** hand-edit `appwrite.config.json` or `appwrite push` (data safety). CLI ops: `system.appwrite-cli-ops`.

## Framework / UI host (Next.js is expedient)

- Next.js is the **current** delivery vehicle, not the product core.
- Prefer logic in `lib/`, `sdk/`, `context/` — not trapped in route files.
- Server Actions are one transport; keep core operations callable from CLI, API, and future non-Next hosts.
- UI chrome rules: `openbricks` (opaque surfaces, conditional mount).

## What we optimize for

| Optimize | De-prioritize |
|----------|----------------|
| Swap adapters | Bleeding-edge vendor features |
| Contract stability | Framework fashion |
| Local-first UX | Server-round-trip UI gates |
| Single-repo clarity | Microservice sprawl |
| Sovereign self-host | Multi-cloud magic |

## Companion skills

| Topic | Skill |
|-------|--------|
| Day-to-day safety rules | `kylrix-guardrails` |
| Ports & DI | `system.hexagonal-registry` |
| Data facade | `lib/data` (code), `system.query-expression-mapping` |
| Local-first | `architecture.local-first`, `sync` |
| Public API | `system.pat-http-api`, `api/SKILL.md` |
| Layer swap detail | [references/layers.md](references/layers.md) |

## Agent mandate

When the user asks for “quick” solutions that permanently bind a vendor or duplicate a database path: **push back once**, propose the port/adapter or contract consolidation, then implement the leanest boundary that preserves decade optionality.
