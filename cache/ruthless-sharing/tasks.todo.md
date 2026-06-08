# Implementation Tasks — Ruthless Sharing

**Track religiously.** Update status inline as work proceeds.  
**Do not start** until explicit user go-ahead after cache review.

Status: `[ ]` todo · `[~]` in progress · `[x]` done · `[—]` deferred · `[!]` blocked

---

## Phase 0 — Planning & sign-off

- [x] Create `cache/ruthless-sharing/` program directory
- [x] Document architecture, routes, resource matrix
- [x] **Revise routes plan** — no sweeping deprecation; three flagship collapses only (`routes.md`, `migration.todo.md`)
- [ ] Product sign-off on OD-1, OD-6, OD-R1 in `architecture.md` §10
- [ ] User explicit "implement" instruction

---

## Phase 1 — Canonical URL layer (no UI)

**Why first:** Every later phase copies links; one builder prevents drift.

- [ ] **1.1** Create `lib/share/public-url.ts`
  - `buildPublicResourceUrl(type, id, opts?)` — singularize noun + `[id]` per `routes.md` §5
  - `buildInternalFlagshipUrl(app)` — only `'note' | 'vault' | 'flow'` → `/note`, `/vault`, `/flow`
  - `buildProjectScopedPublicUrl(projectId, kind, entityId)`
  - **Do not** add root `/notes`, `/goals` builders
- [ ] **1.2** Create `lib/share/resource-types.ts` — union type `PublicResourceType`
- [ ] **1.3** Add `www.kylrix.space` base enforcement (reuse `system.domain-canonicalization` helpers)
- [ ] **1.4** Wire new shares to builder; **keep** `/note/shared/[id]` resolving for legacy links (no mass redirect)

---

## Phase 2 — Server: unified public/guest toggle

**Why before UI:** Lock button must not call per-resource ad-hoc toggles.

- [ ] **2.1** `toggleResourcePublicGuestSecure` in `secure-ops.ts`
  - Modes: `publish`, `copy_only`, `make_private`, `guest_off`, `guest_on`
  - Owner verification per resource type
- [ ] **2.2** `getResourcePublicGuestSecure` — read flags for card state hydration
- [ ] **2.3** Note adapter: wrap/replace `toggleNoteVisibility` to set **both** flags; decide OD-2 `Role.any()` removal
- [ ] **2.4** Task/goal adapter — flow DB `tasks` table
- [ ] **2.5** Form adapter — sync `status` + flags
- [ ] **2.6** Event adapter
- [ ] **2.7** Credential adapter — implement OD-6 policy (block or metadata-only)
- [ ] **2.8** TOTP adapter — return blocked for `publish`
- [ ] **2.9** Project adapter — sync `visibility` enum
- [ ] **2.10** Huddle/call adapter — define row + flags
- [ ] **2.11** Client wrapper `lib/actions/client-ops.ts` → `toggleResourcePublicGuest()`
- [ ] **2.12** DataNexus invalidation map per resource after toggle

---

## Phase 3 — Shared UI components

- [ ] **3.1** `components/share/ShareLockButton.tsx`
  - Props per `architecture.md` §5
  - States: private lock, public link, loading, disabled + tooltip
  - Clipboard + toast on success
- [ ] **3.2** `components/share/AccessControlMenuItems.tsx`
  - Returns context menu nodes; only when `isPublic || isGuest`
  - Confirm dialog for make private
- [ ] **3.3** `hooks/useLongPressContextMenu.ts`
  - 500ms long-press → `openMenu` (mobile)
  - Reuse existing `ContextMenuContext`
- [ ] **3.4** `components/share/ShareLockButton.stories` or dev fixture page (optional)

---

## Phase 4 — Card chrome rollout (remove three-dot)

**Order:** Notes → Goals → Forms → Vault → Projects → Events → Connect

### 4A — Notes

- [ ] Remove `MoreHorizIcon` button from `components/NoteCard.tsx`
- [ ] Remove duplicate from `components/ui/NoteCard.tsx`
- [ ] Add `ShareLockButton` + keep `Pin`
- [ ] Wire `onContextMenu` + long-press to existing menu (includes Access Control when public)
- [ ] Remove redundant inline "Copy Share Link" when public (link icon is ShareLockButton)

### 4B — Goals / Tasks

- [ ] Remove `MoreVertical` from `components/tasks/TaskItem.tsx` visible chrome
- [ ] Add ShareLockButton (accent `#A855F7`)
- [ ] Context menu: add Access Control subtree; keep Synergy/Project/Tags/Workflow
- [ ] `TaskDetails.tsx` header: optional lock/link duplicate for detail view

### 4C — Forms

- [ ] `forms/page.tsx` card actions: remove overflow menu trigger from card surface
- [ ] Add Pin + ShareLockButton per form row
- [ ] Context menu on right-click row

### 4D — Vault credentials

- [ ] `CredentialItem.tsx`: remove overflow from inline chrome if present
- [ ] Add ShareLockButton (disabled until OD-6 resolved)
- [ ] Pin stays

### 4E — Projects

- [ ] `LocalProjectCard` in `projects/page.tsx`: Pin + ShareLockButton
- [ ] `ProjectCard.tsx`: same
- [ ] Remove inline delete? **No** — delete stays; only remove three-dot if redundant with context menu

### 4F — Events

- [ ] `EventCard.tsx`: Pin (if added) + ShareLockButton
- [ ] Context menu migration

### 4G — Connect / Huddles

- [ ] Chat list items: evaluate lock for invite link (may differ from resource cards)
- [ ] Huddle history cards if applicable

---

## Phase 5 — Access Control UI (public-only)

- [ ] **5.1** Bottom drawer `AccessControlDrawer.tsx` (or extend existing)
  - Shows: guest toggle, make private, manage collaborators link
- [ ] **5.2** Wire drawer from context menu only (not card)
- [ ] **5.3** Demote `ShareNoteDrawer` to collaborator management entry point only
- [ ] **5.4** Update `UnifiedDrawerContext` type if new drawer id `access-control`

---

## Phase 6 — Public guest detail pages

**Law:** `{appPrefix}/{singularNoun}/[id]` → standard detail read-only OR access-unavailable.

- [ ] **6.1** `/note/[id]` — guest shell (reuse shared note detail where possible)
- [ ] **6.2** `/flow/goal/[id]` — goal guest detail (OD-R1)
- [ ] **6.3** `/flow/form/[id]` — form guest view
- [ ] **6.4** `/flow/event/[id]` — event guest view
- [ ] **6.5** `/project/[id]` — standalone project guest preview
- [ ] **6.6** `/vault/[id]` — per OD-6 policy
- [ ] **6.7** `/connect/call/[id]` — huddle join/view if applicable
- [ ] **6.8** `/projects/[pid]/[kind]/[entityId]` — project-scoped public (if not already)

**Not in Phase 6:** Root `/goal/[id]`, `/form/[id]` without app prefix; mass move of `/note/shared` route tree.

---

## Phase 7 — Three flagship landings ONLY (+ global href sweep)

See `migration.todo.md`. **No mass route wipe.**

- [ ] **7.1** Mount notes list content at **`/note`** (flagship)
- [ ] **7.2** Mount secrets list at **`/vault`**
- [ ] **7.3** Mount goals list at **`/flow`**
- [ ] **7.4** Aliases: `/note/notes` → `/note`, `/vault/dashboard` → `/vault`, `/flow/goals` + `/flow/tasks` → `/flow`
- [ ] **7.5** Global href update — grep `/note/notes`, `/vault/dashboard`, `/flow/goals`, `/flow/tasks` (all callsites)
- [ ] **7.6** Update `UnifiedBottomBar` + `SectionContext` DEFAULT_LAYOUTS keys
- [ ] **7.7** Update `middleware.ts`, `resume-route.ts`, layout allowlists for `/note` flagship
- [ ] **7.8** Save `migration-baseline.txt` before/after grep proof

**Explicitly excluded from Phase 7:**

- [—] Move `/note/shared`, `/flow/forms`, `/connect/calls`, or any other sibling routes
- [—] Create root `/notes`, `/goals`, `/forms`
- [—] Delete `app/(app)/note/(app)/...` tree

---

## Phase 8 — Cleanup & QA

- [ ] **8.1** QA matrix: private link → 403/redirect to login (when guest off, public on)
- [ ] **8.2** QA: guest link → loads without account (guest on)
- [ ] **8.3** QA: collaborator write still works when private
- [ ] **8.4** QA: make private → guest link 404/forbidden
- [ ] **8.5** QA: lock double-tap debounce
- [ ] **8.6** QA: long-press menu on mobile Safari + Android Chrome
- [ ] **8.7** Remove dead share UI paths
- [ ] **8.8** QA: `/note/shared`, `/flow/forms`, `/connect/calls` unchanged
- [ ] **8.9** QA: flagship aliases `/note/notes`, `/vault/dashboard`, `/flow/goals` still resolve

---

## Cross-cutting concerns (apply during phases)

- [ ] **X.1** Layman copy audit — no "ACL", "RLS", "E2EE" in lock/toast strings
- [ ] **X.2** Terminology: Table/Row not collection/document in new code comments
- [ ] **X.3** No new `app/api/*` routes — Server Actions only
- [ ] **X.4** Global unmount: drawers use `keepMounted: false`
- [ ] **X.5** Telegram/email share links use new canonical URLs

---

## Progress summary

| Phase | Total | Done | % |
|-------|-------|------|---|
| 0 | 5 | 3 | 60% |
| 1 | 4 | 0 | 0% |
| 2 | 12 | 0 | 0% |
| 3 | 4 | 0 | 0% |
| 4 | 7 groups | 0 | 0% |
| 5 | 4 | 0 | 0% |
| 6 | 8 | 0 | 0% |
| 7 | 8 | 0 | 0% |
| 8 | 9 | 0 | 0% |

*Update counts when checking boxes.*
