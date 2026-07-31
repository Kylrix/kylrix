# Native Sidebar Migration

All **desktop** detail popovers, drawers, and right overlays mount through one host:

- `NativeSidebarProvider` (`context/RightRailContext.tsx`) — single push rail, instant content swap
- `NativeSidebarBridge` — bridges Overlay/DynamicSidebar **on desktop only**, plus UnifiedDrawer, Agentic, Wallet
- Memory: `f_sidebar_memory_{userId}` (LocalEngine) + `settings.sidebarMemory` (cross-device)
- Agentic is **sticky** — survives route changes until explicit dismiss
- Opening a right rail contracts the primary left nav without overwriting the user’s collapse preference

**Mobile** object details stay on `Overlay` / `DynamicSidebarPanel` (true edge-to-edge drawers covering top + bottom chrome). See `ui.chrome-surfaces`.

Still floating (auth only): login drawer.
