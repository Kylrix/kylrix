---
name: kylrix-muted-v3-design
description: >-
  Kylrix Next.js mono app — Muted V3 Deep Earth UI system (palette, typography,
  opaque surfaces, hairline borders, bottom chrome parity, prohibited patterns).
  Use when styling MUI surfaces, drawers, shells, navigation, cards, typography,
  spacing, brand polish, or reviewing visuals for drift from ecosystem design docs.
disable-model-invocation: true
---

# Kylrix Muted V3 — Next.js Implementation

## Sources of truth (read before large UI changes)

- Repo root / parent: `AGENTS.md` (colors, typography trio, mandates)
- `/design.md` — gradients + **zero translucent fills** policy, typography hierarchy
- `/DESIGN.V2.md` — Deep Earth palette, logo matrix
- `kylrix/app/globals.css` — CSS variables consumed by Next.js (`--font-*`, surfaces)
- **`kylrix/components/UnifiedBottomBar.tsx`** — canonical mobile bottom chrome (match drawers/sheets to this)
- **`kylrix/components/common/Logo.tsx`** — ecosystem / app hemisphere logic

Companion skills: **`kylrix-brand`** (positioning copy, logo doc pointers), **`kylrix-drawer-ui`** (drawer patterns).

## Palette (implement with opaque solids only)

Do **not** use `rgba`, `alpha()`, `hsla`, or `opacity` \< 1 for **background fills** on product UI. Layer depth with discrete hex steps.

| Role | Hex | Typical use |
| :--- | :--- | :--- |
| Canvas / void | `#0A0908` or `#000000` | Inset panels, input wells |
| Primary surface | `#161412` | Drawer paper, bottom nav shell (`UnifiedBottomBar`) |
| Hover / lifted | `#1C1A18` (`#1F1D1B` in `globals`) | Rows, hover fill |
| Opaque edge / hairline | e.g. `#34322F` on `#161412` | Borders (replaces translucent white strokes) |
| Ecosystem primary | `#6366F1` — hover e.g. `#575CF0` solid | Primary buttons, emphasis (solid only) |

App accents — from `AGENTS.md` — only for app-scoped UI.

## Typography (always wire explicitly in MUI when needed)

MUI defaults are **not** brand fonts:

- **UI / body:** `fontFamily: 'var(--font-satoshi)'`
- **Display / titles:** `fontFamily: 'var(--font-clash)'`, optional `letterSpacing: '-0.02em'`
- **Technical:** `fontFamily: 'var(--font-mono)'`
- **Muted text:** opaque hex (`#9B9691`), not translucent white `rgba`.

## Prohibited (do not ship)

- **Gradient fills** on shells, drawers, nav, cards, buttons (`design.md`).
- **Translucent fills** (`rgba`, `alpha()`, opacity-scaled backgrounds) on panels, sheets, chrome buttons, chips, icon tiles, inputs — solids only (`design.md` §3 Architectural).
- **Backdrop blur / glass** on product surfaces.
- **Tailwind** — MUI + CSS only (`AGENTS.md`).

## Bottom sheets & drawers (UX)

1. **Chrome parity:** Same opaque surface & hairline convention as `UnifiedBottomBar`; no gradient `backgroundImage`.
2. **Copy discipline:** Prefer short titles; avoid stacked paragraphs unless the flow is explanatory.
3. **Primary chrome buttons** (mic, FAB-like controls): fill with **solid** ecosystem primary (`#6366F1`), white icon — not tinted translucency.
4. **Safe area:** `paddingBottom: max(theme spacing, env(safe-area-inset-bottom))`.
5. **Scroll:** One obvious scroll region.

## Polishing checklist

- [ ] No gradients
- [ ] No translucent backgrounds on interactive / panel chrome
- [ ] Solid hex borders for separation
- [ ] Fonts use `--font-satoshi` / `--font-clash` / `--font-mono`
- [ ] Bottom sheet surface matches unified bottom bar treatment

## Reference implementation

- `kylrix/components/overlays/AgenticDrawer.tsx` — minimal copy, solid controls, opaque palette.
