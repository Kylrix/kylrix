# Kylrix layer swap map

Reference for **what must stay stable** vs **what may be rewritten** when moving off Appwrite, Next.js, or a hosted LLM.

## Stable (decades)

- User-visible semantics: Idea, Goal, Workspace, Vault, Thread, PAT scopes.
- `sdk/contracts/*` shapes consumed by REST, MCP, and UI.
- `/api/v1` resource model (paths may evolve; behaviors are the contract).
- Local-first paint + pending sync semantics (`architecture.local-first`).
- Encryption model: client-held keys, server metadata only for secrets.

## Swappable adapters (5–10 year horizon)

| Concern | Port / facade | Current adapter | Replacement examples |
|---------|---------------|-----------------|----------------------|
| Tables / CRUD | `DatabasePort`, `systemTables()` | Appwrite TablesDB | Postgres + SQL, SQLite edge, custom KV |
| Auth sessions | `AuthPort` | Appwrite Account | Custom OIDC, passkey-only local |
| Files | `StoragePort` | Appwrite Storage | S3-compatible, local disk |
| Realtime | `MessagingPort` | Appwrite Realtime | SSE, NATS, WebSocket hub on VPS |
| Functions | `FunctionsPort` | Appwrite Functions | systemd workers, queue on VPS |
| Inference | *(formalize)* agent provider interface | Gemini / routed APIs | llama.cpp on VPS, vLLM, Ollama |
| HTTP UI host | — | Next.js 16 App Router | Static SPA + API server, other framework |

## Migration tactics (when swapping)

1. **Freeze contracts** — add tests around `sdk/contracts` and `/api/v1` responses.
2. **Dual-write or export** — never big-bang cutover without user data path.
3. **Implement adapter** — `Registry.overrideDatabase(newAdapter)` for shadow testing.
4. **Delete vendor imports** from `lib/services` and `lib/api` only after port coverage hits 100%.
5. **Keep one repo** — no second “v2” tree; branch in place behind ports.

## Anti-patterns (vendor leaks)

- `import { Query } from 'node-appwrite'` in `lib/services/*` or `components/*`
- `createSystemTablesDB()` in domain code (use `@/lib/data`)
- Direct `GOOGLE_API_KEY` checks in UI components
- Hardcoded `fra.cloud.appwrite.io` outside adapter config
- Duplicate cache keys for the same entity (`f_tags_*` variants — use `lib/data/local/tags.ts`)

## Bare-metal end state (vision)

```
VPS
├── kylrix process(es)     # app + API + agent worker
├── postgres or sqlite       # via DatabasePort adapter
├── local/object storage   # via StoragePort adapter
├── optional local LLM     # via InferencePort adapter
└── reverse proxy (TLS)    # caddy/nginx — not product logic
```

No managed BaaS required at runtime. Appwrite (or any cloud) becomes an **optional** hosted adapter for users who want it, not a hard dependency for self-hosters.
