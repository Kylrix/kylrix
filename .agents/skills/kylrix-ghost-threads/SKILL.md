---
name: kylrix-ghost-threads
description: Guidelines and lifecycle rules for using Ghost Notes as a high-efficiency comment and chat thread channel across Kylrix resources (calls, tasks, tags, projects, events) without database bloat.
---

# Kylrix Ghost Note Thread System

This skill documents the pattern of leveraging the existing Note Comment system to power real-time, persistent thread chats and comments on other resources (like Calls, Tasks, Tag earmarks, and Projects) without introducing new database schemas or modifying `appwrite.config.json`.

---

## 1. Metadata Schema

Every Ghost Note created as a thread anchor must have the following metadata payload:

```json
{
  "isGhost": true,
  "linkedResourceType": "huddle" | "task" | "project" | "tag" | "event",
  "linkedResourceId": "parent-object-id",
  "linkedResourceName": "Quick Sync / Tag Earmark",
  "expiresAt": "2026-05-28T16:00:00.000Z",
  "ghostSecret": "random-hex-string",
  "isStory": false
}
```

### Attributes:
- **`isGhost: true`**: Hides the note from the main notes sub-app and subjects it to the automated 7-day cleanup job.
- **`linkedResourceType`**: Specifies which super-object owns the thread.
- **`linkedResourceId`**: The unique ID of the parent resource.
- **`isStory`**: If `true`, indicates the thread has been promoted to a permanent "Story" (an owned, standard note filtered from general view but exempted from the 7-day deletion).

---

## 2. Interoperability & Storage

1.  **Comments as Messages**: Instead of creating a `chat_messages` table, every message in a huddle call chat or task comment is stored as a standard document in the `comments` table linked to the Ghost Note ID via `noteId`.
2.  **Reactions**: Reactions are mapped to comment IDs using `targetType: "comment"`, offering rich, instant emojis for free.
3.  **Automatic Expiration**: Any ghost note (and its child comments/reactions) whose `expiresAt` is in the past is purged by the existing 7-day sweep, preventing zombie resource buildup and lowering read costs.

---

## 3. Route Interception & Redirection

When a user visits the shared route `/note/shared/[noteId]`:
1.  Parse the note's metadata.
2.  If `linkedResourceType` and `linkedResourceId` are present:
    -   Intercept the view.
    -   Verify if the viewer has access to the parent resource.
    -   If yes, smartly switch context or redirect (e.g., redirect from the note view to `/connect/call/[linkedResourceId]` or `/tasks/[linkedResourceId]`).

---

## 4. "Story" Promotion (Morphing)

To save a temporary chat/thread from expiring in 7 days, users can convert it into a permanent **"Story"**:
1.  Set `isGhost` to `false` and `isStory` to `true` (or metadata `isStory: true`).
2.  Set the note's `userId` to the current user's authenticated ID.
3.  Optionally use an AI workflow to summarize the comment history into a beautiful title and abstract.
4.  Filter Stories out of the primary Notes list so they do not clutter daily notes, but keep them searchable under a dedicated filter or within their parent objects.

---

## 5. UI & Safety Guidelines

-   **Public Disclosure**: Clearly inform users that thread comments are **Public by Design** to anyone with resource access.
-   **Alternative Option**: Provide a clear choice to spin up a **"Hangout"** instead—a secure, private, encrypted group chat based on public keys for authenticated project/call members.
-   **Global Unmount**: Ensure thread sidebars and overlay drawers use conditional rendering (`{isThreadOpen && <ThreadPanel />}`) to avoid interaction traps.
-   **Layman-First Copy**: Avoid technical jargon. Use simple phrases like `"Private Chat Group"` for Hangouts and `"Public Thread (auto-cleans in 7 days)"` for ghost threads.
