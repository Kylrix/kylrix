---
name: kylrix-guardrails
description: Enforces Kylrix safety and architecture rules in the single Next.js codebase. Use before editing app logic, data flows, shared services, or cross-app UX.
disable-model-invocation: true
---

# Kylrix Guardrails

## Rules

1. Read `AGENTS.md` and `.agents/skills/SKILLS.md` first. Then open only the specific skill you need.
2. Canonical app tree is this repo (`kylrix/`). Prefer `lib/sdk`, `lib/services`, and Server Actions over new surfaces.
3. **No new in-app HTTP APIs** (`app/api/*`, `route.ts`) for product UI flows — use Server Actions / in-process helpers. **Exception:** public developer surface `app/api/v1/*` (PAT-authenticated; see `system.pat-http-api`).
4. Never edit `generated/` or hand-edit generated Appwrite types. Schema changes only when the user explicitly requests them — follow **`system.appwrite-cli-ops`** (durable CLI SoT; survives official `appwrite-cli` reinstall). Never hand-edit `appwrite.config.json`; never `push tables`.
5. Single database: `passwordManagerDb`. Never introduce other DB IDs.
6. Terminology: **Table** / **Row** only (never Collection/Document) in code, logs, and UI.
7. Routing: Flow = `/flows` (workflows only). Workspaces = `/workspaces`. Goals/forms/events are separate. See `system.routing-canonical`.
8. Keep token ledger + BlockBee billing modules — not optional “Web3 cut” targets.
9. Privileged ops: server-side `ADMINS` allowlist; do not trust client role labels.
10. Overlay UX: conditional mount (`{isOpen && <Drawer />}`); OpenBricks drawers use `keepMounted: false`, `disablePortal: true`.
11. PNPM only. Opaque product chrome (no gradient/translucent chrome).
12. Layman UI copy — no jargon in user-facing strings.
13. Keep changes surgical. Do not expand scope into unrelated refactors.
14. Dead code: Knip for unused files/exports (`system.dead-code-knip`); do not enable unused-vars in default `pnpm lint`.
15. Local-first invariants: `architecture.local-first`. Unlock/trust boundaries: `architecture.security-session`. Product UI: `openbricks`.
