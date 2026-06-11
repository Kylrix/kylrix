---
name: brand.openbricks-3.0
description: Unified OpenBricks 3.0 specifications combining tactile depth, glow dynamics, micro-interactions, minimal contextual copy, and strict sectional hierarchy.
---

# OpenBricks 3.0 Design & Philosophy

OpenBricks 3.0 is a design philosophy focused on high-utility minimalism, tactile depth, dynamic feedback, and clean spatial rhythm. It merges standard OpenBricks rules with structural patterns found in Kylrix's flagship layouts.

## 1. The Core Philosophy of Minimal Context
- **Zero Template Text**: Do not write long instruction paragraphs. Users prefer quick, functional prompts. Use direct labels, self-explanatory controls, and monospaced indicators.
- **Immediate Utility (Industrial UI)**: If a component's job is to execute a setting or establish a link (e.g., Telegram Link, Connect Calls), omit onboarding bloat. Move actions to the forefront.

## 2. Tactility, Depth & Shadows (Gold Standard)
Inspired by the live call interface (`/connect/call/[id]`):
- **Dynamic Glows**: Make interactive elements react to real-time events. For example, active states should trigger scaled shadows:
  ```css
  box-shadow: 0 0 16px rgba(245, 158, 11, 0.4);
  ```
- **Scale Transforms**: Active controls or hovered targets must translate or scale slightly to denote physics (e.g., `hover:translate-y-[-1px]` or `scale-[1.03]`).
- **Layered Shadows**: Containers must utilize deep, offset shadows to lift elements above the dark background:
  ```css
  box-shadow: 0 -12px 36px rgba(0, 0, 0, 0.5), 0 16px 48px rgba(0, 0, 0, 0.7);
  ```

## 3. Sectional Layouts (Settings & Forms)
Inspired by the Passkeys setting section:
- **Nested Card Surface Hierarchy**:
  - Main Panel: Surface background `#161412` with a `border border-white/5` or `border-[#34322F]`.
  - Subsection cards: Pure dark background `#0B0A09` with a subtle inner border (`border-white/5`).
  - Inputs & Code blocks: Neutral base `#161412` matching the outer panel, creating a recessed visual effect.
- **Section Dividers**: Keep dividers minimal (`h-px bg-white/5`), separating distinct options cleanly.

## 4. Customizing Structural boilerplate
Avoid generic Tailwind/SaaS templates (as seen in legacy `/flow` structures) by enforcing:
1. **Low-contrast Borders**: Never use flat white or bright gray borders. Use `border-white/5` or `border-[#34322F]`.
2. **Top Spotlight Ambient Gradients**: Layer subtle radial gradients matching the page context (e.g., Amber `rgba(245,158,11,0.08)` for Connect, Indigo `rgba(99,102,241,0.08)` for core Kylrix).
3. **Typography Rhythm**: Use `font-clash` strictly for core headers and `font-satoshi` for settings/descriptions.
