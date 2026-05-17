---
name: kylrix-interaction-design
description: Expert architectural patterns for maintaining UI responsiveness and preventing 'click-blocking' in complex mono-apps. Use when refactoring layouts, adding global chrome, or debloating redundant stacking contexts.
---

# Kylrix Interaction Design

This skill provides the permanent architectural resolution for the 'Non-Responsive UI' problem common in unified mono-applications.

## The Problem: Layout-Driven Deadlocks
When multiple standalone applications are merged into one, they often bring conflicting 'Shell' and 'Layout' wrappers. Each wrapper establishes its own **Stacking Context**. When these contexts are centralized into a `GlobalShell`:
1.  **Ghost Backdrops**: Closed-but-mounted Drawers/Modals leave invisible viewport-wide layers in the DOM.
2.  **Microtask Saturation**: DOM-polling mechanisms (like `MutationObserver`) scan the entire tree on every mutation, dropping user clicks.
3.  **Context Storms**: Non-memoized high-frequency contexts (like Task state) trigger global re-renders that lock the main thread.

## The Solution: Architectural Unification

### 1. The Global Unmount Policy
NEVER use visibility props (`open={false}`) to hide global chrome. You MUST physically delete the component from the React tree.
```tsx
// If it's not open, it does not exist.
{isOpen && <GlobalDrawer />}
```

### 2. Flattening the Layout Stream
Mathematical safety is achieved by ensuring a single, flat DOM hierarchy for all application content.
- **Delete All Sub-Shells**: Sub-app layouts (e.g., `MainLayout`, `VaultGuard`) must be purged.
- **Direct Rendering**: Every page must render its 'naked' content directly into the `GlobalShell`.
- **Hoisted Routing**: All `pathname`-derived flags must be calculated at the very top of the shell to prevent Temporal Dead Zone errors during hydration.

### 3. Pointer-Event Determinism
Fixed-position containers must be 'Pointer-Transparent' unless specifically interacting.
- **Root Chrome Wrapper**: `pointer-events: none;`
- **Interactive Children**: `pointer-events: auto;` (e.g., the actual Topbar buttons).

### 4. High-Privilege Adapters (Server Actions)
To prevent 'Unauthorized' errors in privileged tasks (Sharing, Minting):
- **Resilient Discovery**: Scan for all possible session cookie names (`a_session_*`, `session`).
- **Identity Pass**: Authenticate once at the Action layer using `getActor()`, then pass the verified `actorId` to Admin-SDK-powered internal services.

## Performance Mandates
- **Memoized Providers**: All high-level context values must be wrapped in `useMemo`.
- **Stable Callbacks**: Functions passed to list items (e.g., `NoteCard`) must have stable identities to prevent list-wide re-render storms.
- **Kill DOM Polling**: Zero tolerance for `MutationObserver` or `setInterval` for UI state reconciliation.
