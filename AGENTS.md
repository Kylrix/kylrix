# KylrixOrganization - Organizaion Local Agent Guide

## 🏗️ Architectural Mandates

### 🚫 IMMUTABLE FILES (STRICT)
- **No internal APIs**: DO NOT introduce new HTTP API routes/endpoints (`app/api/*`, `route.ts`) for in-app flows. This Организация Организации keeps zero extra attack surface and no unnecessary latency.
- **Prefer Internal Methods**: Use existing in-process functions, Server Actions, and SDK helpers instead of exposing new API surfaces.
- **Data Consolidation**: When returning shaped payloads to hydrate multiple UI widgets, use Server Actions or consolidated internal service methods.

### ⚡ Development Standards
- **Canonical App**: Only implement against **`kylrix/`**. Legacy trees at repo root are for reference only.
- **No Tailwind**: Use Material UI (MUI) and Vanilla CSS.
- **Opaque Surfaces**: No gradients or translucent backgrounds on product chrome.
- **PNPM Only**: Always use `pnpm` for package management. NEVER use `npm` or `yarn`.
- **Global Unmount Policy**: Strictly use conditional rendering (`{isOpen && <Component />}`) for all overlays (drawers, modals, sidebars) instead of relying on visibility props. This physically removes the component and its invisible backdrops from the DOM when closed, mathematically preventing interaction blocking.
- **Interactivity Standards**: Use `keepMounted: false` and `disablePortal: true` for all MUI drawers/modals to ensure they stay contained and cleanup correctly.
- **Surgical Execution**: For 'surgical fixes', prioritize direct, high-precision code modifications. Skip build/lint/test cycles unless explicitly instructed to validate. Aim for maximum velocity in resolving identified issues.
