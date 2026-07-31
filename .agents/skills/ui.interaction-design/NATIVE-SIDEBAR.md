# Native Sidebar Migration

All former detail popovers, bottom drawers, and right overlays mount through one host:

- `NativeSidebarProvider` (`context/RightRailContext.tsx`) — single push rail, instant content swap
- `NativeSidebarBridge` — bridges Overlay, DynamicSidebar, UnifiedDrawer, Agentic, Wallet
- Memory: `f_sidebar_memory_{userId}` (LocalEngine) + `settings.sidebarMemory` (cross-device)
- Agentic is **sticky** — survives route changes until explicit dismiss
- Opening a right rail contracts the primary left nav without overwriting the user’s collapse preference

Still floating (auth only): login drawer.

Topbar search / profile / notifications Drawers in `ConnectTopbar` are next to fold into the same host via `TopbarPanelContext`.
