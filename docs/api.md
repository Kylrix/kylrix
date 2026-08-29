# Kylrix REST HTTP API

External agents, mobile apps, CLI tools, and integrations use Personal Access Tokens (PATs) or OAuth 2.1 tokens.

**→ [Wire any agent in 60 seconds](./integrations.md)** · MCP: [mcp.md](./mcp.md)

---

## Base URI

**Production:** `https://www.kylrix.space/api/v1`

Self-hosted? See [SELFHOST.md](../SELFHOST.md).

```bash
export KYLRIX_PAT='kyl_pat_…'
export KYLRIX_API_BASE='https://www.kylrix.space/api/v1'
```

---

## Authentication

```bash
curl -H "Authorization: Bearer $KYLRIX_PAT" https://www.kylrix.space/api/v1/me
```

Mint tokens: **Settings → Developers** on [kylrix.space](https://www.kylrix.space).

---

## Scopes

| Scope | Description |
|---|---|
| `profile:read` | Profile and identity |
| `notes:read` / `notes:write` | Ideas & markdown notes |
| `goals:read` / `goals:write` | Goals & tasks |
| `workspaces:read` / `workspaces:write` | Workspaces |
| `chats:read` / `chats:write` | Conversations & messages |
| `events:read` / `events:write` | Calendar |
| `forms:read` / `forms:write` | Forms |
| `flows:read` / `flows:write` | Workflows |
| `agents:read` / `agents:write` | Agent sessions |
| `agents:provision` | Provision autonomous agents |
| `pats:read` / `pats:write` | Manage PATs |

---

## Endpoints (summary)

### Token self-service
- `GET /token` · `GET|PATCH /token/scopes` · `POST /token/scopes/grant`

### Profile
- `GET /me`

### Notes
- `GET /notes?workspaceId=&limit=` · `POST /notes` · `GET|PATCH|DELETE /notes/:id`

### Goals
- `GET /goals?workspaceId=&status=&limit=` · `POST /goals` · `GET|PATCH|DELETE /goals/:id`
- Fields: `title`, `description`, `status`, `priority`, `dueDate`, `tags`, `workspaceId` — see `sdk/contracts/goals.ts`

### Workspaces
- `GET /workspaces` · `POST /workspaces` · `GET|PATCH|DELETE /workspaces/:id`
- `GET|POST /workspaces/:id/collaborators` · `GET|POST /workspaces/:id/thread`

### Chats, events, forms, flows, moments, threads, vault, tags, agents

See [api/references/http-api.md](../api/references/http-api.md) for the full route table.
