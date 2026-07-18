# Amber / pending-sync status — unresolved

> **Status**: OPEN — not fixed. Do not resume “one more elegant layer” without a proven single-signal fix.  
> **Last updated**: 2026-07-18  
> **Symptom**: Create-idea drawer correctly drives **amber** on the note card while the draft is unsynced. Editing an existing note in **note detail** does not: card and detail stay **green / “Saved”** even while the user is typing.

---

## Intent (what amber means)

Amber = **this device** has local edits not yet confirmed upstream.  
It is **not** a cross-device flag. If another device already pulled the row, it should be green there.

Green = compose session is not in the client pending set (or local dirty snapshot says clean).

---

## What already works (do not break)

**Create note / idea drawer** (`CreateNoteForm.tsx`):

1. On first non-empty draft, allocates an id and calls `registerComposeSession(draftId)`.
2. On every keystroke: `pushLiveNote(draftNote)` + cache write (card mirrors title/content/tags).
3. Card amber comes from `isUnpersistedComposeDraft(id)` / `SyncStatusDot` + `composeSyncEpoch`.
4. Pending clears when create persists (`migrateDraftId` → `unregisterComposeSession` + `markNotePersistedRemote`), typically on close/save — **not** from detail-owned autosave.

That path is the only proven amber communication. Treat it as the reference.

---

## What fails

After an idea/note already exists and the user opens **note detail** (card → `setActiveDetail` → `NoteDetailContainer` → `NoteDetailSidebar`, or sidebar/overlay open):

- Typing in title/content/tags does **not** flip card or detail to amber.
- Detail may literally show **“Saved”** while content is dirty.
- Create amber after first create still works; this is specifically the **edit-in-detail** path.

---

## Architecture that should be true (and isn’t behaving)

| Piece | Role |
|-------|------|
| Live copy (`NotesContext` + `pushLiveNote`) | UI SoT for content |
| `registerComposeSession` / `unpersistedDraftIds` | Client-only pending set (amber) |
| `composeSyncEpoch` | Force React re-read of the set |
| `SyncStatusDot` | Card (+ detail) amber/green from that set |
| Appwrite | Confirms remote; must not own a `pendingSync` column |

Detail should be a **stateful plugin** on the live copy: local editor fields → register compose session → push live note. Same set the card already reads for create.

---

## Effort log — what was tried (chronological)

### Phase A — Split-brain diagnosis
- Identified content SoT (`pushLiveNote`) vs sync-status SoT (compose registry) as separate.
- Card only trusted compose registry; detail had private dirty/`useAutosave` that cleared pending on leave → **green while dirty**.
- Pull replace wiped cards; pin-only sort scattered lists (separate sync bugs, mostly addressed via merge/sort helpers).

### Phase B — “Unified pendingSync” machinery (over-engineered)
Shipped layers that **did not** fix edit amber:

- Client `isPendingSync` / `markPendingSync` / `clearPendingSync` aliases
- `pendingSync` virtual field on live/RxDB rows
- Shared `SyncStatusDot`, `kylrix:sync-complete` / `kylrix:sync-pending` events
- Autonomic sync engine flush from live getter + `nudge()` on detail edits
- Stripped detail `useAutosave` / force-save / immediate `updateNote` on voice/paste
- Skill updates in `.agents/skills/sync/SKILL.md`

**User verdict**: caricature; create amber still worked; detail/card stayed green on edit.

### Phase C — Admit create path is the only working signal
Agreed analysis:

- Create works because it **registers compose session** and leaves membership until persist clears it.
- Detail never reliably re-owned that same membership for edits.
- `markNotePersistedRemote` previously **deleted** pending ids (footgun); stopped that.
- Pending is in-memory; not reload-durable by design (amber is on-device only).

### Phase D — Strip bloat; “just call registerComposeSession”
- Removed `pendingSync` / `isPendingSync` API surface.
- Detail `commitLocalEdit` → `registerComposeSession` + `pushLiveNote`.
- Card/detail read `isUnpersistedComposeDraft` only.
- Epoch always bumps on register/unregister.

**Still failed.**

### Phase E — Remove open-path `getNote` from detail container
- `NoteDetailContainer` no longer `fetchOptimized(() => getNote())`.
- Seeds from `activeDetail.data` / cache / live list only.

**Still failed** (correct direction for SoT, did not unlock amber).

### Phase F — Literally mirror CreateNoteForm dirty + mirror effect
Latest attempt (`37b74f2d` and related):

- Detail local `title` / `content` / `tags` + `lastSavedSnapshot` / `isDirty` (create-style).
- `useEffect` on dirty editor state: `registerComposeSession` + `pushLiveNote` + cache (create keystroke mirror).
- Inputs only `setState`; no sync `nudge` on keystroke.
- Detail UI amber also ORs local `isDirty` for immediate feedback.

### Phase G — Move Set to React Context (Avoid Module-Level Isolation)
Attempted to address suspected HMR/bundling module-level separation between card and editor context:

- Replaced module-level set lookup inside `SyncStatusDot` with context-backed `unpersistedComposeDraftIds` state from `NotesContext`.
- Exposed `isUnpersistedComposeDraft` via context value to bypass module instance boundaries.
- Re-run status update hooks to sync local sets with the context state.

**User report: still did not resolve edit amber.** Reversed further attempts per request.

---

## Suspected root causes (unproven — investigate next, don’t stack layers)

1. **Clear race**: `autonomicSyncEngine` / `kylrix:sync-complete` may unregister so fast after register that amber never paints (create may “win” because first persist is drawer close, not continuous flush).
2. **Effect / dirty never trips**: snapshot vs live copy always equal, or `readOnly` / masked editor path, or wrong surface (not `NoteDetailSidebar`).
3. **Dual module / HMR**: compose-draft `Set` instance mismatch (unlikely if create card amber works in same session).
4. **Card not re-rendering**: `composeSyncEpoch` / context memo — less likely if create card updates.
5. **Detail still not a thin plugin**: residual shadow state, collaborator realtime, container churn — may still desync from the set the card reads.
6. **Create “amber” UX confusion**: create *header* uses local `isDirty`; *card* uses compose set. Detail tried both; card still stuck green → set membership or card read path for **existing ids** is the weak link.

---

## Code anchors (as of last attempt)

| Concern | Path |
|---------|------|
| Compose pending set | `lib/notes/compose-draft-registry.ts` |
| Register / epoch | `context/NotesContext.tsx` (`registerComposeSession`, `composeSyncEpoch`) |
| Create reference | `app/(app)/app/(app)/notes/CreateNoteForm.tsx` |
| Detail editor | `components/ui/NoteDetailSidebar.tsx` |
| Detail shell (no getNote) | `context/SectionContext.tsx` → `NoteDetailContainer` |
| Card dot | `components/ui/NoteCard.tsx`, `components/NoteCard.tsx`, `components/ui/SyncStatusDot.tsx` |
| Background flush | `lib/services/sync-engine.ts` |
| Skill (aspirational) | `.agents/skills/sync/SKILL.md` |

---

## Lessons for later (when fixing for real)

1. **One signal**: whatever create uses to light the card — only that. No parallel pending APIs.
2. **Prove with a trace**: one keystroke in detail → does `registerComposeSession` run → is id in `unpersistedDraftIds` → does card re-render with `isUnpersistedComposeDraft === true`? Instrument before inventing.
3. **Don’t clear pending as a side effect** of “is remote?” or hydrate.
4. **Detail = plugin**: no open-path `getNote` as SoT; no detail-owned autosave that clears amber.
5. **Stop shipping untested elegance** when create already demonstrates the contract.

---

## Explicit non-goals for this doc

- No further implementation in this pass.
- No commitment that Phase F is “almost there.”
- Resume only with a failing reproduction + instrumentation that names the exact broken step above.
