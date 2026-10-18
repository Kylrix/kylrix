# Workspaces Architecture & Filtering Edge Cases

This document details the workspace architecture, join relationships, entity filtering rules, and potential edge cases within the Kylrix ecosystem.

---

## 🏛️ Overview & Concepts

Kylrix features a flexible workspace model that separates **Virtual Personal Workspaces** from **Concrete Project Workspaces**.

### Workspace Types

1. **Virtual Personal Workspace (Default View)**
   - Reserved project IDs: `'inbox'`, `'personal'`, `'default'`.
   - Represents the un-categorized personal workspace of the authenticated user.
   - Entities in this view have `isWorkspace: false` (or undefined/null).

2. **Concrete Project Workspaces**
   - Stored as rows in the `projects` table.
   - Managed via workspace routes (`/workspace/[id]`).
   - Can contain custom settings, agentic sessions, linked objects, and collaborators.

---

## 🔗 Data Model & Join Mapping (`project_objects`)

Workspace object relationships are tracked using a dual-stamping strategy:

1. **Direct Row Stamping**: The entity row itself maintains `projectId` and `isWorkspace: true`.
2. **Join Table Record (`project_objects`)**: A join row in `project_objects` connects `(projectId, entityKind, entityId)` under the owner's `userId`.

```
+----------------+          +--------------------+          +--------------------+
|  Entity Row    |          |  project_objects   |          |   projects Table   |
| (Note/Goal/...) |          |  Join Mapping      |          | (Custom Workspace) |
+----------------+          +--------------------+          +--------------------+
| $id: note_123  | <----->  | entityId: note_123 |  <-----> | $id: proj_abc      |
| projectId:     |          | entityKind: note   |          | name: Frontend Dev |
|   proj_abc     |          | projectId: proj_abc|          +--------------------+
| isWorkspace:   |          +--------------------+
|   true         |
+----------------+
```

When an entity is attached to or created inside a workspace:
- `isWorkspace: true` and `projectId: <workspaceId>` are stamped on the entity row.
- `attachObjectToProject(projectId, entityKind, entityId)` creates/verifies the `project_objects` join row.

---

## 🔍 Filtering Mechanics (`useWorkspaceFilteredItems`)

The `useWorkspaceFilteredItems` hook governs how items are presented in the UI based on active context:

- **Inside a Custom Workspace (`/workspace/[id]`)**:
  - Filters items where `item.projectId === activeWorkspaceId` OR the item ID exists in `project_objects` for that workspace.
- **In Personal / Default Views (`/app`, `/goals`, `/vault`, etc.)**:
  - Filters using `isDefaultWorkspaceObject(item)`. Items stamped with `isWorkspace: true` belonging to custom workspaces are excluded from personal feeds.

---

## ⚠️ Edge Cases & Common Traps

### 1. Property Name Normalization (`isWorkspace` vs `is_workspace`)
Depending on whether data is fetched via raw Turso SQLite queries, legacy Appwrite compatibility shims, or LocalEngine cache, the workspace boolean flag may be named `isWorkspace` (camelCase) or `is_workspace` (snake_case).
- **Rule**: Code filtering or checking workspace state MUST normalize both: `const isWs = Boolean(item.isWorkspace || item.is_workspace);`.

### 2. Live Update Merging (PartyKit & Sync Engine)
When real-time updates arrive via PartyKit websockets or background autonomic sync passes, raw updated payloads from the server may omit workspace metadata if not specifically queried.
- **Trap**: Replacing an in-memory item with a raw payload missing `projectId` or `isWorkspace` will cause the item to disappear instantly from the workspace view.
- **Fix**: Contexts (e.g. `TaskContext`, `load-local-goals.ts`) must defensively merge incoming updates with existing local representations:
  ```typescript
  const merged = {
    ...existingItem,
    ...incomingUpdate,
    projectId: incomingUpdate.projectId ?? existingItem.projectId,
    isWorkspace: incomingUpdate.isWorkspace ?? existingItem.isWorkspace,
  };
  ```

### 3. LocalEngine Tombstone Persistence
Deleting an item registers a persistent tombstone in LocalEngine (`markDeleted(id, userId)`).
- **Behavior**: Local cache keys are purged immediately, pending sync queue items are canceled, and soft refreshes or background inbound sync pulls are blocked from resurrecting deleted items.

### 4. Real-World Bug Reports vs Invariants
If workspace filtering or join logic causes legitimate user items (such as vault secrets or goals) to become hidden or inaccessible:
- **Primacy Rule**: Real-world user reports ALWAYS supersede documented invariants or past agent assumptions. Investigate real-world behavior and fix filtering logic rather than enforcing a broken invariant.
