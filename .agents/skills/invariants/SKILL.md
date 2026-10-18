---
name: invariants
description: Immutable architectural constraints, workspace data rules, fragile filtering logic, and real-world bug override rules.
---

# System Invariants & Anti-Regression Rules

## 1. Real-World Bug Reports Supersede Invariants (CRITICAL)
- **Rogue Agent Assumption Guard**: An invariant or skill document might have been codified by a past agent based on an incomplete or faulty assumption.
- **Real-World Primacy**: If a real-world user report or live UI test indicates broken behavior (e.g. vault secrets, goals, or notes failing to display, or form submissions breaking due to workspace filtering logic), **the real-world report ALWAYS supersedes any locked-in invariant**.
- Do not let a documented invariant become a roadblock or pothole preventing the fix of a real bug. Exercise discretion, fix the root cause, and update the invariant accordingly.

## 2. Workspace Filtering & Entity Stamping Invariants
- **Dual Stamping Required**: Entities created within a workspace MUST stamp `isWorkspace: true` and `projectId: <workspaceId>` directly on the entity row AND create the `project_objects` join row linking `(projectId, entityKind, entityId)`.
- **Attribute Normalization**: Both `isWorkspace` and `is_workspace` (snake_case vs camelCase) exist across cached payloads. Contexts (`TaskContext`, `load-local-goals.ts`, etc.) must check and normalize both fields.
- **Virtual Personal Workspace Handling**: Reserved project IDs (`'inbox'`, `'personal'`, `'default'`) are non-workspace scopes (`isWorkspace: false`). `isDefaultWorkspaceObject` checks ensure personal items do not bleed into custom workspace feeds.
- **Data Preservation during Sync**: Live goal/task updates must defensively merge live payloads with existing in-memory state to preserve workspace linkages (`projectId`, `isWorkspace`), `subtasks`, `comments`, and `labels`.

## 3. Account Sovereignty & User Consolidation Invariants
- **Email Normalization**: `consolidateUserByEmail` matches users strictly by normalized email in Turso SQLite. When duplicate user rows exist across auth providers (Google, GitHub, credential, Appwrite migration), it selects a canonical user ID and re-links related rows.
- **Entitlement Resolution**: Contributor status and paid tier entitlements resolve across all user IDs sharing the normalized email address.
- **Human Owner ID Enforcement**: All objects created by agents, CLI, or MCP belong to the authenticated human user (`userId`). Agents never create isolated ghost user accounts.

## 4. Local-First Engine & Tombstone Invariants
- **Persistent Tombstones**: Local deletions register tombstones in LocalEngine via `markDeleted(id, userId)`. This purges local cache keys, cancels pending sync passes, and mathematically prevents soft refreshes or background inbound sync pulls from resurrecting deleted items.
- **Read-Through Cache Fallback**: Local data hydration checks user-specific cache keys first, falling back to un-prefixed (`f_notes_list`) and guest (`f_notes_list_guest`) cache keys when user-specific keys return no items.

## 5. Real-Time WebSocket Dispatches
- **Normalized Event Payloads**: All mutations in `ApiResources`, Server Actions, client ops, and Turso ops MUST invoke `broadcastRealtimeEvent` (PartyKit), normalizing payload IDs (`$id` and `id`) and broadcasting over comprehensive channels (`collections`, `tables`, `row:${rowId}`).

## 6. Single Database & Terminology
- **Single DB `passwordManagerDb`**: All tables exist inside `passwordManagerDb`.
- **Terminology Enforcement**: Strictly use **"Table"** (never Collection) and **"Row"** (never Document) across all code, comments, logs, and documentation.
