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
- **Simple Language:** Use plain English. Prohibit technical jargon like "Entropy," "E2EE," "Decentralized," "Nexus," or "Node." Use "Secure," "Private," "Personal," or "System."

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
6. **No text walls:** keep copy minimal; avoid dense multi-line stacks in compact surfaces.
7. **Responsive drawer mapping (no hardcoding by route):**
   - Mobile **bottom drawer** => Desktop **right sidebar**
   - Mobile **top drawer / topbar extension** => Desktop **left sidebar**
   - This is behavior-driven by drawer orientation, not by page-specific hardcoded exceptions.
8. **Desktop rule:** do not render expanding topbar drawer panels on desktop; translate them into sidebars per mapping above.

## Content density + type quality

- Prefer short headings and one-sentence support copy.
- Add vertical rhythm between title, support text, and actions; avoid cramped text blocks.
- Use only Kylrix font tokens for product UI: `--font-satoshi`, `--font-clash`, `--font-mono`.
- Reduce aggressive negative tracking in large hero text when readability drops.

## Polishing checklist

- [ ] No gradients
- [ ] No translucent backgrounds on interactive / panel chrome
- [ ] Solid hex borders for separation
- [ ] Fonts use `--font-satoshi` / `--font-clash` / `--font-mono`
- [ ] Bottom sheet surface matches unified bottom bar treatment
- [ ] Copy is concise and not crammed
- [ ] No technical jargon (E2EE, entropy, node, etc.); use plain English
- [ ] Only approved font tokens are used

## Reference implementation

- `kylrix/components/overlays/AgenticDrawer.tsx` — minimal copy, solid controls, opaque palette.
