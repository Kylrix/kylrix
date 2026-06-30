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

## 5. Layout and Input Modals (Note Detail & settings standard)
- **Outer Panel Surface**: For root/primary components (drawers, panels, details), always use our signature muted ash background (`#161412`). Never stack pure black elements directly on black layout backgrounds (black-on-black is forbidden).
- **Drawer / Select Panels**: Do not use standard inline Select dropdowns or menus which bloat the viewport. Handle choice configurations or type assignments inside dedicated bottom drawer selectors.
- **Scroll Constraints (Viewport Boundaries)**: For fullscreen layouts, set strict scroll heights (e.g., `maxHeight: 'calc(100vh - 180px)'`) on scrollable wrappers to guarantee footer buttons are always visible, fully balanced, and never cut off by viewport edges. Horizontal page overflows (forcing side-to-side scrolling) are strictly prohibited.
- **Action Button Placement (Anti-Overflow)**: Place cancel, delete, or dismiss buttons for row-level inputs (e.g. lists of options, dynamic fields) to the *left* of the input field. Placing them on the far right pushes elements off the screen bounds on smaller viewports and creates layout breakage.
- **Padding Integrity**: Ensure all text inputs, descriptions, and indicators maintain a minimum of `12px` (or `pl-3`/`pr-3`) padding from parent card edges to block clipping.
- **Bottom Drawer Context Menus**: We have moved entirely to bottom drawers for all context options and right-click actions (e.g., clicking or long-pressing note cards). Traditional desktop-style right-click context menus are deprecated and must be replaced with a bottom drawer selector containing the contextual options.
- **FAB and Action Triggers**: Floating Action Buttons (FABs) must carry out their default action instantly without showing staggered menus or blur overlays. If multiple options are required, they must be displayed in a clean bottom drawer instead of showing staggered menu listings.
