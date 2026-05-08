---
name: flow-tasks
description: Handles Flow task/form/event behavior and task-linked integrations. Use for task detail state, subtasks, comments, and attachments/pointers to notes or calls.
disable-model-invocation: true
---

# Flow Tasks

## Rules

1. Treat task row shape as source of truth, not transient UI shape.
2. Keep subtask/comment serialization aligned with existing model.
3. Prefer pointer attachments (note/call/credential) over copied payloads.
4. Preserve clean handoff between Flow tasks and connected call/note surfaces.

