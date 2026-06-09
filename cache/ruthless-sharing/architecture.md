# Architecture — Ruthless Sharing

## 1. Product thesis

**Sharing should feel like flipping a switch, not filing paperwork.**

Google-style sharing fails because it separates *intent* ("share this") from *mechanism* (permission levels, domain restrictions, link types). The recipient discovers failure **after** the owner already believed they shared.

Kylrix uses two columns as **server-side escape hatches** (not bloated row ACLs):

- **`isPublic`** — authenticated ecosystem users may read via `secure-ops` admin path.
- **`isGuest`** — **anyone** (no session) may read via `secure-ops` admin path.

**Ruthless rule for one-tap share:** toggling public from the card sets **both** `isPublic: true` and `isGuest: true` by default. The link works for strangers immediately. Owners who want login-only public links use **Access Control → Disable guest access** (sets `isGuest: false`, keeps `isPublic: true`).

### Why both flags on first publish?

| Flag combo | Recipient experience |
|------------|---------------------|
| `isGuest: true` | Opens link in incognito — works. This is what link senders expect. |
| `isPublic: true` only | Recipient must sign in — surprise failure for "I sent you a link." |
| Both true | Works everywhere; owner can tighten later. |

### Why read-only only for public/guest?

Realtime collaborative editing on anonymous sessions requires:

- Presence channels
- Conflict resolution
- Permission revalidation on every keystroke

We already grant **write** through discrete `collaborators` rows resolved in `verifyResourcePermissionSecure`. Keeping public/guest strictly **read** avoids building a second permission system and prevents "guest edited my row" incidents.

---

## 2. Card chrome contract (`ShareLockButton` + `PinButton`)

Every list/card row across Notes, Vault, Flow (goals/forms/events), Projects, Connect gets **exactly two** inline icon actions (right side):

```
[ Pin ]  [ Lock | Link ]
```

### Pin button

- Behavior: unchanged from global per-user pin program (`user_resource_pins` + owner `isPinned`).
- Icon: Pin, filled when pinned.

### Lock / Link button (new unified widget)

| State | Icon | Color | Click behavior |
|-------|------|-------|----------------|
| Private | `Lock` (dull) | `text-white/20` | Publish: `isPublic=true`, `isGuest=true`, transform icon, **copy public URL**, toast "Link copied — anyone with the link can view" |
| Public | `Link` (bright) | accent per app | **Copy public URL only** — no toggle off |
| Publishing | spinner | — | Disable double-tap |

**Why no unpublish on card?** Accidental unpublish breaks links people already received. Unpublish lives in Access Control with confirm.

**Why remove three-dot on card?** Same actions move to context menu (right-click / long-press). Card stays scannable.

### Context menu additions (when `isPublic || isGuest`)

```
Access Control
  ├─ Copy link
  ├─ Disable guest access (isGuest → false)     [only if isGuest]
  ├─ Enable guest access (isGuest → true)       [only if !isGuest && isPublic]
  └─ Make private (isPublic → false, isGuest → false)  [confirm]
```

When private, **no** Access Control submenu — only standard items (edit, delete, tags, etc.).

---

## 3. Server action: `toggleResourcePublicGuestSecure`

**Location (planned):** `lib/actions/secure-ops.ts`

```typescript
// Pseudocode — not implemented yet
toggleResourcePublicGuestSecure({
  resourceType: 'note' | 'credential' | 'totp' | 'task' | 'form' | 'event' | 'project' | 'huddle' | ...,
  resourceId: string,
  mode: 'publish' | 'copy_only' | 'make_private' | 'guest_off' | 'guest_on',
  jwt?: string,
})
```

### `publish` mode

1. Verify actor is owner (or admin collaborator where applicable).
2. Set `isPublic: true`, `isGuest: true`, `updatedAt`.
3. **Do not** add `Role.any()` to row permissions if project standard is column-only (notes currently add `Role.any()` in `toggleNoteVisibility` — **decision:** migrate notes to column-only for consistency; see migration.todo.md).
4. Return `{ publicUrl: string }` using canonical URL builder.

### `make_private` mode

1. Owner-only.
2. Set `isPublic: false`, `isGuest: false`.
3. Strip any legacy `Role.any()` permissions if present.
4. Invalidate caches (DataNexus keys per resource).

### Resource-specific hooks

Some resources need side effects on publish:

| Resource | Side effect on publish |
|----------|------------------------|
| Note (T4 encrypted) | Refuse OR decrypt-to-plaintext (current behavior) — product must choose |
| Credential / TOTP | Refuse publish if vault-encrypted fields cannot be sanitized for guest read |
| Form | Published forms already have `status: published` — align `isGuest` with public form URL |
| Project | May need `visibility: 'public'` sync |

---

## 4. Public URL builder (revised — no mass internal route change)

**Location (planned):** `lib/share/public-url.ts`

```typescript
resolveShareBaseUrl(): string
buildPublicResourcePath(resourceType, resourceId, options?): string
buildPublicResourceUrl(resourceType, resourceId, options?, baseUrl?): string
```

**Base URL policy (no env vars for clipboard copy):**

| Context | Base |
|---------|------|
| **Browser** (Lock button, Access Control copy) | `window.location.origin` — whatever host the user is on (localhost, preview, prod) |
| **Server-only** (email, Telegram, background jobs) | `https://www.kylrix.space` canonical fallback |

Client components **always** build the copied link locally via `buildPublicResourceUrl()` so the clipboard matches the tab the user is in. Server actions may still return `publicUrl` for logging, but UI must not paste a server-built origin into the clipboard.

### Public URL law

> Take the resource’s **app-scoped path**, **drop trailing `s`** on the resource noun if present, append **`/[id]`**. That URL is what Lock copies.

On request:

- If `isGuest` or (`isPublic` + authenticated) → render **standard detail component** (read-only).
- Else → **Access unavailable** page (clear copy, not a permission maze).

### Examples (internal flagship vs public guest)

| Resource | Internal flagship / list (revised) | Other internal (unchanged) | Public guest |
|----------|-----------------------------------|----------------------------|--------------|
| Note | **`/note`** (was `/note/notes`) | `/note/shared`, `/note/tags`, detail routes as today | **`/note/[id]`** |
| Vault secret | **`/vault`** (was `/vault/dashboard`) | `/vault/totp`, `/vault/sharing` | **`/vault/[id]`** |
| Goal | **`/flow`** (was `/flow/goals`) | `/flow/forms`, `/flow/events` | **`/flow/goal/[id]`** (OD-R1) |
| Form | — | `/flow/forms/[id]` | **`/flow/form/[id]`** |
| Event | — | `/flow/events/[id]` | **`/flow/event/[id]`** |
| Project | `/projects/[id]` (standalone) | — | **`/project/[id]`** |
| Project child | `/projects/[id]` | — | `/projects/[id]/[kind]/[entityId]` |
| Huddle | — | `/connect/calls`, `/connect/chat/[id]` | **`/connect/call/[id]`** |
| Send | `/send` | — | `/send/[id]` (unchanged) |

**Why not collapse `/note/shared`?** Sub-app secondary routes keep their prefix; only empty middle flagship segments move up.

**Why `/connect` unchanged?** It already serves the flagship feed at the app root — the template for `/note`, `/vault`, `/flow`.

---

## 5. UI component plan

### `components/share/ShareLockButton.tsx`

Props:

```typescript
interface ShareLockButtonProps {
  resourceType: PublicResourceType;
  resourceId: string;
  isPublic: boolean;
  isGuest: boolean;
  accentColor?: string;
  projectId?: string; // for project-scoped URLs
  onPublished?: () => void;
  canPublish?: boolean; // false for encrypted-blocked
  blockReason?: string;
}
```

Uses `toggleResourcePublicGuestSecure` + clipboard API + toast.

### `components/share/AccessControlMenuItems.tsx`

Returns context menu item subtree for `ContextMenuContext` consumers.

### Card refactors (each resource)

Replace `MoreVertical` / `MoreHoriz` inline button with ShareLockButton; ensure `onContextMenu` / long-press still opens full menu.

**Files to touch (Phase 4):** see `tasks.todo.md` § Card chrome rollout.

---

## 6. Security model summary

```
                    ┌─────────────────┐
                    │  Private row    │
                    │  ACL: owner +   │
                    │  collaborators  │
                    └────────┬────────┘
                             │ Lock click (publish)
                             ▼
                    ┌─────────────────┐
                    │ isPublic=true   │
                    │ isGuest=true    │
                    │ READ via        │
                    │ secure-ops only │
                    └────────┬────────┘
                             │ Access Control
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        guest_off      guest_on      make_private
     (auth required)  (anyone)      (back to private)
```

**Collaborators** with `editor` / `admin` on the `collaborators` table: unchanged — full write through `secure-ops`, never through public flags.

**Scraping protection:** Rows stay without `Role.any()` in DB where possible; only Server SDK serves guest reads after flag check. This matches `security.database-read-only-rls` skill intent.

---

## 7. Interaction with existing ShareNoteDrawer

`ShareNoteDrawer` / `openUnified('share-note')` is the **old** multi-step collaborator flow.

| Keep | Deprecate / relocate |
|------|----------------------|
| Assignee/collaborator grants for goals | "Copy link" as primary card action |
| Admin permission editing | Default publish drawer on every share click |
| | Pro paywall on basic share |

**Target end state:** `share-note` drawer opens only from **Access Control → Manage collaborators**, not from card chrome.

---

## 8. Mobile vs desktop

| Gesture | Opens |
|---------|--------|
| Right-click (desktop) | Full context menu including Access Control when public |
| Long-press (mobile) | Same menu |
| Tap Lock | Publish or copy — **no menu** |

Long-press implementation: reuse `ContextMenuContext.openMenu` with timer in card wrapper (`pointerdown` + 500ms).

---

## 9. Caching & offline

Public URL copy does not require network after URL is known.

Publish toggle requires server round-trip. Optimistic UI optional but **not** in Phase 3 — show spinner on lock until `secure-ops` returns to avoid "link copied but 403" races.

DataNexus cache invalidation keys (per resource) listed in `migration.todo.md`.

---

## 10. Open decisions log

| ID | Question | Proposed default | Status |
|----|----------|------------------|--------|
| OD-1 | T4 encrypted note one-tap publish | Block with toast "Unlock vault to share" OR strip encryption | **Unresolved** |
| OD-2 | Notes `Role.any()` on publish | Remove; rely on `isGuest` column only | **Proposed** |
| OD-3 | `/note/shared/[id]` legacy | Keep working; **new** shares may use `/note/[id]` via builder | **Revised — no mass redirect** |
| OD-R1 | Flow goal public path | `/flow/goal/[id]` (keeps `/flow` prefix) | **Proposed** |
| OD-4 | Send `/send/[id]` | Out of ruthless lock program (ephemeral) | **Accepted** |
| OD-5 | Project `visibility` enum | Mirror: `visibility=public` when `isPublic` | **Proposed** |

Update this table when product signs off.
