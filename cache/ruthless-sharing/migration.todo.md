# Migration & Compatibility — Ruthless Sharing (Revised)

**Scope:** Minimal route aliases + global href updates for **three flagship landings** only.  
**Explicitly out of scope:** Mass route tree moves, root `/notes`, renaming `/connect/calls`, relocating `/note/shared`.

---

## 1. What changes vs what stays

### Changes (canonical internal hrefs)

| Old href | New canonical href | Action |
|----------|-------------------|--------|
| `/note/notes` | `/note` | Serve notes list at `/note`; alias old path |
| `/vault/dashboard` | `/vault` | Serve secrets list at `/vault`; alias old path |
| `/flow/goals` | `/flow` | Serve goals list at `/flow`; alias old path |
| `/flow/tasks` | `/flow` | Same destination as goals flagship |

### Stays unchanged

- `/note/shared`, `/note/tags`, `/note/settings`, …
- `/flow/forms`, `/flow/events`, `/flow/calendar`, …
- `/vault/totp`, `/vault/sharing`, `/vault/overview`, …
- `/connect`, `/connect/chats`, `/connect/calls`, …
- `/projects`, `/projects/[id]`, `/send`, …
- Existing `app/(app)/note/(app)/...` file tree (no mass delete)

### Public share URLs (new copies from Lock button)

- Built via `buildPublicResourceUrl()` — see `routes.md` §5
- Legacy `/note/shared/[id]` **continues to work**; optional later alignment, **not** a redirect storm

---

## 2. Minimal redirect / alias map

**File:** `middleware.ts` or thin re-export pages

| From (alias) | To (canonical) | Code |
|--------------|----------------|------|
| `/note/notes` | `/note` | 308 or render same page |
| `/vault/dashboard` | `/vault` | 308 or render same page |
| `/flow/goals` | `/flow` | 308 or render same page |
| `/flow/tasks` | `/flow` | 308 or render same page |

**NOT in redirect map:**

- `/note/shared/*`
- `/flow/forms/*`
- `/connect/calls`
- Any root-level `/notes`, `/goals`, `/forms`

- [ ] Implement only the four rows above
- [ ] Optional: telemetry sample on alias hits (1%)

---

## 3. Global href update (mandatory when implementing Phase 7)

Every **internal navigation** target for the three landings must point to canonical URLs.

### Grep commands (authoritative sweep)

```bash
rg "/note/notes" --glob "*.{ts,tsx}"
rg "/vault/dashboard" --glob "*.{ts,tsx}"
rg "/flow/goals" --glob "*.{ts,tsx}"
rg "/flow/tasks" --glob "*.{ts,tsx}"
```

Save baseline to `cache/ruthless-sharing/migration-baseline.txt` before edits.

**Do NOT run broad replaces on:**

```bash
# FORBIDDEN bulk patterns
rg "/note/shared"   # keep
rg "/flow/forms"    # keep
rg "/connect/calls" # keep
```

### Files known to need href updates

| File | Change |
|------|--------|
| `components/UnifiedBottomBar.tsx` | `note.notes` → `/note` |
| `components/layout/ConnectTopbar.tsx` | any `/note/notes` CTA |
| `components/ui/ContextMenuContext.tsx` | Notes Vault target |
| `context/SectionContext.tsx` | `DEFAULT_LAYOUTS['/note/notes']` → `'/note'`; vault/flow keys |
| `middleware.ts` | post-auth redirect if aimed at `/note/notes` |
| `app/layout.tsx` | root redirect script paths |
| `lib/ecosystem/resume-route.ts` | add `/note` if needed; **keep** `/note/shared` |
| `app/(app)/layout.tsx` | public allowlist |
| `components/providers/EcosystemStateTracker.tsx` | path prefixes |
| `lib/context-engine.tsx` | `actionHref` |
| `app/(app)/note/(app)/notes/page.tsx` | `replaceState` → `/note` |
| `app/(app)/projects/page.tsx` | insights link |
| `components/layout/DesktopRightSection.tsx` | panel links to notes list |

- [ ] Run grep baseline
- [ ] Update each callsite
- [ ] Re-grep — zero stale **internal** links to old flagship paths (aliases still OK in middleware only)

---

## 4. Share link generator migration (public URLs only)

When Lock publishes, copy URL from builder — **not** a route tree move.

| File | Change |
|------|--------|
| `lib/appwrite/note.ts` | `getShareableUrl` → prefer `buildPublicResourceUrl('note', id)` → `/note/[id]` for **new** shares |
| `components/overlays/ShareNoteDrawer.tsx` | use builder for copy link |
| `lib/share/public-url.ts` | **new** — single source |

**Keep working:** Existing `/note/shared/[id]` links already in the wild.

- [ ] New publishes use `/note/[id]` (or product choice)
- [ ] Do **not** 301 all `/note/shared/*` unless explicitly approved later

---

## 5. SectionContext layout keys

| Old key | New key |
|---------|---------|
| `/note/notes` | `/note` |
| `/vault/dashboard` | `/vault` |
| `/flow/goals` | `/flow` |
| `/flow/tasks` | `/flow` |

Unchanged keys: `/note/shared`, `/flow/forms`, `/connect/chats`, `/projects`, etc.

---

## 6. Public guest pages (Phase 6)

Create or wire guest shells at **public URL law** paths — see `routes.md` §5.

Each page:

```
if (isGuest || isPublic) → <StandardDetailReadOnly />
else → <AccessUnavailable />
```

- [ ] `/note/[id]` (may overlap existing shared note client — reuse component)
- [ ] `/project/[id]`
- [ ] `/vault/[id]` (policy OD-6)
- [ ] `/flow/goal/[id]` (OD-R1)
- [ ] Others per `resource-matrix.md` as needed

**Not required:** New pages for `/notes`, `/goals` at site root.

---

## 7. Data / cache invalidation (unchanged)

On `toggleResourcePublicGuestSecure`:

| Resource | Invalidate |
|----------|------------|
| Note | `note_${id}`, `initial_notes_${userId}`, pinned cache |
| Task | flow warm keys |
| Form | `f_user_forms_${userId}` |
| Project | projects list cache |

---

## 8. Rollback

| Rolled back | Action |
|-------------|--------|
| Phase 7 only | Point hrefs back to `/note/notes` etc.; remove aliases |
| Share URLs only | Builder returns `/note/shared/[id]` again |
| Full program | Revert ShareLockButton; keep all routes as today |

---

## 9. QA checklist (narrow + sharing)

**Flagship routes**

- [ ] `/note` shows notes list (same as old `/note/notes`)
- [ ] `/note/notes` still works (alias)
- [ ] `/vault` shows secrets list; `/vault/dashboard` aliases
- [ ] `/flow` shows goals; `/flow/goals` and `/flow/tasks` alias
- [ ] `/note/shared` still works unchanged
- [ ] `/flow/forms` still works unchanged
- [ ] `/connect/calls` still works unchanged
- [ ] Bottom bar Notes tab → `/note`

**Sharing**

- [ ] Lock on private note → public + copy `/note/[id]`
- [ ] Incognito opens copied link → detail or access message
- [ ] Access Control → make private → link shows unavailable
- [ ] `/note/shared/old-id` still loads (legacy links)

---

## 10. Timeline (unchanged phases, narrower Phase 7)

Phase 7 is **days not weeks** if scoped correctly — three route mounts + href sweep only.
