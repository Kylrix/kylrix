# Ruthless Sharing & Route Canonicalization — Program Cache

**Status:** Planning only — **do not implement** until explicitly instructed.  
**Created:** 2026-06-02  
**Owner surface:** All Kylrix resource cards, public routes, `secure-ops` guest/public gates.

This directory is the **single source of truth** for the ruthless sharing overhaul. Every file includes **why** behind decisions, not just what to build.

---

## Problem statement (why we are doing this)

Incumbent suites (Google Workspace, etc.) optimize for enterprise ACL granularity at the cost of **recipient UX**:

1. Owner copies a link and sends it.
2. Recipient opens the link.
3. Recipient sees *"You need permission"* with no path forward.

Kylrix already has the right **server-side escape hatches** (`isPublic`, `isGuest`) documented in `.agents/skills/why.ispublic-isguest-escape-hatches/SKILL.md`. We have been **under-using** them in product UI while **over-using** collaborator permission drawers, three-dot menus, and multi-step share flows.

This program **flips the default**: sharing is one tap on the resource card. Fine-grained access control moves behind an explicit *Access Control* entry that only appears **after** a resource is already public.

---

## Design pillars

| Pillar | Decision | Why |
|--------|----------|-----|
| **Two-tap chrome** | Every resource card shows **Pin** + **Lock/Link** only | Frees horizontal space; matches muscle memory (pin = personal order, lock = world access) |
| **Lock = publish** | First lock click sets `isPublic: true` **and** `isGuest: true`, copies canonical public URL | Guest=true means **unauthenticated** recipients work — no login wall on shared links |
| **Link = re-copy** | When already public, lock icon is bright **Link**; click only copies URL | No accidental unpublish; unpublish is intentional via Access Control |
| **Read-only public** | Public/guest paths never grant write via flags | Avoids realtime CRUD complexity; writes stay on `collaborators` table + `secure-ops` |
| **Context menu demotion** | Remove card **three-dot** / overflow; keep **right-click** (desktop) + **long-press** (mobile) | Same power, cleaner cards; aligns with `ui.interactivity-safety` global unmount policy |
| **Singular public routes** | Public item URL drops trailing `s` from app plural (`/projects/[id]` → `/project/[id]`) | Mental model: plural = *my workspace*, singular = *this one thing on the web* |

---

## File map

| File | Purpose |
|------|---------|
| [architecture.md](./architecture.md) | Full system design, UX flows, security model, component contracts |
| [routes.md](./routes.md) | Canonical route matrix: internal vs public vs deprecated |
| [resource-matrix.md](./resource-matrix.md) | Per-resource: DB flags, public URL, toggle API, card chrome |
| [tasks.todo.md](./tasks.todo.md) | Phased implementation checklist (tracked religiously) |
| [migration.todo.md](./migration.todo.md) | Redirects, link generators, SEO, telemetry, comms |

---

## Phase overview (high level)

```
Phase 0 ─ Documentation & sign-off          ← YOU ARE HERE
Phase 1 ─ lib/share canonical URL builder   (no UI yet)
Phase 2 ─ secure-ops togglePublicGuest()    (unified server action)
Phase 3 ─ ShareLockButton component         (shared card chrome)
Phase 4 ─ Roll card chrome per resource     (notes → vault → flow → projects → connect)
Phase 5 ─ Access Control drawer (public-only)
Phase 6 ─ Route additions + middleware redirects
Phase 7 ─ Deprecate old paths + update all href generators
Phase 8 ─ QA matrix + delete dead share drawers where redundant
```

**Rule:** Do not start Phase 1 until user gives explicit implementation go-ahead.

---

## Tracking legend (`tasks.todo.md`)

- `[ ]` Not started  
- `[~]` In progress  
- `[x]` Done  
- `[—]` Explicitly deferred with reason  
- `[!]` Blocked — note blocker in line  

Update checkboxes in `tasks.todo.md` as work proceeds. This README's phase list is summary only; **tasks.todo.md is authoritative**.

---

## Related existing code (anchors for implementers)

| Area | Path |
|------|------|
| `isPublic` / `isGuest` skill | `.agents/skills/why.ispublic-isguest-escape-hatches/SKILL.md` |
| Note visibility toggle (legacy) | `lib/appwrite/note.ts` → `toggleNoteVisibility` |
| Share URL (legacy note) | `lib/appwrite/note.ts` → `getShareableUrl` → `/note/shared/[id]` |
| Permission grants | `lib/actions/secure-ops.ts` → `grantPermissionSecure` |
| Share drawer (to demote) | `components/overlays/ShareNoteDrawer.tsx` |
| Context menu | `components/ui/ContextMenuContext.tsx` |
| Note card chrome (reference) | `components/NoteCard.tsx`, `components/ui/NoteCard.tsx` |
| Section layouts | `context/SectionContext.tsx` |
| Bottom bar routes | `components/UnifiedBottomBar.tsx` |
| Resume / public allowlist | `lib/ecosystem/resume-route.ts`, `app/(app)/layout.tsx` |

---

## Non-goals (this program)

- Rebuilding the entire `collaborators` permission matrix UI (only **relocate** behind Access Control when public).
- E2EE public sharing for T4 encrypted notes (encrypted resources may **block** one-tap publish with clear toast — see `resource-matrix.md`).
- Appwrite ACL `Role.any()` on row permissions for every resource (we keep **column flags** + admin SDK reads per existing mandate).

---

## Open questions (resolve before Phase 2)

1. **Encrypted notes:** Publish strips encryption (today's `toggleNoteVisibility` behavior) — confirm product copy on first lock click.
2. **Projects:** `visibility: public` enum vs `isPublic`/`isGuest` columns — unify or bridge?
3. **Huddles / calls:** Guest join without account — does `isGuest` on conversation row suffice?
4. **Send ghosts:** `/send/[id]` stays separate ephemeral channel — out of scope for lock icon?

Document answers in `architecture.md` § Open decisions when resolved.
