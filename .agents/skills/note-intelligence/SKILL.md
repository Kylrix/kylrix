---
name: note-intelligence
description: Handles notes, shared notes, collaborators, comments, tags, and note-linked metadata safely. Use for note-centric product logic and note-linked integrations.
disable-model-invocation: true
---

# Note Intelligence

## Rules

1. Never leak public-link notes into authenticated feeds/lists.
2. Keep ghost notes isolated from authenticated lists.
3. Prefer existing note relations (`tags`, `note_tags`, collaborators, comments, metadata) over new state models.
4. Use note metadata as the canonical bridge for note-linked task/call context.
5. Enforce owner/collaborator write access on note mutations.

