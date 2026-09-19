---
name: api
description: >-
  Use the Kylrix HTTP API with Personal Access Tokens (PATs). REST toward UI
  parity: notes, goals, flows (+install), workspaces, events, forms, feeds,
  moments (internal + Nostr view; internal comments), threads (unified plaintext
  discussions), chats (E2EE meta; plaintext send when unencrypted), vault
  metadata, tags, objects, agents/harness, and token self-service. Not a 1:1
  UI clone — E2EE unlock, Nostr signing, WebRTC calls stay client-side.
---

# Kylrix HTTP API (PAT)

**Wire-in guide:** [docs/integrations.md](../docs/integrations.md)

```bash
npx skills add kylrix/kylrix --skill mcp --skill api --skill agents
export KYLRIX_PAT='kyl_pat_…'
export BASE="${KYLRIX_API_BASE:-https://www.kylrix.space/api/v1}"
```

MCP and REST share `ApiResources` — prefer MCP for IDE agents, REST for scripts. Same PAT, same scopes.

## Honest parity

| UI area | PAT API | Notes |
|---------|---------|-------|
| Ideas (notes) | Full CRUD | ✅ |
| Goals | Full CRUD | ✅ |
| Workspaces | Full CRUD + nested projects | ✅ |
| Discussions | `GET/POST /threads?parent_kind=&parent_id=` | ✅ Unified thread model |
| Feeds | GET `/feeds?source=ecosystem\|nostr\|all` | ✅ |
| Moments | List/get/create + comments | ✅ Internal comments; Nostr view-only |
| Chats | List/get/messages; POST if unencrypted | ❌ E2EE send needs unlocked vault |
| Vault | List metadata | ❌ No secret plaintext without master unlock |
| Agents + harness mirror | List/get/delete + mirror append | ✅ |
| Calls / WebRTC | — | Client realtime only |
| Token self-scope refresh | ✅ | Rescue hatch — no remint |

## Rescue hatch

```bash
curl -sS -X POST "$BASE/token/scopes" \
  -H "Authorization: Bearer $KYLRIX_PAT" -H "Content-Type: application/json" \
  -d '{"mode":"grant","scopes":["moments:read","moments:write","chats:read","chats:write","workspaces:read"]}'
```

## Routes (summary)

`/me` · `/token` · `/token/scopes` · `/pats`  
`/notes` · `/goals` · `/workspaces` · `/projects` · `/workspaces/:id/projects` · `/events` · `/forms`  
`/flows` · `/flows/installations` · `/flows/:id/installations`  
`/feeds` · `/moments` · `/moments/:id` · `/moments/:id/comments`  
`/threads` · `/threads/:id` · `/threads/:id/messages`  
`/chats` · `/chats/:id` · `/chats/:id/messages`  
`/vault` · `/tags` · `/objects`  
`/agents/sessions` · `/agents/harness` · `/agents/sessions/:id/mirror`

## Account Sovereignty & Workspace Scoping (STRICT)

- **User ID Invariant**: All objects created by agents, REST API, or MCP belong to the authenticated human user's account (`userId`). The API server inspects and overrides `userId` on every entity row with the account owner's ID to prevent orphaned ghost objects.
- **Workspace Stamping**: When creating objects in a workspace, `/api/v1` and MCP automatically stamp `isWorkspace: true` and `projectId: <wsId>` on the entity row AND create the `project_objects` join record so items are correctly scoped and isolated.

Full table: `api/references/http-api.md`. Internal: `system.pat-http-api`.
