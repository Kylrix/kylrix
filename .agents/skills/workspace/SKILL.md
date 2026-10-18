---
name: workspace
description: Workspaces architecture, projects table, project_objects join mapping, workspace-jailed entity filtering, and flow execution.
---

# Workspaces & Workflow Architecture

## 1. Workspace Isolation & Join Mapping
- Workspaces map to the `projects` table.
- Objects linked to a workspace are tracked via the `project_objects` join table linking `(projectId, entityKind, entityId)`.
- When an entity (note, goal, form, event, secret, totp, agent_session) is created in a workspace, set `isWorkspace: true`, stamp `projectId`, and invoke `attachObjectToProject` to create the `project_objects` join record.

## 2. Filtering Quirks & Edge Cases
- **Hook `useWorkspaceFilteredItems`**: Filters items depending on whether a custom workspace or default workspace is active.
- **Reserved Project IDs**: `'inbox'`, `'personal'`, and `'default'` represent non-workspace / personal default views (`isWorkspace: false`).
- **Property Field Dual-Check**: In-memory rows may present `isWorkspace` (camelCase) or `is_workspace` (snake_case) depending on whether they were fetched via raw Turso SQLite queries, Appwrite compatibility wrappers, or LocalEngine cache. Always check both fields (`row.isWorkspace || row.is_workspace`).
- **Defensive Goal & Task Merging**: When live background updates arrive via PartyKit or sync engine, merge incoming items with existing in-memory objects to preserve `projectId`, `isWorkspace`, `subtasks`, `comments`, and `labels`. Failing to preserve these fields will cause items to momentarily disappear from workspace lists.
- **Real-World Bug Priority**: If workspace filtering rules cause user items (e.g. vault secrets or goals) to disappear unexpectedly, prioritize fixing the filtering logic or fallback handling over rigid invariant adherence.

## 3. Flow Workflows & Drafts Persistence
- Workflows live under `/flows` with install counters, review gates, and reversible action negations.
- Localized form drafts persist in uncommitted drafts storage (`form_draft_${formId}`) in LocalEngine without clobbering remote state.
