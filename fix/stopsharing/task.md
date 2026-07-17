# Fix: Stop Sharing Icon State Propagation

## Problem
Stopping share (entirely or guests-only) from `AccessControlDrawer` saved on the server, but the parent share icon stayed fully colored. Share-from-menu worked because it already pushed `{ isPublic, isGuest }` into parent state; stop/toggle did not.

## Root Cause
`AccessControlDrawer` typed and called `onUpdate` as `() => void` (no payload).

Callers (`useAccessControlMenuItems` → NoteCard / CredentialItem / etc.) only merge live icon state when they receive:

```ts
onUpdate?: (updatedFields?: { isPublic: boolean; isGuest: boolean }) => void
```

Empty `onUpdate?.()` left parent `isPublic` / `isGuest` stale, so `ShareLockButton` color mapping never re-ran:

| State | Icon |
|---|---|
| neither | uncolored |
| public only | half color |
| public + guest | full accent |

## Fix (surgical)
File: `components/overlays/AccessControlDrawer.tsx`

1. Align callback type with the menu path:
   - `onUpdate?: (updatedFields?: { isPublic: boolean; isGuest: boolean }) => void`

2. After successful public toggle, pass the next flags:
   - enable → `{ isPublic: true, isGuest: localIsGuest }`
   - disable (stop entirely) → `{ isPublic: false, isGuest: false }`

3. After successful guest toggle, pass:
   - `{ isPublic: localIsPublic, isGuest: enable }`
   - guest-off leaves public on → parent gets half-color

No changes to `ShareLockButton` coloring, `UnifiedBottomDrawer` wiring, or menu publish path.

## Outcome
- Stop entirely → icon clears immediately.
- Stop guests only → icon goes half-colored immediately.
- Server write path unchanged; only client state propagation fixed.
