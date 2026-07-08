# /idea/[id] Overhaul — Implementation Plan

> **Last updated**: 2026-07-08T15:48:35Z  
> **Assigned agent**: Pick up from this file if tokens expired mid-task.

---

## Context

The `/idea/[id]` page (rendered by `app/(app)/idea/[id]/[[...key]]/page.tsx`) currently uses `SharedNoteClient.tsx` — a monolithic, messy custom UI that duplicates logic already in `NoteDetailSidebar.tsx`. The goal is to overhaul this by reusing `NoteDetailSidebar` as the note detail component, but with smart permission-aware gating.

---

## Architecture Decision

| Role | Access Level | What they see |
|---|---|---|
| **Owner** | Full | `NoteDetailSidebar` with full write, delete, share controls |
| **Write Collaborator** | Write | `NoteDetailSidebar` with `readOnly=false`, but no delete/share-toggle |
| **Read Collaborator** | Read-only | `NoteDetailSidebar` with `readOnly=true` (preview only, no Write tab) |
| **Guest** (requires `note.isGuest === true`) | Read-only | `NoteDetailSidebar` with `readOnly=true` |
| **Public** (requires `note.isPublic === true`) | Read-only | `NoteDetailSidebar` with `readOnly=true` |
| **No Access** | None | Beautiful "No Access" screen |

**Permission resolution order** (server-authoritative via server action, not gameable client-side):
1. Call `getPublicNoteDataSecure(noteId)` from `@/lib/actions/secure-ops`
2. If result is null → **No Access** or **Not Found**
3. Check if note is `isPublic` or `isGuest` to determine public/guest access
4. Check `user.$id === resolveResourceOwnerId(note)` → owner
5. Parse `note.collaborators` array for `{ userId, permission: 'write' | 'read' }` entries → collaborator write/read
6. Fallback to `isNoteEditableByAnyone(note)` for legacy editableByAnyone notes

---

## Files to Modify / Create

### Step 1 — Extend `NoteDetailSidebar` props [ ]
**File**: `components/ui/NoteDetailSidebar.tsx`

Add `readOnly?: boolean` and `accessRole?: 'owner' | 'write-collab' | 'read-collab' | 'guest' | 'public'` to `NoteDetailSidebarProps`.

Gate the following behind `!readOnly`:
- Title `<input>` (show `<span>` read-only instead when readOnly)
- Write/Preview tab switcher (force to `preview` mode, hide `Write` button)
- Voice recorder buttons (both header and content area)
- ShareLockButton (hide)
- Action Hub button (hide)
- Rotate link confirm (hide)
- Delete button (hide entirely)
- Tag editing (hide add tags input)
- Autosave hook enable flag → pass `enabled: canEditNote && isDirty && !readOnly`

When `readOnly=true`:
- Force `contentMode` to `'preview'` on mount (useEffect)
- Show a subtle "Read-only" badge near the header

### Step 2 — Create `IdeaPageClient.tsx` [ ]
**File**: `app/(app)/idea/[id]/IdeaPageClient.tsx`

```typescript
'use client';
// Resolves permissions and renders appropriate view.
// Props: noteId: string, decryptionKey?: string
```

**Logic:**
1. `useAuth()` → get `user`, `isAuthenticated`, `isLoading`
2. On mount: call `getPublicNoteDataSecure(noteId)` → fetch `note`
3. Decrypt if needed (reuse decryption logic from SharedNoteClient)
4. Resolve `accessRole`:
   - `owner` if `user.$id === resolveResourceOwnerId(note)`
   - `write-collab` if collaborator entry has `permission: 'write'`
   - `read-collab` if collaborator entry has `permission: 'read'`
   - `guest` if `note.isGuest === true` and user is authenticated but not owner/collab
   - `public` if `note.isPublic === true` and user is not authenticated or not owner/collab
   - `none` → no access screen
5. Handle realtime subscription (reuse from SharedNoteClient)
6. Handle encryption / ghost note decryption
7. Render:
   - Loading skeleton
   - No-access screen (beautiful)
   - `NoteDetailSidebar` with `layout="page"` and `readOnly` flag set appropriately
   - For `owner` / `write-collab`: `readOnly=false`, full controls
   - For `read-collab` / `guest` / `public`: `readOnly=true`, preview-only

**No Access Screen:**
- Dark, premium design (`bg-[#0A0908]`)
- Large lock icon with glow
- Title: "This note is private"
- Subtitle: contextual based on auth state ("Sign in to check access" / "You don't have access to this note")
- CTA buttons: Back, Sign In (if not authed)

### Step 3 — Update `SharedNoteClient.tsx` to delegate [ ]
**File**: `app/(app)/idea/[id]/SharedNoteClient.tsx`

Replace the entire rendering logic with:
```tsx
import IdeaPageClient from '../IdeaPageClient';
export default function SharedNoteClient({ noteId, initialKey }) {
  return <IdeaPageClient noteId={noteId} decryptionKey={initialKey} />;
}
```
The heavy logic moves to `IdeaPageClient.tsx`.

### Step 4 — Wire `layout="page"` in `NoteDetailSidebar` [ ]
**File**: `components/ui/NoteDetailSidebar.tsx`

The `layout="page"` prop already exists. Ensure that when `layout="page"` and `readOnly=true`:
- No back button goes to `/app` (the private notes area)
- Back button goes to `router.back()` or `/` for unauthenticated users
- The container fills the full page correctly with `min-h-screen`

### Step 5 — Remove old SharedNoteClient heavy rendering [ ]
Once `IdeaPageClient.tsx` is working, the old body of `SharedNoteClient.tsx` is replaced.

---

## Implementation Order

```
[ ] 1. Extend NoteDetailSidebar props + gate controls behind readOnly
[ ] 2. Create IdeaPageClient.tsx with permission resolution
[ ] 3. Update SharedNoteClient.tsx to delegate to IdeaPageClient
[ ] 4. Run `pnpm lint` to verify no type errors
[ ] 5. Manual test: owner, collab, guest, public, no-access
[ ] 6. git commit + push
```

---

## Key Files Reference

| File | Purpose |
|---|---|
| `components/ui/NoteDetailSidebar.tsx` | The note detail component (1747 lines) |
| `app/(app)/idea/[id]/SharedNoteClient.tsx` | Current messy shared note page (1354 lines) |
| `app/(app)/idea/[id]/[[...key]]/page.tsx` | Route page — calls SharedNoteClient |
| `app/(app)/idea/[id]/IdeaPageClient.tsx` | **NEW** — smart permission resolver |
| `lib/appwrite/index.ts` | `isNoteEditableByAnyone`, `getPublicNoteDataSecure` |
| `lib/utils/resource-ids.ts` | `resolveResourceOwnerId` |
| `lib/actions/secure-ops.ts` | `getPublicNoteDataSecure` server action |

---

## Progress Log

- [x] Plan written
- [x] Step 1: NoteDetailSidebar readOnly prop (+ accessRole) — DONE
- [x] Step 2: IdeaPageClient.tsx created — DONE
- [x] Step 3: SharedNoteClient.tsx delegated — DONE
- [x] Step 4: pnpm lint passed — DONE (clean, 0 warnings)
- [x] Step 5: committed + pushed — DONE (f1e2cc5a)
