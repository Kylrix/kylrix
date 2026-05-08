---
name: kylrix-navigation-policy
description: Enforces same-tab navigation and context-preserving route behavior. Use when editing links, redirects, shell transitions, or flows that should stay in-place.
disable-model-invocation: true
---

# Navigation Policy

## Rules

1. Default to same-tab navigation.
2. Preserve current page context when drawer/sheet flow can handle the action.
3. Avoid unnecessary full-page redirects for in-context actions.
4. Ensure route changes do not unintentionally clear volatile session state.

