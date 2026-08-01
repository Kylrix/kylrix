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
| `oauth_apps` / `oauth_app_installs` | OAuth foundation (UI coming soon / External apps list) |

Column types: **varchar / text / mediumtext** only (see `system.appwrite-cli-ops`).

## Auth

`Authorization: Bearer kyl_pat_<prefix>_<secret>`

Verify: lookup `tokenPrefix` → compare `sha256(token)` → check status/expiry → rate limit → scope gate.

## Limits

- Free: 20/min, 200/hour
- Pro/Teams: 120/min, 5000/hour

## Surfaces

- Settings → **Developers** (after Security) — skill install command at top
- Connected Apps → Sign-in methods + **External apps**
- Docs: `/docs`, `/docs/api`
- Routes: `app/api/v1/[...path]/route.ts`
- Shared: `lib/api/*` + `PatService` (same foundation for actions + HTTP)
- Install constant: `lib/api/public.ts` → `KYLRIX_API_SKILL_INSTALL`

## Scopes

Stable catalog in `lib/api/scopes.ts` — additive only; never rename shipped scopes.
