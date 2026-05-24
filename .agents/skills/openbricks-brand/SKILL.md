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
- **The Hairline:** `#2E2A27` (Precision solid borders)

## 2. Skeuomorphic Solidity & Tactile Physics
- **Tactile Edge Profiles:** Interactive elements feature crisp `#2E2A27` borders and **hard-offset solid dark shadow layers** instead of soft blurry shadow drop filters, mimicking physical machine-milled components.
- **Precision Specular Hairlines:** Highly saturated solid-color highlights overlaying base facets to simulate sharp edge reflections under clean directional lighting.
- **Physical Feedback:** Micro-animations (bezier transitions) mimicking structural material inertia.

## 3. Typography Refresh
- **Display / Headers:** `Outfit` (`var(--font-outfit)`) or `Clash Display` — highly opinionated, premium, rounded geometric weights.
- **Inputs & Interactive Focus:** `Space Grotesk` (`var(--font-space-grotesk)`) — high-character, brutalist geometric monoline curves that turn active typing fields into state-of-the-art interactive surfaces.
- **UI / Body:** `Satoshi` (`var(--font-satoshi)`) — highly clean, readable geometric sans.
- **Technical / Metadata:** `Mono` (`var(--font-mono)`) — premium, high-density technical monospaces (JetBrains Mono).
