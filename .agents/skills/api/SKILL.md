---
name: api
description: >-
  Use the Kylrix HTTP API with Personal Access Tokens (PATs). REST toward UI
  parity: notes, goals, flows (+install), workspaces, events, forms, feeds,
  moments (internal + Nostr view; internal comments), threads (full plaintext
  read/reply), chats (E2EE meta; plaintext send when unencrypted), vault
  metadata, tags, objects, agents/harness, and token self-service. Not a 1:1
  UI clone — E2EE unlock, Nostr signing, WebRTC calls stay client-side.
---

# Kylrix HTTP API (PAT)

```bash
npx skills add kylrix/kylrix/api
export KYLRIX_PAT='kyl_pat_…'
export BASE="${KYLRIX_API_BASE:-http://localhost:3005/api/v1}"
```

## Honest parity

| UI area | PAT API | Notes |
|---------|---------|-------|
| Ideas (notes) | Full CRUD | ✅ |
| Goals | Full CRUD | ✅ |
| Workspaces | Full CRUD | ✅ |
| Threads | `POST /threads` ensure · messages CRUD | ✅ Unique scopeKey substrate |
| Workspace discussion | GET/POST `/workspaces/:id/thread` | ✅ via ThreadService |
| Feeds | GET `/feeds?source=ecosystem\|nostr\|all` | ✅ |
| Moments | List/get/create + comments | ✅ Internal comments; Nostr view-only |
| Chats | List/get/messages; POST if unencrypted | ❌ E2EE send needs unlocked vault |
| Vault | List metadata | ❌ No secret plaintext without master unlock |
| Agents + harness mirror | List/get/delete + mirror append | ✅ |
| Calls / WebRTC | — | Client realtime only |
| Token self-scope refresh | ✅ | Rescue hatch — no remint |

## Rescue hatch

```bash
curl -sS -X POST "$BASE/token/scopes/grant" \
  -H "Authorization: Bearer $KYLRIX_PAT" -H "Content-Type: application/json" \
  -d '{"scopes":["moments:read","moments:write","chats:read","chats:write","workspaces:read"]}'
```

## Routes (summary)

`/me` · `/token` · `/token/scopes` · `/token/scopes/grant` · `/pats`  
`/notes` · `/goals` · `/workspaces` · `/workspaces/:id/thread` · `/events` · `/forms`  
`/flows` · `/flows/install` · `/flows/installs`  
`/feeds` · `/moments` · `/moments/:id` · `/moments/:id/comments`  
`/threads` · `/threads/:id` · `/threads/:id/messages`  
`/chats` · `/chats/:id` · `/chats/:id/messages`  
`/vault` · `/tags` · `/objects`  
`/agents/sessions` · `/agents/harness` · `/agents/sessions/:id/mirror`

Full table: `api/references/http-api.md`. Internal: `system.pat-http-api`.
