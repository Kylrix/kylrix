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

## Unified panel color (STRICT)

A single component / section uses **one continuous fill**. Do **not** split a card into a deep-ash header band and a pitch-black body with a hard seam.

- Wrong: panel shell `#161412` + inner well `#0A0908` sharing one border (two-tone slab).
- Right: panel is all `#161412` (or all `#0A0908`). Title + actions sit on that same fill.
- Need structure or contrast? Nest a **child** with its own background (icon chip, row tile, delete button, duration chip) — like the fingerprint / trash tiles on passkey rows.
- Separate sections = separate sibling panels with gap, not internal color bands or long hairline dividers between list items.

## Color stack (Inverted Accent Standard)

| Role | Hex / token |
|---|---|
| Panel / Container Background | `#161412` (Canonical deep ash background for shells, pages, drawers, sidebars) |
| Primary Components / Cards / Wells (STRICT) | `#000000` (Strictly pitch black for all components, interactive cards, input wells, and items with text) |
| Component Border | `white/[0.08]`–`white/[0.12]` or `#34322F` |
| Text Color (STRICT) | `#FFFFFF` (`color: '#fff'`, `text-white` only — differentiate hierarchy by font-size, weight, or uppercase tracking, never muted/gray opacity) |
| Accent (core) | `#6366F1` |
| Accent (social/moment) | `#F59E0B` |
| Accent (flow) | `#A855F7` |

## Typography & Text Hierarchy

- Headers: `font-clash`
- Body / settings: `font-satoshi`
- **Pure White Text Rule (STRICT)**: All text is pure `#FFFFFF`. Prohibit `rgba(255,255,255,0.45)`, `text-white/50`, or gray text.
- Secondary / meta markers: smaller size (`0.72rem`), font-weight (`500` vs `800`), uppercase with letter-spacing (`letterSpacing: '0.08em'`).

## Related pointers

- Chrome hosts: `ui.chrome-surfaces`
- Drawer ↔ sidebar sizes: `ui.drawer-sidebar-desktop-translation`
- Brand hues: `colors`
- Interaction safety: `ui.interactivity-safety`, `ui.interaction-design`
