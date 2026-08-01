---
name: kylrix-api
description: >-
  Use the Kylrix HTTP API with Personal Access Tokens (PATs). REST CRUD for
  notes and goals, scopes, rate limits, and errors. Tools are internal only —
  never call /tools/execute. Install with: npx skills add kylrix/kylrix/api
---

# Kylrix HTTP API (agent skill)

Call **https://www.kylrix.space/api/v1** with a Personal Access Token using **REST CRUD**.

Do **not** use `/tools/execute` (gone). Tools may run inside the server when a route needs them; they are not a public HTTP surface and expect app sessions.

## Install

```bash
npx skills add kylrix/kylrix/api
```

Token UI: **Settings → Developers** (token is auto-copied on create).

For **Sign in with Kylrix** (OAuth provider for third-party apps), install the sibling skill instead:

```bash
npx skills add kylrix/kylrix/oauth2
```

Docs: https://www.kylrix.space/docs/api · OAuth: https://www.kylrix.space/docs/oauth2

## Auth

```http
Authorization: Bearer kyl_pat_<appwriteUniqueId>_<secret>
```

## Response

```json
{ "ok": true, "data": { } }
```

```json
{ "ok": false, "error": { "code": "scope_denied", "message": "…" } }
```

## Notes CRUD — `notes:read` / `notes:write`

```bash
# Create
curl -sS -X POST -H "Authorization: Bearer $KYLRIX_PAT" -H "Content-Type: application/json" \
  -d '{"title":"Hello","content":"From API","isPublic":false}' \
  https://www.kylrix.space/api/v1/notes

# List
curl -sS -H "Authorization: Bearer $KYLRIX_PAT" \
  "https://www.kylrix.space/api/v1/notes?limit=25"

# Get / Patch / Delete
curl -sS -H "Authorization: Bearer $KYLRIX_PAT" \
  https://www.kylrix.space/api/v1/notes/<id>
curl -sS -X PATCH -H "Authorization: Bearer $KYLRIX_PAT" -H "Content-Type: application/json" \
  -d '{"title":"Updated"}' https://www.kylrix.space/api/v1/notes/<id>
curl -sS -X DELETE -H "Authorization: Bearer $KYLRIX_PAT" \
  https://www.kylrix.space/api/v1/notes/<id>
```

## Goals CRUD — `goals:read` / `goals:write`

Same pattern under `/api/v1/goals` with body `{ title, description?, status? }`.

## Other

| Method | Path | Scope |
|--------|------|-------|
| GET | `/me` | `profile:read` |
| GET | `/flows` | `flows:read` |

## Rate limits

Free 20/min · 200/hr. Pro/Teams 120/min · 5000/hr. 429 + `Retry-After`.

## Errors

401 unauthorized / invalid_pat · 403 scope_denied · 404 not_found · 410 gone · 429 rate_limited
