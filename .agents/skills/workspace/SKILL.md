---
name: workspace
description: Workspaces architecture, projects table, project_objects join mapping, workspace-jailed entity filtering, and flow execution.
---

# Workspaces & Workflow Architecture

## 1. Workspace Isolation & Join Mapping
- Workspaces map to the \`projects\` table.
- Objects linked to a workspace are tracked via the \`project_objects\` join table linking \`(projectId, entityKind, entityId)\`.
- When an entity is created in a workspace, set \`isWorkspace: true\`, stamp \`projectId\`, and create the \`project_objects\` join record.

## 2. Flow Workflows & Drafts Persistence
- Workflows live under \`/flows\` with install counters, review gates, and reversible action negations.
- Localized form drafts persist in uncommitted drafts storage without clobbering remote state.
