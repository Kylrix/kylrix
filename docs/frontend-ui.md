# Frontend Architecture, Design System & Overlay Mechanics

This document details the Next.js 15 App Router architecture, OpenBricks UI design system, color palette, navigation routing, drawer overlay suppression rules, and local-first guest fallbacks.

---

## 🎨 OpenBricks Design System & Color Palette

Kylrix features a unified tactile visual hierarchy:

- **Primary Brand Color:** `#6366F1` (Indigo accent)
- **Background Surfaces:**
  - Pitch Black: `#000000` (Primary background)
  - Deep Muted Ash: `#161412` / `#0A0908` (Card & overlay surfaces)
- **Status & Marker Colors:** Accent colors (emerald for completed goals, amber for high urgency, rose for deleted/destructive) are reserved exclusively for functional indicators.

---

## 🧭 Navigation & Unified Left Sidebar

The desktop navigation (`components/UnifiedLeftSidebar.tsx`) organizes primary workspace features into paired modules with distinct Lucide icons:

| Section | Icon | Route | Purpose |
|---|---|---|---|
| **Ideas & Forms** | `NotesIcon` / `FormsIcon` | `/app` & `/forms` | Notes compose canvas & public form builder |
| **Goals & Events** | `GoalsIcon` / `EventsIcon` | `/goals` & `/events` | Goal milestones & calendar events |
| **Vault & TOTPs** | `VaultIcon` / `TotpIcon` | `/vault` & `/vault/totp` | E2EE password manager & 2FA authenticator |
| **Settings** | `SettingsIcon` | `/settings` | Security, developer PATs, WebMCP & profile settings |

---

## 🪟 Overlay & Drawer Suppression Mechanics (`UnifiedBottomDrawer.tsx`)

Application drawers and modals are rendered globally through `UnifiedBottomDrawer.tsx` and controlled via `UnifiedDrawerContext`:

- **Desktop Overlay Suppression Rule:**
  To prevent duplicate or overlapping drawer popups on desktop screen widths (`isDesktop`), bottom drawer overlays are explicitly **suppressed** for sidebar-docked surfaces:
  - `share-context`
  - `share-note`
  - `access-control`
  - `ecosystem-send`
  - `new-chat`
  - `delete-confirm`
  - `delete-note`
  - `security-confirm`

  On desktop, these surfaces render within the `NativeSidebarBridge` panel instead of popping up as bottom sheets.

---

## 🚪 Auth Drawer & Guest Fallbacks

### Universal Auth Drawer
Kylrix **does not use a standalone `/login` route**. Authentication is invoked universally across all app surfaces via the global auth drawer (`open('login')` or `openDrawer('login')`).

### Unauthenticated Guest Fallbacks
To support zero-friction offline exploration for unauthenticated users:
- Vault credentials and TOTP secrets operate local-first and non-blocking without requiring sign-in.
- Unauthenticated writes store data in `LocalEngine` under guest keys:
  - `vault_credentials_guest`
  - `vault_totp_guest`
  - `f_totp_list_guest`
- Signing in later automatically merges guest local items into the authenticated user's encrypted Turso database space.

---

## 👤 Profile View & External Interoperability (`UnifiedProfileView.tsx`)

When viewing external user profiles (`/u/[username]`):
- **Direct Messaging:** Renders a 'Message' action button that opens `openUnifiedDrawer('new-chat', { recipientId, recipientName })` (or prompts login if unauthenticated).
- **GitHub Activity Tab:** Displays linked open-source contributions, commit frequency, and repository pull requests fetched via `getContributorStatusByUsernameAction`.
- **Normalized Profile Attributes:** Profiles extract and display avatar URL, banner URL, website, social handles, and E2E public keys from Turso SQLite `profiles` columns and metadata JSON.
