# Sync journey — how the current system was earned

Read this before adding “one more elegant layer.” Notes/Ideas amber was the proving ground; almost every intermediate design **looked** unified and still failed. The system that works is documented in [SKILL.md](./SKILL.md).

**Symptom that drove the work:** create-idea drawer correctly drove **amber** on the card while unsynced; editing an existing note in **detail** stayed **green / “Saved”** while typing — or later remounted green while Appwrite never got the edit.

**Product meaning of amber:** this **device** has unflushed local work. Not cross-device. Green = engine no longer owes a flush for that id (or explicit remote save already `ack`’d).

---

## Phase A — Split-brain diagnosis

- Content SoT (`pushLiveNote`) and sync-status SoT (compose registry / detail dirty) were separate.
- Card trusted compose membership; detail had private dirty + `useAutosave` that cleared pending on leave → **green while dirty**.
- Pulls that `setList(serverPage)` wiped cards not on page 1; pin-only sort scattered lists (addressed via `mergeServerPageWithLocalCopy` / `sortPinnedThenCreatedAt`).

---

## Phase B — “Unified pendingSync” machinery (over-engineered)

Shipped layers that did **not** fix edit amber:

- Client `isPendingSync` / `markPendingSync` / `clearPendingSync` aliases
- Virtual `pendingSync` on live/RxDB rows
- Shared `SyncStatusDot`, `kylrix:sync-complete` / `kylrix:sync-pending`
- Autonomic engine flush + `nudge()` on detail edits
- Stripped detail `useAutosave` / force-save / immediate `updateNote` on voice/paste

**Verdict:** caricature. Create amber still worked; detail/card stayed green on edit.

---

## Phase C — Admit create path is the only working signal

- Create worked because it **registered compose session** and left membership until persist cleared it.
- Detail never reliably re-owned that same membership for edits.
- `markNotePersistedRemote` previously **deleted** pending ids (footgun) — stopped.
- Pending was in-memory only (not reload-durable yet).

---

## Phase D — Strip bloat; “just call registerComposeSession”

- Removed `pendingSync` API surface.
- Detail `commitLocalEdit` → `registerComposeSession` + `pushLiveNote`.
- Card/detail read `isUnpersistedComposeDraft` only; epoch bumps on register/unregister.

**Still failed.**

---

## Phase E — Remove open-path `getNote` from detail container

- `NoteDetailContainer` stopped `fetchOptimized(() => getNote())`.
- Seeds from `activeDetail.data` / cache / live list only.

**Correct for content SoT; did not unlock amber.**

---

## Phase F — Mirror CreateNoteForm dirty + effect

- Detail local `title` / `content` / `tags` + `lastSavedSnapshot` / `isDirty`.
- Effect on dirty: `registerComposeSession` + `pushLiveNote` + cache.
- Detail UI ORed local `isDirty` for immediate feedback (theater for the label).

**Still unreliable for card amber / remount trust.**

---

## Phase G — Move Set into React Context

- Suspected HMR/module isolation of compose `Set`.
- Context-backed `unpersistedComposeDraftIds` + `isUnpersistedComposeDraft` on `NotesContext`.

**Did not fix the product failure.**

---

## Phase H — Direct `setNoteDirty` / `isNoteDirty` channel

- Parallel `dirtyNoteIds` in context; card dots consumed `isNoteDirty`.
- User: still broken. Reverted. Ceased stacking theater APIs.

---

## Scorched earth (what finally worked)

**Dot SoT = sync engine pending queue**, not compose set, not React dirty maps.

| Decision | Why |
|----------|-----|
| `pushLiveNote` → `markPending(id, revision)` | Same path that mutates content enqueues flush debt |
| `SyncStatusDot` → `useSyncExternalStore` → `isPending` only | One signal cards and detail share |
| Flush payload = `pickNoteAutosavePayload` only | Pending never pollutes Appwrite |
| Concurrent edit: compare live rev vs flushed rev | Stay amber / re-queue; don’t ack stale |
| `unregisterComposeSession` must **not** `ack` | Sync-complete + unregister was wiping a newer pending rev |
| Explicit remote save: `pushLiveNote(..., { pending: false })` + `ack` | Avoid false amber after create already wrote |
| Pending persistence: **RxDB cache** (not `sessionStorage`) | True offline / close-browser; guest-safe device store |
| One-time migrate from `sessionStorage` | Don’t strand users mid-upgrade |

Content already lived in live copy + RxDB. The bug class was **lying about sync status** (and briefly parking the queue in sessionStorage so close-browser dropped flush debt while bodies survived).

---

## Lessons (permanent)

1. **One signal for the dot** — whatever flushes must own amber/green. Parallel dirty APIs fail.
2. **Prove with a trace** before inventing layers: keystroke → enqueue → card `isPending` → flush → `ack`.
3. **Don’t clear pending as a side effect** of hydrate, “is remote?”, unmount, or compose unregister.
4. **Detail = plugin** — no open-path network as SoT; no detail-owned autosave that clears amber.
5. **Storage for pending = same durability class as offline bodies** (RxDB/IndexedDB), not tab session.
6. **Stop shipping untested elegance** when a working create path already demonstrates half the contract — finish by aligning edit to the **engine**, not by cloning create’s compose set into three places.
7. **Guest / no-account** users still get RxDB durability; identity only gates which remote write path runs.

---

## Historical doc

Longer symptom dump (may lag code): `cache/amber/README.md`. Prefer this journey + [SKILL.md](./SKILL.md) as agent truth.
