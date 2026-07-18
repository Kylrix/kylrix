---
name: sync
description: >-
  Canonical offline-first local-copy sync for Kylrix. Live copy = UI content SoT;
  autonomic sync engine pending queue (RxDB) = amber/green SoT; Appwrite confirms
  and replenishes. Use when wiring notes or porting goals, vault, projects, forms,
  tasks, events to the same offline-first pattern — including guest/no-account use.
---

# Sync (Offline-First Local Copy ↔ Appwrite)

**Canonical skill** for suite-wide offline-first sync. Notes/Ideas are the reference implementation; every other object type must follow the same contract.

| Companion | Purpose |
|-----------|---------|
| [journey.md](./journey.md) | Full history: failed layers → scorched-earth resolution (read before reinventing) |
| [porting.md](./porting.md) | Object-agnostic checklist to add offline-first to goals, vault, projects, etc. |

Related substrate only: `rxdb-appwrite-sync` (IndexedDB/RxDB mechanics). **Do not** invent a second pending model from that skill — follow **this** skill first.

---

## Code anchors (current system)

| Piece | Path |
|-------|------|
| **Pending queue SoT** (`markPending` / `isPending` / `ack` / `runCycle`) | `lib/services/sync-engine.ts` |
| Pending queue persistence | RxDB `cache` id `kylrix:sync:pending-queue` (IndexedDB; survives browser close) |
| Live-copy getter for flush payloads | `lib/sync/pending-sync-bridge.ts` |
| Merge / sort / soft-pull | `lib/sync/local-copy-sync.ts` |
| Amber/green UI (engine only) | `components/ui/SyncStatusDot.tsx` |
| Live content upsert + enqueue | `context/NotesContext.tsx` → `pushLiveNote` |
| Compose **lifecycle** (create drawer; not the dot) | `lib/notes/compose-draft-registry.ts`, `registerComposeSession` / `unregisterComposeSession` |
| Flush field picker (no pending flags) | `pickNoteAutosavePayload` in `lib/appwrite/note.ts` |
| Reference create path | `app/(app)/app/(app)/notes/CreateNoteForm.tsx` |
| Reference detail plugin | `components/ui/NoteDetailSidebar.tsx` |
| Detail shell (no open-path `getNote` as SoT) | `context/SectionContext.tsx` → `NoteDetailContainer` |

---

## Intent (non-negotiable)

1. UI talks **only** to the **live/local copy** for content (context list + RxDB/cache).
2. **Amber/green** talks **only** to the **sync engine pending queue** (same authority that flushes).
3. Appwrite **feeds and confirms** — never owns a `pendingSync` / dirty column.
4. Push and pull are **upserts by id** — never replace-the-list, never discard-the-card-because-uploaded.
5. Works for **signed-in and guest / no-account** users: RxDB + engine queue are device-local; guest payloads may stay local or use ghost paths, but the **same** pending/live contracts apply.
6. Background sync is **autonomic** (activity intensity), not random full reloads.

---

## Dual authority (strict)

| Layer | Authority for | Storage |
|-------|---------------|---------|
| **Live / local copy** | On-device **content** (cards, detail, composers) | React context + RxDB/cache (`note_${id}`, etc.) |
| **Engine pending queue** | On-device **amber/green** (unflushed work this device owes) | In-memory `Map` + RxDB cache key `kylrix:sync:pending-queue` |
| **Appwrite** | Remote confirm + replenish | TablesDB — **no** pending fields in payloads |

- Detail = **stateful plugin** on live copy: edits → `pushLive*` (content) → engine `markPending` (dot).
- Card/list = **projection** of live copy + `SyncStatusDot(noteId)` (engine subscribe).
- Compose registry = **create/drawer lifecycle** only. It must **not** drive the dot and must **not** call `ack` (that wiped concurrent edits after `sync-complete`).

---

## Pending API (engine — use these names)

| Call | Meaning |
|------|---------|
| `autonomicSyncEngine.markPending(id, revision)` | This device owes a flush for this live revision → amber |
| `autonomicSyncEngine.isPending(id)` | Dot / label read path |
| `autonomicSyncEngine.subscribe(listener)` | `useSyncExternalStore` for dots |
| `autonomicSyncEngine.ack(id, flushedRevision?)` | Remote confirmed (or explicit remote save already wrote). If `flushedRevision` ≠ queued, **stay amber** |
| `autonomicSyncEngine.runCycle()` | Flush pending ids via live getter → `pick*AutosavePayload` → create/update |
| `autonomicSyncEngine.nudge()` | Reschedule autonomic flush |

**Events:** `kylrix:sync-complete` (compose cleanup / snapshot align — **not** a second ack that deletes a newer pending rev); `kylrix:sync-pending` (concurrent edit re-queue).

**Deprecated theater (do not revive):** `setNoteDirty` / `isNoteDirty`, detail-local dirty as dot SoT, `isPendingSync` aliases, Appwrite `pendingSync` columns, `SyncStatusDot` reading compose sets, `unregisterComposeSession` → `ack`.

---

## Edit → flush contract (notes reference)

```
keystroke / mutate
  → pushLiveNote(draft)           // live content SoT; default options.pending !== false → markPending
  → registerComposeSession(id)    // create lifecycle only (optional for detail)
  → setCachedData(`note_${id}`)   // RxDB body survives close

engine runCycle
  → getLiveNoteForSync(id) || RxDB cache
  → pickNoteAutosavePayload only  // never pending flags
  → createNote | updateNote
  → if live rev moved on: re-queue + sync-pending
  → else: ack(id, flushRevision) + sync-complete

explicit remote save already succeeded (create drawer / agent tools)
  → pushLiveNote(row, { pending: false })
  → autonomicSyncEngine.ack(id)
```

Ephemeral ids (`live-*`, `ghost-*`): `isPending` stays true until they become real or are discarded + `ack`.

---

## Detail must not own saves

| Do | Do not |
|----|--------|
| Dirty mirror → `pushLiveNote` (+ compose register for lifecycle) | Detail `useAutosave` / `forceSave` / immediate `updateNote` on keystroke |
| Leave amber when user closes detail | Clear pending on unmount / “Saving…” |
| Share `SyncStatusDot` (engine) | Local `isDirty` as the card’s amber source |
| Engine create-or-update from live copy | Race detail autosave vs engine with different payloads |
| No open-path `getNote` as SoT in detail shell | Fetch that overwrites newer live copy |

---

## Core sync rules (all objects)

1. **Separation:** edits update live copy sync; remote writes are engine-scheduled.
2. **Autonomic cadence:** high intensity → shorter push interval; soft pull via `shouldSoftPull` + visibility.
3. **Upsert merge:** `mergeServerPageWithLocalCopy` — local-only ids **kept**; remove only on explicit delete.
4. **Push confirms:** does not discard the card; `ack` clears amber only.
5. **Order:** `sortPinnedThenCreatedAt`.
6. **Auth / cold start:** hydrate RxDB before network; clear live list only on confirmed logout; failed pull must not wipe.
7. **Offline / guest:** bodies + pending queue in RxDB; no account required for local durability. Flush when network + identity allow; until then amber stays honest.

---

## Quick port (see porting.md)

1. Live context + `pushLiveT` that enqueues engine pending (or shared multi-type queue).
2. RxDB cache body + pending map durability.
3. Detail plugin only; shared `SyncStatusDot`.
4. Engine cycle: getter → strip payload → create/update → ack / re-queue.
5. Pulls: merge helper; never `setList(serverPage)`.

---

## Quick test matrix

- Edit detail → amber on **card and detail**; green only after flush or explicit remote `ack`.
- Reload / **close browser** → body in RxDB + pending queue still amber until flush.
- Close detail while amber → card stays amber; engine still flushes.
- Type during in-flight flush → stays amber until **latest** rev confirmed.
- Create drawer save → `pending: false` + `ack`; no false re-amber.
- Guest/no-account → local RxDB still holds body + queue.
- Soft pull / pin order / explicit delete behave as merge rules above.

---

## Do not reintroduce (see journey.md)

Wipe-after-sync, detail-vs-card split brain, green-while-dirty theater, pending cleared by “is remote?” reads, sessionStorage-only pending (breaks offline), `unregisterComposeSession` calling `ack`, Appwrite pending columns, parallel dirty APIs, open-path network as SoT.
