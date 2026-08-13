---
name: fix.conversation-actions-drawer-top-layer
description: System rule and post-mortem for conversation action drawers, context menus, and mobile bottom sheet z-index layering in Kylrix.
---

# Fix Post-Mortem & Rule: Conversation Actions Drawer & Top-Layer Z-Index

## Post-Mortem: What Went Wrong & What Was Fixed

### What Went Wrong
1. **Z-Index Layering Deficit**: `ConversationActionsSheet` and `chatSettingsConv` bottom drawers were initially set to `z-index: 1305` / `z-[1401]`. In the Kylrix chrome hierarchy, navigation bars and global shell overlays range between `z-[1400]` and `z-[10000]`. As a result, the bottom navigation bar rendered above the conversation actions drawer, covering and blocking the lower portion of its options.
2. **Component Target Misalignment**: Previous attempts modified `ConversationActionsSheet` when the mobile long-press/right-click trigger in `ChatList` actually rendered a inline `ChatSettingsPanel` drawer (`chatSettingsConv`).

### What Was Fixed
1. **Absolute Top-Layer Z-Index (`z-[9999999]`)**: Updated both `ConversationActionsSheet` (`ModalProps` & `PaperProps`) and `chatSettingsConv` overlay backdrop to `z-[9999999]` (the exact top-layer level used by `SudoModal`). This guarantees the drawer sits unconditionally above all bottom navbars and layout chrome.
2. **Locked 60% Viewport Height (`60dvh`)**: Enforced `height: 60vh` / `h-[60dvh]` and `maxHeight: 60vh` with standard OpenBricks rounded top borders (`rounded-t-[24px]`).

---

## Architectural Rules for Drawer Layering

1. **Top-Level Confirmation & Action Sheets**: Any context-menu, action sheet, or modal that must appear over all navigation chrome (including mobile bottom bars) MUST use `z-[9999999]` / `zIndex: 9999999`.
2. **60% Bottom Drawer Standard**: Non-fullscreen bottom drawers must explicitly specify `60vh` / `60dvh` height and max-height constraints.
