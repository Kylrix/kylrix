---
name: api
description: >-
  Use the Kylrix HTTP API with Personal Access Tokens (PATs). REST toward UI
  parity: notes, goals, flows (+install), workspaces, events, forms, chats
  (metadata/ciphertext), vault metadata, moments, tags, objects, agents/harness,
  and token self-service. Not a 1:1 UI clone — E2EE unlock, WebRTC calls, and
  browser-only chrome stay client-side.
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
| Events / Forms | Full CRUD | ✅ |
| Flows list + install | ✅ | Builtin installs may also live client-side |
| Chats | List / get / messages meta | ❌ No E2EE send (needs unlocked vault) |
| Vault | List metadata | ❌ No secret plaintext without master unlock |
| Moments / tags / objects | List | Writes still expanding |
| Agents + harness mirror | List/get/delete + mirror append | ✅ |
| Calls / WebRTC | — | Client realtime only |
| Token self-scope refresh | ✅ | Rescue hatch — no remint |

## Rescue hatch

```bash
curl -sS -X POST "$BASE/token/scopes/grant" \
  -H "Authorization: Bearer $KYLRIX_PAT" -H "Content-Type: application/json" \
  -d '{"scopes":["moments:read","tags:read","agents:harness"]}'
```

## Routes (summary)

`/me` · `/token` · `/token/scopes` · `/token/scopes/grant` · `/pats`  
`/notes` · `/goals` · `/workspaces` · `/events` · `/forms`  
`/flows` · `/flows/install` · `/flows/installs`  
`/chats` · `/chats/:id` · `/chats/:id/messages`  
`/vault` · `/moments` · `/tags` · `/objects`  
`/agents/sessions` · `/agents/harness` · `/agents/sessions/:id/mirror`

Full table: `api/references/http-api.md`. Internal: `system.pat-http-api`.
