---
name: api
description: >-
  Use the Kylrix HTTP API with Personal Access Tokens (PATs). REST CRUD toward
  full UI parity: notes, goals, flows, workspaces, chats, agents/harness,
  events, forms, and token self-service (scope refresh without minting a new
  PAT). Base URL local: http://localhost:3005/api/v1 — prod:
  https://www.kylrix.space/api/v1
---

# Kylrix HTTP API (PAT)

Install:

```bash
npx skills add kylrix/kylrix/api
```

Internal companion: `.agents/skills/system.pat-http-api/SKILL.md`

## Auth

```http
Authorization: Bearer kyl_pat_<appwriteUniqueId>_<secret>
```

## Rescue hatch — refresh THIS token’s scopes

Any valid PAT can inspect and expand **its own** scopes without `pats:write`.
Use this when dogfooding: grant new scopes as the catalog grows — **do not mint a second PAT**.

```bash
export KYLRIX_PAT='kyl_pat_…'
export BASE="${KYLRIX_API_BASE:-http://localhost:3005/api/v1}"

# Inspect current token + catalog
curl -sS "$BASE/token" -H "Authorization: Bearer $KYLRIX_PAT" | jq .

# List catalog only
curl -sS "$BASE/token/scopes" -H "Authorization: Bearer $KYLRIX_PAT" | jq .

# Replace scopes (full set)
curl -sS -X PATCH "$BASE/token/scopes" \
  -H "Authorization: Bearer $KYLRIX_PAT" -H "Content-Type: application/json" \
  -d '{"scopes":["profile:read","notes:read","notes:write","goals:read","goals:write","forms:read","forms:write","events:read","events:write","flows:read","flows:write","flows:install","vault:read","vault:write","objects:read","objects:write","tools:execute","pats:read","pats:write","workspaces:read","workspaces:write","chats:read","chats:write","agents:read","agents:write","agents:harness"]}'

# Additive grant (keep existing + add)
curl -sS -X POST "$BASE/token/scopes/grant" \
  -H "Authorization: Bearer $KYLRIX_PAT" -H "Content-Type: application/json" \
  -d '{"scopes":["agents:harness","workspaces:read"]}'
```

New scopes apply on the **next** request with the same bearer string.

## Core CRUD

| Method | Path | Scope |
|--------|------|-------|
| GET | `/me` | profile:read |
| GET | `/token` | *(any valid PAT)* |
| GET/PATCH | `/token/scopes` | *(self)* |
| POST | `/token/scopes/grant` | *(self)* |
| GET/POST | `/notes` | notes:read / notes:write |
| GET/PATCH/DELETE | `/notes/:id` | notes:read / notes:write |
| GET/POST | `/goals` | goals:read / goals:write |
| GET/PATCH/DELETE | `/goals/:id` | goals:read / goals:write |
| GET | `/flows` | flows:read |
| GET | `/workspaces` (alias `/projects`) | workspaces:read |
| GET | `/workspaces/:id` | workspaces:read |
| GET | `/events` | events:read |
| GET | `/forms` | forms:read |
| GET | `/chats` | chats:read |
| GET | `/agents` or `/agents/sessions` | agents:read |
| POST | `/agents/harness` | agents:harness + agents:write |
| POST | `/agents/sessions/:id/mirror` | agents:harness + agents:write |
| GET/POST | `/pats` | pats:read / pats:write |
| DELETE | `/pats/:id` | pats:write |

`POST /tools/*` → **410 Gone** (tools stay in-process).

## Harness sessions (CLI mirror)

`agentic_sessions.harness` tags mirror sessions (e.g. `claude-code`, `codex`).
Titles/context use `[harness_name]` style. Today: **read-only mirror** of prompts /
tool calls into the session history. Future: webhooks / push prompts into the CLI.

```bash
# Create mirror session
curl -sS -X POST "$BASE/agents/harness" \
  -H "Authorization: Bearer $KYLRIX_PAT" -H "Content-Type: application/json" \
  -d '{"harness":"claude-code","title":"[claude-code] dogfood"}'

# Append a mirrored turn
curl -sS -X POST "$BASE/agents/sessions/<id>/mirror" \
  -H "Authorization: Bearer $KYLRIX_PAT" -H "Content-Type: application/json" \
  -d '{"role":"user","content":"hello from CLI"}'
```

## Dogfood findings (keep updating)

- Notes CRUD works end-to-end against live TablesDB.
- Prefer `localhost` over `127.0.0.1` when the dev server binds IPv6 (`-H localhost`).
- `/flows` may return `[]` for users who only have builtin installs (localStorage) —
  remote `workflows` rows are owner-published flows.
- Scope denials return `{ ok:false, error:{ code:"scope_denied" } }` with HTTP 403.
- Never put PATs in git. Rotate via Developers settings if leaked in chat logs.

## Appwrite CLI vs PAT

- **PAT / this API:** all user-data CRUD and product dogfooding.
- **Appwrite CLI:** additive schema only (columns/tables/indexes). **Never touch rows.**
  See `system.appwrite-cli-ops` guardrails.
