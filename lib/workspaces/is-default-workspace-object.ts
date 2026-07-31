/**
 * Default (no-workspace) view excludes rows tagged for a named workspace.
 * Named workspace views filter via project_objects instead.
 */
export function isDefaultWorkspaceObject(row: { isWorkspace?: boolean | null }): boolean {
  return row?.isWorkspace !== true;
}
