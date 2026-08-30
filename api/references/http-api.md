# HTTP API reference

Install: `npx skills add kylrix/kylrix --skill mcp --skill api --skill agents` · Wire-in: [docs/integrations.md](../../docs/integrations.md)

Base: `https://www.kylrix.space/api/v1` · MCP: `https://www.kylrix.space/api/v1/mcp` · Self-host: see `SELFHOST.md`

`/workspaces` and `/projects` are aliases. Nested **projects** live under a workspace: `/workspaces/:workspaceId/projects`.

## Self-service
| Method | Path |
|--------|------|
| GET | `/token` |
| GET | `/token/scopes` |
| PATCH | `/token/scopes` — replace scopes (`{ "scopes": [...] }`) |
| POST | `/token/scopes` — grant scopes (`{ "mode": "grant", "scopes": [...] }`) |
| GET | `/pats` |
| POST | `/pats` |
| DELETE | `/pats/:id` |

## Resources
| Method | Path | Scope |
|--------|------|-------|
| GET | `/me` | profile:read |
| CRUD | `/notes`, `/notes/:id` | notes:* |
| CRUD | `/goals`, `/goals/:id` | goals:* |
| CRUD | `/workspaces`, `/workspaces/:id` | workspaces:* |
| CRUD | `/projects`, `/projects/:id` | workspaces:* (alias) |
| GET/POST | `/workspaces/:id/collaborators` (or `/members`) | workspaces:* |
| POST | `/workspaces/:id/objects` (or `/attach`) | workspaces:write, objects:write |
| CRUD | `/workspaces/:workspaceId/projects`, `.../projects/:projectId` | workspaces:* |
| CRUD | `/events`, `/events/:id` | events:* |
| CRUD | `/forms`, `/forms/:id` | forms:* |
| GET/POST | `/flows` | flows:read / flows:write |
| GET | `/flows/:id` | flows:read |
| DELETE | `/flows/:id` | flows:write |
| POST | `/flows/:id/publish` | flows:write |
| GET | `/flows/installations` | flows:read |
| POST | `/flows/:id/installations` | flows:install |
| GET | `/feeds?source=ecosystem\|nostr\|all` | moments:read |
| GET/POST | `/moments` | moments:read / moments:write |
| GET | `/moments/:id` | moments:read (ecosystem or `nostr_<hex>`) |
| GET/POST | `/moments/:id/comments` | moments:read / moments:write (internal only for POST) |
| GET | `/threads?parent_kind=&parent_id=` | chats:read |
| POST | `/threads` | chats:write — ensure thread (`{ parent_kind, parent_id }`) |
| GET | `/threads/:id`, `/threads/:id/messages` | chats:read |
| POST | `/threads/:id/messages` | chats:write |
| GET/POST | `/chats` | chats:read / chats:write |
| GET | `/chats/:id`, `/chats/:id/messages` | chats:read |
| POST | `/chats/:id/messages` | chats:write (unencrypted only) |
| GET/POST | `/vault`, `/vault/:id` | vault:read / vault:write (metadata; MEK header when encrypted) |
| GET/POST | `/vault/totp`, `/vault/totp/:id` | vault:* |
| GET/POST | `/totp`, `/totp/:id` | vault:* (alias) |
| GET | `/tags`, `/objects` | tags:read / objects:read |
| POST | `/tags` | tags:write |
| DELETE | `/tags/:id` | tags:write |
| GET | `/trash?kind=` | trash:read |
| POST | `/trash` | trash:write — restore or purge via body |
| POST | `/trash/restore`, `/trash/purge` | trash:write |
| DELETE | `/trash/:kind/:id` | trash:write |
| GET/DELETE | `/agents/sessions`, `/agents/sessions/:id` | agents:* |
| POST | `/agents/harness` | agents:harness |
| POST | `/agents/sessions/:id/mirror` | agents:harness |
| POST | `/agents/provision` | agents:provision |
| POST | `/agents/keys` | agents:write |

Query parameters use **snake_case** (`parent_kind`, `parent_id`, `workspace_id`). Aliases: `workspaceId`, `projectId`.

## Rate Limits (Rolling 1m / 24h)

| Tier | Burst (1 min) | Daily ceiling |
| --- | --- | --- |
| **Free** | 12 req / min | 300 req / day |
| **Pro** | 60 req / min | 2,500 req / day |
| **Teams** | 120 req / min | 5,000 req / day |

Teams = exactly **2× Pro** on both windows. The **daily** cap is what blocks long MCP/agent sessions; the **minute** cap protects the server from burst abuse.

Request payload constraint: Max ~256 KB per request.

HTTP 429 response structure:
```json
{
  "error": "rate_limit_exceeded",
  "message": "You have exceeded your rolling 1-minute limit of 12 requests.",
  "type": "per_minute",
  "reset_at": 1722676643
}
```

Response headers include `RateLimit-Policy`, `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, and `Retry-After` on 429.

Intentional gaps: E2EE chat send, Nostr comment/like (needs vault key), vault secret plaintext without MEK unlock, WebRTC calls.
