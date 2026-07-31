---
name: ui.chrome-surfaces
description: >-
  Mobile vs desktop chrome for details and drawers. Use when opening object
  details, drawers, overlays, or native sidebars — mobile uses top/bottom
  drawers; desktop uses the native right sidebar.
---

# Chrome Surfaces (Mobile Drawers / Desktop Right Rails)

## Rule (verbatim)

mobile users top and bottom drawers for everything, desktop uses right sidebars for everything.

## Mapping

| Surface | Mobile | Desktop |
|---|---|---|
| Object details (notes/ideas, goals, events, forms, chats, …) | Full-screen top/bottom drawer (`100dvh`, covers top + bottom chrome) | Native **right** sidebar (push rail) — never fullscreen |
| Utility drawers (wallet, agentic, settings panels, delete confirms, …) | Top/bottom drawer | Native **right** sidebar |
| Login | May stay floating overlay (auth exception) | Same |

## Implementation hosts

- **Mobile details**: `Overlay` (flapover) and/or `DynamicSidebarPanel` when opened via `openOverlay` / mobile `openSidebar`. Mount only below `md`.
- **Desktop details / drawers**: `NativeSidebarBridge` → `NativeSidebarProvider` right rail in `GlobalShell`. Widths from `NATIVE_SIDEBAR_WIDTHS` (detail ~560).
- **Do not** set `fullscreen: true` on desktop `openSidebar` options — that was the old DynamicSidebar edge-to-edge hijack and is wrong for the native rail.

## Caller pattern

```tsx
if (isDesktop) {
  openSidebar(<Detail … embedded onClose={closeSidebar} />, id, { hideHeader: true });
} else {
  openOverlay(<Detail … embedded onClose={closeOverlay} />);
}
```

Detail components must always wire back/close to `closeSidebar()` + `closeOverlay()` (see `EventDetails`, `GoalObjectDetail`, `NoteObjectDetail`).

## Anti-patterns

- Swallowing mobile details into the native rail under the topbar (leaves top/bottom chrome visible).
- Rendering Overlay / DynamicSidebar fullscreen on desktop.
- Waiting on `account.get` / auth loading before showing local lists — see local-first rules in Notes/Task contexts.

## Related

- `.agents/skills/ui.drawer-sidebar-desktop-translation/SKILL.md` — dimension/anchor details
- `.agents/skills/ui.interaction-design/NATIVE-SIDEBAR.md` — native rail host + memory
