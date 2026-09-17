---
name: sync
description: >-
  Canonical offline-first local-copy sync for Kylrix. Live copy = UI content SoT;
  autonomic sync engine pending queue (RxDB) = amber/green SoT; Appwrite confirms
  and replenishes. Detailed reference for the RxDB engine, LocalEngine substrate,
  Autonomic Sync Engine, and local copy merge reconciliation across the suite.
---

# Sync (Offline-First Local Copy ↔ RxDB Engine ↔ Appwrite)

**Canonical skill** for suite-wide offline-first sync in Kylrix.
Every object type in the suite (Notes/Ideas, Goals/Tasks, Events, Forms, Tags) adheres strictly to this contract. Invariants without paths: `architecture.local-first`.

---

## Code Anchors (Current System)

| Piece | Path | Description |
|-------|------|-------------|
| **Autonomic Sync Engine** | `lib/services/sync-engine.ts` | Demand-driven, forward-reactive sync engine with coalesced flushing and pre-warmed JWTs. |
| **RxDB Database Manager** | `lib/webrtc/RxDBManager.ts` | IndexedDB/Dexie RxDB database (`kylrix_nexus_db_v3`) holding offline collections and cache outbox. |
| **LocalEngine Substrate** | `lib/services/LocalEngine.ts` | Unified storage substrate handling tombstones, baseline diffing, write tiers, and Appwrite gateway. |
| **Local Copy Sync Primitives** | `lib/sync/local-copy-sync.ts` | Object-agnostic page merging (`mergeServerPageWithLocalCopy`), soft-pull gating (`shouldSoftPull`), and escape hatches. |
| **Live Content Bridge** | `lib/sync/pending-sync-bridge.ts` | Live-copy getters (`getLiveNoteForSync`, `getLiveGoalForSync`, `getLiveEventForSync`) used during flush cycles. |
| **Goal Key Utilities** | `lib/sync/goal-keys.ts` | Namespacing helpers (`goalPendingKey`, `parseGoalPendingKey`). |
| **UI Sync Indicators** | `components/ui/SyncStatusDot.tsx` | UI component subscribing to `autonomicSyncEngine` to display amber (pending) or green (synced). |

---

## Suite Core Invariants & Architecture

1. **Local Copy as Single Source of Truth**: The UI reads and writes **exclusively** to the **live/local copy** (React contexts + RxDB/LocalEngine cache). UI operations never block on network roundtrips.
2. **RxDB as On-Device Persistent Substrate**: Offline collections (`notes`, `tasks`, `forms`, `events`, `tags`, `cache`) persist locally in IndexedDB via Dexie. Local edits survive browser closes, app crashes, and offline states.
3. **Demand-Driven Autonomic Sync Engine**: All CRUD operations mutate the local copy instantly (0ms), register pending status via `markPending`, and schedule a demand flush. There is **no fixed-interval background polling** for pushing edits.
4. **Amber / Green State Authority**: The amber/green status (unflushed vs confirmed) is driven strictly by `autonomicSyncEngine`'s pending queue. Remote database payloads never hold `pendingSync` or dirty columns.
5. **Appwrite as Remote Destination & Replenisher**: Appwrite confirms pushed local changes and replenishes local state via Realtime events and soft pulls. Appwrite never overrides un-flushed local changes.
6. **Guest & Signed-In Parity**: Guest/unauthenticated changes stay in the local RxDB cache until claimed upon account registration/login, using the exact same pending queue contracts.

---

## Dual Authority Structure

| Layer | Role & Authority | Physical Storage |
|-------|------------------|------------------|
| **Live / Local Copy** | On-device UI content (cards, detail panels, list views) | React context state + RxDB cache (`note_[id]`, `goal_[id]`, etc.) |
| **Engine Pending Queue** | Amber/Green status (work this device owes upstream) | In-memory `pendingById` Map + RxDB `cache` collection key `kylrix:sync:pending-queue` |
| **LocalEngine Baseline** | Baseline snapshots for no-op diff suppression | Window memory `__kylrix_baseline_[id]` + RxDB `cache` |
| **Local Tombstones** | Deletion registry preventing item resuscitation | In-memory `Set` + `localStorage` (`f_deleted_ids_[userId]`) + RxDB `cache` |
| **Appwrite Remote DB** | Remote confirmation, long-term persistence & cross-device replenishment | Appwrite Database Tables — **no** dirty/pending columns |

---

## RxDB Engine Architecture (`RxDBManager.ts`)

### Database Instance & Collections
- **Database Name**: `kylrix_nexus_db_v3` using Dexie storage (`getRxStorageDexie()`).
- **Plugins Loaded**: `RxDBcrdtPlugin`, `RxDBCleanupPlugin`, `RxDBQueryBuilderPlugin`, `RxDBLeaderElectionPlugin`.
- **Collections**:
  - `notes`: Note documents with CRDT support (`getCRDTSchemaPart()`) indexed on `userId` and `['userId', 'updatedAt']`.
  - `tasks`: Goal/Task documents indexed on `userId`, `projectId`, and `['userId', 'projectId']`.
  - `forms`: Form schema definitions and configurations.
  - `events`: Event calendar documents.
  - `tags`: Local tag documents with color mapping.
  - `cache`: Generic key-value store (`id`, `data`, `timestamp`) for outbox queues, payloads, tombstones, and transient engine state.

### Outbox Cache Keys in RxDB `cache`
- `kylrix:sync:pending-queue`: Maps item ID / pending key to queued revision string (`Record<string, string>`).
- `kylrix:sync:pending-payloads`: Stores full item payload objects for offline flush operations (`Record<string, any>`).
- `f_deleted_ids_[userId]`: Array of tombstones for locally deleted items.

### Fault Tolerance & Migration
- **Schema Mismatch Protection**: If an RxDB schema mismatch or Dexie DB6 error occurs, `getRxDB()` automatically catches the error, safely purges outdated partition databases (`removeDatabaseSafely`), and initializes a fresh database instance without crashing the client.
- **LocalStorage Migration**: `migrateLocalStorageToRxDB()` migrates legacy `k_nexus_*`, `kylrix_flow_draft_*`, and `kylrix_connect_cached_*` localStorage items into the RxDB `cache` collection on startup.

---

## Autonomic Sync Engine (`sync-engine.ts`)

### Pending Key Namespacing Rules
To prevent collision across entity types in the shared pending queue:
- **Notes / Ideas**: Bare ID (`[id]`)
- **Goals / Tasks**: `goal:[id]` (managed via `goalPendingKey(id)` / `parseGoalPendingKey(key)`)
- **Events**: `event:[id]`
- **Forms**: `form:[id]`
- **Tags**: `tag:[id]`

### Baseline Snapshot Diffing
Before marking an item as pending, `markPending()` checks:
1. If the item ID is ephemeral (`live-*` or `thread-*`), it is **always** queued as pending.
2. If `LocalEngine.hasBaseline(id)` is true, `LocalEngine.hasObjectDiff(id, payload)` compares the current payload with its baseline snapshot. If there are no structural differences, the `markPending` call is suppressed as a no-op to prevent unnecessary network writes.
3. If no baseline exists (first create), `hasObjectDiff` returns `true` and enqueue proceeds.

### Pre-Warmed Authentication JWTs
To eliminate 100–300ms latency per row during bulk flushes:
- `getPrewarmedJwt()` maintains a pre-warmed Appwrite JWT in memory (`cachedJwt`).
- Refreshes automatically every 13.5 minutes (14-minute JWT lifespan).
- Pre-warms immediately on page load, window `focus`, and network `online` events.
- Batched sync execution uses this pre-warmed token for all flush requests in a cycle.

### Adaptive Flush Cadence & Timing
- **Typing Debounce (`FLUSH_TYPING_DEBOUNCE_MS = 1500ms`)**: While active typing or input keystrokes occur, demand flushes are debounced by 1500ms to avoid database write storms per keystroke.
- **Discrete Flush (`FLUSH_DISCRETE_MS = 0ms`)**: Discrete actions (detail view close, form submit, modal blur, unmount) trigger an immediate 0ms microtask flush (`autonomicSyncEngine.nudge(true)`).
- **Hard Ceiling (`HARD_CEILING_MS = 1000ms`)**: If unflushed changes have been pending for 1000ms or more, a demand flush is forced immediately.
- **Exponential Backoff (`RETRY_BASE_MS = 500ms`, `RETRY_MAX_MS = 15000ms`)**: Failed sync attempts trigger retries using exponential backoff ($500ms \times 1.4^{\text{failedCount}}$) capped at 15s.
- **Page Unload / Hide**: `beforeunload`, `pagehide`, and `visibilitychange` (to `hidden`) invoke `autonomicSyncEngine.flushImmediately()`, writing pending queues to IndexedDB and executing an immediate flush.

### Plan Tier & Isolation Logic in `runCycle()`
1. **Unauthenticated / Guest Users**: Payloads remain in RxDB cache locally and stay pending (amber) until the user logs in or claims the session.
2. **Free Plan Users (Kylrix Cloud)**: Cloud database sync is skipped; `autonomicSyncEngine.ack(id)` acknowledges pending items locally so free users enjoy a full offline-first green experience without server DB overhead.
3. **Paid Plan Users**: `runCycle()` executes parallel bulk flushes via `Promise.allSettled`.

### Concurrent Edits & Re-queueing Strategy
When `runCycle()` pushes an item to Appwrite:
1. `flushNotePending` / `flushGoalPending` captures `flushRevision`.
2. After remote write completes, the engine inspects `pendingById.get(id)`.
3. If a newer revision arrived while the flush was in-flight (`queuedAfter !== flushRevision`), the item is **re-queued**, stays amber, and dispatches `kylrix:sync-pending`.
4. If revisions match, `autonomicSyncEngine.ack(id, flushRevision)` is called, clearing amber, setting baseline snapshots, and dispatching `kylrix:sync-complete`.

---

## LocalEngine Substrate (`LocalEngine.ts`)

`LocalEngine` is the universal storage substrate providing baseline tracking, tombstone management, optimistic write helpers, and a unified Appwrite gateway.

### Tombstone Lifecycle (`markDeleted`, `isDeleted`, `unmarkDeleted`)
When an item is deleted locally:
1. `LocalEngine.markDeleted(id, userId)` adds the ID to an in-memory `Set`, persists it in `localStorage` (`f_deleted_ids_[userId]`), and upserts it into RxDB `cache`.
2. `autonomicSyncEngine.cancelPending(id)` is immediately invoked to cancel any pending creates/updates for that item.
3. `LocalEngine.clearBaseline(id)` removes baseline snapshots.
4. Caches (`local:note:[id]`, `local:goal:[id]`, list caches, RxDB collections) are purged synchronously.
5. Custom event `kylrix:nexus:delete` is dispatched globally.
6. Tombstones prevent soft pulls, background refreshes, or Realtime messages from resuscitating deleted items.

### Baseline Snapshots (`snapshotBaseline`, `hasObjectDiff`, `clearBaseline`)
- `pickComparablePayload` extracts comparable fields: `title`, `content`, `description`, `tags`, `labels`, `status`, `priority`, `isPublic`, `isGuest`, `dueDate`.
- `snapshotBaseline(id, payload)` stores a JSON string snapshot in `window.__kylrix_baseline_[id]`.
- `hasObjectDiff(id, payload)` compares current normalized payload with baseline JSON. Returns `true` if different or if baseline is missing.

### Write Tier Primitives
- `instantWrite<T>(cacheKey, data, mutator)`: Writes to local RxDB cache immediately (0ms), dispatches `kylrix:nexus:update`, and fires background Appwrite sync.
- `lazyWrite<T>(cacheKey, data, mutator)`: Writes to local RxDB cache immediately, dispatches `kylrix:nexus:update`, and debounces Appwrite sync by 800ms.
- `batchedWrite<T>(cacheKey, data, mutator)`: Writes to local RxDB cache immediately; queues mutator into a batch flushed every 2000ms or when batch size reaches 10 items.

---

## Local Copy Merge Reconciliation (`local-copy-sync.ts`)

### `mergeServerPageWithLocalCopy`
When background soft pulls or Realtime sync fetch remote rows, `mergeServerPageWithLocalCopy` reconciles remote rows with the local copy:

```ts
export function mergeServerPageWithLocalCopy<T extends SyncableRow>(params: {
  serverBatch: T[];
  localNotes: T[];
  guards?: Map<string, LiveEditGuardLike>;
  applyGuard?: (serverRow: T, guard: LiveEditGuardLike) => T;
  normalize?: (row: T) => T;
  deletedIds?: Set<string>;
}): T[]
```

**Reconciliation Rules**:
1. **Tombstone Filtering**: Any remote or local row present in `deletedIds` or `LocalEngine.isDeleted(id)`, or with `isTrash: true` / `isDeleted: true`, is discarded.
2. **Conflict Resolution**:
   - If a live edit guard exists, `applyGuard` is executed.
   - If local row `updatedAt` / `$updatedAt` is newer than server row, local copy **strictly wins** and local fields are preserved.
   - Otherwise, remote server fields merge into local row.
3. **Preservation of Local-Only Rows**: Local rows not present in the remote server page (pending local creations, drafts, or items outside the current remote page window) are **strictly kept** to prevent list wipeouts.

### Soft-Pull Gating (`shouldSoftPull`)
Soft pulls run via `shouldSoftPull` without fixed polling intervals:
- **Active / Visible Window**: 30-second interval (`SYNC_PULL_ACTIVE_MS = 30000ms`).
- **Idle / Hidden Window**: 120-second interval (`SYNC_PULL_IDLE_MS = 120000ms`).
- **Minimum Gap Constraint**: Soft pulls are blocked if less than 15 seconds have elapsed since `lastPullAt` (`SYNC_PULL_MIN_GAP_MS = 15000ms`).

### Rate-Limited Empty Escape Hatch (`shouldRunEmptyEscapeHatch`)
If local copy returns empty for a specific entity type, a rate-limited escape hatch allows a single remote fetch to populate local copy.
- Key format: `kylrix_empty_escape_[dataType]_[userId]` stored in `sessionStorage`.
- Throttled to once every 24 hours per session (`ONE_DAY_MS`).

---

## Custom Window Event Bus

The sync ecosystem communicates status across components via custom window events:

| Event Name | Detail Payload | Description |
|------------|----------------|-------------|
| `kylrix:sync-complete` | `{ noteId, goalId, eventId, formId, revision, kind }` | Dispatched when an item flush completes successfully and amber status clears. |
| `kylrix:sync-pending` | `{ noteId, goalId, kind }` | Dispatched when an item is re-queued due to concurrent user edits during flush. |
| `kylrix:nexus:update` | `{ key, data }` | Dispatched when local cache or LocalEngine updates an object. |
| `kylrix:nexus:delete` | `{ key, id, userId }` | Dispatched when an object is locally deleted / tombstoned. |
| `kylrix:nexus:restore` | `{ id, userId }` | Dispatched when a tombstoned object is restored. |

---

## Edit → Flush Contract Execution Flow

```
User Action (Keystroke / Mutate)
  │
  ├──> Local Copy Update (0ms UI render)
  │      `pushLiveNote(draft)` / `pushLiveGoal(task)`
  │
  ├──> Baseline Snapshot Check
  │      `LocalEngine.hasObjectDiff(id, payload)`
  │      If no diff vs baseline ──> Skip enqueue (no-op)
  │
  └──> Enqueue Pending Revision
         `autonomicSyncEngine.markPending(id, revision, payload)`
         ├─> Writes to RxDB cache `kylrix:sync:pending-queue` & `pending-payloads`
         ├─> Displays Amber `SyncStatusDot`
         └─> Schedules demand flush (1500ms debounce during typing, 0ms on discrete actions)

Engine Demand Flush Cycle (`runCycle`)
  │
  ├──> Pre-Warm Appwrite JWT (`getPrewarmedJwt`)
  │
  ├──> Read Outbox Payloads from Memory / RxDB `cache`
  │
  ├──> Execute Bulk Push to Appwrite (`updateNote` / `updateGoal` / `createNote` / etc.)
  │
  ├──> Compare Current Queue Revision vs Flushed Revision
  │      ├─> Revision moved on (concurrent user edit during flush)
  │      │     └──> Re-queue, remain Amber, dispatch `kylrix:sync-pending`
  │      │
  │      └─> Revision matches
  │            ├──> `autonomicSyncEngine.ack(id, flushRevision)`
  │            ├──> Update baseline snapshot (`LocalEngine.snapshotBaseline`)
  │            ├──> Display Green `SyncStatusDot`
  │            └──> Dispatch `kylrix:sync-complete`
```

---

## Verification & Testing Matrix

- **Local Edit Persistence**: Edit note/goal → instant amber dot → verify IndexedDB RxDB `cache` contains updated `kylrix:sync:pending-queue`.
- **Browser Reload / Offline Resilience**: Disconnect network → edit item → reload browser → item body and amber status persist from RxDB.
- **Concurrent Edit Guard**: Edit detail while flush is in-flight → confirm `kylrix:sync-pending` fires and dot remains amber until latest revision flushes.
- **Local Tombstone Integrity**: Delete item locally → confirm tombstone in `f_deleted_ids_[userId]` → perform soft pull → confirm item does not re-appear.
- **Free Tier Behavior**: Free user edits item → `autonomicSyncEngine.ack` runs locally → UI turns green without throwing Appwrite database errors.
