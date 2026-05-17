---
name: kylrix-note-filtering
description: Foundation for note discovery and partitioning in the Kylrix ecosystem. Use this to ensure notes are correctly routed between the primary Notes list, Shared Private, and Shared Public tabs without data leakage or overlap.
---

# Kylrix Note Filtering Logic

This skill pins the canonical filtering and discovery patterns for notes to prevent AI agents from breaking the specific partitioning required for secure collaboration.

## 1. Primary Notes List (Ownership-Only)
The main Notes page (`/note/notes`) must ONLY display notes explicitly owned by the current user.
- **Filter**: `Query.equal('userId', currentUser.$id)`
- **Intent**: Personal workspace management.
- **Rule**: Never include shared or public notes owned by others here.

## 2. Shared Workspace Partitioning
The Shared workspace (`/note/shared`) discovery is driven by `getSharedNotes()`, which uses a strict inclusion-first model.

### getSharedNotes() Implementation
- **Initial Fetch**: `Query.notEqual('userId', currentUser.$id)`
- **Strict Validation**: Iterate results and filter for documents where the `$permissions` array explicitly contains `user:CURRENT_USER_ID`.
- **Reasoning**: This excludes "Global Public" notes that the user has read access to via `Role.any()` but was never explicitly invited to.

### Tab 0: Private (Collaborator Notes)
- **Source**: `getSharedNotes()`
- **Filter**: `note.isPublic === false`
- **Display**: Notes explicitly shared with the user by others that remain private to that group.

### Tab 1: Public (Owned + Shared Public)
This tab aggregates two distinct categories:
1.  **Owned Public**: The user's own notes where `isPublic === true`. (Fetch: `listPublicNotesByUser(userId)`)
2.  **Explicit Shared Public**: Notes owned by others where `isPublic === true` AND the user is an **explicit collaborator** in `$permissions`. (Fetch: `getSharedNotes()` result where `isPublic === true`)

## Summary Table

| UI Surface | Owner | Public Status | Permission Requirement |
| :--- | :--- | :--- | :--- |
| **Notes UI** | Me | Any | Owner |
| **Shared > Private** | Others | Private | Explicitly named in `$permissions` |
| **Shared > Public** | Me | Public | Owner |
| **Shared > Public** | Others | Public | Explicitly named in `$permissions` |
