---
name: openbricks-brand
description: Defines the Openbricks 2.0 design framework, doubling down on the dark-mode-only psychology, premium tactile depth, and opinionated aesthetics.
disable-model-invocation: true
---

# Openbricks 2.0 Brand & Design System

## Core Philosophy: The Pitch-Dark Sanctuary

Openbricks 2.0 is a dark-mode-only system. We reject the compromise of light mode to craft a cozy, protective, premium digital sanctuary. Inspired by Discord’s warmth and Apple’s visual precision, we establish a tactile physical workspace.

## 1. The Opaque Chromatic Stack
We construct depth purely with opaque solid blocks. No translucent fills, no backdrop blur, **no glows, and no gradient fills**.
- **Level 0 (The Void):** `#000000` (Pure Black base)
- **Level 1 (The Bedrock):** `#0A0908` (Deep void panels)
- **Level 2 (The Chrome):** `#141211` (Solid primary components, cards, drawers)
- **Level 3 (The Focus):** `#1E1B19` (Hover fills, active states)
- **The Hairline:** `#23211F` (Volcanic Slate / Carbon Hairline - Canonical border token for all outlines)

## 2. Skeuomorphic Solidity & Tactile Physics
- **Tactile Edge Profiles:** Interactive elements feature crisp **`#23211F`** borders and **hard-offset solid dark shadow layers** instead of soft blurry shadow drop filters, mimicking physical machine-milled components.
- **Precision Specular Hairlines:** Highly saturated solid-color highlights overlaying base facets to simulate sharp edge reflections under clean directional lighting.
- **Physical Feedback:** Micro-animations (bezier transitions) mimicking structural material inertia.

## 3. The Canonical Hairline Rule (The Perfect Outline)

> [!IMPORTANT]
> **#23211F (Volcanic Slate / Carbon Hairline)** is the absolute single source of truth for all outlines in Openbricks 2.0. 
> This color was discovered on the experimental Back button and has been crowned as the **Perfect Outline Color** because it delivers the perfect, warm, cozy, high-contrast hairline separator against pure `#000000` black without creating the harsh glow of white or the dirty, flat look of generic greys.

### Core Outlining Mandates:
1. **Never use generic greys or harsh whites**: All other neutral outlines (e.g. `#2E2A27`, `#2E2E2E`, `#333333`, `#444444`) are strictly forbidden. You must surgically enforce `#23211F` as the border token.
2. **First-Layer Shadow Anchor**: For solid skeuomorphic offset drop-shadow stacks, the very first pixel layer must start with `#23211F` to act as a tight tactile bevel boundary.
3. **Cohesive Well Divider**: Use `#23211F` for all horizontal or vertical divider segments and card container panels to maintain clean, modular bounds.

#### Code Reference (JSX / Material UI):
```tsx
// 1. Cozy Interactive Button
<Button sx={{
  border: '2px solid #23211F',
  bgcolor: '#0B0A09',
  '&:hover': { borderColor: '#23211F', bgcolor: '#131110' }
}}>
  Interactive Control
</Button>

// 2. Tactile Shadow Stack Anchor
<Paper sx={{
  border: '2px solid #9B9691',
  boxShadow: '1px 1px 0px #23211F, 2px 2px 0px #1E1B19, 3px 3px 0px #161412, 4px 4px 0px #0A0908, 5px 5px 0px #000000'
}}>
  Obsidian Container
</Paper>
```

## 4. Typography Refresh
- **Display / Headers:** `Outfit` (`var(--font-outfit)`) or `Clash Display` — highly opinionated, premium, rounded geometric weights.
- **Inputs & Interactive Focus:** `Space Grotesk` (`var(--font-space-grotesk)`) — high-character, brutalist geometric monoline curves that turn active typing fields into state-of-the-art interactive surfaces.
- **UI / Body:** `Satoshi` (`var(--font-satoshi)`) — highly clean, readable geometric sans.
- **Technical / Metadata:** `Mono` (`var(--font-mono)`) — premium, high-density technical monospaces (JetBrains Mono).
