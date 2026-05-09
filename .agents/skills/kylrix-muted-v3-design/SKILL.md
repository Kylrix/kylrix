---
name: kylrix-muted-v3-design
description: >-
  Kylrix Next.js mono app — Muted V3 Deep Earth UI system (palette, typography,
  rim-light surfaces, bottom chrome parity, prohibited patterns). Use when styling
  MUI surfaces, drawers, shells, navigation, cards, typography, spacing, brand polish,
  or reviewing visuals for drift from ecosystem design docs.
disable-model-invocation: true
---

# Kylrix Muted V3 — Next.js Implementation

## Sources of truth (read before large UI changes)

- Repo root / parent: `AGENTS.md` (colors, typography trio, mandates)
- `/design.md` — gradients prohibition, rim rules, typography hierarchy
- `/DESIGN.V2.md` — Deep Earth palette, logo matrix, rim-lighting note
- `kylrix/app/globals.css` — CSS variables consumed by Next.js (`--font-*`, surfaces)
- **`kylrix/components/UnifiedBottomBar.tsx`** — canonical mobile bottom chrome (match drawers/sheets to this)
- **`kylrix/components/common/Logo.tsx`** — ecosystem / app hemisphere logic

Companion skills: **`kylrix-brand`** (positioning copy, logo doc pointers), **`kylrix-drawer-ui`** (drawer patterns).

## Palette (implement with solids)

| Role | Hex | Typical use |
| :--- | :--- | :--- |
| Canvas / void | `#000000` or `#0A0908` (see `globals.css`; prefer tokens) | Behind panels, cutout punches |
| Primary surface | `#161412` | Drawer paper, shared bottom nav shell, lifted panels |
| Hover / lifted | `#1C1A18` or `--surface-2` from `globals.css` | List row hover, pressed affordances |
| Rim / hairline | `1px solid rgba(255, 255, 255, 0.05)` | Top edge of bottom sheets, cards (align with `UnifiedBottomBar` Paper) |
| Ecosystem primary | `#6366F1` | Primary actions, selection stroke (low saturation tints only) |

App accents (Connect Amber, Note Pink, etc.) — use from `AGENTS.md` only for app-scoped UI, not global chrome.

## Typography (always wire explicitly in MUI when needed)

MUI defaults are **not** brand fonts. Use CSS variables so `next/font` / loaded faces apply:

- **UI / body / buttons / inputs:** `fontFamily: 'var(--font-satoshi)'`
- **Display / section titles / strong headers:** `fontFamily: 'var(--font-clash)'`, often `letterSpacing: '-0.02em'`
- **Code / IDs / timers / technical:** `fontFamily: 'var(--font-mono)'`

Defined in `app/globals.css`: `--font-satoshi`, `--font-clash`, `--font-mono`.

## Prohibited (do not ship)

- **Gradients** as background fills (`linear-gradient`, `radial-gradient`, etc.) on shells, drawers, nav, cards, or buttons. See `design.md` § Gradients.
- **Glass / backdrop blur** on product surfaces (`backdrop-filter: blur(...)`) — `design.md` § Glassmorphism.
- **Tailwind** in this ecosystem — **MUI + CSS** only (`AGENTS.md`).

## Bottom sheets & drawers (UX + parity)

1. **Match global bottom bar:** `bgcolor: '#161412'`, `border: '1px solid rgba(255, 255, 255, 0.05)'`, `borderBottom: 0`, `borderRadius: '24px 24px 0 0'`, no gradient `backgroundImage`, `boxShadow: 'none'` unless a specific surface spec requires elevation.
2. **Breathing room:** generous vertical padding (`3`–`4` theme units minimum on content), explicit section spacing (`gap` / `spacing={2}`+), avoid dense `Chip` grids for primary actions — prefer **full-width tap targets** (min ~44px height).
3. **Hierarchy:** optional top **drag handle** (neutral pill); optional **section label** row (Satoshi, small caps feel via `letterSpacing`, muted opacity).
4. **Safe area:** respect `paddingBottom: max(theme spacing, env(safe-area-inset-bottom))`.
5. **Scroll:** one obvious scroll region; header/composer pinned when possible.

## Polishing checklist

- [ ] No gradients on the surface
- [ ] Fonts use `--font-satoshi` / `--font-clash` / `--font-mono` where appropriate
- [ ] Bottom sheet colors match `UnifiedBottomBar` Paper
- [ ] Rim border `rgba(255,255,255,0.05)` — not heavier unless spec says
- [ ] Touch targets and vertical rhythm feel calm, not cramped

## Reference implementation

- `kylrix/components/overlays/AgenticDrawer.tsx` — intended as a conforming bottom sheet (chrome + typography + spacing).
