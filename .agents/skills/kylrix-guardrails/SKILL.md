---
name: kylrix-guardrails
description: Enforces Kylrix safety and architecture rules in the single Next.js codebase. Use before editing app logic, data flows, shared services, or cross-app UX.
disable-model-invocation: true
---

# Kylrix Guardrails

## Rules

1. Read `AGENTS.md` and follow it as hard policy.
2. Never edit `generated/` or `types/appwrite.d.ts` manually. Only edit `appwrite.config.json` when the user explicitly requests schema changes, and keep changes surgical.
3. Prefer existing `lib/sdk` and `lib/services` paths over ad-hoc duplication.
4. Preserve privacy boundaries (especially public/shared notes and ghost-note isolation).
5. Keep same-tab navigation and drawer-first UX unless user asks otherwise.
6. Do not run build/lint commands unless explicitly requested.
7. Keep changes surgical and avoid unrelated refactors.
8. For privileged operations, enforce `ADMINS` email allowlist checks server-side; do not rely only on role labels.
9. For token/network operations, require explicit singleton state-row checks before allowing mutations.

