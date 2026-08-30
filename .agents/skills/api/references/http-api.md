# HTTP API reference

Install: `npx skills add kylrix/kylrix/api` · Wire-in: [docs/integrations.md](../../docs/integrations.md)

Base: `https://www.kylrix.space/api/v1` · MCP: `https://www.kylrix.space/api/v1/mcp` · Self-host: see `SELFHOST.md`

## Self-service
| Method | Path |
|--------|------|
| GET | `/token` |
| GET | `/token/scopes` |
| PATCH | `/token/scopes` — replace scopes (`{ "scopes": [...] }`) |
| POST | `/token/scopes` — grant scopes (`{ "mode": "grant", "scopes": [...] }`) |

## Resources
| Method | Path | Scope |
|--------|------|-------|
| GET | `/me` | profile:read |
| CRUD | `/notes`, `/notes/:id` | notes:* |
| CRUD | `/goals`, `/goals/:id` | goals:* |
| CRUD | `/workspaces`, `/workspaces/:id` | workspaces:* |
| CRUD | `/events`, `/events/:id` | events:* |
| CRUD | `/forms`, `/forms/:id` | forms:* |
| GET/POST | `/flows` | flows:read / flows:write |
| GET | `/flows/:id` | flows:read |
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
| GET | `/chats`, `/chats/:id`, `/chats/:id/messages` | chats:read |
| POST | `/chats/:id/messages` | chats:write (unencrypted only) |
| GET | `/vault` | vault:read (metadata only) |
| GET | `/tags`, `/objects` | tags/objects:read |
| GET/DELETE | `/agents/sessions`, `/agents/sessions/:id` | agents:* |
| POST | `/agents/harness`, `/agents/sessions/:id/mirror` | agents:harness |

Query parameters use **snake_case** (`parent_kind`, `parent_id`, `workspace_id` via `workspaceId` alias).

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

Intentional gaps: E2EE chat send, Nostr comment/like (needs vault key), vault secret plaintext, WebRTC calls.
