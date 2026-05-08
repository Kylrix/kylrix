---
name: kylrix-guardrails
description: Enforces Kylrix safety and architecture rules in the single Next.js codebase. Use before editing app logic, data flows, shared services, or cross-app UX.
disable-model-invocation: true
---

# Kylrix Guardrails

## Rules

1. Read `AGENTS.md` and follow it as hard policy.
2. Never edit `generated/`, `types/appwrite.d.ts`, or `appwrite.config.json` manually.
3. Prefer existing `lib/sdk` and `lib/services` paths over ad-hoc duplication.
4. Preserve privacy boundaries (especially public/shared notes and ghost-note isolation).
5. Keep same-tab navigation and drawer-first UX unless user asks otherwise.
6. Do not run build/lint commands unless explicitly requested.
7. Keep changes surgical and avoid unrelated refactors.

