---
name: system.threads
description: >-
  Canonical threads substrate (threads, thread_messages, thread_reactions).
  Unique scopeKey parentKind:parentId:channel. Use when adding discussions to
  notes, goals, workspaces, or any object — never spin thread isThread notes.
---

# Threads (canonical)

## Tables (`passwordManagerDb`)

| Table | Role |
|-------|------|
| `threads` | One row per discussion channel on an object |
| `thread_messages` | Messages; nest via `parentMessageId` + `rootMessageId` |
| `thread_reactions` | Emoji reactions on messages |

Denorm pointers (optional, stamped on first ensure): `notes.primaryThreadId`, `tasks.primaryThreadId`, `projects.primaryThreadId`.

## Uniqueness (kills duplicate spins)

```
scopeKey = `${parentKind}:${parentId}:${channel}`
```

Unique index `idx_threads_scope_uq`. `ThreadService.getOrCreate` is idempotent (re-fetch on race).

Channels: `general` (workspace/object default), `discuss` (idea/goal Discussions).

Parent kinds: `note` | `goal` | `workspace` | `event` | `form` | `call` | `dm` | `agent` | `object` | `user`.

## Nested replies

- `parentMessageId` — immediate parent
- `rootMessageId` — branch root (for loading a subthread without walking)
- `replyCount` on parent message (best-effort bump)

## Legacy

thread `isThread` / `isChat` notes + `comments` remain readable when `threads.legacyNoteId` is set. **New writes go to `thread_messages` only.** Do not create new thread-note threads.

## Service / API

- `lib/services/threads.ts` — `ThreadService`
- `lib/threads/types.ts` — kinds, `buildThreadScopeKey`
- PAT: `POST /threads` ensure · `GET /threads` · `GET|POST /threads/:id/messages`
- Shortcuts: `POST /notes/:id/discussion`, `POST /goals/:id/discussion`, `GET|POST /workspaces/:id/thread`

## Do not

- Add more `isThread` / `isDiscussion` / `isChat` flags on notes
- Create a second thread for the same `(parentKind, parentId, channel)`
- Use Appwrite CLI for row CRUD (schema only)
- Let discussion shells appear in Ideas — enforce `isthreadNote` + `ideaListExclusionQueries()` on every note list path
- Call `createthreadNoteForProject` / `ForResource` expecting a note row — they now return canonical thread ids only
