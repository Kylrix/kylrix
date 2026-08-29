# Kylrix SDK

Shared contracts and integration surfaces for UI, REST (`/api/v1`), MCP, and external clients.

## What belongs here

- **contracts/** — canonical domain shapes (Zod + JSON Schema) used by every surface
- **api/** — path builders and HTTP client helpers
- **token/**, **crosslinks/**, **notes/** — platform-agnostic business rules with dependency injection
- **design/**, **topbar/**, **fab/** — shared UI tokens and layout primitives

## What stays outside

- Appwrite adapters (`lib/appwrite`, `lib/services`)
- React components (`components/`)
- Route handlers (`app/api/`)
- Server-only ops and RLS (`lib/actions`)

Import from `@/sdk` or `@/sdk/<module>`.
