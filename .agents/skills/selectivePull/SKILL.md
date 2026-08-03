# Selective Pull (`selectivePull`)

**Canonical Skill** for zero-waste delta pulling across all Kylrix object contexts (Notes/Ideas, Goals/Tasks, Workspaces/Projects, Vault, Events, Forms).

---

## 1. Core Mandates

1. **Never Mindlessly Fetch**: UI surfaces must **talk only to the local copy engine** (RxDB / LocalEngine / Context).
2. **Delta-Only Network Queries**:
   - Web application startup and background sync cycles **must never re-fetch full lists** using arbitrary limit/offset offsets.
   - When pulling updates from remote databases (Appwrite), perform a **Selective Pull**: query only rows modified since the latest locally synced item's timestamp (`Query.greaterThan('$updatedAt', latestLocalTimestamp)` or `$createdAt`).
3. **Local Copy Pre-hydration**:
   - The UI hydrates instantly from local storage (RxDB / IndexedDB) on cold load.
   - Remote queries perform incremental delta updates in the background and merge into local copy via `mergeFetchedWithLocalDrafts`.
4. **Infinite Scroll is Local Windowing**:
   - UI infinite scroll does **not** make network requests to Appwrite.
   - Scrolling simply expands the slice of items rendered from the pre-warmed local engine.
5. **Preserve User Ordering**:
   - Background pulls must preserve pinned states and relative user sorting (`sortPinnedThenCreatedAt`).
   - Server pages must never overwrite pending/un-flushed local edits (`autonomicSyncEngine.isPending(id)`).

---

## 2. Implementation Pattern

```ts
// 1. Get latest timestamp from local engine
const latestLocalTimestamp = getLatestLocalUpdatedAt(localCopyList);

// 2. Build selective delta query
const queries = [
  Query.orderDesc('$updatedAt'),
  Query.limit(100),
];

if (latestLocalTimestamp) {
  queries.push(Query.greaterThan('$updatedAt', latestLocalTimestamp));
}

// 3. Perform quiet background replenishment
const deltaRows = await listFromAppwrite(queries);

// 4. Merge into local copy without layout thrash or resetting pinned lists
upsertLocalCopy(deltaRows);
```
