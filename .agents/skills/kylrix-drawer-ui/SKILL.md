---
name: kylrix-drawer-ui
description: Applies drawer-first interaction patterns for secondary actions, pickers, and in-context workflows. Use when replacing modal-heavy flows or stabilizing drawer UX.
disable-model-invocation: true
---

# Drawer UI

## Rules

1. Prefer drawer/sheet patterns for secondary interactions.
2. Keep scroll containment explicit and prevent overflow clipping.
3. Ensure clear close/expand affordances and keyboard accessibility.
4. Keep drawer content concise; split crowded flows.
5. **Spacing & parity:** Follow `.agents/skills/kylrix-muted-v3-design/SKILL.md` — match mobile bottom chrome (`UnifiedBottomBar`), no gradient fills, safe-area padding, full-width tap targets instead of cramped chip grids when listing actions.
6. **Desktop translation:** treat orientation as the source of truth, not route-specific hacks. Bottom drawers map to right sidebars on desktop; top drawers/topbar drawers map to left sidebars on desktop.
