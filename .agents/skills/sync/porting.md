# Porting offline-first sync to other objects

Use this when adding goals, vault rows, projects, forms, tasks, events, or any new table to the same offline-first model as notes. Contract lives in [SKILL.md](./SKILL.md); failures to avoid live in [journey.md](./journey.md).

---

## Mental model (copy this, don’t invent)

```
┌─────────────────────┐     ┌──────────────────────────┐
│ Live copy (context) │────▶│ Engine pending queue     │
│ = content SoT       │     │ = amber/green SoT        │
│ RxDB body cache     │     │ RxDB: pending-queue map  │
└─────────┬───────────┘     └────────────┬─────────────┘
          │ pushLiveT                    │ markPending / ack
          │                              │ runCycle flush
          ▼                              ▼
     UI cards / detail              Appwrite create/update
     SyncStatusDot(id)              (payload: pick* only)
```

**Guest / no-account:** same diagram. No Appwrite session → bodies + pending stay on device; flush when identity/network allow. Do not require login to keep local durability.

---

## Checklist per object type `T`

### 1. Live copy context

- [ ] List state in a React context (or shared nexus slice).
- [ ] `upsertT` / `pushLiveT(row, { pending?: boolean })`.
- [ ] Default `pending !== false` → engine `markPending(id, revision)`.
- [ ] After **already-successful** remote write → `pushLiveT(row, { pending: false })` + `ack(id)`.
- [ ] Register a live getter for the engine: `getLiveTForSync(id)` (mirror `pending-sync-bridge`).

### 2. Durable body cache

- [ ] On every live push: RxDB/cache upsert `t_${id}` (or suite convention).
- [ ] Engine flush falls back to cache if memory miss (offline reopen).
- [ ] Never treat Appwrite GET as SoT over a newer cache/live row on open.

### 3. Pending queue (shared engine preferred)

**Preferred:** extend `autonomicSyncEngine` to a **typed** pending map (`resourceType:id` → revision) and one `runCycle` that dispatches by type.

**Acceptable short term:** notes-only queue if `T` piggybacks the same `markPending`/`ack` with namespaced ids (`goal:${id}`) **and** flush knows how to load + write that type.

- [ ] Persist queue in RxDB cache (same durability as bodies).
- [ ] `isPending` / `subscribe` for UI.
- [ ] Concurrent flush: if live revision ≠ flushed revision → re-queue, do not ack.
- [ ] Failed network → stay pending (amber honest).

### 4. UI surfaces

- [ ] Card/list: `<SyncStatusDot noteId={…} />` or generalize to `resourceId` once engine is multi-type.
- [ ] Detail: stateful plugin — local fields → `pushLiveT` on dirty; **no** detail-owned autosave to Appwrite.
- [ ] Detail shell: seed from live/cache/activeDetail data — **no** open-path `getT()` overwrite.
- [ ] Do **not** drive dots from compose sets, local `isDirty`, or context dirty maps.

### 5. Compose / create drawer (if any)

- [ ] Create lifecycle registry separate from engine pending (notes: `registerComposeSession`).
- [ ] Unregister must **not** call `ack`.
- [ ] Empty discard: remove live row + `ack` so amber dies with the abandoned draft.

### 6. Pull / realtime / order

- [ ] Every page pull → `mergeServerPageWithLocalCopy` (or typed equivalent).
- [ ] Realtime: upsert/delete by id with live-edit guards.
- [ ] Soft pull: `shouldSoftPull` + activity intensity + visibility.
- [ ] Sort: pinned then newest created (or object-specific stable rule).
- [ ] Clear live list only on confirmed logout.

### 7. Payload hygiene

- [ ] `pickTAutosavePayload` / strip list — block UI-only and pending fields.
- [ ] Never add Appwrite columns for sync status.

### 8. Guest path

- [ ] Local create ids may be ephemeral (`live-*` / `ghost-*`); `isPending` true until real id or discard.
- [ ] Ghost/localStorage paths (if any) still enqueue/ack through the engine when they represent “owes sync.”

---

## Minimal code sketch (new type)

```ts
// push
upsertT(stamped);
if (options?.pending !== false) {
  autonomicSyncEngine.markPending(namespacedId(stamped.$id), stamped.updatedAt);
}

// flush slice inside runCycle
const row = getLiveTForSync(id) ?? await readCache(`t_${id}`);
const payload = pickTAutosavePayload(row);
await updateT(id, payload); // or createT
// then ack or re-queue by revision compare
```

```tsx
// card + detail
<SyncStatusDot noteId={row.$id} />  {/* evolve prop name when multi-type */}
```

---

## Anti-patterns (will regress)

| Anti-pattern | Result |
|--------------|--------|
| Detail `useAutosave` clears “saved” locally | Green while engine still owes flush |
| `setList(serverPage)` | Cards vanish after sync |
| Pending in `sessionStorage` only | Close browser → body in RxDB, no flush debt |
| `unregisterCompose*` → `ack` | Wipes concurrent edit pending |
| Appwrite `pendingSync` column | Payload pollution; trust lies |
| Parallel `setDirty` API for dots | Theater; remount lies |
| Open-path `getT` as detail SoT | Overwrites offline edits |

---

## Verification matrix (per object)

1. Edit in detail → amber on card + detail immediately.
2. Wait for engine (or go offline) → stays amber; body still in UI/RxDB.
3. Close browser, reopen → amber + body restored; flush when online.
4. Explicit save path that already wrote remote → green without double-amber.
5. Soft pull does not wipe local-only / newer local rows.
6. Guest session: no account → still durable locally.
