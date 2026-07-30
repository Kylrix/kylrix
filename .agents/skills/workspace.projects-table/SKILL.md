---
name: workspace.projects-table
description: Workspaces UI over the projects table (ProjectsService). Use when editing /workspaces, project detail, discussion, or project-linked objects.
---

# Workspaces (= projects table)

## Naming

- **UI / routes:** Workspace(s) → `/workspaces`, `/workspaces/[projectId]`
- **Data / services:** still the projects table + `ProjectsService` (do not rename the table casually)
- **Deprecated URLs:** `/projects`, `/project/[id]` redirect to workspaces

## Flagship behavior

Workspaces remain the synergy hub: link ideas, goals, forms, events, hangouts, and discussion threads under one project row. Capability caps and free-tier collaborator limits still apply — see `why.free-tier-limits-8-collaborators`.

## Rules

1. New links go to `/workspaces`, never `/projects`.
2. Use Table/Row terminology in code and copy.
3. Project discussion / ghost threads follow `note.ghost-threads` and Connect patterns.
4. Do not resurrect deleted GitHub-integration or AI-milestone drawers unless product asks.
