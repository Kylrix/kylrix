# HTTP API reference (companion)

Canonical agent skill: [`../SKILL.md`](../SKILL.md)

Install:

```bash
npx skills add kylrix/kylrix/api
```

## Response envelope

Success:

```json
{ "ok": true, "data": <payload> }
```

Failure:

```json
{
  "ok": false,
  "error": { "code": "<string>", "message": "<string>" }
}
```

## Auth header

```
Authorization: Bearer kyl_pat_<prefix>_<secret>
```

## Live routes (v1)

| Method | Path | Scope |
|--------|------|-------|
| GET | `/me` | `profile:read` |
| GET | `/notes?limit=` | `notes:read` |
| GET | `/notes/:id` | `notes:read` |
| GET | `/goals?limit=` | `goals:read` |
| GET | `/flows?limit=` | `flows:read` |
| POST | `/tools/execute` | `tools:execute` |

Body for tools:

```json
{ "toolId": "<id>", "params": { } }
```

## Rate limits

| Plan | /min | /hour |
|------|------|-------|
| Free | 20 | 200 |
| Pro/Teams | 120 | 5000 |

429 + `Retry-After`.

## Scopes

See `lib/api/scopes.ts` in the Kylrix repo — additive only.
