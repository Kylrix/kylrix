# Kylrix REST HTTP API

External agents, mobile apps, CLI tools, and integrations use Personal Access Tokens (PATs) or OAuth 2.1 tokens.

**→ [Wire any agent](./integrations.md)** · MCP: [mcp.md](./mcp.md) · Full route table: [api/references/http-api.md](../api/references/http-api.md)

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
| `workspaces:read` / `workspaces:write` | Workspaces & nested projects |
| `chats:read` / `chats:write` | Conversations, threads, messages |
| `events:read` / `events:write` | Calendar |
| `forms:read` / `forms:write` | Forms |
| `flows:read` / `flows:write` / `flows:install` | Workflows |
| `vault:read` / `vault:write` | Vault metadata (not plaintext secrets without unlock) |
| `moments:read` / `moments:write` | Moments & feeds |
| `tags:read` / `tags:write` | Tags |
| `objects:read` / `objects:write` | Object links |
| `trash:read` / `trash:write` | Trash restore / purge |
| `agents:read` / `agents:write` / `agents:harness` / `agents:provision` | Agent sessions |
| `pats:read` / `pats:write` | Manage PATs |
| `tools:execute` | Run tools (restricted) |

---

## Endpoints (summary)

### Token & PAT self-service
- `GET /token` · `GET|PATCH /token/scopes` · `POST /token/scopes` (`mode: grant`)
- `GET /pats` · `POST /pats` · `DELETE /pats/:id`

### Profile
- `GET /me`

### Notes & goals
- `GET /notes?workspace_id=&limit=` · `POST /notes` · `GET|PATCH|DELETE /notes/:id`
- `GET /goals?workspace_id=&status=&limit=` · `POST /goals` · `GET|PATCH|DELETE /goals/:id`

### Workspaces & projects
- `GET /workspaces` · `POST /workspaces` · `GET|PATCH|DELETE /workspaces/:id`
- `/projects` is an alias for `/workspaces`
- `GET|POST /workspaces/:id/collaborators` · `POST /workspaces/:id/objects`
- **Nested projects:** `GET|POST /workspaces/:workspaceId/projects` · `GET|PATCH|DELETE /workspaces/:workspaceId/projects/:projectId`
- Discussions: `GET /threads?parent_kind=workspace&parent_id=:id` · `POST /threads`

### Events, forms, flows, feeds, moments, chats, vault, tags, trash, agents

See [api/references/http-api.md](../api/references/http-api.md) for the full route table.

MCP and REST share the same `ApiResources` layer — same PAT, same scopes. Prefer **MCP** in IDEs; use **REST** for mobile apps, CI, and scripts.

Domain shapes: `sdk/contracts/` (e.g. `goals.ts`).
