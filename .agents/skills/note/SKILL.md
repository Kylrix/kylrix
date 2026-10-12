---
name: note
description: Notes architecture, decoupled SDK, private/shared/public filtering, crosslink tagging relations, and shared caching.
---

# Notes Architecture & Discovery

## 1. Note Partitioning & Filtering
- Notes are strictly partitioned into:
  - **Personal Notes**: Owned by user, private by default.
  - **Shared Private**: Shared with specific collaborator user IDs.
  - **Shared Public**: Publicly accessible via share links (\`isPublic: true\`).
- Filtering logic ensures zero data leakage between user spaces and workspace boundaries.

## 2. Crosslink Tagging Pattern
- Relational connections between notes and other entities use prefix tags (e.g. \`source:kylrixnote:id\`, \`project:id\`) avoiding complex relational join tables.

## 3. Global Note Cache & Decoupled SDK
- Notes loaded in views are cached in the local RxDB/NotesContext layer for instant navigation.
