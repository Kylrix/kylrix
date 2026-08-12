---
name: note.thread-threads
description: Guidelines and lifecycle rules for using thread Notes as a high-efficiency comment and chat thread channel across Kylrix resources (calls, tasks, tags, projects, events, forms) without database bloat.
---

# Kylrix thread Note Thread System

This guide documents the pattern of leveraging the existing Note Comment system to power real-time, persistent thread chats and comments on other resources (like Projects, Goals/Tasks, Forms, and Events) without introducing new database schemas or bloating the database.

---

## 1. Core Metadata Schema

Every thread Note created as a thread anchor must have the following metadata payload stringified in its `metadata` column:

```json
{
  "isthread": true,
  "linkedResourceType": "huddle" | "task" | "project" | "tag" | "event" | "form",
  "linkedResourceId": "parent-object-id",
  "linkedResourceName": "Quick Sync / Tag Earmark",
  "expiresAt": "2026-05-28T16:00:00.000Z",
  "threadSecret": "random-hex-string",
  "isStory": false
}
```

### Attributes:
- **`isthread: true`**: Hides the note from the main notes sub-app and subjects it to the automated 7-day cleanup job.
- **`linkedResourceType`**: Specifies which super-object owns the thread.
- **`linkedResourceId`**: The unique ID of the parent resource.
- **`isStory`**: If `true`, indicates the thread has been promoted to a permanent "Story" (an owned, standard note filtered from general view but exempted from the 7-day deletion).

---

## 2. Appwrite Schema Enhancements

To prevent heavy database sweeps and in-memory JSON parsing overhead, the `notes` table has been upgraded with the following columns and indexes:

### New Columns (Optional Booleans):
1. **`isthread`** (Boolean, default: `false`): Explicit flag indicating an ephemeral document.
2. **`isThread`** (Boolean, default: `false`): Explicit flag indicating the note anchors a resource discussion thread.

### Database Index:
*   **Index Key**: `idx_notes_thread_thread`
*   **Index Type**: `Key` (non-unique index)
*   **Attributes**: `isthread` (ASC), `isThread` (ASC)

This indexing strategy allows the system-level cleanup sweeps to surgically select and delete expired thread notes (`isthread === true && isThread === false`) in a single query on-disk without downloading or parsing the metadata of persistent threads.

---

## 3. Generic Resource Huddles (Task/Form/Event)

To maximize performance and simplicity, **resource-linked huddles** utilize the parent resource ID directly as the note document ID (`rowId = resourceId`):

1.  **Direct Note Matching**: Checking if a huddle is initialized is done by fetching the note document directly by its ID (`getNote(resourceId)`). If it exists, the huddle is initialized.
2.  **Access Inheritance**: Setting `isPublic = true` and read permissions to `read("any")` on the huddle note document ensures that all comments inherit read permissions. 
    -   *Guests & Attendees* can instantly load and view the comment thread in real-time.
    -   *Posting comments* (`createComment`) requires standard authentication to prevent spam.
3.  **Comments as Messages**: Real-time comments are saved with `noteId = resourceId` (e.g. `taskId`), utilizing the existing Appwrite real-time collection subscription layer.

---

## 4. "Story" Promotion (Morphing)

To save a temporary chat/thread from expiring in 7 days, users can convert it into a permanent **"Story"**:

1.  **Chronological outline compilation**: Fetch all active comments under `noteId = resourceId` and format them into a beautiful, chronological markdown outline document.
2.  **Provision permanent Note**: Create a new Note document with a unique ID (`rowId = ID.unique()`) owned by the actor (`userId = actor.$id`) with `isStory: true` and `isthread: false`, completely removing the `expiresAt` parameter.
3.  **Huddle Reset**: Delete all comments under `noteId = resourceId` and delete the original thread note (with `id = resourceId`), cleanly resetting the discussion space so a fresh thread can be started.

---

## 5. Backwards-Compatible Legacy Fallback

During the migration period, some older thread notes may lack the first-class `isthread` or `isThread` attributes. The UI and sweep jobs must employ the following fallback logic:

```typescript
// Safe classification helper
const isthreadNote = (note: any) => {
  // 1. Direct Column Check
  if (note.isthread !== undefined) {
    return !!note.isthread;
  }
  // 2. Legacy Metadata Fallback
  if (note.metadata) {
    try {
      const parsed = JSON.parse(note.metadata);
      return !!parsed.isthread;
    } catch {}
  }
  // 3. Userless Fallback
  return !note.userId;
};
```

This legacy parsing layer must be maintained until all legacy documents have naturally expired (within 7 days of deployment), after which the metadata and userless fallbacks can be safely removed to achieve pure, high-performance boolean sweeps.

---

## 6. UI & Safety Guidelines

-   **Public Disclosure**: Clearly inform users that thread comments are **Public by Design** to anyone with resource access.
-   **Global Unmount**: Ensure thread sidebars and overlay drawers use conditional rendering (`{isThreadOpen && <ThreadPanel />}`) to avoid interaction traps.
-   **Layman-First Copy**: Avoid technical jargon. Use simple phrases like `"Public Thread (auto-cleans in 7 days)"` for thread threads, and `"Public Event Huddle"` for events.
