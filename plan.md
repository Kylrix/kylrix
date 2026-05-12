# Drawer Backdrop Topbar-Safe Implementation Plan

## Problem Statement

Drawer backdrops (semi-transparent overlay) across multiple app modules (connect, flow, vault, note) are covering or interfering with their respective topbars. The visual hierarchy places the backdrop above the topbar, making topbar controls inaccessible when drawers are open. The accounts topbar should remain unaffected by this change.

## Approach

1. **Create a reusable topbar-safe backdrop utility** that calculates appropriate backdrop positioning and z-index values based on app context
2. **Define consistent topbar offset patterns** for each app (connect, flow, vault, note) to account for varying topbar heights
3. **Implement via MUI's `slotProps.backdrop.sx`** in drawer components to apply the safe styling without restructuring component hierarchy
4. **Preserve existing behavior** for the accounts app's topbar and drawers (no changes needed)

## Implementation Todos

- [ ] **backdrop-utils**: Create utility function `getTopbarSafeBackdropSx()` that returns MUI sx object with:
  - `top` offset matching topbar height
  - Reduced `maxHeight` to respect topbar space
  - Transparent area above topbar (or top margin adjustment)
  - Maintain `backgroundColor` and `backdropFilter` blur effects

- [ ] **app-topology**: Map topbar heights for each app:
  - Connect: 64px (or measure from ConnectTopbar.tsx)
  - Flow: 64px (or measure from flow topbar)
  - Vault: 64px (or measure from vault topbar)
  - Note: 64px (or measure from note topbar)
  - Accounts: No change (skip)

- [ ] **update-overlays**: Apply topbar-safe styling to drawer components:
  - `/components/overlays/MasterPassDrawer.tsx` (affects vault/accounts)
  - `/components/overlays/SudoModal.tsx` (affects all apps)
  - `/components/overlays/MfaChallengeDrawer.tsx`
  - `/components/overlays/TwoFactorDrawer.tsx`
  - Other drawer components in `/components/overlays/`

- [ ] **context-aware-rendering**: Inject app context into drawers so they know which app they're in (connect/flow/vault/note/accounts) to apply correct topbar offset

- [ ] **test-visually**: Verify drawer backdrops no longer cover topbars in:
  - Connect app
  - Flow app
  - Vault app (ensure it still works)
  - Note app
  - Confirm accounts topbar unchanged

## Key Decisions

- **No DOM restructuring**: Use MUI `slotProps.backdrop.sx` to keep component tree clean
- **Fallback height**: Default 64px topbar height with explicit overrides per app
- **Accounts exemption**: Only modify non-accounts drawers; accounts module remains untouched
- **Backdrop effect preservation**: Maintain blur, color, and visual effects while adjusting positioning
