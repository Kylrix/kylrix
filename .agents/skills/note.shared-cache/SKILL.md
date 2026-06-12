---
name: note.shared-cache
description: Share note state globally via RxDB/NotesContext instead of making redundant network fetches. Ensure once notes are loaded/synced in /note, they are locally queryable and filterable throughout the application timeline.
---

# Global Shared Cache and Local Notes Retrieval

To achieve sub-millisecond execution speeds and respect the local RxDB/IndexedDB substrate design, the application must avoid redundant database network queries when routing or viewing notes across different parts of the codebase (e.g. project object integration).

## Architectural Protocol

1. **Leverage Cached/Synced State**: Avoid executing network calls like `listNotes` inside modal fetches or new route mounts if the data is already synced and cached.
2. **Access Notes via `useNotes()`**: The globally wrapped `NotesProvider` dynamically hydrates notes from the local RxDB IndexedDB database on cold start. Use the `notes` list from `useNotes()` for local querying, integration selectors, and dialog list lookups.
3. **Local Search & Filter**: When users perform search operations in overlays or integration panels, perform case-insensitive substring matches against cached notes (`note.title` or `note.content`) rather than pushing query objects to the server.
4. **Encryption Gating**: When filtering cached notes for sharing or integration, respect security flags such as `isEncrypted` or metadata encryption flags locally.
