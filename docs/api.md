# Kylrix REST HTTP API

The Kylrix HTTP API allows external agents, CLI tools, and integrations to read and write ecosystem objects using Personal Access Tokens (PATs) or OAuth 2.1 access tokens.

---

## 🌐 Base URIs

- **Production**: `https://www.kylrix.space/api/v1`
- **Local Dev / Dogfooding**: `http://localhost:3005/api/v1`

---

## 🔑 Authentication

Include your token as a Bearer token in the `Authorization` header:

```bash
curl -H "Authorization: Bearer kyl_pat_YOUR_TOKEN" https://www.kylrix.space/api/v1/me
```

---

## 📋 Scopes Catalog

| Scope | Description |
|---|---|
| `profile:read` | Read user profile and identity details |
| `notes:read` / `notes:write` | Read and write ideas & markdown notes |
| `goals:read` / `goals:write` | Read and manage task items and goals |
| `workspaces:read` / `workspaces:write` | Read and manage workspace projects |
| `chats:read` / `chats:write` | Read conversations and send messages |
| `events:read` / `events:write` | Calendar event management |
| `forms:read` / `forms:write` | Dynamic forms management |
| `flows:read` / `flows:write` | Workflow definitions and execution |
| `agents:read` / `agents:write` | Agent sessions and mirror hooks |
| `agents:provision` | Provision new autonomous AI agents |
| `pats:read` / `pats:write` | Manage Personal Access Tokens |

---

## 📡 REST Endpoints

### Token Self-Service
- `GET /api/v1/token` - Inspect active token, granted scopes, and scope catalog.
- `GET /api/v1/token/scopes` - List full scope catalog.
- `PATCH /api/v1/token/scopes` - Self-service scope update (replace scopes).
- `POST /api/v1/token/scopes/grant` - Add new scopes to current token.

### User Profile
- `GET /api/v1/me` - Authenticated actor info (userId, kind, scopes, patId).

### Ideas & Notes
- `GET /api/v1/notes?workspaceId={id}&limit={n}` - List notes (workspace-scoped or personal).
- `POST /api/v1/notes` - Create note (`{ title, content, workspaceId?, isPublic? }`).
- `GET /api/v1/notes/:id` - Retrieve single note.
- `PATCH /api/v1/notes/:id` - Update note (`{ title?, content?, isPublic? }`).
- `DELETE /api/v1/notes/:id` - Delete note.

### Goals & Tasks
- `GET /api/v1/goals?workspaceId={id}&limit={n}` - List goals (workspace-scoped or personal).
- `POST /api/v1/goals` - Create goal (`{ title, description?, status?, workspaceId? }`).
- `GET /api/v1/goals/:id` - Retrieve single goal.
- `PATCH /api/v1/goals/:id` - Update goal (`{ title?, description?, status? }`).
- `DELETE /api/v1/goals/:id` - Delete goal.

### Workspaces (Projects)
- `GET /api/v1/workspaces?limit={n}` - List workspaces.
- `POST /api/v1/workspaces` - Create workspace (`{ title, summary?, visibility?, isAgentic? }`).
- `GET /api/v1/workspaces/:id` - Retrieve workspace metadata.
- `PATCH /api/v1/workspaces/:id` - Update workspace metadata.
- `DELETE /api/v1/workspaces/:id` - Delete workspace.
- `POST /api/v1/workspaces/:id/objects` - Attach object (`{ entityKind, entityId }`).
- `GET /api/v1/workspaces/:id/collaborators` - List workspace members.
- `POST /api/v1/workspaces/:id/collaborators` - Add member (`{ userId, permission }`).

### Direct Chats & Discussions
- `GET /api/v1/chats?limit={n}` - List active chats.
- `POST /api/v1/chats` - Start or find direct conversation (`{ participantId, initialMessage? }`).
- `GET /api/v1/chats/:id` - Chat details.
- `GET /api/v1/chats/:id/messages?limit={n}` - Message history.
- `POST /api/v1/chats/:id/messages` - Send message (`{ content }`).

### Events & Forms
- `GET /api/v1/events?workspaceId={id}` - List calendar events.
- `POST /api/v1/events` - Create event (`{ title, startTime, endTime, location?, workspaceId? }`).
- `GET /api/v1/forms?workspaceId={id}` - List forms.
- `POST /api/v1/forms` - Create form (`{ title, fields, workspaceId? }`).

### Autonomous Agents
- `POST /api/v1/agents/provision` - Register an autonomous agent and mint session keys.
- `GET /api/v1/agents/sessions` - List agent runtime sessions.
- `POST /api/v1/agents/harness` - Create CLI harness mirror session.
- `POST /api/v1/agents/sessions/:id/mirror` - Append CLI prompt/tool call history.
