# Resource Matrix — Flags, URLs, Card Chrome, Blockers

Per-resource specification for ruthless sharing. Each row is authoritative for implementers.

---

## Legend

- **Publish:** Lock click when private → set `isPublic + isGuest`, copy URL
- **Re-copy:** Link click when public → clipboard only
- **AC:** Access Control submenu (context menu / detail) when public

---

## Notes

| Field | Value |
|-------|-------|
| DB | `67ff05a9000296822396` / `67ff05f3002502ef239e` |
| Columns | `isPublic`, `isGuest` (both exist) |
| Internal flagship list | **`/note`** (was `/note/notes`; `/note/shared` etc. unchanged) |
| Internal detail | Existing paths (e.g. `/note/notes/[id]`) — no mass move in this program |
| Public URL | **`/note/[id]`** — detail or access-unavailable |
| Project public | `/projects/[pid]/note/[id]` |
| Pin | `user_resource_pins` + owner `isPinned` |
| Lock accent | `#EC4899` |
| Current share API | `toggleNoteVisibility` (sets `isPublic` + `Role.any()`, **not** `isGuest`) |
| **Gap** | Must migrate to `isGuest: true` on publish; align with column-only read |
| Publish blocker | T4 encrypted notes — need vault unlock or refuse |
| Card files | `components/NoteCard.tsx`, `components/ui/NoteCard.tsx` |
| Three-dot | `MoreHorizIcon` → **remove** |

**Why notes lead Phase 4:** Richest share UX already exists; proves ShareLockButton pattern.

---

## Vault credentials (secrets)

| Field | Value |
|-------|-------|
| DB | `passwordManagerDb` / `credentials` |
| Columns | `isPublic`, `isGuest` |
| Internal flagship list | **`/vault`** (was `/vault/dashboard`; `/vault/totp` etc. unchanged) |
| Public URL | **`/vault/[id]`** |
| Project public | `/projects/[pid]/secret/[id]` |
| Pin | `user_resource_pins` type `credential` |
| Lock accent | `#10B981` |
| Current share | No one-tap; sharing page exists |
| Publish blocker | **Never** guest-read raw password fields — public view must be redacted card OR block publish entirely |
| Card files | `components/app/dashboard/CredentialItem.tsx` |
| Three-dot | Context menu only — **remove** inline overflow if any |

**Why likely block guest publish for raw secrets:** Guest read of `password` column violates layman trust expectation unless explicit "share password" mode with audit toast.

**Decision required (OD-6):** Public secret = metadata-only (name, username, URL) vs full secret reveal.

---

## TOTP

| Field | Value |
|-------|-------|
| DB | `passwordManagerDb` / `totpSecrets` |
| Columns | `isPublic`, `isGuest` |
| Public URL | `/totp/[id]` or `/vault/totp/[id]` |
| Pin | type `totp` |
| Publish blocker | **Strong block** — sharing TOTP guest-readable is dangerous |

**Proposed:** Lock button disabled with tooltip "TOTP codes can't be shared publicly."

---

## Goals / Tasks

| Field | Value |
|-------|-------|
| DB | `whisperrflow` / `tasks` |
| Columns | `isPublic`, `isGuest` |
| Internal flagship list | **`/flow`** (was `/flow/goals`, `/flow/tasks`; `/flow/forms` etc. unchanged) |
| Public URL | **`/flow/goal/[id]`** (OD-R1 — keeps `/flow` prefix) |
| Project public | `/projects/[pid]/goal/[id]` |
| Pin | type `task` |
| Lock accent | `#A855F7` |
| Current share | `ShareNoteDrawer` via context Synergy menu |
| Card files | `components/tasks/TaskItem.tsx` |
| Three-dot | `MoreVertical` → **remove**; keep context menu |

**Why goal singular URL:** Matches user mental model "share this goal" not "share from goals list."

---

## Forms

| Field | Value |
|-------|-------|
| DB | `whisperrflow` / `forms` |
| Columns | `isPublic`, `isGuest` |
| Internal | **`/flow/forms`**, **`/flow/forms/[id]`** (unchanged) |
| Public | **`/flow/form/[id]`** |
| Pin | type `form` |
| Lock accent | `#6366F1` |
| Card files | `app/(app)/flow/(dashboard)/forms/page.tsx` |
| Publish note | `status: published` may already imply public — **sync** `isGuest` when locking |

---

## Events

| Field | Value |
|-------|-------|
| DB | `whisperrflow` / `events` |
| Columns | `isPublic`, `isGuest` |
| Internal | **`/flow/events`**, **`/flow/events/[id]`** (unchanged) |
| Public | **`/flow/event/[id]`** |
| Card files | `components/events/EventCard.tsx` |
| Pin | Not yet on card — add with global pin if event pin desired |

---

## Projects

| Field | Value |
|-------|-------|
| DB | `chat` / `projects` |
| Columns | `isPublic`, `isGuest` + `visibility` enum |
| Internal | `/projects`, `/projects/[id]` |
| Public | `/project/[id]` |
| Pin | owner `isPinned` on row |
| Card files | `app/(app)/projects/page.tsx` LocalProjectCard, `components/projects/ProjectCard.tsx` |
| **Gap** | Bridge `visibility: public` ↔ `isPublic/isGuest` |

**Why separate `/project/[id]`:** Guest landing for "view this workspace" without exposing full `/projects` list UI.

---

## Huddles (calls)

| Field | Value |
|-------|-------|
| DB | `chat` / `conversations` or `calls` |
| Columns | varies — conversations use `isPinned: string[]`, may need `isPublic/isGuest` on call row |
| Internal list | **`/connect/calls`** (unchanged) |
| Internal detail | **`/connect/calls/[id]`** or existing call route |
| Public join | **`/connect/call/[id]`** |
| Pin | per-user conversation pin (future) |
| Publish | Lock shares join link; guest may enter call lobby |

---

## Tags

| Field | Value |
|-------|-------|
| Public URL | None (tags are filters, not shareable objects) |
| Lock button | **Hidden** |

---

## Send ghosts

| Field | Value |
|-------|-------|
| Route | `/send/[id]` |
| Lock program | **Excluded** — ephemeral 7-day relay, different security model |

---

## Collaborators table (write path — unchanged)

| Permission | Source | Write? |
|------------|--------|--------|
| viewer | `collaborators` row | Read via secure-ops |
| editor | `collaborators` row | Write via secure-ops |
| admin | `collaborators` row | Write + share management |
| public | `isPublic` flag | Read only |
| guest | `isGuest` flag | Read only, no auth |

**Why collaborators unchanged:** Ruthless sharing fixes **link recipient** UX; collaborators remain the only write expansion path besides owner.
