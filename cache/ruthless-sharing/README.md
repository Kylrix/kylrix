# Ruthless Sharing & Route Tuning — Program Cache

**Status:** Planning only — **do not implement** until explicitly instructed.  
**Created:** 2026-06-02  
**Revised:** User correction — **no sweeping route deprecation.**

This directory is the **single source of truth** for the ruthless sharing overhaul and the **minimal** flagship-route adjustments. Every file includes **why** behind decisions.

---

## Problem statement (sharing — unchanged)

Incumbent suites optimize for ACL granularity at the cost of recipient UX: copy link → recipient sees "no permission."

Kylrix uses **`isPublic`** + **`isGuest`** column escape hatches (see `.agents/skills/why.ispublic-isguest-escape-hatches/SKILL.md`). This program puts **one-tap publish** on every resource card (Pin + Lock/Link) and moves fine-grained **Access Control** behind context menu / detail — only when already public.

---

## Route policy (revised — read this first)

**Most routes stay exactly as they are today.**

### Only three flagship landings collapse

| Old | New | Why |
|-----|-----|-----|
| `/note/notes` | `/note` | `/note` prefix was empty; notes are the Note app flagship (like `/connect` = feed) |
| `/vault/dashboard` | `/vault` | Secrets list belongs at vault root |
| `/flow/goals`, `/flow/tasks` | `/flow` | Goals are the Flow app flagship |

**Keep unchanged:** `/note/shared`, `/note/tags`, `/flow/forms`, `/flow/events`, `/connect/calls`, `/connect/chats`, `/projects`, `/send`, and the rest of the app tree.

**Sub-app rule:** Secondary pages **do not** move to site root (`/notes`, `/forms`). They stay under their prefix (`/note/shared`, `/flow/forms`, …).

**Standalone league:** `/projects` and `/send` are not children of Note/Vault/Flow/Connect.

**Aliases:** Old URLs (`/note/notes`, etc.) remain valid via redirect or shared page — **not** deleted.

Full detail: [routes.md](./routes.md)

---

## Public URL law (sharing links)

> Resource URI, singularize noun (`s` off if present), `+ /[id]` → guest detail page or access-unavailable message.

Examples: `/note/[id]`, `/project/[id]`, `/vault/[id]`, `/flow/form/[id]`.

Uses standard read-only detail component when `isGuest` / `isPublic` allows.

---

## Design pillars (sharing UI)

| Pillar | Decision | Why |
|--------|----------|-----|
| **Two-tap chrome** | Pin + Lock/Link on every resource card | Space; no three-dot on card |
| **Lock = publish** | Sets `isPublic` + `isGuest`, copies public URL | Link works for strangers immediately |
| **Link = re-copy** | When public, click copies only | No accidental unpublish |
| **Read-only public** | Flags never grant write | Collaborators table handles writes |
| **Context menu** | Right-click / long-press; Access Control when public | Same power, cleaner cards |

---

## File map

| File | Purpose |
|------|---------|
| [architecture.md](./architecture.md) | Sharing UX, server actions, security, components |
| [routes.md](./routes.md) | **Revised** minimal route matrix + public URL law |
| [resource-matrix.md](./resource-matrix.md) | Per-resource flags, URLs, card chrome |
| [tasks.todo.md](./tasks.todo.md) | Phased checklist — **no mass route wipe** |
| [migration.todo.md](./migration.todo.md) | **Narrow** href + alias redirects only |

---

## Phase overview (revised)

```
Phase 0 ─ Documentation & sign-off
Phase 1 ─ lib/share/public-url.ts (public links only)
Phase 2 ─ secure-ops toggleResourcePublicGuestSecure
Phase 3 ─ ShareLockButton + Access Control menu items
Phase 4 ─ Card chrome rollout (all resources)
Phase 5 ─ Access Control drawer (public-only)
Phase 6 ─ Public guest detail pages (singular noun + [id])
Phase 7 ─ THREE flagship routes only (/note, /vault, /flow) + global href updates
Phase 8 ─ QA
```

**Removed from plan:** Mass deprecation, root-level `/notes` `/goals`, `/connect/calls` rename, moving `/note/shared`, flattening entire `app/(app)` tree.

---

## Tracking

Update [tasks.todo.md](./tasks.todo.md) religiously. Status: `[ ]` `[~]` `[x]` `[—]` `[!]`

---

## Open questions (sharing — unchanged)

1. Encrypted notes on one-tap publish — block vs strip encryption (OD-1)
2. Public vault secrets — block vs metadata-only (OD-6)
3. TOTP — hard block on public share
4. Send — out of scope for Lock button

Route open question:

5. **OD-R1:** Flow goal public URL — `/flow/goal/[id]` (keeps prefix) vs `/goal/[id]` (root) — prefer **`/flow/goal/[id]`** per sub-app rule

---

## Non-goals

- Sweeping application route migration
- Rebuilding full collaborator permission matrix
- New `app/api/*` routes
