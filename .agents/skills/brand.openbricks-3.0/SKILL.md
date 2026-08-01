---
name: brand.openbricks-3.0
description: >-
  Legacy OpenBricks 3.0 notes. Prefer the canonical `openbricks` skill for all
  UI work; this file only keeps historical tactile/drawer detail.
---

# OpenBricks 3.0 (legacy pointer)

**Canonical skill:** `.agents/skills/openbricks/SKILL.md`

Use `openbricks` for surfaces, sectioning, copy density, no-gradients/no-blur, and chrome. Keep the notes below only when you need drawer height / FAB specifics not yet folded into `openbricks`.

## Still useful specifics

- Bottom drawers default max ~`60dvh`; object details exception = `100dvh` fullscreen on mobile.
- FABs: primary action instantly; multi-option → drawer, not stacked menus.
- No multi-drawer side-by-side stacks — overlay cleanly.
- Inputs: min ~12px padding from card edges; row delete controls to the **left** of fields on tight viewports.
- Fonts: `font-clash` headers, `font-satoshi` body.

## Superseded / do not follow

- Ambient radial gradients / “top spotlight” washes — **forbidden** (see `openbricks` + AGENTS opaque surfaces).
- Long instructional paragraphs in settings — **forbidden**.
- Decorative hero/stats cards that repeat the current tab — **forbidden**.
