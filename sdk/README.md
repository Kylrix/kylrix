# Kylrix SDK

Shared contracts and integration surfaces for UI, REST (`/api/v1`), MCP, and external clients.

## What belongs here

- **contracts/** — canonical domain shapes (auth, goals, notes, workspaces, events, chats, agentic tools, …)
- **api/** — path builders (`KYLRIX_API_V1_BASE`, `apiV1Path`)
- **token/**, **crosslinks/**, **notes/** — platform-agnostic business rules with dependency injection
- **identity/** — profile pic resolution, username normalization, verification flags
- **orchestration/** — cross-object metadata helpers

## What stays outside

- Appwrite adapters (`lib/appwrite`, `lib/services`)
- React components (`components/`)
- Route handlers (`app/api/`)
- Server-only ops and RLS (`lib/actions`)

Import from `@/sdk` or `@/sdk/<module>`.
