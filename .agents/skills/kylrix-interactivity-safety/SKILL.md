---
name: kylrix-interactivity-safety
description: Expert guidance for maintaining UI interactivity and preventing 'Stacking Context traps' in the Kylrix mono-app. Use when modifying global layouts, adding new drawers/modals, or debugging frozen/unclickable UI elements.
---

# Kylrix Interactivity Safety

This skill enforces the 'Global Unmount Policy' and 'Architectural Flatness' required to prevent invisible DOM elements from blocking user interactions in the Kylrix ecosystem.

## Core Problem: Stacking Context Traps

In a mono-app with centralized chrome (Topbar, Sidebars, Bottom Bar), MUI's `Drawer` and `Modal` components can leave 'Ghost Portals' in the DOM. Even if `open={false}`, these components may retain invisible backdrops or viewport-wide wrappers that intercept pointer events, rendering the page underneath 'unclickable'.

## Mandatory Safety Patterns

### 1. The Global Unmount Policy (Strict)
NEVER rely solely on a visibility prop (like `open` or `visible`) for global overlays. You MUST use conditional rendering to physically delete the component from the React tree when it is inactive.

**Prohibited Pattern:**
```tsx
<UnifiedBottomDrawer open={isOpen} /> // Backdrops may persist in DOM
```

**Mandatory Pattern:**
```tsx
{isOpen && <UnifiedBottomDrawer />} // Guaranteed DOM removal
```

### 2. Architectural Flatness
The application MUST maintain a single, predictable layout stream.
- **Single Shell:** All pages render directly into `GlobalShell`.
- **No Nested Layouts:** Do not use intermediate `AppShell`, `MainLayout`, or `VaultGuard` wrappers. These fragment the stacking context and lead to collision.
- **Hoisted Analysis:** Route flags (e.g., `isAppRoute`) must be hoisted to the top of the `GlobalShell` component to ensure initialization before any `useEffect` triggers.

### 3. Pointer-Event Determinism
Global fixed-position containers (like the Topbar wrapper) MUST use `pointer-events: none` on their root, and then explicitly enable `pointer-events: auto` only on their interactive children. This prevents 100vw 'shields' from covering the page.

### 4. Re-render Storm Prevention
Decouple high-frequency global contexts (like `UnifiedDrawerContext` or `DynamicSidebarContext`) from static list items (like `NoteCard` or `TaskItem`). 
- Use stable callback references.
- Use `useMemo` for context values.
- Never update a `useRef` directly during the render cycle; always use `useEffect` to sync refs with state.

## Debugging Workflow
If the UI is 'frozen' or 'unclickable':
1. Check for 'Ghost' drawers in the DOM using devtools or `grep` for hidden `Modal` roots.
2. Verify that `GlobalShell.tsx` is unmounting inactive components.
3. Ensure no fixed-position `Box` is missing `pointer-events: none`.
4. Hard-refresh the browser to clear HMR-induced DOM pollution.
