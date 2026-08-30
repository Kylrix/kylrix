---
name: system.pat-http-api
description: >-
  Personal Access Tokens, /api/v1 HTTP API, rate buckets (pat_rate_state /
  api_user_rate_state), scopes catalog, Developers settings tab. Use when
  changing PAT, public API, or developer tooling. Public agent skill lives at
  api/ (npx skills add kylrix/kylrix/api) and .agents/skills/api/.
---

# PAT + HTTP API

## Public agent skill (installable)

```bash
npx skills add kylrix/kylrix/api
```

Canonical docs for external agents: `api/SKILL.md` (mirrored at `.agents/skills/api/SKILL.md`).
Companion reference: `api/references/http-api.md`.

When changing endpoints, scopes, or rate limits — **update `api/SKILL.md` and the mirror** so `npx skills` stays accurate.

## Tables

| Table | Role |
|-------|------|
| `pats` | Token metadata (prefix + hash, never plaintext secret) |
| `pat_rate_state` | 1 row/PAT — minute/hour counters via `incrementRowColumn` |
| `api_user_rate_state` | 1 row/user — account-level ceilings |
| `oauth_apps` / `oauth_app_installs` | Optional product overlays only — **Appwrite Apps/grants are SoT** for Sign in with Kylrix (see `system.oauth2-sign-in-with-kylrix`). Do not use local tables as the IdP grant store. |

Column types: **varchar / text / mediumtext** only (see `system.appwrite-cli-ops`).

## Auth

`Authorization: Bearer kyl_pat_<appwriteUniqueId>_<secret>`

Row id = `ID.unique()` = tokenPrefix (collision-free). Secret is random; only SHA-256 hash stored.

Verify: lookup `tokenPrefix` → compare hash → status/expiry → rate limit → scope gate.

## Public HTTP surface

Self-service (any valid PAT): `GET /token`, `GET|PATCH|POST /token/scopes` (`mode: grant` on POST).

REST resources: notes, goals, workspaces, events, forms, flows/:id/installations,
feeds, moments (+ comments), threads (unified plaintext), chats (E2EE meta / plaintext send when open),
vault metadata, tags, objects, agents/harness. **No** `/tools/execute` (410).

Intentional gaps: E2EE send, Nostr signing, vault secrets, WebRTC.

## Limits (Rolling 1m / 24h)

- **Free**: 12 req / min · 300 req / day
- **Pro**: 60 req / min · 2,500 req / day
- **Teams**: 120 req / min · 5,000 req / day (2× Pro)
- **Payload cap**: ~256 KB per request

## Surfaces

- Settings → **Developers** (after Security) — skill install command at top
- Connected Apps → Sign-in methods + **External apps**
- Docs: `/docs`, `/docs/api`
- Routes: `app/api/v1/[...path]/route.ts`
- Shared: `lib/api/*` + `PatService` (same foundation for actions + HTTP)
- Install constant: `lib/api/public.ts` → `KYLRIX_API_SKILL_INSTALL`

## Scopes

Stable catalog in `lib/api/scopes.ts` — additive only; never rename shipped scopes.
