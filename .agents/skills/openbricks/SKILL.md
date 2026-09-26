---
name: openbricks
description: Canonical OpenBricks design system for Kylrix UI. Use for visual work, layouts, colors, surfaces, typography, drawers, sidebars, and interaction safety.
---

# OpenBricks Design System (Canonical)

The single source of truth for all Kylrix UI design, styling, and interactivity patterns.

## 1. Surfaces, Chrome & Color Stack
- **Opaque Surfaces Only**: No gradients, frosted glass, or translucent backdrop blurs on product chrome.
- **Color Stack**:
  - **Panel / Container Background**: \`#161412\` (Canonical deep ash background for shells, pages, drawers, sidebars)
  - **Primary Components / Cards / Wells**: \`#000000\` (Pitch black for cards, input wells, interactive items)
  - **Component Border**: \`rgba(255, 255, 255, 0.18)\` to \`0.25\` (Crisp, solid high-contrast outlines)
  - **Text Color (STRICT)**: \`#FFFFFF\` (\`text-white\` only). Never use muted/gray text opacity (\`text-white/50\`). Differentiate hierarchy by font-size, weight (500 vs 800), and uppercase tracking.
- **Core Accent Hues**:
  - Indigo (Core/Primary): \`#6366F1\`
  - Amber (Social/Moments): \`#F59E0B\`
  - Purple (Flow/Automation): \`#A855F7\`
  - Emerald (Vault/Security): \`#10B981\`
  - Rose (Danger/Destructive): \`#EF4444\`

## 2. Typography & Copy Standards
- **Font Stack**: Headers use \`font-clash\`, body and settings use \`font-satoshi\`.
- **Layman-First Copy**: Prohibit technical buzzwords (E2EE, Entropy, Node, Nexus, Decentralized, Agentic) in user copy. Use clear plain terms: Secure, Private, System, Smart.

## 3. Responsive Chrome: Mobile Drawers vs Desktop Right Sidebars
- **Mobile**: Top/bottom sheets and drawers for actions. Object details use full-screen (\`100dvh\`) drawers.
- **Desktop**: Native **right sidebar** for details, actions, and secondary workflows. Never full-screen modals for details on desktop.
- **Global Unmount Policy**: Always conditionally render overlays (\`{isOpen && <Drawer />}\`). Set \`keepMounted: false\` and \`disablePortal: true\` on drawers to avoid stacking context traps and DOM click-blocking.

## 4. Plan Upgrade Patterns (Anti-SaaS)
- **Never Hide Features**: Show available Pro capabilities to free tier users.
- **On Attempt**: Trigger the upgrade drawer gracefully when clicking/toggling a Pro feature, rather than removing or disabling the button.

## 5. Layout & Glitch Prevention
- **Fluid layouts**: Use flexible grid/flex containers that adapt seamlessly without rigid fixed-width columns.
- **Skeleton loading**: Minimal, non-jarring skeletons to prevent layout shift.
- **Glitch prevention**: Avoid infinite subscription re-trigger loops or GPU composite thrashing.
