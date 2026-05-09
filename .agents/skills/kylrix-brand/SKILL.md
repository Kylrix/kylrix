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
5. Product positioning copy should emphasize: E2EE workspace, autonomous agents, and effortless execution.
6. Prefer chain-agnostic "agentic wallet infrastructure" language over chain-specific branding in product marketing surfaces.
7. **Opaque UI:** No gradient fills and no translucent (`rgba` / `alpha` / opacity) **backgrounds** on product chrome—see `design.md` and `kylrix-muted-v3-design`.
