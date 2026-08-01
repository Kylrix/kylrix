---
name: kylrix-api
description: >-
  Use the Kylrix HTTP API with Personal Access Tokens (PATs). Covers auth,
  scopes, rate limits, every /api/v1 endpoint, tools.execute, error codes,
  and agent workflows (Claude Code, Cursor, etc.). Install with:
  npx skills add kylrix/kylrix/api
---

# Kylrix HTTP API (agent skill)

Teach coding agents and scripts how to call **https://www.kylrix.space/api/v1** with a Personal Access Token.

## Install this skill

```bash
npx skills add kylrix/kylrix/api
```

Create a token in the product: **Settings → Developers** → Personal access tokens.

## Base URL

| Environment | Base |
|-------------|------|
| Production | `https://www.kylrix.space/api/v1` |
| Local | `http://localhost:3000/api/v1` (or your app origin) |

All responses are JSON:

```json
{ "ok": true, "data": { } }
```

Errors:

```json
{
  "ok": false,
  "error": { "code": "scope_denied", "message": "Missing scope: notes:read" }
}
```

## Authentication

```http
Authorization: Bearer kyl_pat_<prefix>_<secret>
```

- Token format: `kyl_pat_<8-char-prefix>_<secret>`
- Shown **once** at creation. Only a hash is stored server-side.
- Revoke anytime from Settings → Developers.
- Prefer least-privilege scopes. Never commit tokens.

### Minimal curl

```bash
export KYLRIX_PAT='kyl_pat_xxxxxxxx_…'
curl -sS \
  -H "Authorization: Bearer $KYLRIX_PAT" \
  https://www.kylrix.space/api/v1/me
```

## Scopes (permissions)

Grant only what the integration needs. Catalog is **additive-only** (never rename shipped scopes).

| Scope | Purpose | Sensitive |
|-------|---------|-----------|
| `profile:read` | Account id + granted scopes via `/me` | |
| `notes:read` | List / get ideas (notes) | |
| `notes:write` | Create / update ideas (via tools) | |
| `goals:read` | List goals | |
| `goals:write` | Mutate goals (via tools) | |
| `forms:read` | Read forms (via tools) | |
| `forms:write` | Submit / mutate forms (via tools) | |
| `events:read` | Read events (via tools) | |
| `events:write` | Mutate events (via tools) | |
| `flows:read` | List owned flows | |
| `flows:write` | Mutate flows (via tools) | |
| `flows:install` | Install published flows (via tools) | |
| `vault:read` | Vault metadata / read tools | yes |
| `vault:write` | Vault write tools | yes |
| `objects:read` | Object-link reads | |
| `objects:write` | Object-link writes | |
| `tools:execute` | `POST /tools/execute` | yes |

Missing scope → HTTP **403**, `error.code = "scope_denied"`.

## Rate limits

Enforced **per token** and **per account** (stricter of the two applies).

| Plan | Per minute | Per hour |
|------|------------|----------|
| Free | 20 | 200 |
| Pro / Teams | 120 | 5000 |

Over limit → HTTP **429**, `error.code = "rate_limited"`, header `Retry-After` (seconds).

Payload body max ≈ **256 KB** → **413** if larger.

## Endpoints

### `GET /me` — `profile:read`

Who the token belongs to.

```bash
curl -sS -H "Authorization: Bearer $KYLRIX_PAT" \
  https://www.kylrix.space/api/v1/me
```

Example `data`:

```json
{
  "id": "userId",
  "auth": "pat",
  "scopes": ["profile:read", "notes:read"],
  "patId": "…"
}
```

### `GET /notes` — `notes:read`

Query: `limit` (1–100, default 25).

```bash
curl -sS -H "Authorization: Bearer $KYLRIX_PAT" \
  "https://www.kylrix.space/api/v1/notes?limit=25"
```

Each item: `{ id, title, updatedAt, isPublic }`.

### `GET /notes/:id` — `notes:read`

Single idea owned by the token user. 404 if missing or not owned.

```bash
curl -sS -H "Authorization: Bearer $KYLRIX_PAT" \
  https://www.kylrix.space/api/v1/notes/<noteId>
```

`data`: `{ id, title, content, updatedAt, isPublic }`.

### `GET /goals` — `goals:read`

Query: `limit` (1–100, default 25).

```bash
curl -sS -H "Authorization: Bearer $KYLRIX_PAT" \
  "https://www.kylrix.space/api/v1/goals?limit=25"
```

Each item: `{ id, title, status, updatedAt }`.

### `GET /flows` — `flows:read`

Owned flows. Query: `limit` (1–100, default 25).

```bash
curl -sS -H "Authorization: Bearer $KYLRIX_PAT" \
  "https://www.kylrix.space/api/v1/flows?limit=25"
```

Each item: `{ id, name, isPublic, installCount, reviewStatus }`.

### `POST /tools/execute` — `tools:execute`

Run a registered Kylrix tool as the token user.

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $KYLRIX_PAT" \
  -H "Content-Type: application/json" \
  -d '{"toolId":"user.profile.read","params":{}}' \
  https://www.kylrix.space/api/v1/tools/execute
```

Body:

```json
{
  "toolId": "objects.idea.search",
  "params": { "query": "roadmap" }
}
```

#### Common tool IDs

| toolId | Typical need |
|--------|----------------|
| `user.profile.read` | Profile |
| `workspace.create` / `workspace.read` / `workspace.update` / `workspace.delete` / `workspace.search` | Workspaces |
| `objects.idea.create` / `read` / `update` / `delete` / `search` | Ideas |
| `objects.goal.create` / `read` / `update` / `delete` / `search` | Goals |
| `objects.form.read` / `objects.form.submit` | Forms |
| `objects.tag.create` / `objects.tag.search` | Tags |
| `objects.vault.secret.create` / `read` / `delete` / `search` | Vault (sensitive) |
| `search.ecosystem` | Cross search |
| `ui.navigate` | Navigation hint (UI agents) |
| `developer.pat.create` / `list` / `revoke` | Manage PATs (privileged) |

Always pair `tools:execute` with the resource scopes that match what the tool touches (e.g. idea tools → `notes:read` / `notes:write`).

## Error codes

| HTTP | code | Meaning |
|------|------|---------|
| 401 | `unauthorized` | Missing Bearer |
| 401 | `invalid_pat` | Bad / revoked token |
| 403 | `scope_denied` | Scope missing |
| 404 | `not_found` | Unknown path or resource |
| 413 | — | Body too large |
| 429 | `rate_limited` | Slow down; honor `Retry-After` |
| 500 | `internal_error` | Unexpected failure |

## Agent playbook

1. Install skill: `npx skills add kylrix/kylrix/api`
2. Ask user for a PAT (or guide them to Settings → Developers).
3. Call `GET /me` first to confirm scopes.
4. Prefer REST list/get endpoints for reads; use `tools/execute` for mutations and richer ops.
5. On 429, sleep `Retry-After` seconds and retry once.
6. Never log full tokens. Mask as `kyl_pat_<prefix>_***`.

## Product docs

- In-app: https://www.kylrix.space/docs/api
- Token UI: https://www.kylrix.space/settings?tab=developers

## Security notes

- Tokens act as the user for granted scopes — treat like passwords.
- Vault and `tools:execute` are high risk; default agents to read-only scopes.
- OAuth apps for third-party “Sign in with Kylrix” are coming soon; until then use PATs.
- Do not invent new public API paths; extend via scopes + tools registry.

## Changelog (skill)

- **v1** — PAT Bearer auth, `/me`, `/notes`, `/notes/:id`, `/goals`, `/flows`, `/tools/execute`, scopes + rate limits documented.
