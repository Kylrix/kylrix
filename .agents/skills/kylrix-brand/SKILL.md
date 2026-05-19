---
name: kylrix-brand
description: Applies Kylrix brand language (logo, palette, typography, surface hierarchy) while preserving readability and UX clarity. Use for top-level UI visual decisions. For Muted V3 tokens, drawers, typography variables, and prohibited patterns in the Next.js app, use kylrix-muted-v3-design.
disable-model-invocation: true
---

# Kylrix Brand

## Source of truth

- `logo.md`
- `design.md`
- `DESIGN.V2.md`
- `brand.design.md`
- `components/common/Logo.tsx`
- **Implementation / MUI / Next.js:** `.agents/skills/kylrix-muted-v3-design/SKILL.md`

## Rules

1. Preserve canonical logo geometry and app-color mapping.
2. Use muted dark surfaces with deliberate contrast.
3. Keep visuals clean; avoid effect-heavy overlays that hurt usability.
4. Prioritize legibility and interaction clarity over decorative styling.
5. Product positioning copy must use simple, direct language: focus on "Private workspace," "Smart assistants," and "Easy execution."
6. Prohibit technical jargon (e.g., E2EE, agentic, infrastructure, entropy, decentralized node). Use layman-friendly equivalents (e.g., Private, Smart, System, Secure).
7. **Opaque UI:** No gradient fills and no translucent (`rgba` / `alpha` / opacity) **backgrounds** on product chrome—see `design.md` and `kylrix-muted-v3-design`.
8. **Do not cram copy:** Keep hero and drawer copy short. Prefer one clear sentence per block and clear whitespace between text groups.
9. **Authorized fonts only:** Use `var(--font-satoshi)`, `var(--font-clash)`, and `var(--font-mono)`; never introduce ad-hoc or default fallback-only typography for primary UI.
10. **Drawer-to-sidebar responsiveness:** Topbar drawers become sidebars on desktop (top drawer -> left sidebar, bottom drawer -> right sidebar). Avoid desktop topbar extension panels.
11. **Dark Ash Baseline:** Use `#161412` (Dark Ash / Deep Ash) as the default background for all primary surfaces and components (cards, drawers, bottom bars) sitting on the pitch-black (`#0A0908`) shell.
