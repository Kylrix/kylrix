---
name: ui.drawer-sidebar-desktop-translation
description: Direct layout translation of mobile drawers into unified desktop sidebars. Outlines rules for anchor placement, dimensions, stacking behavior, and responsive CSS structure to ensure perfect visual balance on both mobile and desktop screen sizes.
disable-model-invocation: true
---

# Drawer to Sidebar Desktop Translation

## 🏗️ Architectural Layout Mandates

### 1. Orientation & Anchor Mapping
Bottom and top drawers must translate dynamically to sidebars on desktop to respect the screen aspect ratio and optimize visual ergonomics.

* **Mobile Bottom Drawer** maps directly to a **Right Sidebar** on desktop.
  * Mobile: `anchor="bottom"`, width `100%`, height capped at `max 60vh` (`60dvh`).
  * Desktop: `anchor="right"`, height `100dvh` (tall as screen), width `30%` (normal baseline) to `40%` (for high density configurations).
* **Mobile Top Drawer** maps directly to a **Left Sidebar** on desktop.
  * Mobile: `anchor="top"`, width `100%`, height capped at `max 60vh` (`60dvh`).
  * Desktop: `anchor="left"`, height `100dvh` (tall as screen), width `30%` (normal baseline) to `40%` (for high density configurations).

---

### 2. Dimension Standards
* **Drawers (Mobile / Bottom & Top)**:
  * **Width:** `100%` (full screen).
  * **Height:** Around **60% high** (`max-height: 60vh / 60dvh`) to allow users to maintain background context.
* **Sidebars (Desktop / Left & Right)**:
  * **Height:** **100% tall** (`height: 100vh / 100dvh`) spanning from the top of the viewport to the bottom.
  * **Width:** **30% wide** (standard baseline, e.g., 400px - 480px) to **40% wide** (for dashboards, complex inputs, or logs).

---

### 3. Stacked Multi-Step Sidebars
Just as mobile layouts can overlay multiple drawers sequentially (e.g. stacking a Masterpass authentication sheet on top of a repository settings sheet), **desktop layouts must support stacked sidebars**.
* Stacked sidebars overlay sequentially on the same side.
* Ensure z-indexes and backdrops are clean (`keepMounted: false` and `disablePortal: true`) so that unmounting physically cleans up closed steps in the stacked stack.

---

### 4. Implementation Example (OpenBricks / Tailwind)
Always use responsive media hooks or media queries to compute the `anchor` and drawer panel styles dynamically.

```tsx
import { useMediaQuery, useTheme } from '@/lib/openbricks/primitives';

const theme = useTheme();
const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

// Compute responsive anchor:
const anchor = isDesktop ? 'right' : 'bottom';

// Compute responsive PaperProps styles:
const paperSx = {
  bgcolor: '#161412',
  border: 'none',
  boxSizing: 'border-box' as const,
  ...(isDesktop ? {
    height: '100vh',
    width: '35%',
    maxWidth: '480px',
    borderTopLeftRadius: '26px',
    borderBottomLeftRadius: '26px',
    borderLeft: '1px solid rgba(255,255,255,0.08)',
  } : {
    maxHeight: '90vh',
    width: '100%',
    borderTopLeftRadius: '26px',
    borderTopRightRadius: '26px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
  })
};
```

---

### 5. Detail Screen Section Hijack Pattern (STRICT)

To heavily de-incentivize navigation and foster a snappy, immersive, application-like feel across the suite, all object details (notes, moments/posts, tasks/goals, events, forms, E2E secrets, tags, E2E chats, calls) must intercept direct page routing and traditional sliding sidebars.

#### Core Behaviors:
1. **Mobile Layout**: Object details are rendered inside a **100% full-screen bottom drawer (`anchor="bottom"`, height `100dvh`)**. This is the **ONLY exception** to the traditional 60% max-height drawer rule. When closed, it physically unmounts from the DOM (`keepMounted: false`, `disablePortal: true`) to mathematically prevent interaction blocking. Host: `Overlay` / mobile `DynamicSidebarPanel`.
2. **Desktop Layout**: Object details open in the **native right sidebar** (`NativeSidebarBridge` → push rail). Never fullscreen. Never Overlay flapover on desktop.
3. **Canonical rule**: see `ui.chrome-surfaces` — mobile users top and bottom drawers for everything, desktop uses right sidebars for everything.
4. **Explicit Back Navigation**: Both mobile drawers and desktop right rails must display a prominent, simple, and clean `[Back]` button at the top. Clicking this button clears the surface.
5. **Link Sharing Fail-Safe**: Standalone dynamic page routes (e.g., `/post/[id]`, `/note/[id]`, etc.) must remain fully functional for external public link shares, falling back to the standard page layout when loaded directly.

#### Implementation with SectionContext:
Always utilize `activeDetail` inside the global `SectionContext` to manage details hijacking and trigger this pattern seamlessly from list cards or clicks:
```tsx
const { setActiveDetail } = useSection();
setActiveDetail({ type: 'note', id: note.$id, data: note });
```
