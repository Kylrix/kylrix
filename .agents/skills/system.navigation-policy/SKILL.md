---
name: system.navigation-policy
description: Enforces same-tab navigation and canonical route helpers. Use when editing links, redirects, shell transitions, or chrome active states.
disable-model-invocation: true
---

# Navigation Policy

## Rules

1. Default to same-tab navigation.
2. Preserve page context when a drawer/sheet can handle the action.
3. Avoid full-page redirects for in-context actions.
4. Use `lib/routing/app-paths.ts` (`isFlowPath`, `isWorkspacesPath`, `isGoalsSurfacePath`) for chrome highlighting — do not hardcode obsolete `/projects` or `/flow` checks.
5. Auth entry is `/` + login drawer — there is no `/login` page.
6. Route renames must add `next.config.js` redirects for old public URLs.
