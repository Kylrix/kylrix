# HTTP API reference

Install: `npx skills add kylrix/kylrix/api`

REST CRUD only. `/tools/execute` returns 410.

| Method | Path | Scope |
|--------|------|-------|
| GET | `/me` | profile:read |
| GET/POST | `/notes` | notes:read / notes:write |
| GET/PATCH/DELETE | `/notes/:id` | notes:read / notes:write |
| GET/POST | `/goals` | goals:read / goals:write |
| GET/PATCH/DELETE | `/goals/:id` | goals:read / goals:write |
| GET | `/flows` | flows:read |
