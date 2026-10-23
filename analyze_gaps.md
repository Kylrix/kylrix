# analyze_gaps.md — Loading Failures Analysis

## Root Causes

### Workspaces Never Load
`listWorkspacesTurso` queries `schema.projects` (alias for `workspaces`) filtering by `creatorId` / `ownerId`. But live Turso rows store `creator_id`; the column mapping in schema must be correct—however the `workspace_members` join or `projectObjects` may silently return empty, yielding zero results.

**Fix:** Ensure `schema.projects.creatorId` → `creator_id` is in the Drizzle schema. Then confirm `workspace_members` has rows for this user.

### Forms & Events Never Load
Turso `forms` and `events` use `creator_id` (not `user_id`). Code likely queries by `user_id`. If the schema maps `creatorId = creator_id`, the query needs to use `creatorId` not `userId` column.

**Fix:** Audit `listRows` filters for forms/events — switch filter column to `creatorId`.

### Sidekick Spawns New Session Instead of Reusing
`agentic_sessions` has both `workspace_id` and `project_id`. Sidekick lookup likely filters on the wrong column or mismatches the user's active workspace ID, creating a new session each time instead of fetching existing ones.

**Fix:** Unify session lookup to check both `workspace_id` and `project_id` in OR condition.

## No Migration Needed
All columns already exist in Turso. These are query-layer column name mismatches only — pure code fixes.
