---
name: system.routing-canonical
description: Canonical Kylrix App Router paths after the scorched-earth route wipe. Use before adding links, redirects, nav items, or isXPath helpers.
---

# Canonical routing

Source of truth: `lib/routing/app-paths.ts` + `next.config.js` redirects.

## Product map

| Surface | Canonical path | Notes |
|---------|----------------|-------|
| Home / auth entry | `/` | No `/login` page — auth drawers open from `/` |
| Ideas (notes) | `/app`, `/app/[id]`, `/idea/[id]` | Primary note list under `/app` |
| Flow (= workflows only) | `/flows` | Not goals/forms/events. `/flow` and `/workflows` redirect here |
| Workspaces | `/workspaces`, `/workspaces/[projectId]` | Projects **table** under the hood. `/projects` redirects |
| Goals / forms / events | `/goals`, `/goal/[id]`, `/forms`, `/form/[id]`, `/events`, `/events/[id]` | Own products — **not** Flow |
| Connect | `/connect`, chats, calls, hangouts invite, posts | Groups invite lives under hangouts |
| Vault | `/vault`, `/vault/totp`, share `[[...key]]` routes | |
| Settings / agents | `/settings`, `/settings/agents`, `/agents/chat/[id]`, `/agents/session/[id]` | No standalone `/agents` hub page |
| Billing | `/billing/checkout`, `/billing/success`, `/billing/coupon/[id]`, `/pricing` | BlockBee hosted checkout |
| Profile | `/u/[username]` | |

## Deleted / do not revive

`/login`, `/handoff`, `/resume`, `/silent-check`, `/connect/settings`, `/vault/sharing`, `/vault/overview`, `/app/extensions`, `/app/settings`, `/app/landing`, `/app/shared`, `/app/popout`, `/r/[username]`, `/project/[projectId]`, accounts subtree as a product shell.

## Helpers

- `isFlowPath` → `/flows` only
- `isGoalsSurfacePath` → goals/forms/events
- `isWorkspacesPath` → `/workspaces`

## Rules

1. Prefer `lib/routing/app-paths.ts` over string literals in chrome/nav.
2. Do not invent new `app/api/*` routes for in-app flows.
3. Keep redirects in `next.config.js` when renaming public URLs.
