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
| CRUD | `/events`, `/events/:id` | events:* |
| CRUD | `/forms`, `/forms/:id` | forms:* |
| GET | `/flows` | flows:read |
| GET/POST | `/flows/installs`, `/flows/install` | flows:read / flows:install |
| GET | `/chats`, `/chats/:id`, `/chats/:id/messages` | chats:read |
| GET | `/vault` | vault:read (metadata only) |
| GET | `/moments`, `/tags`, `/objects` | moments/tags/objects:read |
| GET/DELETE | `/agents/sessions`, `/agents/sessions/:id` | agents:* |
| POST | `/agents/harness`, `/agents/sessions/:id/mirror` | agents:harness |

Intentional gaps: E2EE chat send, vault secret plaintext, WebRTC calls.
