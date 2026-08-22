---
name: workspace.projects-table
description: Canonical architecture for Workspaces and the project_objects join table in Kylrix. Use when working on /workspaces, workspace switches, object filtering (ideas, goals, secrets, events, forms), or LocalEngine caching.
---

# Workspace Architecture & Object Isolation

## 1. Core Architectural Model

Kylrix distinguishes strictly between two workspace scopes:

1. **Virtual Personal Workspace (`isPersonal: true` / default)**:
   - Contains all unassigned user items.
   - Filters **OUT** any object that belongs to a real workspace using `isDefaultWorkspaceObject(item)` (i.e. drops items where `isWorkspace === true`, `projectId` is a custom workspace ID, or tags contain `workspace:*`).

2. **Real / Named Workspaces (`isPersonal: false`, `projectId: <id>`)**:
   - Items are linked to the workspace via the `project_objects` join table (`projectId`, `entityKind`, `entityId`).
   - The workspace view shows only items whose IDs exist in `project_objects` for that workspace OR have `item.projectId === activeWorkspace.id`.
   - **Never** relies on `isWorkspace` flag alone to display items; `project_objects` is the definitive join table.

---

## 2. Database Schema & Appwrite Index Realities

- **Table**: `project_objects` in `passwordManagerDb` (`APPWRITE_CONFIG.DATABASES.CHAT`).
- **Indices**:
  - `uniq_project_object`: `(projectId, entityKind, entityId)`
  - `idx_project_objects_entity`: `(entityKind, entityId)`
- **Normalized Entity Kinds**:
  - `note` (for Notes & Ideas)
  - `goal` (for Goals & Tasks)
  - `credential` (for Passwords & Vault secrets)
  - `totp` (for 2FA seeds)
  - `event` (for Calendar events)
  - `form` (for Forms)
  - `moment` (for Social moments)
  - `tag` & `collaborator`

> [!IMPORTANT]
> **No Compound Index on `$createdAt`**: Appwrite queries on `project_objects` must query by indexed fields (e.g. `Query.equal('projectId', projectId)`). Never inject `Query.orderDesc('$createdAt')` into `project_objects` queries unless an explicit index exists.

---

## 3. LocalEngine Caching & Dual Response Normalization

To ensure 0ms rendering and zero layout flash during workspace switching:

1. **`ProjectsService.listProjectObjects(projectId)`**:
   - Executes with dual fallbacks (`listRows` then `listDocuments`).
   - Normalizes output to `{ rows: any[] }`.
   - Immediately primes `LocalEngine` with the overall list (`projectObjectsCacheKey(projectId)`) and **partitions by kind** (`projectObjectsKindCacheKey(projectId, kind)`).
2. **`useProjectObjects(projectId, entityKind)`**:
   - Reads directly from the primed `LocalEngine` partition cache on mount and workspace switch.
   - Never clears rows (`setRows([])`) before local cache hydration, preventing empty-state flash.
3. **`ProjectsService.listTaggedResources(projectId)`**:
   - Fetches entity documents by primary key (`getNote(id)`, `getTask(id)`, `getKeepCredential(id)`).
   - Direct primary-key lookups bypass compound query index constraints and guarantee 100% resolution.

---

## 4. Single Source of Truth & Live Copy Invariants

- **`NotesContext` / `TaskContext`**:
  - Responsible for applying `useWorkspaceFilteredItems` to produce `contextNotes` / `filteredTasks`.
  - Pages (`app/(app)/app/(app)/page.tsx`, `app/(app)/goals/page.tsx`) must directly consume `contextNotes` / `tasks` from context without maintaining separate un-synced local states or running duplicate secondary filters.
- **`upsertNote` Equality Check**:
  - Must evaluate `isWorkspace` and `projectId` in state comparison so that stamping an item to a workspace updates memory immediately.
- **Autosave & Persistence**:
  - `pickNoteAutosavePayload` in `lib/appwrite/note.ts` must explicitly preserve `isWorkspace` and `projectId` during background sync flushes to prevent workspace metadata stripping.

