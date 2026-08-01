---
name: openbricks
description: >-
  Canonical OpenBricks design system for Kylrix UI. Use for any visual work:
  settings, details, drawers, sidebars, cards, copy density, colors, surfaces,
  sectioning. This is the single source of truth — prefer it over scattered
  brand.* / ui.* notes when they conflict.
---

# OpenBricks (canonical)

Read this skill for product UI. Older `brand.openbricks-3.0`, `colors`, `ui.chrome-surfaces`, and `copy.plain-language` skills defer here when they conflict.

## Surfaces & chrome

- **Opaque only.** No gradients. No blur backdrops / frosted glass on product chrome.
- **No translucent washes** on panels (no `bg-*/10` hero fills that read as haze). Borders and solid ash blocks only.
- **Mobile:** top/bottom drawers for everything. Object details = full-screen (`100dvh`) drawers covering top + bottom chrome.
- **Desktop:** native **right** sidebar for details and drawers. Never edge-to-edge fullscreen details on desktop.
- Overlays: `keepMounted: false`, `disablePortal: true`, conditional mount `{isOpen && <X />}`.

## Color stack (ash sectioning)

| Role | Hex / token |
|---|---|
| Page / pitch | `#000000` / near-black |
| Panel shell | `#161412` |
| Section header bar | `#1C1A18` |
| Section body well | `#0A0908` / `#0B0A09` |
| Nested row | `#161412` on the well |
| Border | `white/[0.04]`–`white/[0.06]` or `#34322F` |
| Accent (core) | `#6366F1` |

**Section with shade, not hairlines.** Prefer stacked blocks of different ash blacks (shell → header bar → body well → nested rows) like the profile topbar panel. Do **not** rely on long divider lines between list items — separate with gap + distinct background.

## Copy density (STRICT)

- **Cut text.** Labels and actions beat paragraphs.
- No intro/hero cards that repeat the tab or nav the user already clicked.
- No “stats summary” chips that only mirror content listed below.
- No explanatory blah for obvious controls. One short warning line is enough for risky toggles (e.g. Remember Unlock → “Less safe”).
- Layman English only — see `copy.plain-language`. No crypto jargon in UI.

## Cards & lists

- Cards are for **interaction** or a real section of controls — not for decorative empty “About” blocks.
- List rows: compact icon + title + one meta line + trailing action.
- Event detail structure (header → labeled blocks → actions) is fine for **object details**; strip gradients/blur if copying that pattern.

## Typography

- Headers: `font-clash`
- Body / settings: `font-satoshi`
- Tiny section labels: uppercase tracking, muted white (`white/55`)

## Related pointers

- Chrome hosts: `ui.chrome-surfaces`
- Drawer ↔ sidebar sizes: `ui.drawer-sidebar-desktop-translation`
- Brand hues: `colors`
- Interaction safety: `ui.interactivity-safety`, `ui.interaction-design`
