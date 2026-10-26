# Synchronization Engine & Real-Time Orchestration

This document details the mechanics of the `autonomicSyncEngine`, background queue flushing, PartyKit WebSocket real-time events, and LocalEngine tombstone management.

---

## ⚡ Autonomic Sync Engine (`lib/services/sync-engine.ts`)

The `autonomicSyncEngine` manages background bidirectional synchronization between the client storage layer (`LocalEngine`) and the Turso SQLite backend.

```
+-----------------------------------------------------------------------------------+
|                            CLIENT MUTATION OCCURS                                 |
|                         (Note / Goal / Event / Vault)                             |
+-----------------------------------------------------------------------------------+
                                         |
                       Optimistic UI + LocalEngine Write
                                         v
+-----------------------------------------------------------------------------------+
|                        autonomicSyncEngine QUEUE                                  |
|         Keys: `note:<id>`, `goal:<id>`, `cred:<id>`, `totp:<id>`, etc.             |
+-----------------------------------------------------------------------------------+
                                         |
                     Debounce Check: 150ms typing / 500ms max
                                         v
+-----------------------------------------------------------------------------------+
|                        TRANSACTIONAL BATCH FLUSH                                  |
|            (Server Actions: `upsertNotesBatchTurso`, `{ skipPending: true }`)     |
+-----------------------------------------------------------------------------------+
                                         |
                          Success: Clear Queue & Acknowledge
                                         v
+-----------------------------------------------------------------------------------+
|                        PartyKit WebSocket Broadcast                               |
|                  (`broadcastRealtimeEvent(table, action, id)`)                    |
+-----------------------------------------------------------------------------------+
```

---

## ⏱️ Flush Timings & Hard Ceilings

To balance near-instantaneous sync responsiveness with server request efficiency during active typing:

- **Typing Debounce (`FLUSH_TYPING_DEBOUNCE_MS`):** `150ms`.
- **Hard Ceiling (`HARD_CEILING_MS`):** `500ms`. Ensures queued edits are force-flushed to the server within 500ms even during continuous typing.
- **Freshness Cache Threshold:** `requestObjectFreshness` skips remote document fetches if a local baseline exists in `LocalEngine` and was verified within 300,000ms (5 minutes).

---

## 🔀 Queue Prefixes & Flush Handlers

Queue item keys in `PENDING_QUEUE_KEY` map directly to entity flush handlers:

| Key Prefix | Entity Type | Flush Handler | Target Action / Service |
|---|---|---|---|
| `note:<id>` | Notes | `flushNotePending` | `updateNote` / `createNote` |
| `goal:<id>` | Goals | `flushGoalPending` | `upsertGoalsBatchTurso` |
| `event:<id>` | Events | `flushEventPending` | `upsertEventsBatchTurso` |
| `cred:<id>` | Credentials | `flushCredentialPending` | `upsertVaultItemTurso` |
| `totp:<id>` | TOTP Secrets | `flushTotpPending` | `upsertTotpSecretTurso` |
| `form:<id>` | Forms | `flushFormPending` | `upsertFormTurso` |

**Preventing Re-Queuing Loops:** Lower-level CRUD actions invoked during flushes pass `{ skipPending: true }` to explicitly prevent the sync engine from re-queuing the item it is currently flushing.

---

## 🌐 Real-Time WebSockets (PartyKit)

- **Connection Setup (`lib/realtime/partykit.ts`):** Reconnection delay is configured to `500ms`.
- **On-Open Sync Flush:** Establishing or re-establishing a WebSocket connection (`onopen`) immediately triggers `autonomicSyncEngine.flushImmediately()` to flush pending local mutations.
- **Event Channels:** Shared client views (`IdeaPageClient`, `SharedGoalClient`, `SharedVaultClient`, `SharedTotpClient`, `/form/[id]`) align `realtime.subscribe` channel names with `broadcastRealtimeEvent` table prefixes (`ideas`, `tasks`, `credentials`, `totpSecrets`, `forms`) to trigger live remote revalidation upon updates.

---

## 🪦 Tombstone Management & Deletion Safety

When an item is deleted locally:
1. Local storage keys are purged immediately.
2. A tombstone record is saved in `LocalEngine` (`markDeleted(id, userId)`).
3. Pending queue items for that ID are canceled (`cancelPendingSync(id)`).
4. Subsequent inbound sync sweeps or soft refreshes check tombstones and skip resurrecting deleted items.
