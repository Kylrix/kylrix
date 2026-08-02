# HTTP API reference

Install: `npx skills add kylrix/kylrix/api`

Base: `http://localhost:3005/api/v1` (local) · `https://www.kylrix.space/api/v1` (prod)

Auth: `Authorization: Bearer kyl_pat_<id>_<secret>`

## Self-service (any valid PAT — rescue hatch)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/token` | Current PAT + scopes + catalog |
| GET | `/token/scopes` | Scope catalog |
| PATCH | `/token/scopes` | Replace scopes on **this** PAT |
| POST | `/token/scopes/grant` | Additive grant on **this** PAT |

## Resources

| Method | Path | Scope |
|--------|------|-------|
| GET | `/me` | profile:read |
| GET/POST | `/notes` | notes:read / notes:write |
| GET/PATCH/DELETE | `/notes/:id` | notes:read / notes:write |
| GET/POST | `/goals` | goals:read / goals:write |
| GET/PATCH/DELETE | `/goals/:id` | goals:read / goals:write |
| GET | `/flows` | flows:read |
| GET | `/workspaces`, `/projects` | workspaces:read |
| GET | `/workspaces/:id` | workspaces:read |
| GET | `/events` | events:read |
| GET | `/forms` | forms:read |
| GET | `/chats` | chats:read |
| GET | `/agents`, `/agents/sessions` | agents:read |
| POST | `/agents/harness` | agents:harness + agents:write |
| POST | `/agents/sessions/:id/mirror` | agents:harness + agents:write |
| GET/POST | `/pats` | pats:read / pats:write |
| DELETE | `/pats/:id` | pats:write |

`POST /tools/*` → **410**. Full narrative: `api/SKILL.md`.
