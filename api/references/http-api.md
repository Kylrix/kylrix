# HTTP API reference

Install: `npx skills add kylrix/kylrix/api`

Base: `http://localhost:3005/api/v1` · prod `https://www.kylrix.space/api/v1`

## Self-service
| Method | Path |
|--------|------|
| GET | `/token` |
| GET/PATCH | `/token/scopes` |
| POST | `/token/scopes/grant` |

## Resources
| Method | Path | Scope |
|--------|------|-------|
| GET | `/me` | profile:read |
| CRUD | `/notes`, `/notes/:id` | notes:* |
| CRUD | `/goals`, `/goals/:id` | goals:* |
| CRUD | `/workspaces`, `/workspaces/:id` | workspaces:* |
| GET/POST | `/workspaces/:id/thread` | chats:* + workspaces:read |
| GET/POST | `/workspaces/:id/thread/messages` | chats:* + workspaces:read |
| CRUD | `/events`, `/events/:id` | events:* |
| CRUD | `/forms`, `/forms/:id` | forms:* |
| GET | `/flows` | flows:read |
| GET/POST | `/flows/installs`, `/flows/install` | flows:read / flows:install |
| GET | `/feeds?source=ecosystem\|nostr\|all` | moments:read |
| GET/POST | `/moments` | moments:read / moments:write |
| GET | `/moments/:id` | moments:read (ecosystem or `nostr_<hex>`) |
| GET/POST | `/moments/:id/comments` | moments:read / moments:write (internal only for POST) |
| POST | `/threads` | chats:write (ensure unique parentKind+parentId+channel) |
| GET | `/threads?parentKind=&parentId=` | chats:read |
| GET | `/threads/:id`, `/threads/:id/messages` | chats:read |
| POST | `/threads/:id/messages` | chats:write |
| POST | `/notes/:id/discussion`, `/goals/:id/discussion` | chats:write |
| GET | `/chats`, `/chats/:id`, `/chats/:id/messages` | chats:read |
| POST | `/chats/:id/messages` | chats:write (unencrypted only) |
| GET | `/vault` | vault:read (metadata only) |
| GET | `/tags`, `/objects` | tags/objects:read |
| GET/DELETE | `/agents/sessions`, `/agents/sessions/:id` | agents:* |
| POST | `/agents/harness`, `/agents/sessions/:id/mirror` | agents:harness |

Intentional gaps: E2EE chat send, Nostr comment/like (needs vault key), vault secret plaintext, WebRTC calls.
