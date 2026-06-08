# Route Policy — Conservative (Revised)

**Last updated:** per user correction — **no sweeping route deprecation.**

This document replaces the earlier aggressive canonicalization plan. Most existing paths **stay as-is**. Only three **flagship landing** routes collapse so the sub-app root actually serves its primary feature (like `/connect` already does for the moment feed).

---

## 1. What we are NOT doing

| Do NOT | Why |
|--------|-----|
| Move `/note/shared` → root `/shared` | Sub-app pages keep their `/note` prefix |
| Move `/flow/forms` → `/forms` | Same — `/flow/*` siblings unchanged |
| Rename `/connect/calls` → `/connect/huddles` | Existing terminology/routes stay unless product asks later |
| Collapse everything to root `/notes`, `/goals`, `/vault` | Sub-apps are not distilled into site root |
| Mass-delete `app/(app)/note/(app)/...` tree | Catastrophic; avoid |
| 301 every `/flow/*` path | Out of scope |

**Rule of thumb:** Sub-app secondary pages **keep** their prefix (`/note/shared`, `/note/tags`, `/flow/forms`, `/vault/totp`, etc.). Only the **empty middle segment** list pages move up one level.

---

## 2. Standalone apps (own league — unchanged)

These are **not** sub-routes of Note / Vault / Flow / Connect:

| App | Root | Notes |
|-----|------|-------|
| **Projects** | `/projects`, `/projects/[id]` | Cross-ecosystem; not under `/note` or `/flow` |
| **Send** | `/send`, `/send/[id]` | Ephemeral relay; separate security model |

---

## 3. The only three internal landing collapses

Each row: **old URL** had a redundant segment (`/notes`, `/dashboard`, `/goals`) where the **parent prefix was empty**. Parent becomes the flagship surface.

| Sub-app | Old flagship list | **New flagship list** | What moves here | Unchanged siblings (examples) |
|---------|-------------------|----------------------|-----------------|-------------------------------|
| **Note** | `/note/notes` | **`/note`** | Notes list (primary Note feature) | `/note/shared`, `/note/tags`, `/note/settings`, … |
| **Vault** | `/vault/dashboard` | **`/vault`** | Secrets/credentials list | `/vault/totp`, `/vault/sharing`, `/vault/overview`, … |
| **Flow** | `/flow/goals`, `/flow/tasks` | **`/flow`** | Goals/tasks list (primary Flow feature) | `/flow/forms`, `/flow/events`, `/flow/calendar`, … |

### Why only these three?

- `/connect` **already** lands on the live moment feed at `/connect` — no `/connect/feed` middle layer. This is the pattern we mirror.
- `/note/notes` → the `/note` prefix carried no content until `/notes`; opportunistic to serve notes at `/note`.
- `/vault/dashboard` → same for secrets at `/vault`.
- `/flow/goals` (and `/flow/tasks`) → same for goals at `/flow`.

### Compatibility (not deprecation theater)

- Keep **`/note/notes`**, **`/vault/dashboard`**, **`/flow/goals`**, **`/flow/tasks`** as **aliases** (redirect or same page component) so bookmarks and external links never break.
- Update **all internal hrefs globally** to point at the new canonical targets (`/note`, `/vault`, `/flow`).
- This is a **href + flagship route** change, not a tree wipe.

---

## 4. Connect (reference pattern — no change required)

| Route | Role |
|-------|------|
| `/connect` | Live moment feed (flagship — already correct) |
| `/connect/chats` | Chat list |
| `/connect/calls` | Huddles/calls |
| `/connect/chat/[id]` | Conversation detail (internal) |

No collapses planned for Connect in this program.

---

## 5. Public (guest) URL law

> **A resource’s URI — drop a trailing `s` on the resource noun if present — then `+ /[id]` → public detail page.**

Behavior on hit:

1. Load row via `secure-ops` guest/public gate (`isGuest` / `isPublic`).
2. If allowed → render **standard detail component** for that resource (read-only).
3. If not → friendly **access unavailable** message (not a generic 403 wall).

### Examples

| Resource | Internal (auth app chrome) | Public guest URL | Notes |
|----------|----------------------------|------------------|-------|
| Note | `/note` (list), `/note/notes/[id]` or detail route TBD | **`/note/[id]`** | Aligns with `/note` prefix; replaces legacy `/note/shared/[id]` for **new** shares when ready (old URL may remain alias) |
| Goal | `/flow` (list) | **`/flow/goal/[id]`** | OD-R1 — keeps `/flow` prefix; no root `/goal/[id]` |
| Form | `/flow/forms/[id]` | **`/flow/form/[id]`** | Drop `s` on `forms` |
| Event | `/flow/events/[id]` | **`/flow/event/[id]`** | |
| Vault secret | `/vault` (list) | **`/vault/[id]`** | |
| Project | `/projects/[id]` | **`/project/[id]`** | Standalone; `projects` → `project` |
| Huddle | `/connect/calls` … | **`/connect/call/[id]`** | `calls` → `call` |

**Project sub-resources (hierarchy):**

`/projects/[projectId]/[kind]/[entityId]` — unchanged for integrated objects.

### Public page contract

```
GET /{appPrefix}/{resourceNoun}/{id}   // noun singularized
  → guest read via isGuest / isPublic
  → <ResourceDetailReadOnly /> | <AccessUnavailable />
```

Minimal chrome: no vault unlock, no owner edit affordances.

---

## 6. Internal detail routes (mostly unchanged)

Do **not** mass-move detail pages in this program.

| Area | Keep unless explicitly listed |
|------|------------------------------|
| Note editor/detail | Existing `app/(app)/note/(app)/notes/[id]/...` paths may remain; only **list** hrefs switch to `/note` |
| Form builder | `/flow/forms/[formId]` |
| Event | `/flow/events/[eventId]` |
| Project workspace | `/projects/[projectId]` |

Resolve note internal detail canonical URL in implementation (may stay `/note/notes/[id]` with hrefs from `/note` list).

---

## 7. Global href update scope (when implementing)

**Must update** every callsite that links to the three collapsed landings:

```bash
# Primary grep targets (internal navigation only)
rg "/note/notes" --glob "*.{ts,tsx}"
rg "/vault/dashboard" --glob "*.{ts,tsx}"
rg "/flow/goals" --glob "*.{ts,tsx}"
rg "/flow/tasks" --glob "*.{ts,tsx}"
```

**Known files (non-exhaustive):**

- `components/UnifiedBottomBar.tsx`
- `components/layout/ConnectTopbar.tsx`
- `components/ui/ContextMenuContext.tsx`
- `context/SectionContext.tsx` — `DEFAULT_LAYOUTS` key `/note/notes` → `/note`
- `middleware.ts` — auth redirect if it targets `/note/notes`
- `app/layout.tsx` — root redirect script
- `lib/ecosystem/resume-route.ts`
- `components/providers/EcosystemStateTracker.tsx`
- `app/(app)/layout.tsx` — public allowlist (add `/note` as list, keep `/note/shared`)
- `lib/context-engine.tsx`
- `components/layout/DesktopRightSection.tsx`

**Do NOT grep-replace** `/note/shared`, `/flow/forms`, `/connect/calls`, etc.

---

## 8. Redirect aliases (minimal)

| From (alias) | To (canonical) | Code |
|--------------|----------------|------|
| `/note/notes` | `/note` | 308 or same component |
| `/vault/dashboard` | `/vault` | 308 or same component |
| `/flow/goals` | `/flow` | 308 or same component |
| `/flow/tasks` | `/flow` | 308 or same component |

**Not in scope:**

- `/note/shared/[id]` → `/note/[id]` (optional later for share URL builder only; **not** a mass redirect)
- `/flow/forms` → anything else
- `/connect/calls` → anything else

---

## 9. SectionContext / layout keys

Update `DEFAULT_LAYOUTS` only for keys that **rename**:

| Old key | New key |
|---------|---------|
| `/note/notes` | `/note` |
| `/vault/dashboard` | `/vault` |
| `/flow/goals` | `/flow` |
| `/flow/tasks` | `/flow` |

Leave `/note/shared`, `/flow/forms`, `/connect/chats`, etc. keys **unchanged**.
